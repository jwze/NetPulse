/**
 * IPv6 测试的纯逻辑：地址分类、评分、结论、IPv4 / IPv6 对比、分享码。
 * 不碰 DOM、不发请求，方便单测。
 */

import { KNOWN_IDS, PAIRS, SLOW, TESTS } from '../data/ipv6Hosts.ts'

export type Fam = 0 | 4 | 6
export type V6Kind = '' | 'native' | '6to4' | 'teredo'
export type Tone = 'great' | 'good' | 'ok' | 'warn' | 'bad'

export interface TestResult {
  ok: boolean
  /** 第一次响应，含 DNS、TCP、TLS */
  ms?: number
  /** 连接已就绪后的往返，取三次里最小 */
  rtt?: number
  host?: string
  ip?: string
  fam?: Fam
  asn?: number
  cc?: string
  /** 分享结果没有地址，用类型代替 */
  kind?: V6Kind
  err?: 'timeout' | 'fail' | 'abort'
}

/* ---------- 地址 ---------- */

export function famOf(ip: string | undefined | null): Fam {
  const value = ip || ''
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return 4
  if (/^[0-9a-f:.]+$/i.test(value) && value.includes(':')) return 6
  return 0
}

function fullIp(ip: string): string {
  const value = ip.toLowerCase()
  if (!value.includes(':')) return value
  const [left, right = ''] = value.split('::')
  const head = left ? left.split(':') : []
  const tail = right ? right.split(':') : []
  const fill = Array(Math.max(0, 8 - head.length - tail.length)).fill('0')
  return [...head, ...fill, ...tail].map(part => part.replace(/^0+(?=.)/, '')).join(':')
}

/** 同一个地址的不同写法（大小写、前导零、::）算相等 */
export function sameIp(a: string, b: string): boolean {
  return famOf(a) !== 0 && fullIp(a) === fullIp(b)
}

/** 原生，还是又慢又常坏的隧道 */
export function kind6(ip: string | undefined | null): V6Kind {
  if (famOf(ip) !== 6) return ''
  const first = String(ip).toLowerCase().split(':')
  if (first[0] === '2002') return '6to4'
  if (first[0] === '2001' && (first[1] === '0' || first[1] === '0000' || first[1] === '')) return 'teredo'
  return 'native'
}

/* ---------- 读响应 ---------- */

export interface Answer {
  ip?: string
  cc?: string
  colo?: string
  asn?: number
}

export function readAnswer(read: string, body: string): Answer | null {
  if (read === 'any') return {}
  if (read === 'text') {
    const ip = String(body).trim()
    return famOf(ip) ? { ip } : null
  }
  if (read === 'trace') {
    const kv: Record<string, string> = {}
    for (const line of String(body).split('\n')) {
      const at = line.indexOf('=')
      if (at > 0) kv[line.slice(0, at)] = line.slice(at + 1).trim()
    }
    return famOf(kv.ip) ? { ip: kv.ip, cc: /^[A-Z]{2}$/.test(kv.loc || '') ? kv.loc : '', colo: kv.colo || '' } : null
  }
  if (read === 'radar') {
    try {
      const json = JSON.parse(body)
      return famOf(json.ip_address)
        ? { ip: json.ip_address, asn: Number(json.asn) || 0, cc: /^[A-Z]{2}$/.test(json.country || '') ? json.country : '' }
        : null
    } catch {
      return null
    }
  }
  return null
}

/* ---------- 评分 ---------- */

export const POINTS = { v6: 4, lit6: 1, big: 2, ds: 2, prefer: 1 }

export function scoreOf(r: Record<string, TestResult>): number {
  const ok = (id: string) => !!r[id]?.ok
  if (!ok('v6') && !ok('lit6')) return 0
  let score = 0
  if (ok('v6')) score += POINTS.v6
  if (ok('lit6')) score += POINTS.lit6
  if (ok('big')) score += POINTS.big
  if (ok('ds') && (r.ds.ms ?? Infinity) <= SLOW) score += POINTS.ds
  if (ok('ds') && r.ds.fam === 6) score += POINTS.prefer
  if ((ok('v6') && (r.v6.ms ?? 0) > SLOW) || (ok('big') && (r.big.ms ?? 0) > SLOW)) score -= 1
  return Math.max(0, Math.min(10, score))
}

export type HeadKey = 'ready' | 'partly' | 'nodns' | 'none' | 'only6' | 'nat64' | 'offline'
export type ProbKey =
  | 'nodns'
  | 'mtu'
  | 'slowds'
  | 'prefer4'
  | 'slow6'
  | 'tunnel'
  | 'lit6'
  | 'v4dns'

export interface Verdict {
  score: number
  head: HeadKey
  probs: ProbKey[]
}

export function verdictOf(r: Record<string, TestResult>): Verdict {
  const ok = (id: string) => !!r[id]?.ok
  const score = scoreOf(r)
  const probs: ProbKey[] = []
  let head: HeadKey
  if (!ok('v4') && !ok('v6') && !ok('ds') && !ok('lit4') && !ok('lit6')) head = 'offline'
  else if (!ok('v6') && !ok('lit6')) head = 'none'
  else if (!ok('v6')) head = 'nodns'
  else if (!ok('v4') && !ok('lit4')) head = 'only6'
  else if (!ok('lit4')) head = 'nat64'
  else head = score >= 9 ? 'ready' : 'partly'

  if (ok('v6') || ok('lit6')) {
    if (!ok('v6')) probs.push('nodns')
    if (!ok('big')) probs.push('mtu')
    if (ok('ds') && (r.ds.ms ?? 0) > SLOW) probs.push('slowds')
    if (ok('ds') && r.ds.fam === 4) probs.push('prefer4')
    if (ok('v6') && (r.v6.ms ?? 0) > SLOW) probs.push('slow6')
    const kind = r.v6?.kind || kind6(r.v6?.ip)
    if (kind === '6to4' || kind === 'teredo') probs.push('tunnel')
    if (!ok('lit6')) probs.push('lit6')
  }
  if (!ok('v4') && ok('lit4')) probs.push('v4dns')
  return { score, head, probs }
}

export const HEAD_TEXT: Record<HeadKey, string> = {
  ready: '你的网络已经支持 IPv6',
  partly: 'IPv6 能用，但有些问题',
  nodns: 'IPv6 能通，但 DNS 不给 IPv6 地址',
  none: '没有 IPv6，只有 IPv4',
  only6: '只有 IPv6，没有 IPv4',
  nat64: '只有 IPv6，IPv4 网站由运营商转换（NAT64）',
  offline: '测试站点全都没有响应',
}

export const PROB_TEXT: Record<ProbKey, string> = {
  nodns: 'DNS 没有返回 AAAA 记录，只有 IPv6 的网站打不开。',
  mtu: 'IPv6 的大数据包被丢，部分网页卡在加载。',
  slowds: '双栈网站要先等 IPv6 超时才回落到 IPv4。',
  prefer4: '双栈网站走了 IPv4，IPv6 偏慢或代理只转发 IPv4。',
  slow6: 'IPv6 首次响应超过 3 秒。',
  tunnel: 'IPv6 走 6to4 或 Teredo 隧道，不是运营商直连。',
  lit6: '直连 IPv6 地址失败，用域名正常。',
  v4dns: 'IPv4 站点用域名打不开，用 IP 能连，问题在 DNS。',
}

export const OK_TEXT = {
  all: '全部通过',
  v4: '上网走 IPv4 正常，没有 IPv6',
  offline: '所有测试站点都没有响应',
}

/** 得分档位，页面和分享图用同一套颜色 */
export function toneOfScore(score: number): Tone {
  if (score >= 9) return 'great'
  if (score >= 7) return 'good'
  if (score >= 5) return 'ok'
  if (score >= 1) return 'warn'
  return 'bad'
}

/* ---------- IPv4 / IPv6 对比 ---------- */

export type CompareKey = 'same' | '6fast' | '6slow' | '6much' | 'no6' | 'none'

export interface Compare {
  key: CompareKey
  n: number
  v4: number | null
  v6: number | null
  diff: number
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** 差值在 10ms（或 IPv4 的 15%）以内算一样快 */
export const SAME = 10

export function compareOf(r: Record<string, TestResult>): Compare {
  const both = PAIRS
    .map(pair => [r[`${pair.id}4`], r[`${pair.id}6`]] as const)
    .filter(([a, b]) => a?.ok && b?.ok && a.rtt != null && b.rtt != null) as [TestResult, TestResult][]

  if (!both.length) {
    const any6 = PAIRS.some(pair => r[`${pair.id}6`]?.ok)
    return { key: any6 ? 'none' : 'no6', n: 0, v4: null, v6: null, diff: 0 }
  }
  const v4 = median(both.map(([a]) => a.rtt!))!
  const v6 = median(both.map(([, b]) => b.rtt!))!
  const diff = median(both.map(([a, b]) => b.rtt! - a.rtt!))!
  const same = Math.max(SAME, v4 * 0.15)
  const key: CompareKey = Math.abs(diff) <= same
    ? 'same'
    : diff < 0
      ? '6fast'
      : diff > Math.max(50, v4 * 0.5)
        ? '6much'
        : '6slow'
  return { key, n: both.length, v4, v6, diff }
}

export function cmpText(compare: Compare): string {
  const ms = Math.round(Math.abs(compare.diff) * 10) / 10
  switch (compare.key) {
    case 'same': return 'IPv6 和 IPv4 一样快'
    case '6fast': return `IPv6 比 IPv4 快 ${fmtMs(ms)} ms`
    case '6slow': return `IPv6 比 IPv4 稍慢，差 ${fmtMs(ms)} ms`
    case '6much': return `IPv6 比 IPv4 慢很多，差 ${fmtMs(ms)} ms`
    case 'no6': return '没有 IPv6，没法对比'
    default: return '没有一家网络同时用两种协议响应'
  }
}

/* ---------- 数值 ---------- */

export function fmtMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  const round = Math.round(ms * 10) / 10
  return String(round)
}

/* ---------- 分享码 ---------- */

export interface SharedResult {
  ts: number
  cc: string
  r: Record<string, TestResult>
}

const KIND_CODE: Record<string, 'n' | '6' | 't'> = { native: 'n', '6to4': '6', teredo: 't' }
const KIND_BACK: Record<string, V6Kind> = { n: 'native', 6: '6to4', t: 'teredo' }

const n36 = (v: number | undefined | null) => (v == null ? '' : Math.max(0, Math.round(v * 10)).toString(36))
const p36 = (s: string) => (s === '' ? null : /^[0-9a-z]+$/.test(s) ? parseInt(s, 36) / 10 : NaN)

/**
 * 结果链接：1~时间~国家~每项结果。只带结果本身，不含任何 IP 地址。
 * 每项：id_协议_首响应_往返_地址类型，时间单位为 0.1ms 的 36 进制。
 */
export function encodeShare(result: SharedResult): string {
  const body = Object.entries(result.r).map(([id, item]) => item?.ok
    ? [id, item.fam || '0', n36(item.ms), n36(item.rtt), KIND_CODE[item.kind || ''] || ''].join('_')
    : [id, '', '', '', ''].join('_'))
  return ['1', Math.round(result.ts / 1000).toString(36), /^[A-Z]{2}$/.test(result.cc || '') ? result.cc : '-', body.join('.')].join('~')
}

export function decodeShare(code: string): SharedResult | null {
  if (typeof code !== 'string' || code.length > 2000) return null
  const [version, ts, cc, body] = code.split('~')
  if (version !== '1' || !/^[0-9a-z]+$/.test(ts || '') || !body) return null
  const r: Record<string, TestResult> = {}
  for (const part of body.split('.')) {
    const [id, fam, ms, rtt, kind] = part.split('_')
    if (!KNOWN_IDS.has(id) || id in r) continue
    if (fam === '' || fam == null) {
      r[id] = { ok: false, err: 'fail' }
      continue
    }
    if (!/^[046]$/.test(fam) || (kind && !KIND_BACK[kind])) return null
    const first = p36(ms)
    const round = p36(rtt)
    if (first == null || Number.isNaN(first) || Number.isNaN(round)) return null
    r[id] = { ok: true, fam: Number(fam) as Fam, ms: first, kind: KIND_BACK[kind] || '', ip: '' }
    if (round != null) r[id].rtt = round
  }
  if (!Object.keys(r).length) return null
  return { ts: parseInt(ts, 36) * 1000, cc: /^[A-Z]{2}$/.test(cc) ? cc : '', r }
}

/* ---------- 行状态 ---------- */

export type RowState = 'wait' | 'ok' | 'warn' | 'bad'

/**
 * 一项测试显示成什么样：值、副标题、状态。
 * 只有 IPv6 的项在没有 IPv6 时算「不适用」，用 warn 而不是 bad。
 */
export function stateOf(id: string, r: Record<string, TestResult>): { state: RowState; main: string; sub: string } {
  const test = TESTS.find(t => t.id === id)
  const item = r[id]
  const noV6 = !!r.v6 && !r.v6.ok && !!r.lit6 && !r.lit6.ok
  if (!item) return { state: 'wait', main: '…', sub: '' }
  if (!item.ok) {
    return {
      state: test?.fam === 6 && noV6 ? 'warn' : 'bad',
      main: item.err === 'timeout' ? '超时' : '失败',
      sub: test?.fam === 6 && noV6 ? '没有 IPv6' : '',
    }
  }
  const slow = (item.ms ?? 0) > SLOW
  if (id === 'ds') {
    const fam = item.fam === 6 ? 'IPv6' : 'IPv4'
    return {
      state: item.fam === 4 && r.v6?.ok ? 'warn' : slow ? 'warn' : 'ok',
      main: `${fam} · ${fmtMs(item.rtt ?? item.ms)} ms`,
      sub: `浏览器选了 ${fam}`,
    }
  }
  return {
    state: slow ? 'warn' : 'ok',
    main: `${slow ? '慢 · ' : ''}${fmtMs(item.rtt ?? item.ms)} ms`,
    sub: item.host ? `由 ${item.host} 响应` : '',
  }
}
