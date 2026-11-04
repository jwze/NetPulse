/**
 * 采集浏览器侧的连接与设备信息，全部来自标准 Web API，无任何请求外发。
 */

interface UABrand {
  brand: string
  version: string
}

interface UAData {
  brands?: UABrand[]
  mobile?: boolean
  platform?: string
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>
}

interface ConnectionLike {
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
  type?: string
}

export interface ClientInfo {
  /** 当前页面使用的 HTTP 协议版本：h3 / h2 / http/1.1 */
  protocol: string
  effectiveType: string
  downlink: number | null
  rtt: number | null
  saveData: boolean | null
  browser: string
  platform: string
  mobile: boolean | null
  language: string
  timezone: string
  cores: number | null
  memory: number | null
  screen: string
  dpr: number
  architecture: string
  model: string
}

function detectBrowser(ua: string) {
  const rules: [RegExp, string][] = [
    [/Edg\/([\d.]+)/, 'Edge'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Version\/([\d.]+).*Safari/, 'Safari'],
  ]
  for (const [pattern, name] of rules) {
    const match = ua.match(pattern)
    if (match) return `${name} ${match[1].split('.').slice(0, 3).join('.')}`
  }
  return '未知浏览器'
}

function detectPlatform(ua: string) {
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Android/.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS / iPadOS'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Linux/.test(ua)) return 'Linux'
  return '未知平台'
}

function navProtocol() {
  try {
    const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    return entry?.nextHopProtocol || '未知'
  } catch {
    return '未知'
  }
}

export function collectClientInfo(): ClientInfo {
  const ua = navigator.userAgent
  const nav = navigator as Navigator & {
    connection?: ConnectionLike
    deviceMemory?: number
    userAgentData?: UAData
  }
  const conn = nav.connection || {}
  return {
    protocol: navProtocol(),
    effectiveType: conn.effectiveType || '未知',
    downlink: typeof conn.downlink === 'number' ? conn.downlink : null,
    rtt: typeof conn.rtt === 'number' ? conn.rtt : null,
    saveData: typeof conn.saveData === 'boolean' ? conn.saveData : null,
    browser: detectBrowser(ua),
    platform: nav.userAgentData?.platform || detectPlatform(ua),
    mobile: typeof nav.userAgentData?.mobile === 'boolean' ? nav.userAgentData.mobile : null,
    language: navigator.language || '未知',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '未知',
    cores: typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null,
    memory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    screen: `${window.screen.width} × ${window.screen.height}`,
    dpr: window.devicePixelRatio || 1,
    architecture: '',
    model: '',
  }
}

/** UA-CH 高熵字段只在高版本 Chromium 的 HTTPS 环境下可用 */
export async function enrichClientInfo(info: ClientInfo): Promise<ClientInfo> {
  const nav = navigator as Navigator & { userAgentData?: UAData }
  const getter = nav.userAgentData?.getHighEntropyValues
  if (!getter) return info
  try {
    const values = await getter.call(nav.userAgentData, ['architecture', 'bitness', 'model', 'platformVersion'])
    const arch = [values.architecture, values.bitness].filter(Boolean).join(' ')
    return {
      ...info,
      architecture: typeof arch === 'string' ? arch : '',
      model: typeof values.model === 'string' ? values.model : '',
    }
  } catch {
    return info
  }
}

export function connectionQuality(info: ClientInfo) {
  if (info.effectiveType === '4g' && (info.rtt ?? 999) <= 80) return { label: '良好', tone: 'good' }
  if (info.effectiveType === '4g' || info.effectiveType === '3g') return { label: '一般', tone: 'ok' }
  if (info.effectiveType === '2g' || info.effectiveType === 'slow-2g') return { label: '较差', tone: 'bad' }
  return { label: '未知', tone: 'none' }
}
