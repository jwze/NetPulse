/**
 * IP 质量的数据来源：全部由浏览器直连，不需要密钥。
 * 每个来源单独超时，谁先回来就先显示谁，最后汇总评分。
 */
import type { DnsblResult, SourceData, SourceResult } from '@/utils/ipQuality'
import { parseTrace } from '@/utils/egress'

export const TIMEOUT = 7000

export interface SourceDef {
  id: string
  name: string
  /** 只有查本机地址时才跑（Cloudflare 的 trace 只知道自己这次的连接） */
  ownOnly?: boolean
  /** 只支持 IPv4 */
  v4Only?: boolean
  url: (ip: string) => string
  parse: (body: string, ownIp: string) => SourceData
  site?: (ip: string) => string
}

const upper = (value: unknown) => (/^[a-z]{2}$/i.test(String(value ?? '')) ? String(value).toUpperCase() : undefined)
const bool = (value: unknown) => (value === true || value === 'yes' || value === 1 ? true : value === false || value === 'no' || value === 0 ? false : undefined)
const num = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) && value !== null && value !== '' ? Math.max(0, Math.min(100, Math.round(n))) : undefined
}
const asnOf = (value: unknown) => {
  const match = /(\d+)/.exec(String(value ?? ''))
  return match ? Number(match[1]) : undefined
}

export function mapType(value: unknown): SourceData['type'] {
  const text = String(value || '').toLowerCase()
  if (!text) return undefined
  if (/hosting|data ?cent|datacenter|\bdch\b|cdn|content delivery|transit|server|cloud/.test(text)) return 'hosting'
  if (/mobile|wireless|cellular|\bmob\b/.test(text)) return 'mobile'
  if (/residential|fixed line|\bisp\b|broadband|dsl|cable|home/.test(text)) return 'residential'
  if (/educat|universit|college|school|\bedu\b/.test(text)) return 'education'
  if (/government|\bgov\b|military|\bmil\b/.test(text)) return 'government'
  if (/business|commercial|corporate|organi[sz]ation|\bcom\b|search engine|library/.test(text)) return 'business'
  return undefined
}

/** 英文国家名 → 代码，给只给名字的来源用 */
let ccCache: Map<string, string> | null = null
export function ccOfName(name: unknown): string | undefined {
  if (!name) return undefined
  if (!ccCache) {
    ccCache = new Map()
    try {
      const display = new Intl.DisplayNames(['en'], { type: 'region' })
      for (const a of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        for (const b of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
          const label = display.of(a + b)
          if (label && label !== a + b) ccCache.set(label.toLowerCase(), a + b)
        }
      }
    } catch {
      // 老环境没有 Intl.DisplayNames，只靠下面的别名
    }
    for (const [label, code] of [
      ['hong kong', 'HK'], ['macau', 'MO'], ['macao', 'MO'], ['taiwan', 'TW'], ['czech republic', 'CZ'],
      ['turkey', 'TR'], ['united states of america', 'US'], ['russian federation', 'RU'], ['republic of korea', 'KR'],
      ['viet nam', 'VN'],
    ]) ccCache.set(label, code)
  }
  return ccCache.get(String(name).toLowerCase())
}

export const SOURCES: SourceDef[] = [
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    ownOnly: true,
    url: () => 'https://www.cloudflare.com/cdn-cgi/trace',
    parse: text => {
      const trace = parseTrace(text)
      return { cc: upper(trace.loc), anycast: true }
    },
    site: () => 'https://radar.cloudflare.com/ip',
  },
  {
    id: 'ipwho',
    name: 'ipwho.is',
    url: ip => `https://ipwho.is/${ip}`,
    parse: text => {
      const data = JSON.parse(text)
      if (data.success === false) throw new Error(data.message || 'fail')
      const conn = data.connection || {}
      return { cc: upper(data.country_code), city: data.city, asn: asnOf(conn.asn), org: conn.org || conn.isp }
    },
    site: ip => `https://ipwho.is/${ip}`,
  },
  {
    id: 'ipapico',
    name: 'ipapi.co',
    url: ip => `https://ipapi.co/${ip}/json/`,
    parse: text => {
      const data = JSON.parse(text)
      if (data.error) throw new Error(String(data.reason || 'fail'))
      return { cc: upper(data.country_code), city: data.city, asn: asnOf(data.asn), org: data.org }
    },
    site: ip => `https://ipapi.co/${ip}/`,
  },
  {
    id: 'ipsb',
    name: 'IP.SB',
    url: ip => `https://api.ip.sb/geoip/${ip}`,
    parse: text => {
      const data = JSON.parse(text)
      return { cc: upper(data.country_code), city: data.city, asn: asnOf(data.asn), org: data.asn_organization || data.isp }
    },
    site: ip => `https://ip.sb/ip/${ip}`,
  },
  {
    id: 'geojs',
    name: 'GeoJS',
    url: ip => `https://get.geojs.io/v1/ip/geo/${ip}.json`,
    parse: text => {
      const data = JSON.parse(text)
      return { cc: upper(data.country_code), city: data.city, asn: asnOf(data.asn), org: data.organization_name }
    },
    site: () => 'https://www.geojs.io/',
  },
  {
    id: 'iplocation',
    name: 'iplocation.net',
    url: ip => `https://api.iplocation.net/?ip=${encodeURIComponent(ip)}`,
    parse: text => {
      const data = JSON.parse(text)
      if (String(data.response_code) !== '200') throw new Error(data.response_message || 'fail')
      return { cc: upper(data.country_code2), org: data.isp }
    },
    site: ip => `https://www.iplocation.net/ip-lookup?query=${ip}`,
  },
  {
    id: 'ipquery',
    name: 'IPQuery',
    url: ip => `https://api.ipquery.io/${ip}`,
    parse: text => {
      const data = JSON.parse(text)
      const risk = data.risk || {}
      const isp = data.isp || {}
      const loc = data.location || {}
      return {
        cc: upper(loc.country_code),
        city: loc.city,
        asn: asnOf(isp.asn),
        org: isp.org || isp.isp,
        type: risk.is_datacenter ? 'hosting' : risk.is_mobile ? 'mobile' : undefined,
        proxy: bool(risk.is_proxy),
        vpn: bool(risk.is_vpn),
        tor: bool(risk.is_tor),
        risk: num(risk.risk_score),
      }
    },
    site: ip => `https://ipquery.io/?ip=${ip}`,
  },
  {
    id: 'ipapiis',
    name: 'ipapi.is',
    url: ip => `https://api.ipapi.is/?q=${ip}`,
    parse: text => {
      const data = JSON.parse(text)
      if (data.error) throw new Error(String(data.error))
      const system = typeof data.asn === 'object' && data.asn ? data.asn : {}
      const company = typeof data.company === 'object' && data.company ? data.company : {}
      const loc = data.location || {}
      return {
        cc: upper(loc.country_code) || ccOfName(data.country),
        city: loc.city || data.city,
        asn: system.asn || asnOf(data.asn),
        org: company.name || (typeof data.company === 'string' ? data.company : undefined) || system.org,
        type: data.is_datacenter ? 'hosting' : data.is_mobile ? 'mobile' : mapType(company.type || system.type),
        proxy: bool(data.is_proxy),
        vpn: bool(data.is_vpn),
        tor: bool(data.is_tor),
        abuser: bool(data.is_abuser),
        rir: system.rir,
      }
    },
    site: ip => `https://ipapi.is/?q=${ip}`,
  },
  {
    id: 'rdap',
    name: 'RDAP（注册局）',
    url: ip => `https://rdap.arin.net/registry/ip/${ip}`,
    parse: text => {
      const data = JSON.parse(text)
      const port = String(data.port43 || '').match(/whois\.(\w+)\./)
      const notice = (data.notices || [])
        .flatMap((item: { description?: string[] }) => item.description || [])
        .join(' ')
        .match(/\b(APNIC|RIPE|ARIN|LACNIC|AFRINIC)\b/i)
      const rir = port?.[1] || notice?.[1] || ''
      const registered = (data.events || []).find((event: { eventAction?: string }) => event.eventAction === 'registration')
      const extra: [string, string][] = []
      if (data.name) extra.push(['网络名', data.name])
      if (data.startAddress && data.endAddress) extra.push(['地址段', `${data.startAddress} – ${data.endAddress}`])
      return {
        regCc: upper(data.country),
        regName: data.name,
        regDate: registered ? String(registered.eventDate).slice(0, 10) : undefined,
        rir: rir ? String(rir).toUpperCase() : undefined,
        extra,
      }
    },
    site: ip => `https://client.rdap.org/?type=ip&object=${ip}`,
  },
  {
    id: 'ipguide',
    name: 'ip.guide',
    url: ip => `https://ip.guide/${ip}`,
    parse: text => {
      const data = JSON.parse(text)
      const net = data.network || {}
      const system = net.autonomous_system || {}
      return {
        asn: system.asn,
        org: system.organization || system.name,
        asCc: upper(system.country),
        rir: system.rir,
        extra: net.cidr ? [['前缀', net.cidr]] : [],
      }
    },
    site: ip => `https://ip.guide/${ip}`,
  },
  {
    id: 'shodan',
    name: 'Shodan InternetDB',
    v4Only: true,
    url: ip => `https://internetdb.shodan.io/${ip}`,
    parse: text => {
      const data = JSON.parse(text)
      const tags: string[] = data.tags || []
      return {
        ports: (data.ports || []).slice(0, 30),
        tags,
        host: (data.hostnames || [])[0],
        vpn: tags.includes('vpn') || undefined,
        proxy: tags.includes('proxy') || undefined,
        tor: tags.includes('tor') || undefined,
        abuser: tags.some(tag => ['compromised', 'malware', 'c2', 'botnet'].includes(tag)) || undefined,
        extra: data.vulns?.length ? [['漏洞', String(data.vulns.length)]] : undefined,
      }
    },
    site: ip => `https://www.shodan.io/host/${ip}`,
  },
]

export const DNSBL = [
  { id: 'spamcop', name: 'SpamCop', zone: 'bl.spamcop.net' },
  { id: 'barracuda', name: 'Barracuda', zone: 'b.barracudacentral.org' },
  { id: 'psbl', name: 'PSBL', zone: 'psbl.surriel.com' },
  { id: 'mailspike', name: 'Mailspike', zone: 'bl.mailspike.net' },
  { id: 'uceprotect', name: 'UCEPROTECT L1', zone: 'dnsbl-1.uceprotect.net' },
  { id: 'gbudb', name: 'GBUdb', zone: 'truncate.gbudb.net' },
  { id: 'blocklistde', name: 'blocklist.de', zone: 'bl.blocklist.de' },
  { id: 'anonmails', name: 'Anonmails', zone: 'spam.dnsbl.anonmails.de' },
]

export const ELSEWHERE: [string, (ip: string) => string][] = [
  ['Scamalytics', ip => `https://scamalytics.com/ip/${ip}`],
  ['IPQualityScore', ip => `https://www.ipqualityscore.com/free-ip-lookup-proxy-vpn-test/lookup/${ip}`],
  ['AbuseIPDB', ip => `https://www.abuseipdb.com/check/${ip}`],
  ['Spur', ip => `https://spur.us/context/${ip}`],
  ['ping0', ip => `https://ping0.cc/ip/${ip}`],
  ['IPinfo', ip => `https://ipinfo.io/${ip}`],
  ['bgp.tools', ip => `https://bgp.tools/prefix/${ip}`],
  ['VirusTotal', ip => `https://www.virustotal.com/gui/ip-address/${ip}`],
]

async function getText(url: string, timeout = TIMEOUT) {
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(timeout),
  })
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return response.text()
}

export async function fetchOwnIp(): Promise<{ ip: string; data: SourceData }> {
  const text = await getText('https://ipwho.is/', 6000)
  const data = JSON.parse(text)
  if (!data.ip) throw new Error('没有取到本机出口地址')
  const conn = data.connection || {}
  return {
    ip: String(data.ip),
    data: { cc: upper(data.country_code), city: data.city, asn: asnOf(conn.asn), org: conn.org || conn.isp },
  }
}

export async function runSource(
  source: SourceDef,
  ip: string,
  own: { ip: string; data: SourceData },
): Promise<SourceResult> {
  if (source.ownOnly && ip !== own.ip) return { id: source.id, name: source.name, error: 'skip', ms: 0 }
  if (source.v4Only && ip.includes(':')) return { id: source.id, name: source.name, error: 'skip', ms: 0 }
  const started = performance.now()
  try {
    const text = await getText(source.url(ip))
    const data = source.parse(text, own.ip)
    return { id: source.id, name: source.name, data, ms: Math.round(performance.now() - started) }
  } catch (error) {
    return {
      id: source.id,
      name: source.name,
      error: (error as Error).message || 'fail',
      ms: Math.round(performance.now() - started),
    }
  }
}

/** 一个黑名单：A 记录落在 127.0.0.0/8 且不是 127.255.255.x 就算列出 */
export async function checkDnsbl(ip: string): Promise<DnsblResult[]> {
  if (ip.includes(':')) return DNSBL.map(item => ({ ...item, listed: null }))
  const reversed = ip.split('.').reverse().join('.')
  return Promise.all(
    DNSBL.map(async item => {
      try {
        const text = await getText(
          `https://dns.alidns.com/resolve?name=${encodeURIComponent(`${reversed}.${item.zone}`)}&type=A`,
          6000,
        )
        const data = JSON.parse(text)
        const answers: string[] = (data.Answer || []).map((answer: { data?: string }) => String(answer.data || ''))
        const codes = answers.filter(answer => /^127\.\d+\.\d+\.\d+$/.test(answer))
        const real = codes.filter(code => !code.startsWith('127.255.255.'))
        return { ...item, listed: real.length > 0, codes: real }
      } catch {
        return { ...item, listed: null }
      }
    }),
  )
}

export function isPrivateIp(ip: string) {
  if (ip.includes(':')) return /^(::1|fe80:|fc|fd|::ffff:)/i.test(ip)
  const [a, b] = ip.split('.').map(Number)
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0 ||
    a >= 224
  )
}

export function validIp(value: string) {
  const text = value.trim()
  if (!text) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(text)) {
    return text.split('.').every(part => Number(part) <= 255) && !isPrivateIp(text)
  }
  return /^[0-9a-f:]+$/i.test(text) && text.includes(':') && text.length <= 39 && !isPrivateIp(text)
}
