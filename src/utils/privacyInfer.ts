/**
 * 隐私画像里「读数说明什么」的纯逻辑：系统、浏览器、显卡、键盘布局、屏幕物理尺寸、
 * 指纹浏览器的破绽、环境评分。不碰 DOM，便于单元测试。
 */
import { TZ_CC } from '../data/tzCountries.ts'
import { looksLikeDatacenter } from './latency.ts'

/** 机房、云主机、VPN 运营商的网络名 */
export const looksLikeDatacenterOrg = (org?: string | null) => looksLikeDatacenter(String(org || ''))

/* ---------- 语言 → 国家 ---------- */

const LANG_CC: Record<string, string> = {
  ja: 'JP', ko: 'KR', de: 'DE', fr: 'FR', it: 'IT', ru: 'RU', uk: 'UA', pl: 'PL', nl: 'NL', tr: 'TR', vi: 'VN',
  th: 'TH', id: 'ID', ms: 'MY', he: 'IL', fa: 'IR', el: 'GR', cs: 'CZ', sk: 'SK', hu: 'HU', ro: 'RO', bg: 'BG',
  sv: 'SE', da: 'DK', nb: 'NO', no: 'NO', fi: 'FI', et: 'EE', lv: 'LV', lt: 'LT', sl: 'SI', hr: 'HR', sr: 'RS',
  ka: 'GE', hy: 'AM', kk: 'KZ', uz: 'UZ', bn: 'BD', hi: 'IN', ta: 'IN', te: 'IN', mr: 'IN', ur: 'PK', km: 'KH',
  lo: 'LA', my: 'MM', mn: 'MN', ne: 'NP', si: 'LK', fil: 'PH', tl: 'PH',
}

const SPOKEN: Record<string, string[]> = {
  zh: ['CN', 'SG', 'MY'],
  'zh-Hant': ['TW', 'HK', 'MO'],
  es: ['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'PR', 'US', 'GQ'],
  pt: ['PT', 'BR', 'AO', 'MZ', 'CV', 'GW', 'ST', 'TL'],
  fr: ['FR', 'BE', 'CH', 'CA', 'LU', 'MC', 'SN', 'CI', 'CM', 'CD', 'MA', 'DZ', 'TN', 'HT', 'MG', 'ML', 'BF', 'NE', 'BJ', 'TG', 'GA', 'CG'],
  de: ['DE', 'AT', 'CH', 'LI', 'LU', 'BE'],
  it: ['IT', 'CH', 'SM', 'VA'],
  nl: ['NL', 'BE', 'SR'],
  sv: ['SE', 'FI'],
  ru: ['RU', 'BY', 'KZ', 'KG', 'UA', 'MD'],
  ar: ['SA', 'AE', 'EG', 'MA', 'DZ', 'TN', 'IQ', 'JO', 'LB', 'SY', 'KW', 'QA', 'BH', 'OM', 'YE', 'LY', 'SD', 'PS', 'MR'],
  ms: ['MY', 'BN', 'SG', 'ID'],
  ta: ['IN', 'LK', 'SG', 'MY'],
  tr: ['TR', 'CY'],
  el: ['GR', 'CY'],
  ro: ['RO', 'MD'],
  sr: ['RS', 'BA', 'ME'],
  hr: ['HR', 'BA'],
  fa: ['IR', 'AF', 'TJ'],
  ur: ['PK', 'IN'],
  bn: ['BD', 'IN'],
  ko: ['KR', 'KP'],
  he: ['IL'],
  uk: ['UA'],
  hi: ['IN'],
  sw: ['KE', 'TZ', 'UG'],
}

export function langCC(tag?: string | null): string | null {
  if (!tag) return null
  const parts = String(tag).split(/[-_]/)
  const base = parts[0].toLowerCase()
  const region = parts.slice(1).find(x => /^[A-Za-z]{2}$/.test(x))
  if (region) return region.toUpperCase()
  if (base === 'zh') return /hant/i.test(tag) ? 'TW' : 'CN'
  return LANG_CC[base] || null
}

export function spokenIn(tag?: string | null): string[] {
  if (!tag) return []
  const base = String(tag).split(/[-_]/)[0].toLowerCase()
  const key = base === 'zh' && /hant|-(tw|hk|mo)\b/i.test(tag) ? 'zh-Hant' : base
  const own = langCC(tag)
  return [...new Set([...(own ? [own] : []), ...(SPOKEN[key] || [])])]
}

/** 同一个国家语言的其他国家：简中还有新加坡和马来西亚，繁中还有港澳 */
export function sameLanguage(cc: string): string[] {
  const out = new Set([cc])
  for (const [key, list] of Object.entries(SPOKEN)) {
    if (list[0] !== cc) continue
    for (const code of spokenIn(key === 'zh-Hant' ? 'zh-TW' : key)) out.add(code)
  }
  return [...out]
}

export const tzCC = (tz?: string | null) => (tz ? TZ_CC[tz] || null : null)

/* ---------- 国籍推断 ---------- */

export interface Nationality {
  cc: string
  from: string[]
}

export function nationality(input: { langs?: string[]; tz?: string; ipcc?: string; ios?: boolean }): Nationality | null {
  const langs = input.langs || []
  const first = langs[0] || ''
  const lcc = langCC(first)
  const tcc = tzCC(input.tz)
  const english = (l: string) => /^en\b/i.test(l || '')
  const plainEn = input.ios ? /^en$/i.test(first) : english(first)
  if (lcc && !plainEn) {
    return tcc && tcc !== lcc && lcc !== input.ipcc && spokenIn(first).includes(tcc)
      ? { cc: tcc, from: ['langs', 'tz'] }
      : { cc: lcc, from: tcc === lcc ? ['langs', 'tz'] : ['langs'] }
  }
  const tag = langs.slice(1).find(l => !english(l) && langCC(l))
  const other = tag && langCC(tag)
  if (other) {
    return tcc && tcc !== other && other !== input.ipcc && spokenIn(tag).includes(tcc)
      ? { cc: tcc, from: ['langs', 'tz'] }
      : { cc: other, from: tcc === other ? ['langs', 'tz'] : ['langs'] }
  }
  if (tcc) return { cc: tcc, from: ['tz'] }
  if (lcc) return { cc: lcc, from: ['langs'] }
  return input.ipcc ? { cc: input.ipcc, from: ['geo'] } : null
}

/* ---------- 系统与浏览器 ---------- */

export interface DeviceInfo {
  os: string | null
  osv: string
  kind: 'pc' | 'mac' | 'phone' | 'tablet'
  model: string
}

interface Hints {
  platform?: string
  platformVersion?: string
  mobile?: boolean
  model?: string
}

export function device(ua = '', hi: Hints = {}, touch = 0): DeviceInfo {
  let os: string | null = null
  let osv = ''
  let kind: DeviceInfo['kind'] = 'pc'
  let model = hi.model || ''
  const plat = hi.platform || ''
  const pv = hi.platformVersion || ''
  if (/^(HarmonyOS|OpenHarmony)$/i.test(plat) || /OpenHarmony|HarmonyOS|ArkWeb/.test(ua)) {
    os = 'HarmonyOS'
    const v = ua.match(/(?:OpenHarmony|HarmonyOS)[ /]?(\d+(?:\.\d+)?)/)
    osv = pv ? pv.split('.').slice(0, 2).join('.').replace(/\.0$/, '') : v ? v[1] : ''
    kind = /\(Phone;/.test(ua) ? 'phone' : /\(Tablet;/.test(ua) ? 'tablet' : /\(PC;/.test(ua) ? 'pc' : /Mobile/.test(ua) || hi.mobile ? 'phone' : touch > 1 ? 'tablet' : 'pc'
    if (!model) {
      const m = ua.match(/HarmonyOS; ([^;)]+?)[;)]/)
      if (m) model = m[1].trim()
    }
  } else if (plat === 'Windows' || /Windows NT/.test(ua)) {
    os = 'Windows'
    if (pv) osv = parseInt(pv, 10) >= 13 ? '11' : parseInt(pv, 10) > 0 ? '10' : ''
    else {
      const m = ua.match(/Windows NT ([\d.]+)/)
      const map: Record<string, string> = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' }
      osv = m ? map[m[1]] || m[1] : ''
    }
  } else if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) {
    const ipad = /iPad/.test(ua) || /Macintosh/.test(ua)
    os = ipad ? 'iPadOS' : 'iOS'
    kind = ipad ? 'tablet' : 'phone'
    const m = ua.match(/OS (\d+)[_.](\d+)/) || ua.match(/Version\/(\d+)\.(\d+)/)
    osv = m ? `${m[1]}.${m[2]}` : ''
    model = ipad ? 'iPad' : 'iPhone'
  } else if (plat === 'macOS' || /Macintosh|Mac OS X/.test(ua)) {
    os = 'macOS'
    kind = 'mac'
    if (pv) osv = pv.split('.').slice(0, 2).join('.').replace(/\.0$/, '')
    else {
      const m = ua.match(/Mac OS X (\d+)[_.](\d+)/)
      osv = m ? `${m[1]}.${m[2]}` : ''
    }
  } else if (plat === 'Android' || /Android/.test(ua)) {
    os = 'Android'
    kind = /Mobile/.test(ua) || hi.mobile ? 'phone' : 'tablet'
    osv = pv ? pv.split('.')[0] : (ua.match(/Android (\d+)/) || [])[1] || ''
    if (!model) {
      const m = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/)
      if (m && m[1] !== 'K') model = m[1].trim()
    }
  } else if (plat === 'Chrome OS' || /CrOS/.test(ua)) os = 'ChromeOS'
  else if (plat === 'Linux' || /Linux/.test(ua)) os = 'Linux'
  return { os, osv, kind, model }
}

/** App 内置浏览器：它们的 UA 里写着宿主 App */
export const IN_APPS: [string, RegExp][] = [
  ['X', /Twitter for (?:iPhone|iPad|Android)\/(\d+)|TwitterAndroid\/(\d+)/],
  ['微信', /MicroMessenger\/(\d+)/],
  ['微博', /Weibo \(|__weibo__(\d+)/],
  ['QQ', /\bQQ\/(\d+)/],
  ['Instagram', /Instagram (\d+)/],
  ['Facebook', /FBAV\/(\d+)|\[FBAN/],
  ['LINE', /\bLine\/(\d+)/],
  ['TikTok', /musical_ly_(\d+)|BytedanceWebview|TikTok (\d+)/],
  ['Telegram', /Telegram-Android\/(\d+)/],
]

export interface BrowserInfo {
  name: string | null
  v: string
}

export function browser(ua = '', brands: { brand: string; version: string }[] = []): BrowserInfo {
  for (const [name, re] of IN_APPS) {
    const m = ua.match(re)
    if (m) return { name, v: (m.slice(1).find(Boolean) || '').split('.')[0] }
  }
  const real = brands.filter(b => !/Not.?A.?Brand|Chromium/i.test(b.brand))
  const pick = real.find(b => !/Google Chrome/.test(b.brand)) || real[0]
  if (pick) return { name: pick.brand.replace(/^Microsoft /, '').replace(/^Google /, ''), v: String(pick.version).split('.')[0] }
  const tests: [string, RegExp][] = [
    ['Edge', /Edg(?:e|A|iOS)?\/(\d+)/],
    ['Opera', /OPR\/(\d+)/],
    ['Samsung Internet', /SamsungBrowser\/(\d+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
    ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
    ['Safari', /Version\/(\d+).*Safari/],
  ]
  for (const [name, re] of tests) {
    const m = ua.match(re)
    if (m) return { name, v: m[1] }
  }
  return { name: null, v: '' }
}

/** "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (0x00002786) Direct3D11 vs_5_0 ps_5_0, D3D11)" → "NVIDIA GeForce RTX 4070" */
export function gpuName(raw?: string | null): string | null {
  if (!raw || /^(Brave|Mozilla|Generic Renderer)$/i.test(raw)) return null
  let text = String(raw).replace(/,? or similar$/, '')
  const m = text.match(/^ANGLE \((?:[^,]*), (.*?)(?:, [^,]*)?\)$/)
  if (m) text = m[1].replace(/^ANGLE Metal Renderer: /, '')
  text = text
    .replace(/\s*\(0x[0-9a-f]+\)/i, '')
    .replace(/\s+(Direct3D\d*|OpenGL|Vulkan|Metal)(\s.*)?$/i, '')
    .replace(/\s*\(TM\)|\(R\)/gi, '')
    .replace(/, or similar$/, '')
    .trim()
  return text || null
}

/** 显卡字符串透露的系统 */
export function gpuOS(raw?: string | null): string | null {
  if (!raw) return null
  if (/Direct3D|D3D1\d/.test(raw)) return 'Windows'
  if (/Apple (M\d|GPU)|Metal/.test(raw)) return 'Apple'
  if (/Adreno|Mali|PowerVR|Xclipse|Maleoon/.test(raw)) return 'Android'
  return null
}

/** 键盘布局，从 key code → 字符的映射读出来 */
export function kbdLayout(map?: Map<string, string> | null): string | null {
  if (!map || !map.size) return null
  const k = (code: string) => (map.get(code) || '').toLowerCase()
  const q = k('KeyQ')
  const w = k('KeyW')
  const y = k('KeyY')
  const z = k('KeyZ')
  if (/[\u0400-\u04ff]/.test(q)) return 'ЙЦУКЕН'
  if (/[\u0590-\u05ff]/.test(q + w)) return '希伯来'
  if (/[\u0370-\u03ff]/.test(w)) return '希腊'
  if (/[\u0600-\u06ff]/.test(q)) return '阿拉伯'
  if (q === 'a' && w === 'z') return 'AZERTY'
  if (y === 'z' && z === 'y') return 'QWERTZ'
  if (q === "'" || q === ';' || k('KeyE') === '.') return 'Dvorak'
  if (k('KeyD') === 's' && k('KeyF') === 't') return 'Colemak'
  return q === 'q' ? 'QWERTY' : null
}

/* ---------- 系统语言痕迹 ---------- */

const SYS_FONTS: [string, string[]][] = [
  ['CN', ['DengXian', 'FangSong', 'KaiTi', 'SimHei', 'STKaiti', 'STSong', 'STXihei']],
  ['TW', ['DFKai-SB', 'MingLiU', 'PMingLiU']],
  ['JP', ['BIZ UDGothic', 'BIZ UDMincho', 'UD Digi Kyokasho N-R', 'Yu Mincho']],
  ['KR', ['Batang', 'Gulim', 'Dotum', 'Gungsuh']],
]
export const SYS_FONT_LIST = SYS_FONTS.flatMap(([, list]) => list)
const KBD_CC: Record<string, string[]> = {
  AZERTY: ['FR', 'BE'],
  QWERTZ: ['DE', 'AT', 'CH', 'CZ', 'SK', 'HU'],
  'ЙЦУКЕН': ['RU', 'UA', 'BY', 'KZ'],
  希伯来: ['IL'],
  希腊: ['GR', 'CY'],
}

/** 系统装了哪些语言的痕迹；非 Windows 系统看不出来（它们自带全部字体和语音） */
export function sysLangs(input: { os?: string | null; fonts?: string[]; voices?: string[]; kbd?: string | null }) {
  if (input.os !== 'Windows') return false
  const fonts = input.fonts || []
  const cc: string[] = []
  const from: string[] = []
  const add = (list: string[], row: string) => {
    for (const code of list) if (!cc.includes(code)) cc.push(code)
    if (list.length && !from.includes(row)) from.push(row)
  }
  for (const [code, list] of SYS_FONTS) if (list.some(name => fonts.includes(name))) add([code], 'fonts')
  const local = [...new Set((input.voices || []).map(langCC).filter((c): c is string => !!c && !/^(US|GB|AU|CA|IE|IN|NZ|ZA)$/.test(c)))]
  if (local.length && local.length <= 3) add(local, 'voices')
  if (input.kbd && KBD_CC[input.kbd]) add(KBD_CC[input.kbd], 'kbd')
  return { cc, from }
}

/* ---------- 环境评分 ---------- */

export type Level = 'ok' | 'warn' | 'bad' | 'info'

export function grade(levels: Record<string, Level | undefined>, ids: string[]) {
  let score = 100
  for (const id of ids) {
    const level = levels[id]
    if (level === 'bad') score -= 16
    else if (level === 'warn') score -= 7
  }
  score = Math.max(0, score)
  const letter = score === 100 ? 'A+' : score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F'
  return { score, grade: letter }
}

/* ---------- 屏幕 ---------- */

const SIZES: [number, number][] = [
  [7680, 4320], [6016, 3384], [5120, 2880], [5120, 2160], [5120, 1440], [4096, 2304], [3840, 2400], [3840, 2160], [3840, 1600],
  [3840, 1080], [3456, 2234], [3440, 1440], [3200, 1800], [3024, 1964], [3000, 2000], [2880, 1920], [2880, 1800], [2736, 1824],
  [2560, 1664], [2560, 1600], [2560, 1440], [2560, 1080], [2496, 1664], [2256, 1504], [2160, 1440], [1920, 1200], [1920, 1080],
  [1680, 1050], [1600, 900], [1440, 900], [1366, 768], [1280, 1024], [1280, 800], [1280, 720],
]

const near = (w: number, h: number) =>
  SIZES.find(([a, b]) => (Math.abs(a - w) <= a * 0.01 && Math.abs(b - h) <= b * 0.01) || (Math.abs(a - h) <= a * 0.01 && Math.abs(b - w) <= b * 0.01))

/** 屏幕的物理像素：screen.width 是缩放后的 CSS 像素乘以 devicePixelRatio 才是面板真实尺寸 */
export function physicalScreen(w: number, h: number, dpr = 1): [number, number] {
  const pw = Math.round(w * dpr)
  const ph = Math.round(h * dpr)
  const hit = near(pw, ph)
  if (hit) return (w >= h) === (hit[0] >= hit[1]) ? [hit[0], hit[1]] : [hit[1], hit[0]]
  if (dpr > 1 && Number.isInteger(dpr)) return [pw, ph]
  const scales = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3]
  const order = [...scales.filter(s => s < dpr).reverse(), ...scales.filter(s => s > dpr)]
  for (const s of order) {
    const m = near(Math.round(w * s), Math.round(h * s))
    if (m) return (w >= h) === (m[0] >= m[1]) ? [m[0], m[1]] : [m[1], m[0]]
  }
  return [pw, ph]
}

export const isSoftGpu = (raw?: string | null) => /Basic Render Driver|SwiftShader|llvmpipe|softpipe|Software Rasterizer/i.test(raw || '')
/** 核显 */
export const isIntegratedGpu = (g?: string | null) =>
  /UHD|HD Graphics|Iris|Radeon\(TM\) Graphics|Radeon Graphics|Vega \d+ Graphics|Radeon(\(TM\))? \d{3}M\b|Intel(\(R\))? Arc(\(TM\))? Graphics/i.test(g || '')

/* ---------- 引擎版本 ---------- */

const FEATURES: [number, string][] = [
  [97, 'findLast'], [98, 'structuredClone'], [117, 'groupBy'], [119, 'withResolvers'], [121, 'fromAsync'],
  [122, 'union'], [128, 'try'], [129, 'DurationFormat'], [134, 'isError'], [135, 'Float16Array'], [136, 'escape'],
]

export function engineRange(has: Record<string, boolean>) {
  const yes = FEATURES.filter(([, key]) => has[key]).map(([v]) => v)
  const no = FEATURES.filter(([, key]) => !has[key]).map(([v]) => v)
  return { lo: yes.length ? Math.max(...yes) : 0, hi: no.length ? Math.min(...no) - 1 : null, n: yes.length, of: FEATURES.length }
}

/** UA 写的版本比引擎实际具备的特性还旧：只有这个方向能说明问题（特性表不会覆盖到最新版本） */
export const engineOff = (claimed?: number | null, range?: { lo: number; hi: number | null }) =>
  !!(claimed && range && (claimed < range.lo || (range.hi != null && range.hi < range.lo)))

export function platformOff(platform?: string | null, os?: string | null) {
  if (!platform || !os || /Harmony/i.test(os)) return false
  const want = /^Windows/.test(os)
    ? /^Win/
    : /^macOS/.test(os)
      ? /^Mac/
      : /^(iOS|iPadOS)/.test(os)
        ? /^(iPhone|iPad|iPod|MacIntel)/
        : /^(Android|Linux|Chrome ?OS)/i.test(os)
          ? /Linux|Android|arm|aarch|X11|CrOS/i
          : null
  return want ? !want.test(platform) : false
}

export function glVendorOff(vendor?: string | null, renderer?: string | null) {
  const v = /^Google Inc\. \(([^)]+)\)/.exec(vendor || '')
  const r = /^ANGLE \(([^,]+),/.exec(renderer || '')
  return !!(v && r && v[1].trim().toLowerCase() !== r[1].trim().toLowerCase())
}

/* ---------- 其他 ---------- */

/** "+08:00" */
export function offTxt(minutes: number) {
  return (minutes < 0 ? '−' : '+') + String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0') + ':' + String(Math.abs(minutes) % 60).padStart(2, '0')
}

function v6groups(ip: string): number[] {
  const [head, tail = ''] = ip.toLowerCase().split('::')
  const h = head ? head.split(':') : []
  const t = tail ? tail.split(':') : []
  const groups = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t]
  return groups.map(g => parseInt(g || '0', 16))
}

/** IPv6 地址里夹着的网卡 MAC（EUI-64：接口标识中间是 ff:fe，且翻转了保留位） */
export function macOf(ip?: string | null): string | null {
  if (!ip || !ip.includes(':')) return null
  const g = v6groups(ip)
  if ((g[5] & 0xff) !== 0xff || g[6] >> 8 !== 0xfe) return null
  const bytes = [(g[4] >> 8) ^ 0x02, g[4] & 0xff, g[5] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff]
  return bytes.map(x => x.toString(16).padStart(2, '0')).join(':')
}

/** iCloud 专用代理这类中继的出口 */
const RELAY4: [number, number][] = [[104, 28], [172, 224], [172, 225], [172, 226], [146, 75], [140, 248]]
const RELAY6 = /^(2606:54c0|2a02:26f7|2a04:4e41):/i
export function isRelayIp(ip?: string | null) {
  const text = String(ip || '')
  if (text.includes(':')) return RELAY6.test(text)
  const [a, b] = text.split('.').map(Number)
  return RELAY4.some(([x, y]) => x === a && y === b)
}

/** Firefox 的 resistFingerprinting：所有网站都报雷克雅未克（老版本是 UTC）的时间 */
export const rfpClock = (firefox: boolean, tz?: string | null, gpuRaw?: string | null) =>
  !!firefox && /^(Atlantic\/Reykjavik|UTC|Etc\/UTC)$/.test(tz || '') && (gpuRaw == null || /^(Mozilla|Generic Renderer)$/.test(gpuRaw))
