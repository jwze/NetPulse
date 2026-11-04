/**
 * 出口 IP 查询：全部走公开接口，无自有后端。
 * 主接口 ipwho.is（字段最全，含 ASN 与风控标记），失败回退 ipapi.co。
 */

export interface IpInfo {
  ip: string
  version: 'IPv4' | 'IPv6' | '未知'
  country: string
  countryCode: string
  region: string
  city: string
  timezone: string
  utcOffset: string
  asn: number | null
  asnOrg: string
  isp: string
  domain: string
  /** 机房 / 云主机 IP，常见于代理与爬虫 */
  isHosting: boolean | null
  isProxy: boolean | null
  isVpn: boolean | null
  isTor: boolean | null
  /** 组装好的展示串：国家 城市 · 运营商 */
  displayAddress: string
  source: 'ipwho.is' | 'ipapi.co'
}

interface IpwhoResponse {
  success?: boolean
  ip?: string
  type?: string
  country?: string
  country_code?: string
  region?: string
  city?: string
  connection?: { asn?: number; org?: string; isp?: string; domain?: string }
  timezone?: { id?: string; utc?: string }
  security?: { proxy?: boolean; vpn?: boolean; tor?: boolean; hosting?: boolean }
}

interface IpapiResponse {
  ip?: string
  version?: string
  country_name?: string
  country_code?: string
  region?: string
  city?: string
  org?: string
  asn?: string
  timezone?: string
  utc_offset?: string
}

/** 国家码转中文名，纯前端、无需接口 */
export function countryName(code: string | undefined, fallback: string | undefined) {
  if (code) {
    try {
      const display = new Intl.DisplayNames(['zh-CN'], { type: 'region' }).of(code)
      if (display && display !== code) return display
    } catch {
      // 不支持 Intl.DisplayNames 的环境直接用 fallback
    }
  }
  return fallback || ''
}

/** 运营商名称太长，去掉通用后缀 */
export function shortenIsp(isp: string) {
  return isp
    .replace(/\b(communications?|corporation|corp\.?|co\.?,?\s*ltd\.?|limited|ltd\.?|inc\.?|group|company|holding|technologies|technology)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 28)
}

function composeAddress(country: string, region: string, city: string, isp: string) {
  const parts: string[] = []
  const push = (value?: string) => {
    const text = (value || '').trim()
    if (!text) return
    if (parts.some(item => item.toLowerCase() === text.toLowerCase())) return
    parts.push(text)
  }
  push(country)
  push(city && city !== region ? city : region)
  const area = parts.join(' ')
  const carrier = shortenIsp(isp)
  return carrier ? `${area} · ${carrier}` : area
}

function guessVersion(ip: string): IpInfo['version'] {
  if (!ip) return '未知'
  return ip.includes(':') ? 'IPv6' : 'IPv4'
}

function normalizeIpwho(data: IpwhoResponse): IpInfo {
  const country = countryName(data.country_code, data.country)
  const isp = data.connection?.isp || data.connection?.org || ''
  const ip = String(data.ip)
  return {
    ip,
    version: (data.type as IpInfo['version']) || guessVersion(ip),
    country,
    countryCode: (data.country_code || '').toUpperCase(),
    region: data.region || '',
    city: data.city || '',
    timezone: data.timezone?.id || '',
    utcOffset: data.timezone?.utc || '',
    asn: typeof data.connection?.asn === 'number' ? data.connection.asn : null,
    asnOrg: data.connection?.org || '',
    isp,
    domain: data.connection?.domain || '',
    isHosting: data.security?.hosting ?? null,
    isProxy: data.security?.proxy ?? null,
    isVpn: data.security?.vpn ?? null,
    isTor: data.security?.tor ?? null,
    displayAddress: composeAddress(country, data.region || '', data.city || '', isp) || ip,
    source: 'ipwho.is',
  }
}

function normalizeIpapi(data: IpapiResponse): IpInfo {
  const country = countryName(data.country_code, data.country_name)
  const ip = String(data.ip)
  const asn = data.asn ? Number(String(data.asn).replace(/^AS/i, '')) : null
  return {
    ip,
    version: guessVersion(ip),
    country,
    countryCode: (data.country_code || '').toUpperCase(),
    region: data.region || '',
    city: data.city || '',
    timezone: data.timezone || '',
    utcOffset: data.utc_offset || '',
    asn: Number.isFinite(asn) ? asn : null,
    asnOrg: data.org || '',
    isp: data.org || '',
    domain: '',
    isHosting: null,
    isProxy: null,
    isVpn: null,
    isTor: null,
    displayAddress: composeAddress(country, data.region || '', data.city || '', data.org || '') || ip,
    source: 'ipapi.co',
  }
}

export async function fetchIpInfo(signal?: AbortSignal): Promise<IpInfo> {
  try {
    const resp = await fetch('https://ipwho.is/', {
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal,
    })
    if (!resp.ok) throw new Error(`ipwho ${resp.status}`)
    const data = (await resp.json()) as IpwhoResponse
    if (data?.success === false || !data?.ip) throw new Error('ipwho 未返回结果')
    return normalizeIpwho(data)
  } catch (err) {
    if (signal?.aborted) throw err
    const resp = await fetch('https://ipapi.co/json/', {
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal,
    })
    if (!resp.ok) throw new Error(`ipapi ${resp.status}`)
    const data = (await resp.json()) as IpapiResponse
    if (!data?.ip) throw new Error('ipapi 未返回结果')
    return normalizeIpapi(data)
  }
}
