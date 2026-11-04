/**
 * 全球延迟的纯逻辑：中位数、抖动、分级、分段判定、分享码与两次结果对比。
 * 不碰 DOM、不发请求，方便单测。
 */

import { PACKS, PACK_IDS, USES, type LatencyService } from '../data/latencyServices.ts'

/* ---------- 数值 ---------- */

export function median(values: (number | null)[]): number | null {
  const list = values.filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b)
  if (!list.length) return null
  const mid = list.length >> 1
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2
}

/** 相邻样本差的平均值，反映线路抖动 */
export function jitter(values: (number | null)[]): number | null {
  const list = values.filter((v): v is number => v != null && Number.isFinite(v))
  if (list.length < 2) return null
  let sum = 0
  for (let i = 1; i < list.length; i += 1) sum += Math.abs(list[i] - list[i - 1])
  return sum / (list.length - 1)
}

export function fmtMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  return ms < 10 ? ms.toFixed(1) : String(Math.round(ms))
}

export function fmtDelta(ms: number): string {
  const abs = Math.abs(ms)
  const text = abs < 10 ? abs.toFixed(1) : String(Math.round(abs))
  return `${ms > 0 ? '+' : '−'}${text}`
}

/* ---------- 分级 ---------- */

export type TierKey = 'instant' | 'great' | 'good' | 'ok' | 'slow' | 'bad' | 'lost'
export type Tone = 'great' | 'good' | 'ok' | 'warn' | 'bad' | 'muted'

const TIERS: { max: number; key: TierKey; label: string; tone: Tone }[] = [
  { max: 2, key: 'instant', label: '极快', tone: 'great' },
  { max: 30, key: 'great', label: '很快', tone: 'great' },
  { max: 80, key: 'good', label: '良好', tone: 'good' },
  { max: 150, key: 'ok', label: '一般', tone: 'ok' },
  { max: 300, key: 'slow', label: '偏慢', tone: 'warn' },
  { max: Infinity, key: 'bad', label: '很慢', tone: 'bad' },
]

export function tierOf(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return { key: 'lost' as TierKey, label: '不通', tone: 'muted' as Tone }
  return TIERS.find(t => ms <= t.max)!
}

/** 泳道位置：5ms…1000ms 的对数刻度，0…1 */
export const SCALE = { min: 5, max: 1000 }

export function posOf(ms: number): number {
  const ratio = Math.log(ms / SCALE.min) / Math.log(SCALE.max / SCALE.min)
  return Math.max(0, Math.min(1, ratio))
}

/* ---------- 分段与判定 ---------- */

export interface Segment {
  /** 参与判定的服务数 */
  n: number
  /** 有响应的服务数 */
  ok: number
  /** 中位数 */
  med: number | null
  /** 没有响应的服务名 */
  lost: string[]
}

export function segmentOf(values: (number | null)[], names: string[]): Segment {
  const alive = values.filter((v): v is number => v != null)
  return {
    n: values.length,
    ok: alive.length,
    med: median(alive),
    lost: names.filter((_, i) => values[i] == null),
  }
}

export type Grade = 'blocked' | 'good' | 'ok' | 'slow'

/** 一半以上没响应算不通；否则按中位数分档 */
export function gradeSegment(seg: Segment): Grade {
  if (seg.ok < seg.n / 2) return 'blocked'
  if (seg.med == null) return 'blocked'
  if (seg.med <= 80) return 'good'
  if (seg.med <= 150) return 'ok'
  return 'slow'
}

export type VerdictKey = 'allgood' | 'far' | 'odd' | 'near_slow' | 'down'

export interface Verdict {
  key: VerdictKey
  title: string
  detail: string
  tone: Tone
  local: Segment
  global: Segment
  /** 本地 + 海外的整体中位数 */
  med: number | null
}

function lostText(segments: Segment[]): string {
  const lost = [...new Set(segments.flatMap(s => s.lost))]
  if (!lost.length) return ''
  return `未响应：${lost.slice(0, 5).join('、')}${lost.length > 5 ? ' 等' : ''}。`
}

/**
 * 慢在那一侧：本地常用与海外服务分开判定，整体中位数不单独下结论。
 * 本地快、海外慢 → 国际出口或代理线路；本地也慢 → 当前网络本身。
 */
export function diagnose(local: Segment, global: Segment): Verdict {
  const lg = gradeSegment(local)
  const gg = gradeSegment(global)
  const fine = (g: Grade) => g === 'good' || g === 'ok'
  const med = median([local.med, global.med])
  const suffix = lostText([local, global])
  const base = { local, global, med }

  if (lg === 'blocked' && gg === 'blocked') {
    return {
      ...base,
      key: 'down',
      title: '几乎全部不通',
      detail: `两组服务大多没有响应，先确认网络本身是否可用。${suffix}`,
      tone: 'bad',
    }
  }
  if (fine(lg) && fine(gg)) {
    return {
      ...base,
      key: 'allgood',
      title: '本地与海外都可用',
      detail: `本地常用 ${fmtMs(local.med)}ms，海外服务 ${fmtMs(global.med)}ms，往返时延都在可用范围内。${suffix}`,
      tone: 'great',
    }
  }
  if (fine(lg)) {
    return {
      ...base,
      key: 'far',
      title: '本地快，海外偏慢',
      detail: `本地常用 ${fmtMs(local.med)}ms 很快，海外服务 ${fmtMs(global.med)}ms；慢在国际出口或代理线路上。${suffix}`,
      tone: 'warn',
    }
  }
  if (fine(gg)) {
    return {
      ...base,
      key: 'odd',
      title: '海外比本地还快',
      detail: `本地常用 ${fmtMs(local.med)}ms 反而更慢，海外服务 ${fmtMs(global.med)}ms；可能这组本地服务离得更远，或流量整体走了代理。${suffix}`,
      tone: 'ok',
    }
  }
  return {
    ...base,
    key: 'near_slow',
    title: '当前网络本身偏慢',
    detail: `连本地常用服务也要 ${fmtMs(local.med)}ms，海外 ${fmtMs(global.med)}ms；瓶颈更可能在本机网络或 Wi-Fi。${suffix}`,
    tone: 'bad',
  }
}

/* ---------- 用途评级 ---------- */

export type UseStatus = 'great' | 'ok' | 'slow' | 'blocked'

export const USE_TEXT: Record<UseStatus, string> = {
  great: '顺畅',
  ok: '可用',
  slow: '吃力',
  blocked: '不通',
}

export function useStatus(seg: Segment, smooth: number, fine: number): UseStatus {
  if (seg.ok < seg.n / 2 || seg.med == null) return 'blocked'
  if (seg.med <= smooth) return 'great'
  if (seg.med <= fine) return 'ok'
  return 'slow'
}

export function useVerdicts(res: Record<string, number | null>, services: LatencyService[]) {
  return USES.map(use => {
    const list = use.ids
      .map(id => services.find(s => s.id === id))
      .filter((s): s is LatencyService => !!s)
    const values = list.map(s => res[s.id] ?? null)
    const seg = segmentOf(values, list.map(s => s.name))
    return { ...use, seg, status: useStatus(seg, use.smooth, use.fine) }
  }).filter(use => use.seg.n > 0)
}

/* ---------- 分享码 ---------- */

export interface ExitLite {
  cc: string
  city: string
  org: string
  asn: number | null
  proxy: boolean
}

export interface SharedResult {
  ts: number
  pack: string
  exits: ExitLite[]
  res: Record<string, number | null>
}

const enc = (v: string | number) => encodeURIComponent(String(v))

/**
 * 分享码只带结果本身：时间、本地包、出口的国家/城市/网络/是否代理，以及每个服务的中位数。
 * 不带任何 IP 地址。格式：1.<时间36>.<包>.<出口>.<结果>
 */
export function encodeShare(result: SharedResult): string {
  const exits = result.exits
    .map(e => [e.cc, e.city, e.org, e.asn ?? '', e.proxy ? 'p' : 'l'].map(enc).join('~'))
    .join(',')
  const res = Object.entries(result.res)
    .map(([id, ms]) => `${id}:${ms == null ? 'x' : Math.round(ms * 10).toString(36)}`)
    .join(',')
  return ['1', Math.floor(result.ts / 1000).toString(36), result.pack, exits, res].join('.')
}

export function parseShare(code: string): SharedResult | null {
  const match = /^1\.([0-9a-z]+)\.([a-z]{2,4})\.([^.]*)\.([^.]*)$/.exec((code || '').trim())
  if (!match || !PACK_IDS.includes(match[2])) return null
  const dec = (v: string) => {
    try {
      return decodeURIComponent(v)
    } catch {
      return ''
    }
  }
  const exits: ExitLite[] = match[3]
    ? match[3].split(',').map(chunk => {
        const [cc, city, org, asn, kind] = chunk.split('~').map(dec)
        return {
          cc: /^[A-Z]{2}$/.test(cc) ? cc : '',
          city,
          org,
          asn: Number(asn) || null,
          proxy: kind === 'p',
        }
      })
    : []
  const res: Record<string, number | null> = {}
  for (const item of match[4] ? match[4].split(',') : []) {
    const entry = /^([\w-]+):([0-9a-z]+|x)$/.exec(item)
    if (!entry) return null
    res[entry[1]] = entry[2] === 'x' ? null : parseInt(entry[2], 36) / 10
  }
  return { ts: parseInt(match[1], 36) * 1000, pack: match[2], exits, res }
}

/* ---------- 两次结果对比 ---------- */

/** 同一条线路两次测量本身的噪声：绝对 20ms 且相对 30% 以上才算变化 */
export const TOL = { abs: 20, rel: 0.3 }

export interface DiffRow {
  id: string
  name: string
  a: number | null
  b: number | null
  delta: number | null
  changed: boolean
  tone: Tone
}

export function diffRuns(
  before: Record<string, number | null>,
  after: Record<string, number | null>,
  services: LatencyService[],
): { rows: DiffRow[]; changed: DiffRow[] } {
  const rows: DiffRow[] = []
  for (const service of services) {
    if (!(service.id in before) && !(service.id in after)) continue
    const a = before[service.id] ?? null
    const b = after[service.id] ?? null
    const delta = a != null && b != null ? b - a : null
    const moved = a == null || b == null
      ? a !== b
      : Math.abs(delta!) > TOL.abs && Math.max(a, b) / Math.min(a, b) - 1 > TOL.rel
    rows.push({
      id: service.id,
      name: service.name,
      a,
      b,
      delta,
      changed: moved,
      tone: b == null ? 'muted' : tierOf(b).tone,
    })
  }
  rows.sort((x, y) => Number(y.changed) - Number(x.changed) || Math.abs(y.delta ?? 0) - Math.abs(x.delta ?? 0))
  return { rows, changed: rows.filter(r => r.changed) }
}

/* ---------- 历史记录 ---------- */

export const HIST_MAX = 10

export function parseHistory(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((c): c is string => typeof c === 'string' && parseShare(c) != null).slice(0, HIST_MAX)
  } catch {
    return []
  }
}

export function addHistory(list: string[], code: string): string[] {
  return [code, ...list.filter(c => c !== code)].slice(0, HIST_MAX)
}

/* ---------- 出口识别 ---------- */

const DATACENTER_RE = /amazon|google|microsoft|azure|digitalocean|vultr|choopa|constant company|linode|akamai|ovh|hetzner|oracle|alibaba|aliyun|tencent|huawei|m247|datacamp|cloudflare|leaseweb|contabo|hostinger|it7|racknerd|colocrossing|psychz|zenlayer|g-core|gcore|hostwinds|scaleway|ionos|kamatera|upcloud|bandwagon|dmit|cogent|quadranet|servers\.com|packet|equinix|fastly|cdn77|datapacket|tzulo|hostdare|greencloud|nexeon|frantech|buyvm|hosting|vps|data ?cent/i

export function looksLikeDatacenter(org: string): boolean {
  return !!org && DATACENTER_RE.test(org)
}

export function ipFamily(ip: string): 4 | 6 {
  return ip.includes(':') ? 6 : 4
}

function v6Groups(ip: string): string[] {
  const [head, tail = ''] = ip.toLowerCase().split('::')
  const h = head ? head.split(':') : []
  const t = tail ? tail.split(':') : []
  return [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t].map(g => g.padStart(4, '0'))
}

/** 同一网络的判断：IPv4 看 /16，IPv6 看 /64 */
export function netOf(ip: string): string {
  return ipFamily(ip) === 6 ? v6Groups(ip).slice(0, 4).join(':') : ip.split('.').slice(0, 2).join('.')
}

export function sameNet(a: string, b: string): boolean {
  return ipFamily(a) === ipFamily(b) && netOf(a) === netOf(b)
}

export interface ExitGeo {
  cc: string
  city: string
  asn: number | null
  org: string
}

export interface ExitSeen {
  ip: string
  by: string
}

export interface ExitGroup {
  key: string
  ips: string[]
  sources: string[]
  cc: string
  city: string
  asn: number | null
  org: string
  proxy: boolean
}

/** 已知地址的地理信息，或同一网络上某个地址的 */
export function geoOf(geo: Record<string, ExitGeo>, ip: string): ExitGeo | null {
  if (geo[ip]) return geo[ip]
  const near = Object.keys(geo).find(other => sameNet(other, ip))
  return near ? geo[near] : null
}

/**
 * 同一个网络（知道 ASN 时按 ASN）合并成一个出口，所以运营商的 IPv4 与 IPv6
 * 不会显示成两个出口；本地出口排在代理前面，同级按有几项检查看到它排序。
 */
export function groupExits(seen: ExitSeen[], geo: Record<string, ExitGeo>): ExitGroup[] {
  const groups: ExitGroup[] = []
  for (const { ip, by } of seen) {
    const info = geoOf(geo, ip)
    const key = info?.asn ? `as${info.asn}` : `net${netOf(ip)}`
    let group = groups.find(g => g.key === key)
    if (!group) {
      group = { key, ips: [], sources: [], cc: '', city: '', asn: null, org: '', proxy: false }
      groups.push(group)
    }
    if (!group.ips.includes(ip)) group.ips.push(ip)
    if (!group.sources.includes(by)) group.sources.push(by)
    if (info) {
      group.cc = group.cc || info.cc || ''
      group.city = group.city || info.city || ''
      group.asn = group.asn || info.asn || null
      group.org = group.org || info.org || ''
    }
  }
  for (const group of groups) group.proxy = looksLikeDatacenter(group.org)
  return groups.sort((a, b) => Number(a.proxy) - Number(b.proxy) || b.sources.length - a.sources.length)
}

/** 本地包大小，供进度与判定使用 */
export const PACK_SIZE = Object.values(PACKS)[0].length
