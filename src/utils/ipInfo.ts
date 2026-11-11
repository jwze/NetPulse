/**
 * 出口 IP 查询：全部走公开接口，无自有后端。
 * 主接口 ipwho.is（字段最全，含 ASN 与风控标记，lang=zh-CN 拿中文地名），
 * 失败回退 ipapi.co。按 IP 结果缓存，出口不变就不重复问。
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
    const resp = await fetch('https://ipwho.is/?lang=zh-CN', {
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

/* ---------- 指定 IP 的归属（出口地址卡用） ---------- */

/** ipwho.is 免费额度按域名计 1000 次/天，出口没变就不该重复问 */
const GEO_TTL = 30 * 60 * 1000
const GEO_KEY = 'np:exit-geo:v1'

/** 出口卡之外还有别的卡片在问 ipwho，这里再留一道闸：一小时最多 30 次 */
const GEO_BUDGET = 30
const GEO_WINDOW = 60 * 60 * 1000
const spent: number[] = []

function takeBudget() {
  const now = Date.now()
  while (spent.length && now - spent[0] > GEO_WINDOW) spent.shift()
  if (spent.length >= GEO_BUDGET) return false
  spent.push(now)
  return true
}

interface GeoEntry {
  at: number
  info: IpInfo
}

function readGeoCache(): Record<string, GeoEntry> {
  try {
    const raw = sessionStorage.getItem(GEO_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as Record<string, GeoEntry>
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

function saveGeoCache(ip: string, info: IpInfo) {
  try {
    const all = readGeoCache()
    all[ip] = { at: Date.now(), info }
    sessionStorage.setItem(GEO_KEY, JSON.stringify(all))
  } catch {
    // 隐私模式下写不进去，只是少了缓存
  }
}

/** 地址直接进路径，IPv6 的冒号不转义也能命中 */
function ipPath(ip: string) {
  return /^[0-9a-f:.]+$/i.test(ip) ? ip : encodeURIComponent(ip)
}

async function queryIpwho(ip: string, signal?: AbortSignal): Promise<IpInfo> {
  const resp = await fetch(`https://ipwho.is/${ipPath(ip)}?lang=zh-CN`, {
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    signal,
  })
  if (!resp.ok) throw new Error(`ipwho ${resp.status}`)
  const data = (await resp.json()) as IpwhoResponse
  if (data?.success === false || !data?.ip) throw new Error('ipwho 未返回结果')
  return normalizeIpwho(data)
}

async function queryIpapi(ip: string, signal?: AbortSignal): Promise<IpInfo> {
  const resp = await fetch(`https://ipapi.co/${ipPath(ip)}/json/`, {
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    signal,
  })
  if (!resp.ok) throw new Error(`ipapi ${resp.status}`)
  const data = (await resp.json()) as IpapiResponse
  if (!data?.ip) throw new Error('ipapi 未返回结果')
  return normalizeIpapi(data)
}

/**
 * 查某个地址的归属。走缓存；两个接口都不通时，把上一次的结果交回去，
 * 没有就返回 null（界面显示「—」，不编造）。
 */
export async function fetchIpInfoOf(ip: string, signal?: AbortSignal): Promise<IpInfo | null> {
  const target = (ip || '').trim()
  if (!target) return null
  const cached = readGeoCache()[target]
  if (cached && Date.now() - cached.at < GEO_TTL) return cached.info
  if (!takeBudget()) return cached?.info ?? null

  for (const query of [queryIpwho, queryIpapi]) {
    if (signal?.aborted) break
    try {
      const info = await query(target, signal)
      saveGeoCache(target, info)
      return info
    } catch {
      // 换下一个接口
    }
  }
  return cached?.info ?? null
}

