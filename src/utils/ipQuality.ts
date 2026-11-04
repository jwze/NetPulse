/**
 * IP 质量评分的纯逻辑：把十几个来源的应答归一，按公开规则扣分。
 * 规则与来源说明见 README；这里不访问网络。
 */

export type NetType = 'hosting' | 'residential' | 'mobile' | 'business' | 'education' | 'government'

export interface SourceData {
  cc?: string
  city?: string
  asn?: number
  org?: string
  host?: string
  type?: NetType
  proxy?: boolean
  vpn?: boolean
  tor?: boolean
  relay?: boolean
  abuser?: boolean
  risk?: number
  regCc?: string
  regName?: string
  regDate?: string
  rir?: string
  asCc?: string
  ports?: number[]
  tags?: string[]
  anycast?: boolean
  extra?: [string, string][]
}

export interface SourceResult {
  id: string
  name: string
  data?: SourceData
  error?: string
  ms: number
}

export interface DnsblResult {
  id: string
  name: string
  listed: boolean | null
  codes?: string[]
}

export const AI_BLOCKED = ['CN', 'HK', 'MO', 'RU', 'BY', 'IR', 'KP', 'SY', 'CU']

const RISK_W: Record<string, number> = { ipqs: 2, scamalytics: 2, abuseipdb: 2, proxycheck: 1.5, ipdata: 1, ipapiis: 1, ipquery: 0.5 }
const GEO_PREF = ['ipinfo', 'cloudflare', 'ipqs', 'ipapi', 'ip2location', 'proxycheck', 'ipquery', 'ipapiis', 'ipdata', 'ipwho', 'ipsb', 'geojs']

export const GRADES: [number, string][] = [[85, 'A'], [70, 'B'], [50, 'C'], [30, 'D'], [0, 'F']]
export const gradeOf = (score: number) => GRADES.find(([min]) => score >= min)?.[1] || 'F'

export const TYPE_TEXT: Record<NetType, string> = {
  hosting: '机房 / 云主机',
  residential: '家庭宽带',
  mobile: '移动网络',
  business: '企业网络',
  education: '教育网',
  government: '政府网络',
}

export interface ScorePart {
  k: string
  pts: number
  p: Record<string, number | string>
}

export interface Note {
  lv: 'good' | 'warn' | 'bad' | 'info'
  k: string
  p: Record<string, unknown>
}

export interface UseVerdict {
  lv: 'good' | 'warn' | 'bad'
  why: string
}

export interface Assessment {
  score: number
  grade: string
  parts: ScorePart[]
  notes: Note[]
  uses: Record<string, UseVerdict>
  summary: {
    cc: string | null
    city: string | null
    ccs: { cc: string; by: string[] }[]
    asn: number | null
    org: string | null
    host: string | null
    type: NetType | null
    hostShare: number
    regCc: string | null
    regFrom: 'rir' | 'asn' | null
    native: boolean | null
    risk: number | null
    risks: { id: string; v: number; w: number }[]
    flags: Record<string, { yes: number; of: number; by: string[] }>
    ports: number[]
    tags: string[]
    regName: string | null
    regDate: string | null
    rir: string | null
    dnsbl: { listed: number; checked: number }
  }
}

const count = <T>(list: T[], key: (item: T) => string | number | undefined | null) => {
  const map = new Map<string, number>()
  for (const item of list) {
    const k = key(item)
    if (k != null) map.set(String(k), (map.get(String(k)) || 0) + 1)
  }
  return map
}

const top = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1])[0]

/** results: 有应答的来源；dnsbl: 每个黑名单的结论 */
export function assess(results: SourceResult[], dnsbl: DnsblResult[] = []): Assessment {
  const answered = results.filter(item => item.data)
  const by = Object.fromEntries(answered.map(item => [item.id, item.data as SourceData])) as Record<string, SourceData>
  const geo = answered.filter(item => item.data?.cc)

  const ccVotes = count(geo, item => item.data?.cc)
  const cc = ccVotes.size ? top(ccVotes)[0] : null
  const ccs = [...ccVotes.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code]) => ({ cc: code, by: geo.filter(item => item.data?.cc === code).map(item => item.id) }))
  const pref = (id: string) => {
    const index = GEO_PREF.indexOf(id)
    return index < 0 ? 99 : index
  }
  const geoMain = geo.filter(item => item.data?.cc === cc).sort((a, b) => pref(a.id) - pref(b.id))
  const city = geoMain.find(item => item.data?.city)?.data?.city || null

  const asnVotes = count(answered, item => item.data?.asn)
  const asn = asnVotes.size ? Number(top(asnVotes)[0]) : null
  const org =
    ['ipguide', 'ipinfo', 'cloudflare', 'ipapiis', 'proxycheck', 'ipapi', 'ipwho']
      .map(id => by[id])
      .find(data => data && data.org && (!asn || data.asn === asn))?.org ||
    answered.find(item => item.data?.org)?.data?.org ||
    null
  const host =
    ['ipapi', 'ipinfo', 'proxycheck', 'shodan', 'ipqs', 'abuseipdb'].map(id => by[id]).find(data => data && data.host)?.host || null

  const regCc = by.rdap?.regCc || by.ipguide?.asCc || null
  const regFrom: 'rir' | 'asn' | null = by.rdap?.regCc ? 'rir' : regCc ? 'asn' : null
  const native = regCc && cc ? regCc === cc : null

  const typed = answered.filter(item => item.data?.type)
  const tv = count(typed, item => item.data?.type)
  const share = (type: NetType) => (typed.length ? (tv.get(type) || 0) / typed.length : 0)
  const notHosting = ['ipapi', 'ipquery'].filter(id => by[id] && !by[id].type).length
  const typeVotes = typed.length + notHosting
  const hostShare = typeVotes ? (tv.get('hosting') || 0) / typeVotes : 0
  let type: NetType | null = tv.size ? (top(tv)[0] as NetType) : null
  if (type === 'hosting' && hostShare < 0.5) type = tv.get('mobile') ? 'mobile' : null
  if (!type && typeVotes) type = 'residential'

  const flag = (key: keyof SourceData) => {
    const list = answered.filter(item => typeof item.data?.[key] === 'boolean')
    const yes = list.filter(item => item.data?.[key])
    return { yes: yes.length, of: list.length, by: yes.map(item => item.id) }
  }
  const flags = {
    proxy: flag('proxy'),
    vpn: flag('vpn'),
    tor: flag('tor'),
    relay: flag('relay'),
    abuser: flag('abuser'),
  }
  const rate = (item: { yes: number; of: number }) => (item.of ? item.yes / item.of : 0)
  const torListed = by.tor?.tor === true

  const risks = answered
    .filter(item => typeof item.data?.risk === 'number')
    .map(item => ({ id: item.id, v: item.data!.risk as number, w: RISK_W[item.id] || 1 }))
  const weight = risks.reduce((sum, item) => sum + item.w, 0)
  const risk = weight ? Math.round(risks.reduce((sum, item) => sum + item.v * item.w, 0) / weight) : null

  const listed = dnsbl.filter(item => item.listed === true)
  const blChecked = dnsbl.filter(item => item.listed !== null).length
  const ports = by.shodan?.ports || []
  const tags = by.shodan?.tags || []

  const parts: ScorePart[] = []
  const take = (k: string, points: number, p: Record<string, number | string> = {}) => {
    const pts = Math.round(points)
    if (pts > 0) parts.push({ k, pts, p })
  }
  take('p_hosting', type === 'hosting' ? 20 : 20 * hostShare, { n: tv.get('hosting') || 0, of: typeVotes })
  if (type !== 'hosting') take('p_business', 5 * share('business'))
  take('p_proxy', 20 * rate(flags.proxy), { n: flags.proxy.yes, of: flags.proxy.of })
  take('p_vpn', 15 * rate(flags.vpn), { n: flags.vpn.yes, of: flags.vpn.of })
  take('p_tor', torListed ? 40 : 40 * rate(flags.tor), { n: flags.tor.yes, of: flags.tor.of })
  take('p_abuser', 10 * rate(flags.abuser), { n: flags.abuser.yes, of: flags.abuser.of })
  if (risk !== null) take('p_risk', 0.35 * risk, { v: risk })
  take('p_dnsbl', Math.min(24, 6 * listed.length), { n: listed.length })

  const score = Math.max(0, 100 - parts.reduce((sum, part) => sum + part.pts, 0))

  const notes: Note[] = []
  const note = (lv: Note['lv'], k: string, p: Record<string, unknown> = {}) => notes.push({ lv, k, p })
  const anyFlag = flags.proxy.yes || flags.vpn.yes || flags.tor.yes
  if (torListed || rate(flags.tor) >= 0.5) note('bad', 'n_tor')
  else if (flags.vpn.yes || flags.proxy.yes)
    note(rate(flags.vpn) + rate(flags.proxy) >= 0.5 ? 'bad' : 'warn', 'n_anon', {
      n: new Set([...flags.vpn.by, ...flags.proxy.by]).size,
    })
  else if (typeVotes) note('good', 'n_noanon')
  if (type) note(type === 'hosting' ? 'warn' : type === 'residential' || type === 'mobile' ? 'good' : 'info', `n_type_${type}`)
  if (type === 'mobile') note('info', 'n_cgnat')
  if (native === true) note('good', 'n_native', { reg: regCc })
  else if (native === false) note('warn', regFrom === 'rir' ? 'n_broadcast' : 'n_broadcast_as', { reg: regCc, cc })
  if (ccs.length > 1) note('warn', 'n_geo_split', { list: ccs.map(item => item.cc) })
  if (risk !== null)
    note(risk >= 70 ? 'bad' : risk >= 35 ? 'warn' : 'good', risk >= 70 ? 'n_risk_high' : risk >= 35 ? 'n_risk_mid' : 'n_risk_low', {
      v: risk,
      n: risks.length,
    })
  if (flags.abuser.yes) note('bad', 'n_abuser', { n: flags.abuser.yes })
  if (listed.length) note('bad', 'n_dnsbl', { n: listed.length, of: blChecked, list: listed.map(item => item.name) })
  else if (blChecked) note('good', 'n_dnsbl_ok', { of: blChecked })
  if (flags.relay.yes) note('info', 'n_relay')
  if (by.ipinfo?.anycast) note('info', 'n_anycast')
  if (tags.length && tags.some(tag => ['vpn', 'proxy', 'tor'].includes(tag))) note('warn', 'n_scan_tags', { list: tags })
  if (ports.length) note('info', 'n_ports', { list: ports.slice(0, 8) })

  const hosting = type === 'hosting'
  const uses: Record<string, UseVerdict> = {}
  const set = (k: string, lv: UseVerdict['lv'], why: string) => {
    uses[k] = { lv, why }
  }
  if (torListed || rate(flags.vpn) + rate(flags.proxy) >= 0.5) set('stream', 'bad', 'u_stream_vpn')
  else if (hosting || anyFlag) set('stream', 'warn', hosting ? 'u_stream_dc' : 'u_stream_flag')
  else if (native === false || ccs.length > 1) set('stream', 'warn', 'u_stream_geo')
  else set('stream', 'good', 'u_stream_ok')

  if (cc && AI_BLOCKED.includes(cc)) set('ai', 'bad', 'u_ai_region')
  else if (torListed || (risk !== null && risk >= 70)) set('ai', 'bad', 'u_ai_risk')
  else if (hosting && (anyFlag || (risk !== null && risk >= 35))) set('ai', 'warn', 'u_ai_dc')
  else set('ai', 'good', 'u_ai_ok')

  if (torListed || (risk !== null && risk >= 75) || listed.length >= 2) set('captcha', 'bad', 'u_captcha_bad')
  else if ((risk !== null && risk >= 40) || (hosting && anyFlag) || listed.length) set('captcha', 'warn', 'u_captcha_some')
  else set('captcha', 'good', 'u_captcha_ok')

  if (torListed || (risk !== null && risk >= 70) || flags.abuser.yes >= 2) set('account', 'bad', 'u_account_bad')
  else if ((risk !== null && risk >= 35) || anyFlag || hosting || flags.abuser.yes) set('account', 'warn', 'u_account_some')
  else set('account', 'good', 'u_account_ok')

  if (listed.length) set('mail', 'bad', 'u_mail_listed')
  else if (type === 'residential' || type === 'mobile') set('mail', 'warn', 'u_mail_home')
  else if (!host) set('mail', 'warn', 'u_mail_rdns')
  else set('mail', 'good', 'u_mail_ok')

  return {
    score,
    grade: gradeOf(score),
    parts,
    notes,
    uses,
    summary: {
      cc,
      city,
      ccs,
      asn,
      org,
      host,
      type,
      hostShare: Math.round(hostShare * 100) / 100,
      regCc,
      regFrom,
      native,
      risk,
      risks,
      flags,
      ports,
      tags,
      regName: by.rdap?.regName || null,
      regDate: by.rdap?.regDate || null,
      rir: by.rdap?.rir || by.ipguide?.rir || by.ipapiis?.rir || null,
      dnsbl: { listed: listed.length, checked: blChecked },
    },
  }
}

/* ---------- 文案 ---------- */

export const PART_TEXT: Record<string, string> = {
  p_hosting: '机房 / 云主机',
  p_business: '企业网络',
  p_proxy: '代理标记',
  p_vpn: 'VPN 标记',
  p_tor: 'Tor 出口',
  p_abuser: '滥用记录',
  p_risk: '欺诈评分',
  p_dnsbl: '邮件黑名单',
}

export const USE_LABEL: Record<string, string> = {
  stream: '流媒体',
  ai: 'AI 服务',
  captcha: '验证码',
  account: '注册与支付',
  mail: '自己发邮件',
}

export const USE_WHY: Record<string, string> = {
  u_stream_vpn: '被识别为匿名出口，片库会受限',
  u_stream_dc: '机房地址，多数平台只给自制剧',
  u_stream_flag: '有代理标记，部分平台会拦',
  u_stream_geo: '多个来源对位置说法不一',
  u_stream_ok: '位置与信誉都正常',
  u_ai_region: '所在地不在服务范围',
  u_ai_risk: '信誉过低，注册会被拒',
  u_ai_dc: '机房地址加风险标记，容易触发人机验证',
  u_ai_ok: '地区与信誉都可以',
  u_captcha_bad: '信誉差，验证码会反复出现',
  u_captcha_some: '有一定风险，可能偶尔弹验证',
  u_captcha_ok: '通常不会额外验证',
  u_account_bad: '高风险地址，注册与支付多被拒',
  u_account_some: '可能要求额外验证',
  u_account_ok: '注册与支付通常顺利',
  u_mail_listed: '在邮件黑名单里，直发会被退信',
  u_mail_home: '家宽 / 移动地址，按策略常被拒收',
  u_mail_rdns: '没有反向解析，直发可信度低',
  u_mail_ok: '反向解析正常，可以直发',
}

export function noteText(note: Note): string {
  const p = note.p as Record<string, string | number | string[]>
  const list = (value: unknown) => (Array.isArray(value) ? value.join('、') : '')
  switch (note.k) {
    case 'n_tor': return '这是 Tor 出口节点，多数服务会直接拒绝。'
    case 'n_anon': return `${p.n} 个来源标记了代理或 VPN。`
    case 'n_noanon': return '没有来源把它标记为代理或 VPN。'
    case 'n_type_hosting': return '网络类型是机房 / 云主机，不是住宅线路。'
    case 'n_type_residential': return '网络类型是家庭宽带。'
    case 'n_type_mobile': return '网络类型是移动网络。'
    case 'n_type_business': return '网络类型是企业网络。'
    case 'n_type_education': return '网络类型是教育网。'
    case 'n_type_government': return '网络类型是政府网络。'
    case 'n_cgnat': return '移动网络多处在运营商级 NAT 之后，同一地址会分给很多设备。'
    case 'n_native': return `注册国家与使用地一致（${p.reg}），是原生地址。`
    case 'n_broadcast': return `注册在 ${p.reg}，实际使用在 ${p.cc}，属于广播地址。`
    case 'n_broadcast_as': return `所属网络的注册地在 ${p.reg}，实际使用在 ${p.cc}，可能不是原生 IP。`
    case 'n_geo_split': return `来源对位置说法不一：${list(p.list)}。`
    case 'n_risk_high': return `加权欺诈评分 ${p.v}（${p.n} 个来源），风险很高。`
    case 'n_risk_mid': return `加权欺诈评分 ${p.v}（${p.n} 个来源），有一定风险。`
    case 'n_risk_low': return `加权欺诈评分 ${p.v}（${p.n} 个来源），风险较低。`
    case 'n_abuser': return `${p.n} 个来源记录了滥用行为。`
    case 'n_dnsbl': return `${p.of} 个邮件黑名单里有 ${p.n} 个列出：${list(p.list)}。`
    case 'n_dnsbl_ok': return `${p.of} 个邮件黑名单都没有列出。`
    case 'n_relay': return '来自 iCloud 私密中继，出口由苹果分配。'
    case 'n_anycast': return '这个地址是任播地址，物理位置由路由决定。'
    case 'n_scan_tags': return `全网扫描给它打了标签：${list(p.list)}。`
    case 'n_ports': return `扫描看到开放端口：${list(p.list)}。`
    default: return ''
  }
}
