/**
 * DNS over HTTPS 查询：纯前端，无需后端。
 * 逐家查询并对比结果，可以直观看出不同解析器给出的答案差异（CDN 调度 / 污染 / 劫持）。
 */
import { linkSignals, elapsed } from '@/utils/abort'

export type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS'

export const DNS_TYPES: DnsRecordType[] = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS']

const TYPE_CODE: Record<DnsRecordType, number> = {
  A: 1,
  AAAA: 28,
  CNAME: 5,
  MX: 15,
  TXT: 16,
  NS: 2,
}

const CODE_LABEL: Record<number, string> = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA',
  41: 'OPT',
  257: 'CAA',
}

export interface DnsAnswer {
  name: string
  type: string
  ttl: number
  data: string
}

export interface DnsProvider {
  id: 'ali' | 'cloudflare' | 'google'
  label: string
  hint: string
  build: (name: string, type: DnsRecordType) => string
  /** 该解析器使用数字 type 还是字母 type */
  numericType: boolean
  jsonAccept: boolean
}

export const DNS_PROVIDERS: DnsProvider[] = [
  {
    id: 'ali',
    label: '阿里 DNS',
    hint: '国内递归',
    build: (name, type) => `https://dns.alidns.com/resolve?name=${encodeURIComponent(name)}&type=${TYPE_CODE[type]}`,
    numericType: true,
    jsonAccept: false,
  },
  {
    id: 'cloudflare',
    label: 'Cloudflare',
    hint: '海外递归',
    build: (name, type) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    numericType: false,
    jsonAccept: true,
  },
  {
    id: 'google',
    label: 'Google',
    hint: '海外递归',
    build: (name, type) => `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
    numericType: false,
    jsonAccept: true,
  },
]

export interface DnsResult {
  providerId: DnsProvider['id']
  label: string
  hint: string
  ok: boolean
  ms: number | null
  status: number | null
  answers: DnsAnswer[]
  error: string
}

interface DohPayload {
  Status?: number
  Answer?: { name?: string; type?: number; TTL?: number; data?: string }[]
}

export function normalizeDomain(input: string) {
  return input
    .trim()
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split('?')[0]
    .replace(/\.$/, '')
    .toLowerCase()
}

export function isValidDomain(domain: string) {
  if (!domain || domain.length > 253) return false
  return /^(?=.{1,253}$)([a-zA-Z0-9_]([a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?\.)+[a-zA-Z]{2,63}$/.test(domain)
}

export function statusText(status: number | null) {
  if (status === null) return '查询失败'
  if (status === 0) return 'NOERROR'
  if (status === 3) return 'NXDOMAIN'
  if (status === 2) return 'SERVFAIL'
  if (status === 5) return 'REFUSED'
  return `RCODE ${status}`
}

export async function queryProvider(
  provider: DnsProvider,
  domain: string,
  type: DnsRecordType,
  timeout = 5000,
  outer?: AbortSignal,
): Promise<DnsResult> {
  const link = linkSignals(timeout, outer)
  const start = performance.now()
  const base = { providerId: provider.id, label: provider.label, hint: provider.hint }
  try {
    const resp = await fetch(provider.build(domain, type), {
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: provider.jsonAccept ? { accept: 'application/dns-json' } : undefined,
      signal: link.signal,
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = (await resp.json()) as DohPayload
    const answers: DnsAnswer[] = (data.Answer || []).map(item => ({
      name: (item.name || '').replace(/\.$/, ''),
      type: CODE_LABEL[item.type || 0] || String(item.type ?? ''),
      ttl: typeof item.TTL === 'number' ? item.TTL : 0,
      data: String(item.data ?? ''),
    }))
    return {
      ...base,
      ok: true,
      ms: elapsed(start),
      status: typeof data.Status === 'number' ? data.Status : null,
      answers,
      error: '',
    }
  } catch (err) {
    const aborted = outer?.aborted
    return {
      ...base,
      ok: false,
      ms: null,
      status: null,
      answers: [],
      error: aborted ? '已取消' : err instanceof Error && err.message.includes('HTTP') ? err.message : '无响应或被拦截',
    }
  } finally {
    link.release()
  }
}

export async function queryAll(
  domain: string,
  type: DnsRecordType,
  timeout = 5000,
  outer?: AbortSignal,
): Promise<DnsResult[]> {
  return Promise.all(DNS_PROVIDERS.map(provider => queryProvider(provider, domain, type, timeout, outer)))
}

/** 忽略顺序比对解析结果，用于提示「各家答案是否一致」 */
export function answersSignature(answers: DnsAnswer[]) {
  return answers
    .map(item => item.data.replace(/\s+/g, ' ').trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('|')
}
