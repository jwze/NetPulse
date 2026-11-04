/**
 * 出口对照的纯逻辑：读取各探测器的应答、按网络合并出口、给出结论。
 * 不访问网络，便于单元测试。
 */
import { ipFamily, looksLikeDatacenter, netOf, sameNet, type ExitGeo } from '@/utils/latency'
import { AI_BLOCKED, AI_CHECK, GROUPS, PROBES, type EgressProbe, type ProbeGroup } from '@/data/egressProbes'

export interface CfTrace {
  colo: string
  loc: string
  warp: string
}

export interface ReadAnswer {
  ip: string
  geo?: ExitGeo
  cf?: CfTrace
}

export type Why = 'timeout' | 'net' | 'http' | 'parse' | 'stun'

export interface ProbeRow {
  l: string[]
  why?: Why
  ms: number | null
  cf?: { colo: string; loc: string }
}

export interface EgressExit {
  key: string
  ips: string[]
  probes: string[]
  cc: string
  city: string
  asn: number | null
  org: string
  dc: boolean
  warp: boolean
  v4: boolean
  v6: boolean
  kind: 'local' | 'proxy'
  letter: string
}

/* ---------- 地址 ---------- */

const V4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/

export function isIp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (V4.test(value)) return true
  return /^[0-9a-f:]+$/i.test(value) && value.includes(':') && value.length <= 39
}

export function maskIp(ip: string) {
  if (!isIp(ip)) return ''
  return ipFamily(ip) === 6
    ? `${netOf(ip)}:…`
    : `${ip.split('.').slice(0, 2).join('.')}.•.•`
}

const asnOf = (value: unknown): number | null => {
  const match = /(\d+)/.exec(String(value ?? ''))
  return match ? Number(match[1]) : null
}

const ccOf = (value: unknown): string => {
  const text = String(value ?? '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(text) ? text : ''
}

const geo = (cc: unknown, city: unknown, asn: unknown, org: unknown): ExitGeo => ({
  cc: ccOf(cc),
  city: String(city ?? '').trim(),
  asn: asnOf(asn),
  org: String(org ?? '').replace(/^AS\d+\s*/, '').trim(),
})

export function parseTrace(text: unknown): CfTrace & { ip: string } {
  const map: Record<string, string> = {}
  for (const line of String(text ?? '').split('\n')) {
    const index = line.indexOf('=')
    if (index > 0) map[line.slice(0, index).trim()] = line.slice(index + 1).trim()
  }
  return { ip: map.ip || '', colo: map.colo || '', loc: ccOf(map.loc), warp: map.warp || 'off' }
}

/* ---------- 读取应答 ---------- */

type Body = Record<string, unknown> | string

function jsonOf(body: Body): Record<string, unknown> | null {
  return typeof body === 'object' && body ? body : null
}

export const READERS: Record<string, (body: Body) => ReadAnswer | null> = {
  text: body => ({ ip: String(body).trim().split(/\s+/)[0] }),
  trace: body => {
    const trace = parseTrace(body)
    return { ip: trace.ip, cf: { colo: trace.colo, loc: trace.loc, warp: trace.warp } }
  },
  ipip: body => {
    const data = (jsonOf(body)?.data || {}) as Record<string, unknown>
    return { ip: String(data.ip ?? '') }
  },
  iqiyi: body => {
    const text = String((jsonOf(body)?.t as string) || '')
    const match = /(\d+\.\d+\.\d+\.\d+|[0-9a-f:]{6,})$/i.exec(text)
    return { ip: match ? match[1] : '' }
  },
  ipsb: body => {
    const data = jsonOf(body) || {}
    return { ip: String(data.ip ?? ''), geo: geo(data.country_code, data.city, data.asn, data.isp || data.asn_organization) }
  },
  ipinfo: body => {
    const data = jsonOf(body) || {}
    return { ip: String(data.ip ?? ''), geo: geo(data.country, data.city, data.org, data.org) }
  },
  ipapico: body => {
    const data = jsonOf(body) || {}
    return { ip: String(data.ip ?? ''), geo: geo(data.country_code, data.city, data.asn, data.org) }
  },
  ipwho: body => {
    const data = jsonOf(body) || {}
    const conn = (data.connection || {}) as Record<string, unknown>
    return {
      ip: String(data.ip ?? ''),
      geo: data.success === false ? undefined : geo(data.country_code, data.city, conn.asn, conn.isp || conn.org),
    }
  },
  geojs: body => {
    const data = jsonOf(body) || {}
    return { ip: String(data.ip ?? ''), geo: geo(data.country_code, data.city, data.asn, data.organization_name) }
  },
  ipleak: body => {
    const data = jsonOf(body) || {}
    return { ip: String(data.ip ?? ''), geo: geo(data.country_code, data.city_name, data.as_number, data.isp_name) }
  },
  identme: body => {
    const data = jsonOf(body) || {}
    return { ip: String(data.ip ?? ''), geo: geo(data.cc, data.city, data.asn, data.aso) }
  },
  ipguide: body => {
    const data = jsonOf(body) || {}
    const net = (data.network || {}) as Record<string, unknown>
    const system = (net.autonomous_system || {}) as Record<string, unknown>
    const loc = (data.location || {}) as Record<string, unknown>
    return {
      ip: String(data.ip ?? ''),
      geo: system.asn ? geo(system.country, loc.city, system.asn, system.organization || system.name) : undefined,
    }
  },
  radar: body => {
    const data = jsonOf(body) || {}
    return { ip: String(data.ip_address ?? ''), geo: geo(data.country, data.city, data.asn, '') }
  },
  ipify: body => {
    const data = jsonOf(body) || {}
    return { ip: String(data.ip ?? '') }
  },
  bdc: body => {
    const data = jsonOf(body) || {}
    return { ip: String(data.ipString ?? '') }
  },
  stun: () => null,
}

/** 一条应答读取成地址，读不出来（或协议栈不符）就返回 null */
export function readProbe(probe: EgressProbe, body: Body): ReadAnswer | null {
  const reader = READERS[probe.read]
  if (!reader) return null
  let answer: ReadAnswer | null = null
  try {
    answer = reader(body)
  } catch {
    return null
  }
  if (!answer || !isIp(answer.ip)) return null
  if (probe.fam && ipFamily(answer.ip) !== probe.fam) return null
  if (answer.geo && !answer.geo.cc && !answer.geo.asn) delete answer.geo
  return answer
}

/* ---------- 出口 ---------- */

export interface SeenAddress {
  ip: string
  probe: string
}

/**
 * 同一网络（知道 ASN 时按 ASN）合并为一个出口：运营商的 IPv4 与 IPv6 是
 * 同一条线路。本地出口排在代理前面，同级别按看到它的探测器数量排序。
 */
export function groupEgress(
  seen: SeenAddress[],
  geoMap: Record<string, ExitGeo>,
  warp: boolean,
): EgressExit[] {
  const list: EgressExit[] = []
  const geoOf = (ip: string) => {
    if (geoMap[ip]) return geoMap[ip]
    const near = Object.keys(geoMap).find(other => sameNet(other, ip))
    return near ? geoMap[near] : null
  }
  for (const item of seen) {
    const info = geoOf(item.ip)
    const key = info?.asn ? `as${info.asn}` : `net${netOf(item.ip)}`
    let exit = list.find(entry => entry.key === key)
    if (!exit) {
      exit = {
        key,
        ips: [],
        probes: [],
        cc: '',
        city: '',
        asn: null,
        org: '',
        dc: false,
        warp: false,
        v4: false,
        v6: false,
        kind: 'local',
        letter: '',
      }
      list.push(exit)
    }
    if (!exit.ips.includes(item.ip)) exit.ips.push(item.ip)
    if (!exit.probes.includes(item.probe)) exit.probes.push(item.probe)
    if (info) {
      exit.cc = exit.cc || info.cc
      exit.city = exit.city || info.city
      exit.asn = exit.asn || info.asn
      exit.org = exit.org || info.org
    }
  }
  for (const exit of list) {
    exit.dc = !!exit.org && looksLikeDatacenter(exit.org)
    exit.warp = exit.asn === 13335 && warp
    for (const ip of exit.ips) {
      if (ipFamily(ip) === 6) exit.v6 = true
      else exit.v4 = true
    }
    const groups = exit.probes.map(id => PROBES.find(probe => probe.id === id)?.g)
    const score = (groups.includes('cn') ? 2 : 0) + (groups.includes('udp') ? 1 : 0)
    ;(exit as EgressExit & { score: number }).score = score
  }
  list.sort((a, b) => {
    const sa = (a as EgressExit & { score: number }).score || 0
    const sb = (b as EgressExit & { score: number }).score || 0
    return (
      Number(a.dc || a.warp) - Number(b.dc || b.warp) ||
      sb - sa ||
      b.probes.length - a.probes.length ||
      (a.key < b.key ? -1 : 1)
    )
  })
  return labelExits(list)
}

/** 机房网络或 WARP 记为代理（P），其余记为本地线路（D）；同类多于一个才编号 */
export function labelExits(list: EgressExit[]): EgressExit[] {
  for (const exit of list) exit.kind = exit.dc || exit.warp ? 'proxy' : 'local'
  for (const [kind, letter] of [['local', 'D'], ['proxy', 'P']] as const) {
    const same = list.filter(exit => exit.kind === kind)
    same.forEach((exit, index) => {
      exit.letter = same.length > 1 ? `${letter}${index + 1}` : letter
    })
  }
  return list
}

export function exitOfProbe(exits: EgressExit[]) {
  const map: Record<string, string[]> = {}
  for (const exit of exits) for (const id of exit.probes) (map[id] = map[id] || []).push(exit.letter)
  return map
}

/* ---------- 结论 ---------- */

export type Level = 'ok' | 'warn' | 'bad' | 'info' | 'none'

export interface Finding {
  s: Level
  k: string
  v: Record<string, unknown>
}

const none: Finding = { s: 'none', k: 'none', v: {} }

function majority(ids: string[], of: Record<string, string[]>): string | null {
  const count: Record<string, number> = {}
  for (const id of ids) for (const letter of of[id] || []) count[letter] = (count[letter] || 0) + 1
  const best = Object.entries(count).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]
  return best ? best[0] : null
}

export interface Findings {
  route: Finding
  except: Finding
  ai: Finding
  rtc: Finding
  nat: Finding
  v6: Finding
  tz: Finding
}

export const CHECK_ORDER = ['route', 'except', 'ai', 'rtc', 'nat', 'v6', 'tz'] as const

export interface NatInfo {
  k: 'cone' | 'sym' | 'none'
  multi: boolean
}

/**
 * @param cf 探测器 id → 它的 Cloudflare trace（loc 是该站点看到的国家）
 * @param tzCc 浏览器时区所属国家
 */
export function findings(
  exits: EgressExit[],
  cf: Record<string, { loc: string }>,
  tzCc: string,
  nat: NatInfo | null,
): Findings {
  if (!exits.length) {
    return { route: none, except: none, ai: none, rtc: none, nat: none, v6: none, tz: none }
  }
  const of = exitOfProbe(exits)
  const byLetter = Object.fromEntries(exits.map(exit => [exit.letter, exit]))
  const ids = (group: ProbeGroup) => PROBES.filter(probe => probe.g === group).map(probe => probe.id)

  const cn = majority(ids('cn'), of)
  const abroad = majority([...ids('intl'), ...ids('ai'), ...ids('web')], of) || cn
  const result = {} as Findings

  result.route = cn && cn !== abroad
    ? { s: 'info', k: 'split', v: { a: cn, b: abroad } }
    : { s: 'ok', k: 'one', v: { a: abroad } }

  // 海外目的地里走了别的出口的探测器
  const odd: Record<string, string[]> = {}
  const v6only = PROBES.filter(probe => probe.g === 'stack' && probe.fam === 6).map(probe => probe.id)
  for (const probe of PROBES) {
    if (!['intl', 'ai', 'web', 'stack'].includes(probe.g)) continue
    const letters = of[probe.id]
    if (!letters || !abroad || letters.includes(abroad)) continue
    ;(odd[letters[0]] = odd[letters[0]] || []).push(probe.id)
  }
  const groups = Object.entries(odd).map(([letter, list]) => ({
    x: letter,
    list: v6only.every(id => list.includes(id)) ? ['@v6', ...list.filter(id => !v6only.includes(id))] : list,
  }))
  result.except = groups.length ? { s: 'info', k: 'some', v: { groups } } : { s: 'ok', k: 'none', v: {} }

  const seen = AI_CHECK.filter(id => /^[A-Z]{2}$/.test(cf[id]?.loc || ''))
  if (!seen.length) result.ai = none
  else {
    const bad = seen.filter(id => AI_BLOCKED.includes(cf[id].loc))
    const letter = majority(ids('ai'), of)
    const exit = letter ? byLetter[letter] : null
    result.ai = bad.length
      ? { s: 'bad', k: 'bad', v: { list: bad, c: cf[bad[0]].loc } }
      : { s: 'ok', k: 'ok', v: { x: letter, c: cf[seen[0]].loc, dc: !!exit?.dc } }
  }

  const udpIds = PROBES.filter(probe => probe.read === 'stun' && of[probe.id]).map(probe => probe.id)
  const udpLetters = [...new Set(udpIds.flatMap(id => of[id]))]
  const leaked = udpLetters.filter(letter => byLetter[letter]?.kind === 'local')
  const proxied = abroad ? byLetter[abroad]?.kind !== 'local' : false
  result.rtc = !udpIds.length
    ? { s: 'ok', k: 'none', v: {} }
    : leaked.length && proxied
      ? { s: 'bad', k: 'leak', v: { a: leaked[0] } }
      : { s: 'ok', k: proxied && !leaked.length ? 'proxy' : 'same', v: { a: udpLetters[0] } }

  result.nat = !nat
    ? none
    : nat.k === 'none'
      ? { s: 'info', k: 'none', v: {} }
      : {
          s: nat.k === 'cone' ? 'ok' : 'warn',
          k: nat.k,
          v: { ...(nat.multi ? { multi: true } : {}), ...(udpLetters.some(letter => byLetter[letter]?.kind === 'proxy') ? { px: true } : {}) },
        }

  const v4 = majority(PROBES.filter(probe => probe.g === 'stack' && probe.fam === 4).map(probe => probe.id), of)
  const v6 = majority(PROBES.filter(probe => probe.g === 'stack' && probe.fam === 6).map(probe => probe.id), of)
  result.v6 = !v6 && !exits.some(exit => exit.v6)
    ? { s: 'info', k: 'none', v: {} }
    : v6 && v4 && v6 !== v4 && byLetter[v6]?.kind === 'local' && byLetter[v4]?.kind !== 'local'
      ? { s: 'bad', k: 'leak', v: { a: v6 } }
      : { s: 'ok', k: 'ok', v: { a: v6 || exits.find(exit => exit.v6)?.letter } }

  const cc = abroad ? byLetter[abroad]?.cc : ''
  result.tz = !tzCc || !cc
    ? none
    : cc === tzCc || (tzCc === 'CN' && ['HK', 'MO'].includes(cc))
      ? { s: 'ok', k: 'ok', v: { a: cc } }
      : { s: 'warn', k: 'bad', v: { a: tzCc, b: cc } }

  return result
}

export function verdictOf(found: Findings | null, exits: EgressExit[]): 'leak' | 'ai' | 'split' | 'proxy' | 'direct' | null {
  if (!found || found.route.s === 'none') return null
  if (found.rtc.s === 'bad' || found.v6.s === 'bad') return 'leak'
  if (found.ai.s === 'bad') return 'ai'
  if (found.route.k === 'split' || found.except.k === 'some') return 'split'
  const letter = String(found.route.v.a || '')
  return exits.find(exit => exit.letter === letter)?.kind === 'proxy' ? 'proxy' : 'direct'
}

/** 需要单独标出来的探测器：走了另一条线路，或 UDP 泄露了本地地址 */
export function oddProbes(exits: EgressExit[]): Record<string, { k: 'odd' | 'leak'; x: string; y?: string }> {
  const of = exitOfProbe(exits)
  const byLetter = Object.fromEntries(exits.map(exit => [exit.letter, exit]))
  const ids = (group: ProbeGroup) => PROBES.filter(probe => probe.g === group).map(probe => probe.id)
  const cn = majority(ids('cn'), of)
  const abroad = majority([...ids('intl'), ...ids('ai'), ...ids('web')], of) || cn
  const out: Record<string, { k: 'odd' | 'leak'; x: string; y?: string }> = {}
  if (!abroad) return out
  for (const probe of PROBES) {
    const letters = of[probe.id]
    if (!letters) continue
    if (probe.read === 'stun') {
      const local = letters.find(letter => byLetter[letter]?.kind === 'local')
      if (local && byLetter[abroad].kind !== 'local') out[probe.id] = { k: 'leak', x: local }
      continue
    }
    const want = probe.g === 'cn' ? cn : abroad
    if (want && !letters.includes(want)) out[probe.id] = { k: 'odd', x: letters[0], y: want }
  }
  return out
}

/* ---------- NAT ---------- */

export interface StunCandidate {
  ip: string
  port: number
}

/**
 * 一个连接同时问所有 STUN：同一公网端口对应所有服务器是锥形，每个目的地
 * 换端口是对称型。没回应的服务器与合并后看起来一样，所以锥形要两个服务器
 * 各自看到同一地址。
 */
export function natOf(cands: StunCandidate[], seenByServer: Record<string, string>, exits: EgressExit[]): NatInfo {
  const v4 = cands.filter(item => ipFamily(item.ip) === 4)
  const ips = [...new Set(v4.map(item => item.ip))]
  const ports = (ip: string) => new Set(v4.filter(item => item.ip === ip).map(item => item.port)).size
  const servers = (ip: string) => Object.values(seenByServer).filter(ip2 => ip2 === ip).length
  const k = ips.some(ip => ports(ip) > 1) ? 'sym' : ips.some(ip => servers(ip) >= 2) ? 'cone' : 'none'
  return { k, multi: exits.some(exit => ips.filter(ip => exit.ips.includes(ip)).length > 1) }
}

/* ---------- 分享码 ---------- */

const enc = (value: unknown) => encodeURIComponent(String(value ?? '')).replace(/[~,|:.]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
const WHY_ENCODE: Record<Why, string> = { timeout: 't', http: 'h', net: 'n', parse: 'p', stun: 's' }
const WHY_DECODE = Object.fromEntries(Object.entries(WHY_ENCODE).map(([k, v]) => [v, k])) as Record<string, Why>
const NAT_ENCODE = { cone: 'c', sym: 's', none: 'u' } as const
const NAT_DECODE = { c: 'cone', s: 'sym', u: 'none' } as const

export interface EgressShare {
  ts: number
  tz: string
  exits: EgressExit[]
  rows: Record<string, ProbeRow>
  nat: NatInfo | null
}

/**
 * 结果链接不含任何 IP：出口只带国家、城市、网络名与标记，探测器只带它
 * 走的是第几个出口。
 */
export function encodeShare(data: EgressShare, place: boolean): string {
  const exits = data.exits
    .map(exit =>
      [exit.cc, place ? exit.city : '', place ? exit.org : '', place ? exit.asn ?? '' : '',
        `${exit.dc ? 'd' : ''}${exit.warp ? 'w' : ''}${exit.v4 ? '4' : ''}${exit.v6 ? '6' : ''}`]
        .map(enc)
        .join('~'),
    )
    .join(',')
  const at = Object.fromEntries(data.exits.map((exit, index) => [exit.letter, index]))
  const rows = Object.entries(data.rows)
    .map(([id, row]) => {
      const cf: { colo?: string; loc?: string } = row.cf || {}
      const seen = row.l.length ? row.l.map(letter => at[letter]).join('.') : `x${WHY_ENCODE[row.why || 'net']}`
      return [id, seen, row.ms != null ? Math.round(row.ms).toString(36) : '', cf.colo || '', cf.loc || ''].join(':')
    })
    .join(',')
  const nat = data.nat ? `|n${NAT_ENCODE[data.nat.k]}${data.nat.multi ? 'm' : ''}` : ''
  return `#eg=1|${Math.floor(data.ts / 1000).toString(36)}|${/^[A-Z]{2}$/.test(data.tz) ? data.tz : ''}|${exits}|${rows}${nat}`
}

export function parseShare(hash: string, ids: string[]): EgressShare | null {
  const match = /^#eg=1\|([0-9a-z]+)\|([A-Z]{2})?\|([^|]*)\|([^|]*)(?:\|n([csu])(m?))?$/.exec(hash || '')
  if (!match) return null
  const decode = (value: string) => {
    try {
      return decodeURIComponent(value)
    } catch {
      return ''
    }
  }
  const exits: EgressExit[] = match[3]
    ? match[3].split(',').map((chunk, index) => {
        const [cc = '', city = '', org = '', asn = '', flags = ''] = chunk.split('~').map(decode)
        return {
          key: `s${index}`,
          ips: [],
          probes: [],
          cc: ccOf(cc),
          city: city.slice(0, 80),
          org: org.slice(0, 120),
          asn: Number(asn) || null,
          dc: flags.includes('d'),
          warp: flags.includes('w'),
          v4: flags.includes('4'),
          v6: flags.includes('6'),
          kind: 'local' as const,
          letter: '',
        }
      })
    : []
  const rows: Record<string, ProbeRow> = {}
  for (const chunk of match[4].split(',')) {
    const [id, seen = '', ms = '', colo = '', loc = ''] = chunk.split(':')
    if (!ids.includes(id) || !seen) continue
    const row: ProbeRow = { l: [], ms: /^[0-9a-z]+$/.test(ms) ? parseInt(ms, 36) : null }
    if (colo || loc) row.cf = { colo: /^[A-Z0-9]{3}$/.test(colo) ? colo : '', loc: ccOf(loc) }
    if (seen.startsWith('x')) {
      row.why = WHY_DECODE[seen[1]] || 'net'
    } else {
      for (const index of seen.split('.')) {
        const exit = exits[Number(index)]
        if (exit && !exit.probes.includes(id)) exit.probes.push(id)
      }
    }
    rows[id] = row
  }
  labelExits(exits)
  for (const [id, row] of Object.entries(rows)) {
    if (!row.why) row.l = exits.filter(exit => exit.probes.includes(id)).map(exit => exit.letter)
  }
  const nat = match[5] ? { k: NAT_DECODE[match[5] as 'c' | 's' | 'u'], multi: !!match[6] } : null
  return { ts: parseInt(match[1], 36) * 1000, tz: match[2] || '', exits, rows, nat }
}

/* ---------- 文案 ---------- */

export const GROUP_LABEL = Object.fromEntries(GROUPS.map(group => [group.id, group.label])) as Record<ProbeGroup, string>
export const PROBE_NAME = Object.fromEntries(PROBES.map(probe => [probe.id, probe.name])) as Record<string, string>
export const PROBE_HOST = Object.fromEntries(PROBES.map(probe => [probe.id, probe.host])) as Record<string, string>

export const VERDICT_TEXT = {
  leak: { title: '有流量绕过了代理', tone: 'bad' as const },
  ai: { title: 'AI 服务看到的地区不提供服务', tone: 'bad' as const },
  split: { title: '不同网站走了不同线路', tone: 'ok' as const },
  proxy: { title: '全部流量都走代理', tone: 'ok' as const },
  direct: { title: '全部流量都走本地线路', tone: 'good' as const },
}

export function findingText(id: string, finding: Finding, nameOf: (id: string) => string): { title: string; text: string } {
  const v = finding.v as Record<string, string | number | boolean | string[] | { x: string; list: string[] }[]>
  const list = (value: unknown) => (Array.isArray(value) ? value.map(item => nameOf(String(item))).join('、') : '')
  switch (id) {
    case 'route':
      return finding.k === 'split'
        ? { title: '国内外分流', text: `国内网站看到 ${v.a}，海外目的地看到 ${v.b}，流量按规则分成了两条线路。` }
        : { title: '只有一条线路', text: `国内与海外目的地都看到出口 ${v.a}。` }
    case 'except':
      return finding.k === 'some'
        ? {
            title: '部分服务单独走线',
            text: (v.groups as { x: string; list: string[] }[])
              .map(group => `${group.list.includes('@v6') ? '全部 IPv6 目的地' : group.list.map(id2 => nameOf(id2)).join('、')} 走 ${group.x}`)
              .join('；'),
          }
        : { title: '没有例外', text: '所有海外目的地都走了同一个出口。' }
    case 'ai':
      if (finding.k === 'bad') return { title: 'AI 服务不可用', text: `${list(v.list)} 看到你在 ${v.c}，该地区不在服务范围内。` }
      if (finding.k === 'ok') return { title: 'AI 服务可用', text: `AI 服务看到你在 ${v.c}${v.dc ? '，但这是一个机房地址' : ''}。` }
      return { title: 'AI 服务无响应', text: 'AI 服务的 trace 没有读出来，可能被拦截或不可达。' }
    case 'rtc':
      if (finding.k === 'leak') return { title: 'WebRTC 泄露本地出口', text: `网站看到代理，但 STUN 看到 ${v.a}，UDP 走的是本地线路。` }
      if (finding.k === 'proxy') return { title: 'WebRTC 也走代理', text: `STUN 看到 ${v.a}，UDP 与网站走同一条线路。` }
      if (finding.k === 'same') return { title: 'WebRTC 一致', text: `STUN 看到 ${v.a}。` }
      return { title: '没有 UDP 数据', text: '所有 STUN 都没有回应，UDP 可能被拦截。' }
    case 'nat':
      if (finding.k === 'cone') return { title: '锥形 NAT', text: `P2P 打洞成功率高${v.multi ? '，但这个出口有多个公网地址' : ''}${v.px ? '；这是代理侧的 NAT' : ''}。` }
      if (finding.k === 'sym') return { title: '对称型 NAT', text: '每个目的地分配不同端口，打洞成功率低，通话更容易走中继。' }
      return { title: '无法判断 NAT', text: '没有拿到足够的 STUN 映射。' }
    case 'v6':
      if (finding.k === 'leak') return { title: 'IPv6 泄露', text: `IPv4 走代理，IPv6 却从 ${v.a} 直接出去。` }
      if (finding.k === 'ok') return { title: 'IPv6 与 IPv4 一致', text: `IPv6 出口 ${v.a ?? '未检测到'}。` }
      return { title: '没有 IPv6', text: '当前网络没有可用的 IPv6 出口。' }
    case 'tz':
      if (finding.k === 'ok') return { title: '时区与出口一致', text: `浏览器时区与出口国家 ${v.a} 相符。` }
      if (finding.k === 'bad') return { title: '时区与出口不一致', text: `浏览器在 ${v.a}，出口在 ${v.b}，网站会当成代理特征。` }
      return { title: '时区未知', text: '缺少浏览器时区或出口国家。' }
    default:
      return { title: '', text: '' }
  }
}
