/**
 * 隐私画像的纯逻辑：从读数里得出「网站会怎么看你」，以及伪装检测的结论与分享码。
 * 不访问网络，便于单元测试。
 */
import { CHECKS, NOT_COUNTED, type CheckId } from '../data/privacySniffers.ts'
import {
  grade,
  isRelayIp,
  langCC,
  looksLikeDatacenterOrg,
  macOf,
  offTxt,
  platformOff,
  sameLanguage,
  spokenIn,
  sysLangs,
  tzCC,
  glVendorOff,
  engineOff,
  type Level,
} from './privacyInfer.ts'
import type { LocalSide, NetReadout } from './privacyProbe.ts'
import { countryName, shortenIsp } from './ipInfo.ts'

export interface Verdict {
  level: Level
  text: string
}

export const LEVEL_TEXT: Record<Level, string> = { ok: '正常', warn: '有破绽', bad: '露馅', info: '说不准' }
export const LEVEL_TONE: Record<Level, string> = { ok: 'good', warn: 'ok', bad: 'bad', info: 'muted' }

export const CHECK_NAME: Record<CheckId, string> = {
  tz: '系统时区',
  lang: '浏览器语言',
  syslang: '系统语言',
  dns: 'DNS 泄露',
  split: '分流',
  webrtc: 'WebRTC',
  dc: '机房 IP',
  ua: '系统自述',
  tamper: '环境被改',
  fp: '指纹稳定性',
  bot: '自动化',
}

const cc = (code?: string | null) => (code ? countryName(code, code) : '')

/* ---------- 分流判断 ---------- */

const netOf = (ip: string) => (ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip.split('.').slice(0, 2).join('.'))

function splitOf(exits: [string, string][]) {
  const seen: [string, string][] = []
  for (const [id, ip] of exits) {
    if (!ip) continue
    const other = seen.find(([, value]) => value.includes(':') === ip.includes(':') && netOf(value) !== netOf(ip))
    if (other) return { a: other[0], b: id, n: new Set(exits.filter(([, x]) => x).map(([, x]) => netOf(x))).size }
    seen.push([id, ip])
  }
  return null
}

/* ---------- 十二项检测 ---------- */

export interface CheckInput {
  local: LocalSide
  net: NetReadout
}

export function runChecks(input: CheckInput): Record<CheckId, Verdict | null> {
  const { local, net } = input
  const ipcc = net.cc
  const out = {} as Record<CheckId, Verdict | null>
  const ipOff = net.tzOffset

  /* 时区 */
  if (!local.tz || !ipcc) out.tz = null
  else if (ipOff != null && local.tzOffset === ipOff) out.tz = { level: 'ok', text: `你的时钟和出口都在 UTC${offTxt(local.tzOffset)}，对得上` }
  else if (local.firefox && /^(Atlantic\/Reykjavik|UTC|Etc\/UTC)$/.test(local.tz))
    out.tz = { level: 'warn', text: `Firefox 的防指纹功能把所有网站都报成 ${local.tz}：真实时区藏住了，但和出口的 UTC${ipOff != null ? offTxt(ipOff) : '?'} 对不上` }
  else if (tzCC(local.tz) && tzCC(local.tz) === ipcc)
    out.tz = { level: 'warn', text: `出口在${cc(ipcc)}，你的时区是 ${local.tz}：同一个国家，但不是出口那座城市` }
  else
    out.tz = {
      level: 'bad',
      text: `出口在${cc(ipcc)}（UTC${ipOff != null ? offTxt(ipOff) : '?'}），你的系统时区是 ${local.tz}（UTC${local.tzOffset != null ? offTxt(local.tzOffset) : '?'}）：网站一眼看出时区和地址对不上`,
    }

  /* 语言 */
  const first = local.langs[0]
  if (!ipcc || !local.langs.length) out.lang = null
  else if (local.langs.some(l => langCC(l) === ipcc || (!/^en\b/i.test(l) && spokenIn(l).includes(ipcc))))
    out.lang = { level: 'ok', text: `${first} 用在${cc(ipcc)}说得通` }
  else if (!langCC(first) || /^en\b/i.test(first)) out.lang = { level: 'info', text: `${first} 到处都有人用，说明不了你在哪` }
  else out.lang = { level: 'warn', text: `浏览器语言是 ${first}，指向${cc(langCC(first))}，出口却在${cc(ipcc)}` }

  /* 系统语言 */
  const sys = sysLangs({ os: local.dev.os, fonts: local.fonts, voices: local.voices, kbd: local.kbd })
  if (sys === false || !ipcc) out.syslang = { level: 'info', text: `${local.dev.os || '这个系统'}自带各国字体和语音，看不出装过什么语言` }
  else if (!sys.cc.length) out.syslang = { level: 'ok', text: '看起来只装了系统默认的那一种语言' }
  else if (sys.cc.some(code => sameLanguage(code).includes(ipcc)))
    out.syslang = { level: 'ok', text: `系统里装的${cc(sys.cc[0])}语言包，和出口对得上` }
  else
    out.syslang = {
      level: sys.from.length > 1 ? 'warn' : 'info',
      text:
        sys.from.length > 1
          ? `${sys.from.map(row => (row === 'fonts' ? '字体' : row === 'voices' ? '语音' : '键盘')).join('、')}都像是${cc(sys.cc[0])}的系统，和出口对不上`
          : `只有${sys.from[0] === 'fonts' ? '字体' : sys.from[0] === 'voices' ? '语音' : '键盘'}像是${cc(sys.cc[0])}的：可能是装某个软件带进来的，单凭这一项说明不了`,
    }

  /* DNS */
  if (!net.dnsIp || !ipcc) out.dns = { level: 'info', text: '这次没读到 DNS 服务器在哪' }
  else if (!net.dnsCC) out.dns = { level: 'info', text: `解析器 ${net.dnsIp} 查不到归属地` }
  else if (net.dnsCC === ipcc) out.dns = { level: 'ok', text: `替你查域名的是${cc(net.dnsCC)}的服务器，和出口一致` }
  else out.dns = { level: 'bad', text: `DNS 服务器在${cc(net.dnsCC)}（${net.dnsIp}），出口却在${cc(ipcc)}：域名解析没走代理，泄露了你的真实位置` }

  /* 分流 */
  const exits = net.exits.filter(([, ip]) => ip)
  if (exits.length < 2) out.split = { level: 'info', text: '只读到一个出口，判断不了分流' }
  else {
    const split = splitOf(net.exits)
    out.split = split
      ? { level: 'warn', text: `不同站点看到的出口不在一个网段（${split.n} 个网络）：按域名分流的规则被看出来了` }
      : { level: 'ok', text: `${exits.length} 个站点看到的是同一个出口` }
  }

  /* WebRTC */
  if (net.webrtc === false) out.webrtc = { level: 'ok', text: 'WebRTC 关着，UDP 那条路走不通' }
  else if (net.webrtc === null) out.webrtc = null
  else {
    const site = [net.ip, ...net.exits.map(([, ip]) => ip)].filter(Boolean)
    const relay = isRelayIp(net.ip) && net.webrtc.length > 0 && net.webrtc.every(isRelayIp)
    const other = net.webrtc.filter(ip => !site.includes(ip))
    if (relay) out.webrtc = { level: 'ok', text: 'WebRTC 也走的是 iCloud 专用代理这类中继，没漏出真实地址' }
    else if (!net.webrtc.length) out.webrtc = { level: 'ok', text: 'STUN 没读到公网地址，没有泄露' }
    else if (other.length) out.webrtc = { level: 'bad', text: `WebRTC 报出了 ${other[0]}，和网页看到的 ${net.ip || '出口'} 不是同一个：UDP 没走代理` }
    else out.webrtc = { level: 'ok', text: 'WebRTC 读到的地址和网页看到的一致' }
  }

  /* 机房 */
  const mac = macOf(net.ip)
  if (!net.ip) out.dc = null
  else if (isRelayIp(net.ip)) out.dc = { level: 'warn', text: '这是 iCloud 专用代理这类中继的出口：网站看得出来，但看不到你的真实地址' }
  else if (looksLikeDatacenterOrg(net.org) || [13335, 16509, 14618, 15169, 8075, 14061, 63949, 20473, 16276, 24940, 31898, 45102, 37963].includes(Number(net.asn)))
    out.dc = { level: 'warn', text: `出口属于机房网络（${net.org || 'AS' + net.asn}）：网站会把你当成代理或 VPN 用户` }
  else out.dc = { level: 'ok', text: `出口是 ${net.org || '运营商'} 的家宽或移动网络，不是机房` }
  if (mac) out.dc = { level: 'bad', text: `出口是机房网络（${net.org || 'AS' + net.asn}），而且 IPv6 地址里还夹着网卡号 ${mac}` }

  /* 系统自述 */
  if (!local.dev.os) out.ua = null
  else {
    const claim = /^(macOS|iOS|iPadOS)$/.test(local.dev.os) ? 'Apple' : local.dev.os
    const hint = local.hintOS ? (/^(macOS|iOS|iPadOS)$/.test(local.hintOS) ? 'Apple' : local.hintOS) : ''
    const tells = [hint, local.gpuOS || ''].filter(Boolean)
    const off = tells.find(tell => tell !== claim && !(tell === 'Android' && (claim === 'Linux' || claim === 'HarmonyOS')))
    out.ua = off
      ? { level: 'bad', text: `UA 说是 ${local.dev.os}，可${off === hint ? '客户端提示' : '显卡'}透露的是 ${off}：两边对不上` }
      : { level: 'ok', text: `${local.dev.os}：UA、客户端提示和显卡说法一致` }
  }

  /* 环境篡改 */
  const tamper: string[] = [...local.tamper]
  if (platformOff(navigator.platform, local.dev.os)) tamper.push('navigator.platform')
  if (glVendorOff(local.glVendor, local.gpuRaw)) tamper.push('WebGL 厂商和显卡')
  if (engineOff(local.engineClaim, local.engineRange)) tamper.push('UA 版本和 JS 引擎')
  out.tamper = tamper.length
    ? { level: 'bad', text: `有 ${tamper.length} 处被改过：${[...new Set(tamper)].slice(0, 4).join('、')}：网站看得出你在伪装` }
    : { level: 'ok', text: '没发现被改写过的浏览器接口' }

  /* 指纹稳定性 */
  if (local.canvasSame === null) out.fp = null
  else if (!local.canvasSame) out.fp = { level: 'ok', text: '两次画出来的图不一样：浏览器按网站打乱了指纹，认不出你' }
  else if (local.ios) out.fp = { level: 'info', text: 'iPhone 上所有浏览器都用同一个内核，同型号同系统画出来都一样：稳定，但几百万人共用' }
  else out.fp = { level: 'warn', text: '同一个页面里两次画出来一样：清 Cookie 也没用，指纹能一直认出你' }

  /* 自动化 */
  if (local.webdriver === null) out.bot = null
  else out.bot = local.webdriver ? { level: 'bad', text: 'navigator.webdriver 是 true：这是自动化工具开的浏览器' } : { level: 'ok', text: '没有自动化工具的标记' }

  return out
}

/** 环境评分：只算「说明你在哪」的那些项 */
export function scoreOf(verdicts: Partial<Record<CheckId, Verdict | null>>) {
  const levels: Record<string, Level | undefined> = {}
  for (const id of CHECKS) levels[id] = verdicts[id]?.level
  const counted = CHECKS.filter(id => !NOT_COUNTED.includes(id)) as CheckId[]
  return { ...grade(levels, counted), counted }
}

/* ---------- 画像 ---------- */

export interface Portrait {
  place: string
  nettype: string
  isp: string
  dns: string
  device: string
  browser: string
  screen: string
  gpu: string
  langs: string
  tz: string
  shield: string
  fpid: string
  nat: string
}

const KIND_TEXT: Record<string, string> = { pc: '电脑', mac: 'Mac', phone: '手机', tablet: '平板' }

function netType(net: NetReadout) {
  if (!net.ip) return '网络'
  if (isRelayIp(net.ip)) return '中继出口'
  if (looksLikeDatacenterOrg(net.org)) return '机房出口'
  if (/cellular|wireless|LTE|5G|mobile network/i.test(net.org)) return '移动网络'
  return '宽带'
}

export function portraitOf(local: LocalSide, net: NetReadout): Portrait {
  const nat = nationalityOf(local, net)
  return {
    place: net.city ? `${cc(net.cc)} ${net.city}` : cc(net.cc) || '看不出在哪',
    nettype: netType(net),
    isp: net.org ? shortenIsp(net.org) || net.org : '看不出运营商',
    dns: net.dnsCC ? cc(net.dnsCC) : net.dnsIp || '没读到',
    device: `${local.dev.model || KIND_TEXT[local.dev.kind] || '设备'}${local.dev.osv ? ' · ' + local.dev.os + ' ' + local.dev.osv : local.dev.os ? ' · ' + local.dev.os : ''}`,
    browser: local.br.name ? `${local.br.name}${local.br.v ? ' ' + local.br.v : ''}` : '看不出浏览器',
    screen: `${local.rows.screen || '—'}`,
    gpu: local.gpu || '显卡读不到',
    langs: local.langs[0] || '—',
    tz: local.tz || '—',
    shield: local.rows.shield || '—',
    fpid: local.fpid || '—',
    nat: nat ? cc(nat.cc) : '看不出',
  }
}

function nationalityOf(local: LocalSide, net: NetReadout) {
  const first = local.langs[0] || ''
  const lcc = langCC(first)
  const tcc = tzCC(local.tz)
  if (lcc && !/^en\b/i.test(first)) return { cc: lcc }
  if (tcc) return { cc: tcc }
  return net.cc ? { cc: net.cc } : null
}

export interface Label {
  id: string
  text: string
}

/** 网站会给你贴上的标签 */
export function labelsOf(local: LocalSide, net: NetReadout, verdicts: Partial<Record<CheckId, Verdict | null>>): Label[] {
  const out: Label[] = []
  const os = local.dev.os || ''
  if (/iOS|iPadOS|macOS/.test(os)) out.push({ id: 'apple', text: '苹果用户' })
  if (Number((local.rows.cpu || '').replace(/\D/g, '')) >= 12) out.push({ id: 'power', text: '高配机器' })
  if (/RTX|Radeon RX|Arc A\d|M\d (Pro|Max)/i.test(local.gpu || '')) out.push({ id: 'game', text: '可能打游戏' })
  if (verdicts.dc && verdicts.dc.level !== 'ok') out.push({ id: 'proxy', text: '用代理的' })
  if (verdicts.tz?.level === 'bad') out.push({ id: 'abroad', text: '时钟在别处' })
  if (local.rows.adblock === '拦下了广告位') out.push({ id: 'priv', text: '隐私意识强' })
  if (local.rows.screens?.includes('多块')) out.push({ id: 'multi', text: '多屏办公' })
  const hour = new Date().getHours()
  if (hour >= 0 && hour < 5) out.push({ id: 'night', text: '夜猫子' })
  if (local.fonts.some(name => /JetBrains Mono|Fira Code|Cascadia Code|Source Code Pro/.test(name))) out.push({ id: 'dev', text: '写代码的' })
  if (local.kbd === 'AZERTY' || local.kbd === 'QWERTZ') out.push({ id: 'kbd', text: '非英语键盘' })
  if (net.org && /cellular|wireless|\bLTE\b/i.test(net.org)) out.push({ id: 'mobile', text: '手机网络上网' })
  return out.slice(0, 6)
}

/* ---------- 伪装检测的诊断句 ---------- */

export function verdictText(verdicts: Partial<Record<CheckId, Verdict | null>>) {
  const bad = CHECKS.filter(id => verdicts[id]?.level === 'bad')
  const warn = CHECKS.filter(id => verdicts[id]?.level === 'warn')
  if (bad.length) return { tone: 'bad', title: `${bad.length} 处对不上，网站能看出你不是一台普通设备`, ids: bad }
  if (warn.length) return { tone: 'warn', title: `${warn.length} 处可能露馅，看得出痕迹但不一定认定`, ids: warn }
  return { tone: 'ok', title: '各项都对得上，网站会相信你就在这里', ids: [] }
}

/* ---------- 分享码 ---------- */

const FLAG: Record<Level, string> = { ok: 'o', warn: 'w', bad: 'b', info: 'i' }
const UNFLAG: Record<string, Level> = { o: 'ok', w: 'warn', b: 'bad', i: 'info' }

export interface Shared {
  ts: number
  code: string
  checks: Partial<Record<CheckId, Level>>
  place: string
  device: string
  browser: string
  fpid: string
  shield: string
}

export function encodeShare(shared: Shared) {
  const payload = {
    t: shared.ts,
    c: CHECKS.map(id => shared.checks[id] ? FLAG[shared.checks[id]!] : '-').join(''),
    p: shared.place,
    d: shared.device,
    b: shared.browser,
    f: shared.fpid,
    s: shared.shield,
  }
  return `#pv=1.${btoa(encodeURIComponent(JSON.stringify(payload))).replace(/=+$/, '')}`
}

export function parseShare(hash: string, ids: string[]): Shared | null {
  const text = String(hash || '')
  const match = /#pv=1\.([A-Za-z0-9+/_-]+)/.exec(text)
  if (!match) return null
  try {
    const raw = match[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(decodeURIComponent(atob(raw))) as { t?: number; c?: string; p?: string; d?: string; b?: string; f?: string; s?: string }
    const flags = String(payload.c || '')
    const checks: Partial<Record<CheckId, Level>> = {}
    for (const [index, id] of CHECKS.entries()) {
      const level = UNFLAG[flags[index] || '']
      if (level && (!ids.length || ids.includes(id))) checks[id] = level
    }
    return {
      ts: Number(payload.t) || Date.now(),
      code: match[1],
      checks,
      place: payload.p || '',
      device: payload.d || '',
      browser: payload.b || '',
      fpid: payload.f || '',
      shield: payload.s || '',
    }
  } catch {
    return null
  }
}
