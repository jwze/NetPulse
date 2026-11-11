/**
 * 隐私画像的读取部分：本机能直接问到的浏览器信息，加上几个公开接口拿到的网络侧信息。
 * 每一项都单独降级，读不到就留空，不影响其他项。
 */
import { browser, device, engineRange, gpuName, gpuOS, kbdLayout, macOf, physicalScreen, type BrowserInfo, type DeviceInfo } from './privacyInfer.ts'

const TIMEOUT = 6000

export interface NetSide {
  ip: string
  cc: string
  city: string
  coords: string
  asn: number | null
  org: string
  tz: string
  tzOffset: number | null
  colo: string
  tls: string
  http: string
  kex: string
  sni: string
  warp: string
  dnsCC: string
  dnsName: string
  dnsIp: string
  ptr: string
  exits: [string, string][]
  rttCf: number | null
  webrtc: string[] | false | null
  lan: string
}

export interface LocalSide {
  rows: Record<string, string>
  langs: string[]
  tz: string
  tzOffset: number | null
  gpuRaw: string | null
  gpu: string | null
  gpuOS: string | null
  glVendor: string | null
  fonts: string[]
  voices: string[]
  kbd: string | null
  webdriver: boolean | null
  tamper: string[]
  hintOS: string | null
  engineRange: { lo: number; hi: number | null; n: number; of: number }
  engineClaim: number | null
  canvasSame: boolean | null
  noise: boolean
  brave: boolean
  firefox: boolean
  ios: boolean
  br: BrowserInfo
  dev: DeviceInfo
  fpid: string
  hwid: string
}

const empty = (): LocalSide => ({
  rows: {},
  langs: [],
  tz: '',
  tzOffset: null,
  gpuRaw: null,
  gpu: null,
  gpuOS: null,
  glVendor: null,
  fonts: [],
  voices: [],
  kbd: null,
  webdriver: null,
  tamper: [],
  hintOS: null,
  engineRange: { lo: 0, hi: null, n: 0, of: 0 },
  engineClaim: null,
  canvasSame: null,
  noise: false,
  brave: false,
  firefox: false,
  ios: false,
  br: { name: null, v: '' },
  dev: { os: null, osv: '', kind: 'pc', model: '' },
  fpid: '',
  hwid: '',
})

/* ---------- 小工具 ---------- */

async function sha8(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return [...new Uint8Array(buf)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 8)
  } catch {
    return ''
  }
}

const round = (value: number, digits = 2) => Number(value.toFixed(digits))
const cut = (text: unknown, max = 42) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

function canvasDraw(): string {
  const canvas = document.createElement('canvas')
  canvas.width = 260
  canvas.height = 60
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.textBaseline = 'top'
  ctx.font = '14px "Arial"'
  ctx.fillStyle = '#f60'
  ctx.fillRect(0, 0, 120, 24)
  ctx.fillStyle = '#069'
  ctx.fillText('net-pulse 隐私画像 🌐 0123', 4, 6)
  ctx.strokeStyle = 'rgba(102, 204, 0, 0.7)'
  ctx.beginPath()
  ctx.arc(200, 30, 20, 0, Math.PI * 1.5)
  ctx.stroke()
  return canvas.toDataURL()
}

function webglInfo() {
  const canvas = document.createElement('canvas')
  const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null
  if (!gl) return { raw: '', vendor: '', hash: '', texture: 0, ext: 0 }
  const debug = gl.getExtension('WEBGL_debug_renderer_info')
  const raw = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) || '') : String(gl.getParameter(gl.RENDERER) || '')
  const vendor = debug ? String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) || '') : String(gl.getParameter(gl.VENDOR) || '')
  const params = [gl.VERSION, gl.SHADING_LANGUAGE_VERSION, gl.MAX_TEXTURE_SIZE, gl.MAX_VIEWPORT_DIMS, gl.ALIASED_LINE_WIDTH_RANGE, gl.MAX_VERTEX_UNIFORM_VECTORS]
  return {
    raw,
    vendor,
    hash: `${raw}|${vendor}|${params.map(item => JSON.stringify(item)).join(',')}`,
    texture: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0),
    ext: gl.getSupportedExtensions()?.length || 0,
  }
}

let probeCtx: AudioContext | null = null
function audioHash(): Promise<string> {
  return new Promise(resolve => {
    try {
      const Ctor: typeof OfflineAudioContext | undefined = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext
      if (!Ctor) return resolve('')
      const ctx = new Ctor(1, 4410, 44100)
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = 1000
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 500
      const gain = ctx.createGain()
      gain.gain.value = 0.2
      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)
      osc.start(0)
      ctx.startRendering()
      ctx.oncomplete = event => {
        const data = event.renderedBuffer.getChannelData(0)
        let sum = 0
        for (let i = 0; i < data.length; i += 1) sum += Math.abs(data[i])
        resolve(String(round(sum, 6)))
      }
    } catch {
      resolve('')
    }
  })
}

function fontList(): string[] {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return []
  const base = ['monospace', 'sans-serif', 'serif']
  const probe = 'mmmmmmmmmmlli'
  const width = new Map<string, number>()
  for (const family of base) {
    ctx.font = `72px ${family}`
    width.set(family, ctx.measureText(probe).width)
  }
  const names = [
    'Arial', 'Calibri', 'Cambria', 'Candara', 'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Georgia', 'Impact',
    'Lucida Console', 'MS Gothic', 'Meiryo', 'Microsoft YaHei', 'Microsoft JhengHei', 'MingLiU', 'Mongolian Baiti',
    'Segoe UI', 'SimHei', 'SimSun', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Yu Gothic', 'MS PGothic',
    'PingFang SC', 'Hiragino Sans', 'Helvetica Neue', 'Menlo', 'Monaco', 'Optima', 'Palatino', 'SF Pro Text',
    'Noto Sans CJK SC', 'Source Han Sans SC', 'WenQuanYi Micro Hei', 'DejaVu Sans', 'Liberation Sans', 'Ubuntu',
    'Roboto', 'Droid Sans Fallback', 'DengXian', 'FangSong', 'KaiTi', 'STKaiti', 'STSong', 'STXihei',
    'DFKai-SB', 'PMingLiU', 'Batang', 'Gulim', 'Dotum', 'Gungsuh', 'BIZ UDGothic', 'Yu Mincho', 'UD Digi Kyokasho N-R',
    'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Source Code Pro', 'Hack', 'Inconsolata',
    'Myriad Pro', 'Minion Pro', 'Aptos', 'Helvetica', 'Arial Black', 'Comic Sans MS', 'Segoe Print',
  ]
  return names.filter(name => {
    for (const family of base) {
      ctx.font = `72px "${name}", ${family}`
      if (ctx.measureText(probe).width !== width.get(family)) return true
    }
    return false
  })
}

function measureRefresh(): Promise<number | null> {
  return new Promise(resolve => {
    let last = 0
    const gaps: number[] = []
    let frames = 0
    const tick = (now: number) => {
      if (last) gaps.push(now - last)
      last = now
      frames += 1
      if (frames < 24) requestAnimationFrame(tick)
      else {
        const sorted = gaps.slice(2).sort((a, b) => a - b)
        const mid = sorted[Math.floor(sorted.length / 2)]
        resolve(mid ? Math.round(1000 / mid) : null)
      }
    }
    requestAnimationFrame(tick)
  })
}

function timerResolution() {
  let best = Infinity
  for (let i = 0; i < 3; i += 1) {
    let last = performance.now()
    for (let j = 0; j < 4000; j += 1) {
      const now = performance.now()
      const diff = now - last
      if (diff > 0 && diff < best) best = diff
      last = now
    }
  }
  return Number.isFinite(best) ? round(best, 4) : null
}

function tamperCheck() {
  const out: string[] = []
  const props = ['userAgent', 'platform', 'languages', 'hardwareConcurrency', 'deviceMemory', 'webdriver', 'vendor', 'appVersion']
  for (const key of props) {
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator) || navigator, key)
    if (desc && desc.get && !/\[native code\]/.test(desc.get.toString())) out.push(`navigator.${key}`)
  }
  const fns: [string, () => unknown][] = [
    ['Canvas.getContext', () => HTMLCanvasElement.prototype.getContext],
    ['WebGL.getParameter', () => WebGLRenderingContext.prototype.getParameter],
    ['Audio.createOscillator', () => (window.BaseAudioContext || window.AudioContext).prototype.createOscillator],
    ['Date.getTimezoneOffset', () => Date.prototype.getTimezoneOffset],
  ]
  for (const [name, get] of fns) {
    try {
      const fn = get() as unknown as { toString(): string }
      if (fn && !/\[native code\]/.test(fn.toString())) out.push(name)
    } catch {
      // 拿不到就跳过
    }
  }
  return out
}

function cssLevel() {
  const tests: [number, string][] = [
    [105, 'aspect-ratio: 1'],
    [110, ':is(a, b)'],
    [112, 'accent-color: red'],
    [121, 'color-mix(in srgb, red, blue)'],
    [130, ':has(a)'],
    [133, 'text-wrap: balance'],
    [137, 'anchor-name: --a'],
  ]
  const hit = tests.filter(([, rule]) => CSS.supports(rule) || CSS.supports(`(${rule})`))
  return hit.length ? hit[hit.length - 1][0] : 0
}

function baitBlocked() {
  const bait = document.createElement('div')
  bait.className = 'ad-banner adsbox pub_300x250 text-ad'
  bait.style.cssText = 'position:absolute;left:-9999px;top:0;height:12px;width:300px'
  document.body.appendChild(bait)
  const style = getComputedStyle(bait)
  const blocked = style.display === 'none' || style.visibility === 'hidden' || bait.offsetHeight === 0
  bait.remove()
  return blocked
}

/* ---------- 本机 ---------- */

export async function readLocal(): Promise<LocalSide> {
  const out = empty()
  const rows = out.rows
  const nav = navigator as Navigator & {
    userAgentData?: {
      platform?: string
      mobile?: boolean
      brands?: { brand: string; version: string }[]
      getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>
    }
    deviceMemory?: number
    connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean }
    keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> }
    brave?: { isBrave?: () => Promise<boolean> }
    getBattery?: () => Promise<{ charging: boolean; level: number }>
    globalPrivacyControl?: boolean
    pdfViewerEnabled?: boolean
  }

  const hints = nav.userAgentData
  const hi: Record<string, unknown> = hints?.getHighEntropyValues
    ? await hints.getHighEntropyValues(['architecture', 'bitness', 'platformVersion', 'model', 'uaFullVersion']).catch(() => ({}))
    : {}
  const ua = nav.userAgent
  out.dev = device(ua, { platform: hints?.platform, platformVersion: String(hi.platformVersion || ''), mobile: hints?.mobile, model: String(hi.model || '') }, nav.maxTouchPoints)
  out.br = browser(ua, hints?.brands || [])
  out.brave = !!nav.brave
  out.firefox = /Firefox|FxiOS/.test(ua)
  out.ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1)
  out.hintOS = (hi.platform as string) || hints?.platform || null
  out.engineClaim = Number(out.br.v) || null

  rows.os = out.dev.os ? `${out.dev.os}${out.dev.osv ? ' ' + out.dev.osv : ''}` : '读不到'
  rows.browser = out.br.name ? `${out.br.name}${out.br.v ? ' ' + out.br.v : ''}` : '读不到'
  rows.arch = [hi.architecture, hi.bitness].filter(Boolean).join(' · ') || '—'

  /* 屏幕 */
  const phys = physicalScreen(screen.width, screen.height, window.devicePixelRatio)
  const scaled = phys[0] !== Math.round(screen.width * devicePixelRatio)
  rows.screen = `${phys[0]}×${phys[1]}${scaled ? '（实际面板）' : ''} · ${round(devicePixelRatio, 2)}x`
  const hz = await measureRefresh()
  rows.hz = hz ? `${hz} Hz` : '—'
  rows.screens = (screen as Screen & { isExtended?: boolean }).isExtended ? '接了多块屏' : '一块屏'
  rows.win = `${innerWidth}×${innerHeight} · 系统栏 ${Math.round(screen.height - screen.availHeight)} px`
  const scrollbar = document.createElement('div')
  scrollbar.style.cssText = 'width:100px;height:100px;overflow:scroll;position:absolute;left:-9999px'
  document.body.appendChild(scrollbar)
  rows.scrollbar = `${scrollbar.offsetWidth - scrollbar.clientWidth} px`
  scrollbar.remove()

  /* 显卡 */
  const gl = webglInfo()
  out.gpuRaw = gl.raw
  out.gpu = gpuName(gl.raw)
  out.gpuOS = gpuOS(gl.raw)
  out.glVendor = gl.vendor
  rows.gpu = out.gpu || gl.raw || '读不到（WebGL 被关掉）'
  rows.glx = gl.texture ? `最大纹理 ${gl.texture} · ${gl.ext} 个扩展` : '—'

  /* 硬件 */
  rows.cpu = `${nav.hardwareConcurrency || '?'} 核`
  rows.mem = nav.deviceMemory ? `${nav.deviceMemory} GB` : '不告诉（Firefox、Safari）'
  const perf = performance as Performance & { memory?: { jsHeapSizeLimit: number } }
  rows.heap = perf.memory ? `每个页面最多 ${round(perf.memory.jsHeapSizeLimit / 1073741824, 2)} GB` : '只有 Chromium 有'
  rows.touch = `${nav.maxTouchPoints} 点 · ${matchMedia('(pointer: fine)').matches ? '鼠标' : matchMedia('(pointer: coarse)').matches ? '触摸' : '未知'}`
  if (nav.getBattery) {
    const battery = await nav.getBattery().catch(() => null)
    rows.battery = battery ? (battery.charging ? `充电中（${Math.round(battery.level * 100)}%）` : `电池（剩 ${Math.round(battery.level * 100)}%）`) : '读不到'
  } else rows.battery = '不告诉'
  rows.conn = nav.connection
    ? [nav.connection.effectiveType, nav.connection.downlink ? `${nav.connection.downlink} Mbps` : '', nav.connection.rtt ? `RTT ${nav.connection.rtt} ms` : '', nav.connection.saveData ? '省流量' : '']
        .filter(Boolean)
        .join(' · ')
    : '不告诉'
  try {
    probeCtx = probeCtx || new AudioContext()
    rows.audiohw = `${round(probeCtx.sampleRate / 1000, 1)} kHz · ${probeCtx.destination.maxChannelCount} 声道`
  } catch {
    rows.audiohw = '—'
  }
  const codecList = ['video/mp4; codecs="avc1.42E01E"', 'video/mp4; codecs="hev1.1.6.L93.B0"', 'video/mp4; codecs="av01.0.05M.08"', 'video/webm; codecs="vp9"', 'video/webm; codecs="vp8"', 'audio/mp4; codecs="mp4a.40.2"']
  rows.codecs = `${codecList.filter(item => MediaSource.isTypeSupported(item)).length}/${codecList.length} 种`
  const estimate = await navigator.storage?.estimate?.().catch(() => null)
  rows.storage = estimate?.quota ? `配额 ${round(estimate.quota / 1073741824, 1)} GB` : '—'

  /* 语言与时区 */
  out.langs = [...(nav.languages || [nav.language])].filter(Boolean)
  const resolved = new Intl.DateTimeFormat().resolvedOptions()
  out.tz = resolved.timeZone || ''
  out.tzOffset = -new Date().getTimezoneOffset()
  rows.langs = out.langs.join(' · ')
  rows.locale = resolved.locale
  rows.tz = out.tz || '—'
  const hourCycle = new Intl.DateTimeFormat(resolved.locale, { hour: 'numeric' }).resolvedOptions().hourCycle
  rows.hour = hourCycle === 'h23' || hourCycle === 'h24' ? '24 小时制' : hourCycle === 'h11' || hourCycle === 'h12' ? '12 小时制' : '—'
  try {
    const locale = new Intl.Locale(resolved.locale) as Intl.Locale & {
      weekInfo?: { firstDay: number }
      getWeekInfo?: () => { firstDay: number }
    }
    const week = locale.getWeekInfo ? locale.getWeekInfo() : locale.weekInfo
    const names = ['周一', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
    rows.week = week ? names[week.firstDay] || '—' : '看不出来'
  } catch {
    rows.week = '看不出来'
  }
  rows.fmt = new Intl.NumberFormat().format(1234567.89) + ' · ' + new Intl.DateTimeFormat().format(new Date(2026, 0, 2))
  const icu = Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  rows.icu = icu.supportedValuesOf
    ? `${icu.supportedValuesOf('timeZone').length} 个时区 · ${icu.supportedValuesOf('currency').length} 种货币 · ${icu.supportedValuesOf('calendar').length} 种历法`
    : '—'
  try {
    const map = await nav.keyboard?.getLayoutMap?.()
    out.kbd = kbdLayout(map)
  } catch {
    out.kbd = null
  }
  rows.kbd = out.kbd || '不告诉（Safari、Firefox）'
  let voices = window.speechSynthesis?.getVoices?.() || []
  if (!voices.length) {
    await new Promise(resolve => setTimeout(resolve, 250))
    voices = window.speechSynthesis?.getVoices?.() || []
  }
  out.voices = voices.map(voice => voice.lang).filter(Boolean)
  rows.voices = voices.length ? `${voices.length} 个 · ${[...new Set(out.voices)].slice(0, 3).join(', ')}` : '—'

  /* 请求头侧 */
  rows.h_ua = cut(ua, 60)
  rows.h_lang = out.langs.join(', ')
  rows.h_chua = hints?.brands?.length ? hints.brands.map(item => `${item.brand} ${item.version.split('.')[0]}`).join(', ') : 'Safari、Firefox 不发'
  rows.h_plat = hints?.platform || 'Safari、Firefox 不发'
  rows.h_enc = 'JS 读不到'
  rows.h_dnt = nav.doNotTrack === '1' ? '已开启 DNT' : nav.globalPrivacyControl ? '已开启 GPC' : '没有声明'
  rows.h_ref = document.referrer ? cut(document.referrer, 48) : '没有来源页'

  /* 浏览器环境 */
  rows.scheme = matchMedia('(prefers-color-scheme: dark)').matches ? '深色' : '浅色'
  rows.motion = matchMedia('(prefers-reduced-motion: reduce)').matches ? '减少动态效果' : '默认'
  rows.gamut = [
    matchMedia('(color-gamut: p3)').matches ? 'P3 广色域' : matchMedia('(color-gamut: srgb)').matches ? 'sRGB' : '—',
    matchMedia('(dynamic-range: high)').matches ? 'HDR' : '',
  ]
    .filter(Boolean)
    .join(' · ')
  rows.a11y = [
    matchMedia('(prefers-contrast: more)').matches ? '高对比度' : '',
    matchMedia('(forced-colors: active)').matches ? '强制颜色' : '',
    matchMedia('(prefers-reduced-transparency: reduce)').matches ? '减少透明' : '',
  ]
    .filter(Boolean)
    .join(' · ') || '没有特别设置'
  rows.sysui = getComputedStyle(document.documentElement).fontSize
  rows.display = matchMedia('(display-mode: standalone)').matches ? '独立窗口' : '浏览器标签页'
  rows.dnt = rows.h_dnt
  rows.cookies = nav.cookieEnabled ? '能写' : '被禁用'
  const perms = await Promise.all(
    ['geolocation', 'notifications', 'camera', 'microphone', 'clipboard-read'].map(name =>
      navigator.permissions?.query({ name: name as PermissionName }).then(result => result.state).catch(() => ''),
    ),
  )
  rows.perms = perms.filter(Boolean).join(' · ') || '—'
  const apis = [
    ['usb', !!(nav as unknown as { usb?: unknown }).usb],
    ['串口', !!(nav as unknown as { serial?: unknown }).serial],
    ['HID', !!(nav as unknown as { hid?: unknown }).hid],
    ['蓝牙', !!(nav as unknown as { bluetooth?: unknown }).bluetooth],
    ['NFC', 'NDEFReader' in window],
  ]
  rows.apis = `${apis.filter(([, yes]) => yes).length}/5 项：${apis.filter(([, yes]) => yes).map(([name]) => name).join('、') || '都没有'}`
  rows.pdf = nav.pdfViewerEnabled ? '内置 PDF 阅读器' : '没有'
  out.webdriver = nav.webdriver
  rows.webdriver = nav.webdriver ? '是（自动化工具）' : '不是'
  rows.adblock = baitBlocked() ? '拦下了广告位' : '没拦'
  rows.history = `${history.length} 条`
  out.fonts = fontList()
  rows.fonts = `认出 ${out.fonts.length} 个`

  /* 指纹 */
  const err = new Error()
  const stack = err.stack || ''
  const engine = /\n\s+at /.test(stack)
    ? 'V8'
    : !stack
      ? '读不到调用栈'
      : /@\S+:\(?\d+\)?/.test(stack)
        ? /Firefox|FxiOS/.test(ua)
          ? 'SpiderMonkey'
          : 'JavaScriptCore'
        : '读不到'
  const range = engineRange({
    findLast: typeof (Array.prototype as unknown as { findLast?: unknown }).findLast === 'function',
    structuredClone: typeof structuredClone === 'function',
    groupBy: typeof (Object as unknown as { groupBy?: unknown }).groupBy === 'function',
    withResolvers: typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers === 'function',
    fromAsync: typeof (Array as unknown as { fromAsync?: unknown }).fromAsync === 'function',
    union: typeof (Set.prototype as unknown as { union?: unknown }).union === 'function',
    try: 'try' in Promise,
    DurationFormat: typeof (Intl as unknown as { DurationFormat?: unknown }).DurationFormat === 'function',
    isError: typeof (Error as unknown as { isError?: unknown }).isError === 'function',
    Float16Array: typeof (window as unknown as { Float16Array?: unknown }).Float16Array === 'function',
    escape: 'escape' in Uint8Array,
  })
  out.engineRange = range
  rows.engine = engine
  rows.engver =
    range.hi != null && range.hi < range.lo
      ? `具备 Chromium ${range.lo}+ 的全部特性`
      : range.hi != null && range.hi > range.lo
        ? `像 Chromium ${range.lo}–${range.hi}`
        : range.hi != null
          ? `像 Chromium ${range.lo}`
          : `较新的特性支持 ${range.n}/${range.of} 项`
  out.tamper = tamperCheck()
  rows.lies = out.tamper.length ? `${out.tamper.length} 处改写：${out.tamper.slice(0, 3).join('、')}` : '没发现被改写的接口'
  rows.cssv = cssLevel() ? `相当于 Chrome ${cssLevel()} 以上` : '—'

  const canvas = canvasDraw()
  rows.canvas = canvas ? await sha8(canvas) : '读不到'
  rows.webgl = gl.hash ? await sha8(gl.hash) : '读不到'
  const audio = await audioHash()
  rows.audio = audio || '读不到'
  const mathText = [Math.sin(1), Math.tan(1), Math.acos(0.5), Math.sinh(1), Math.exp(1), Math.log(2), Math.atan2(1, 3)].map(value => value.toString()).join(',')
  rows.mathfp = await sha8(mathText)
  const ctx = document.createElement('canvas').getContext('2d')
  rows.emoji = ctx ? `${round(ctx.measureText('😀').width, 2)} px 宽` : '—'
  const fontText = out.fonts.map(name => {
    if (!ctx) return name
    ctx.font = '16px "Arial"'
    const baseWidth = ctx.measureText('字体指纹').width
    ctx.font = `16px "${name}", monospace`
    return `${name}:${round(ctx.measureText('字体指纹').width - baseWidth, 3)}`
  })
  rows.fontfp = await sha8(fontText.join('|'))
  const range2 = document.createRange()
  const span = document.createElement('span')
  span.textContent = 'net-pulse 文字度量'
  span.style.cssText = 'position:absolute;left:-9999px;font:14.5px "Georgia"'
  document.body.appendChild(span)
  range2.selectNodeContents(span)
  const rect = range2.getBoundingClientRect()
  rows.domrect = `${round(rect.width, 3)}×${round(rect.height, 3)}`
  range2.detach()
  span.remove()
  if (ctx) {
    ctx.font = '13px "Times New Roman"'
    const metrics = ctx.measureText('Privacy 1234')
    rows.textm = [metrics.width, metrics.actualBoundingBoxAscent, metrics.actualBoundingBoxDescent, metrics.actualBoundingBoxLeft].map(value => round(value || 0, 2)).join(' / ')
  }
  rows.keys = `window ${Object.keys(window).length} · HTMLElement ${Object.getOwnPropertyNames(HTMLElement.prototype).length} · CSS ${typeof CSS !== 'undefined' ? Object.getOwnPropertyNames(CSS).length : 0}`
  const res = timerResolution()
  rows.timer = res ? `${res} ms` : '—'

  const secondCanvas = canvasDraw()
  out.canvasSame = !!canvas && canvas === secondCanvas
  out.noise = !out.canvasSame
  rows.rand = out.canvasSame ? '两次画出来一样' : '两次不一样（有防护在加干扰）'
  rows.shield = out.brave ? 'Brave 的指纹随机化' : out.firefox && /^Atlantic\/Reykjavik|^UTC|Etc\/UTC/.test(out.tz) ? 'Firefox 的 resistFingerprinting' : out.tamper.length ? '有扩展换掉了浏览器接口' : out.noise ? '有防护在加干扰' : '没有：浏览器原样报出指纹'

  out.fpid = await sha8([rows.canvas, rows.webgl, rows.audio, rows.mathfp, rows.fontfp, rows.textm, rows.emoji, rows.keys].join('|'))
  out.hwid = await sha8([out.dev.os, phys.join('x'), `${screen.colorDepth}`, rows.cpu, out.gpu || '', out.tz, out.fonts.length].join('|'))
  rows.fpid = out.fpid
  rows.hwid = out.hwid

  return out
}

/* ---------- 网络侧 ---------- */

async function get(url: string, signal?: AbortSignal): Promise<Response> {
  return fetch(url, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: signal || AbortSignal.timeout(TIMEOUT) })
}

function parseTrace(text: string) {
  const map: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const index = line.indexOf('=')
    if (index > 0) map[line.slice(0, index).trim()] = line.slice(index + 1).trim()
  }
  return map
}

export interface NetReadout extends NetSide {
  ms: Record<string, number | null>
}

const blankNet = (): NetReadout => ({
  ip: '',
  cc: '',
  city: '',
  coords: '',
  asn: null,
  org: '',
  tz: '',
  tzOffset: null,
  colo: '',
  tls: '',
  http: '',
  kex: '',
  sni: '',
  warp: '',
  dnsCC: '',
  dnsName: '',
  dnsIp: '',
  ptr: '',
  exits: [],
  rttCf: null,
  webrtc: null,
  lan: '',
  ms: {},
})

/** Cloudflare 的 trace：这里能读到它眼中你的地址、城市、边缘节点和 TLS 细节 */
async function readTrace(host: string, signal?: AbortSignal) {
  const started = performance.now()
  const response = await get(`https://${host}/cdn-cgi/trace`, signal)
  const map = parseTrace(await response.text())
  const timing = (performance.getEntriesByName(`https://${host}/cdn-cgi/trace`).pop() as PerformanceResourceTiming | undefined)?.duration
  return { map, ms: timing ?? performance.now() - started }
}

async function readIpWhois(signal?: AbortSignal) {
  const response = await get('https://ipwho.is/?fields=ip,country_code,city,latitude,longitude,connection,timezone', signal)
  return (await response.json()) as {
    ip?: string
    country_code?: string
    city?: string
    latitude?: number
    longitude?: number
    connection?: { asn?: number; org?: string; isp?: string }
    timezone?: { id?: string; utc?: string }
  }
}

/** 开了 EDNS 的 DNS，会告诉你「是谁替我查的这个域名」 */
async function readDns(signal?: AbortSignal) {
  const response = await get('https://edns.ip-api.com/json', signal)
  const body = (await response.json()) as { dns?: { ip?: string; geo?: string } }
  const geo = String(body.dns?.geo || '')
  const cc = (geo.match(/\b([A-Z]{2})$/) || [])[1] || ''
  return { ip: body.dns?.ip || '', cc, name: geo }
}

async function lookupCc(ip: string, signal?: AbortSignal) {
  if (!ip) return ''
  const response = await get(`https://ipwho.is/${ip}?fields=country_code`, signal)
  const body = (await response.json()) as { country_code?: string }
  return body.country_code || ''
}

async function readPtr(ip: string, signal?: AbortSignal) {
  if (!ip || ip.includes(':')) return ''
  const reversed = ip.split('.').reverse().join('.') + '.in-addr.arpa'
  const response = await get(`https://dns.alidns.com/resolve?name=${reversed}&type=PTR`, signal)
  const body = (await response.json()) as { Answer?: { data?: string }[] }
  return String(body.Answer?.[0]?.data || '').replace(/\.$/, '')
}

/** STUN 看到的地址：WebRTC 不走代理时，这里会露出真实的那个 */
export function probeWebrtc(timeout = 4000): Promise<{ ips: string[]; lan: string } | false> {
  const servers = ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302']
  if (typeof RTCPeerConnection !== 'function') return Promise.resolve(false)
  return new Promise(resolve => {
    const ips = new Set<string>()
    let lan = ''
    let done = false
    let pc: RTCPeerConnection | null = null
    const finish = () => {
      if (done) return
      done = true
      try {
        pc?.close()
      } catch {
        // 关不掉就算了
      }
      resolve({ ips: [...ips], lan })
    }
    try {
      pc = new RTCPeerConnection({ iceServers: servers.map(urls => ({ urls })) })
    } catch {
      resolve(false)
      return
    }
    const timer = setTimeout(finish, timeout)
    pc.onicecandidate = event => {
      if (!event.candidate) {
        clearTimeout(timer)
        finish()
        return
      }
      const text = event.candidate.candidate
      const ip = (text.match(/(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f]{1,4}(?::[0-9a-f]{0,4}){2,7})/i) || [])[1]
      if (!ip) return
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|127\.|fe80:|::1)/i.test(ip)) lan = lan || ip
      else ips.add(ip)
    }
    pc.createDataChannel('probe')
    void pc
      .createOffer()
      .then(offer => pc?.setLocalDescription(offer))
      .catch(() => {
        clearTimeout(timer)
        finish()
      })
  })
}

export async function readNetwork(onStep: (key: string, ms: number | null) => void, signal?: AbortSignal): Promise<NetReadout> {
  const out = blankNet()

  const trace = readTrace('www.cloudflare.com', signal).catch(() => null)
  const whois = readIpWhois(signal).catch(() => null)
  const dns = readDns(signal).catch(() => null)

  const [traceResult, whoisResult] = await Promise.all([trace, whois])
  if (traceResult) {
    out.ip = traceResult.map.ip || ''
    out.cc = traceResult.map.loc || ''
    out.colo = traceResult.map.colo || ''
    out.tls = traceResult.map.tls || ''
    out.http = traceResult.map.http || ''
    out.kex = traceResult.map.kex || ''
    out.sni = traceResult.map.sni || ''
    out.warp = traceResult.map.warp || ''
    out.ms.ex_cf = Math.round(traceResult.ms)
    onStep('ex_cf', out.ms.ex_cf)
  }
  if (whoisResult) {
    out.ip = out.ip || whoisResult.ip || ''
    out.cc = out.cc || whoisResult.country_code || ''
    out.city = whoisResult.city || ''
    out.coords = whoisResult.latitude != null ? `${round(whoisResult.latitude, 3)}, ${round(whoisResult.longitude ?? 0, 3)}` : ''
    out.asn = whoisResult.connection?.asn ?? null
    out.org = whoisResult.connection?.org || whoisResult.connection?.isp || ''
    out.tz = whoisResult.timezone?.id || ''
    const offset = String(whoisResult.timezone?.utc || '').match(/([+-])(\d{2}):(\d{2})/)
    out.tzOffset = offset ? (offset[1] === '-' ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3])) : null
    out.ms.ip = null
    onStep('ip', null)
  }

  const dnsResult = await dns
  if (dnsResult) {
    out.dnsIp = dnsResult.ip
    out.dnsName = dnsResult.name
    out.dnsCC = dnsResult.cc || (await lookupCc(dnsResult.ip, signal).catch(() => ''))
    onStep('dns', null)
  }

  const ptr = await readPtr(out.ip, signal).catch(() => '')
  if (ptr) {
    out.ptr = ptr
    onStep('ptr', null)
  }

  const [cn, intl, claude, rtc] = await Promise.all([
    get('https://myip.ipip.net/json', signal).then(response => response.json()).catch(() => null),
    get('https://api.ip.sb/geoip', signal).then(response => response.json()).catch(() => null),
    readTrace('claude.ai', signal).catch(() => null),
    probeWebrtc(),
  ])

  if (cn && cn.data) {
    out.exits.push(['ex_cn', String(cn.data.ip || '')])
    onStep('ex_cn', null)
  }
  const intlIp = intl && (intl.ip || '')
  if (intlIp) {
    out.exits.push(['ex_intl', String(intlIp)])
    onStep('ex_intl', null)
  }
  if (claude) {
    out.exits.push(['ex_claude', claude.map.ip || ''])
    out.ms.ex_claude = Math.round(claude.ms)
    onStep('ex_claude', out.ms.ex_claude)
  }
  if (rtc !== false) {
    out.webrtc = rtc.ips
    out.lan = rtc.lan
  }

  return out
}

export { macOf }
