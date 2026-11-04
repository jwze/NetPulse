/**
 * 解锁检测的纯逻辑：读取各服务的应答、判断结论、打分与分享码。
 */
import { SERVICES, type ReaderId, type UnlockCat, type UnlockService } from '@/data/unlockServices'
import { parseTrace } from '@/utils/egress'

export const CC = (value: unknown): string | null => {
  const text = typeof value === 'string' ? value.trim() : ''
  return /^[a-z]{2}$/i.test(text) ? text.toUpperCase() : null
}
const json = (text: string) => {
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}

export interface Answer {
  ok: boolean | null
  cc?: string | null
  ip?: string
  colo?: string
  proxy?: boolean
}

export const READERS: Record<ReaderId, (status: number, text: string) => Answer | null> = {
  trace: (_status, text) => {
    const trace = parseTrace(text)
    const cc = CC(trace.loc)
    return cc ? { ok: true, cc, ip: trace.ip, colo: trace.colo } : null
  },
  openai: (_status, text) => {
    if (!json(text)) return null
    return { ok: !/unsupported_country/i.test(text) }
  },
  dazn: (status, text) => {
    const allowed = /"isAllowed"\s*:\s*(true|false)/.exec(text)
    const country = /"GeolocatedCountry"\s*:\s*"([a-z]{2})"/i.exec(text)
    if (allowed) return { ok: allowed[1] === 'true', cc: country ? CC(country[1]) : null }
    if (status === 403 && /Security policy has been breached/i.test(text)) return { ok: false }
    return null
  },
  kktv: (_status, text) => {
    const data = (json(text)?.data || {}) as Record<string, unknown>
    return typeof data.is_allowed === 'boolean'
      ? { ok: data.is_allowed, cc: CC(data.country), ip: String(data.ip || '') }
      : null
  },
  tvb: (_status, text) => {
    const data = json(text) || {}
    return typeof data.allow_in_this_country === 'boolean'
      ? { ok: data.allow_in_this_country, cc: CC(data.country), ip: String(data.ip || '') }
      : null
  },
  sbs: (_status, text) => {
    const response = ((json(text)?.get || {}) as Record<string, unknown>).response as Record<string, unknown> | undefined
    const cc = response && CC(response.country_code)
    return cc ? { ok: cc === 'AU', cc } : null
  },
  nbc: (_status, text) => {
    const data = json(text)
    if (!data || typeof data.restricted !== 'boolean') return null
    const info = (data.requestInfo || {}) as Record<string, unknown>
    return { ok: !data.restricted, cc: CC(info.countryCode) }
  },
  dmm: (_status, text) =>
    /FOREIGN/.test(text) ? { ok: false } : /UNAUTHORIZED/.test(text) ? { ok: true, cc: 'JP' } : null,
  philo: (_status, text) => {
    const data = json(text)
    return data && data.status ? { ok: data.status === 'SUCCESS', cc: CC(data.country) } : null
  },
  shudder: (_status, text) =>
    /not (yet )?available/i.test(text) ? { ok: false } : /movies/i.test(text) ? { ok: true } : null,
  bein: status => (status === 451 ? { ok: false } : status === 500 ? { ok: true } : null),
  zdf: status => (status === 403 ? { ok: false } : status === 404 ? { ok: true, cc: 'DE' } : null),
  fod: (_status, text) => {
    const match = /<FLAG\s+TYPE="(true|false)"/i.exec(text)
    return match ? { ok: match[1] === 'true', cc: match[1] === 'true' ? 'JP' : null } : null
  },
  mgtv: (_status, text) => {
    const data = json(text)
    if (!data) return null
    if (data.code === 200 && data.data) return { ok: true, cc: 'CN' }
    return /地区|区域|海外|版权|region|country/i.test(String(data.msg || '')) ? { ok: false } : null
  },
  ten: (_status, text) => {
    const data = json(text)
    return data && typeof data.allow === 'boolean' ? { ok: data.allow, cc: data.allow ? 'AU' : null } : null
  },
  molotov: (_status, text) => {
    const data = json(text)
    return data && typeof data.is_france === 'boolean' ? { ok: data.is_france, cc: data.is_france ? 'FR' : null } : null
  },
  nhk: (_status, text) => {
    const country = json(text)?.country_code
    if (typeof country !== 'string') return null
    return country === 'JP' ? { ok: true, cc: 'JP' } : { ok: false, cc: CC(country) }
  },
  sling: (_status, text) => {
    const data = json(text)
    if (!data || (data.playback_allowed == null && data.playback_disallowed == null)) return null
    const ok = data.playback_allowed === true || data.playback_disallowed === false
    const reason = String(data.playback_disallowed_reason || '')
    return {
      ok,
      cc: String(data.country || '').toLowerCase() === 'usa' ? 'US' : null,
      ...(!ok && /proxy|hosting|vpn|cloud/i.test(reason) ? { proxy: true } : {}),
    }
  },
  itv: (status, text) => (status === 403 && /geoblock/i.test(text) ? { ok: false } : status === 404 ? { ok: true, cc: 'GB' } : { ok: null }),
  telasa: (_status, text) =>
    /IPLocationNotAllowed/.test(text) ? { ok: false } : /"type"\s*:\s*"OK"/.test(text) ? { ok: true, cc: 'JP' } : { ok: null },
  catchplay: (_status, text) => {
    const data = json(text)
    if (!data) return { ok: null }
    if (String(data.code) === '100016') {
      const cc = (/location ([A-Z]{2})\b/.exec(String(data.message || '')) || [])[1]
      return { ok: false, cc: CC(cc) }
    }
    return String(data.code) === '0' ? { ok: true, cc: CC((data.data as Record<string, unknown>)?.isoCode) } : { ok: null }
  },
  aetv: (_status, text) => (/GeoLocationBlocked/.test(text) ? { ok: false } : { ok: null }),
}

const has = (list: string, cc: string) => ` ${list} `.includes(` ${cc} `)

/** 按服务公布的国家列表判断这里能不能用；没有列表或国家未知时返回 null */
export function offered(service: UnlockService, cc: string | null | undefined): boolean | null {
  if (!cc) return null
  if (service.only) return cc === service.only
  if (service.allow) return has(service.allow, cc)
  if (service.deny) return !has(service.deny, cc)
  return null
}

export type VerdictKey = 'ok' | 'no' | 'reach' | 'fail'

export interface Verdict {
  v: VerdictKey
  cc: string | null
  ip: string
  how: 'api' | 'edge' | 'guess' | null
  why?: string
  proxy?: boolean
}

export interface ProbeReply {
  err?: 'net' | 'timeout' | 'http' | 'parse' | null
  status?: number
  answer?: Answer | null
  reach?: boolean | null
}

export function guessCountry(list: (string | null | undefined)[]): string | null {
  const count: Record<string, number> = {}
  for (const cc of list) if (cc) count[cc] = (count[cc] || 0) + 1
  let best: string | null = null
  let max = 0
  for (const [cc, n] of Object.entries(count)) if (n > max) [best, max] = [cc, n]
  return best
}

export function judge(service: UnlockService, reply: ProbeReply, guess: string | null): Verdict {
  const kind = service.probe.kind
  const fail = (): Verdict => ({ v: 'fail', cc: null, ip: '', how: null, why: reply.err || 'net' })
  const byList = (cc: string | null, how: Verdict['how'], ip = ''): Verdict => {
    const value = offered(service, cc)
    return { v: value == null ? 'reach' : value ? 'ok' : 'no', cc, ip, how, why: value == null ? (cc ? 'unknown' : 'nocc') : undefined }
  }
  const answer = reply.answer

  if (kind === 'api') {
    if (reply.err) return fail()
    if (!answer || answer.ok == null) return byList(guess, 'guess')
    return { v: answer.ok ? 'ok' : 'no', cc: answer.cc || null, ip: answer.ip || '', how: 'api', proxy: answer.proxy }
  }
  if (kind === 'trace') {
    if (!reply.err && answer?.cc) return byList(answer.cc, 'edge', answer.ip || '')
    if (reply.reach) return byList(guess, 'guess')
    return fail()
  }
  // 只确认连通性：可达后用公开列表对照多数服务看到的国家
  if (reply.reach === false) return fail()
  return byList(guess, 'guess')
}

export function tally(verdicts: Record<string, Verdict>) {
  const out = { ok: 0, no: 0, reach: 0, fail: 0 }
  for (const verdict of Object.values(verdicts)) if (verdict) out[verdict.v] += 1
  return out
}

export function exitsByCountry(verdicts: Record<string, Verdict>) {
  const map = new Map<string, string[]>()
  for (const [id, verdict] of Object.entries(verdicts)) {
    if (!verdict?.cc || !(verdict.how === 'api' || verdict.how === 'edge')) continue
    if (!map.has(verdict.cc)) map.set(verdict.cc, [])
    map.get(verdict.cc)!.push(id)
  }
  return [...map].map(([cc, ids]) => ({ cc, ids })).sort((a, b) => b.ids.length - a.ids.length)
}

const grade = (ratio: number) => (ratio >= 0.95 ? 'S' : ratio >= 0.8 ? 'A' : ratio >= 0.6 ? 'B' : ratio >= 0.4 ? 'C' : 'D')

export interface ScoreCard {
  cats: Record<string, { ok: number; n: number; places: string[]; g?: string }>
  total: string | null
}

export function scoreCard(verdicts: Record<string, Verdict>, services: UnlockService[]): ScoreCard {
  const cats: ScoreCard['cats'] = {}
  for (const service of services) {
    const verdict = verdicts[service.id]
    if (!verdict) continue
    const bucket = cats[service.cat] || (cats[service.cat] = { ok: 0, n: 0, places: [] })
    if (service.cat === 'local') {
      const cc = verdict.cc || service.only
      if (verdict.v === 'ok' && cc && !bucket.places.includes(cc)) bucket.places.push(cc)
      continue
    }
    if (verdict.v === 'reach') continue
    bucket.n += 1
    if (verdict.v === 'ok') bucket.ok += 1
  }
  for (const bucket of Object.values(cats)) if (bucket.n) bucket.g = grade(bucket.ok / bucket.n)
  const all = Object.entries(cats).filter(([key]) => key !== 'local').map(([, bucket]) => bucket)
  const ok = all.reduce((sum, bucket) => sum + bucket.ok, 0)
  const n = all.reduce((sum, bucket) => sum + bucket.n, 0)
  return { cats, total: n ? grade(ok / n) : null }
}

export interface Advice {
  id: string
  k: 'to' | 'need' | 'fail'
  at: string
  to?: string
  via?: string
}

/** 某个服务在当前线路上不可用，而另一个出口的国家在它的列表里：建议把它的域名分过去 */
export function routeAdvice(
  verdicts: Record<string, Verdict>,
  services: UnlockService[],
  exits: { cc: string; ids: string[] }[],
  max = 6,
): Advice[] {
  const out: Advice[] = []
  for (const service of services) {
    const verdict = verdicts[service.id]
    if (!verdict || (verdict.v !== 'no' && verdict.v !== 'fail')) continue
    if (verdict.v === 'fail') {
      if (service.cat !== 'local') out.push({ id: service.id, k: 'fail', at: '' })
      continue
    }
    const at = verdict.cc || exits[0]?.cc || ''
    const target = exits.find(exit => exit.cc !== at && offered(service, exit.cc) === true)
    if (target) out.push({ id: service.id, k: 'to', at, to: target.cc, via: target.ids.find(id => id !== service.id) || target.ids[0] })
    else if (service.cat !== 'local' && at) out.push({ id: service.id, k: 'need', at })
  }
  const rank = (advice: Advice) =>
    (advice.k === 'to' ? 0 : advice.k === 'need' ? 1 : 2) * 10 + ['ai', 'video', 'social', 'local'].indexOf(services.find(item => item.id === advice.id)!.cat)
  return out.sort((a, b) => rank(a) - rank(b)).slice(0, max)
}

/* ---------- 分享码 ---------- */

const V = { ok: 'o', no: 'n', reach: 'r', fail: 'f' } as const
const H = { api: 'a', edge: 'e', guess: 'g' } as const
const unV = { o: 'ok', n: 'no', r: 'reach', f: 'fail' } as const
const unH = { a: 'api', e: 'edge', g: 'guess' } as const

export function encodeShare(ts: number, tz: string, verdicts: Record<string, Verdict>) {
  const rows = Object.entries(verdicts)
    .filter(([, verdict]) => verdict)
    .map(([id, verdict]) => `${id}~${V[verdict.v]}${verdict.how ? H[verdict.how] : '-'}${verdict.cc || '-'}`)
  return `#un=1.${Math.round(ts / 1000).toString(36)}.${/^[A-Z]{2}$/.test(tz) ? tz : '-'}.${rows.join('_')}`
}

export function parseShare(hash: string, ids: string[]): { ts: number; tz: string; verdicts: Record<string, Verdict> } | null {
  const match = /^#un=1\.([0-9a-z]+)\.([A-Z]{2}|-)\.(.*)$/.exec(hash || '')
  if (!match) return null
  const verdicts: Record<string, Verdict> = {}
  for (const row of match[3].split('_')) {
    const parsed = /^([a-z0-9]+)~([onrf])([aehg-])([A-Z]{2}|-)$/.exec(row)
    if (!parsed || !ids.includes(parsed[1])) continue
    verdicts[parsed[1]] = {
      v: unV[parsed[2] as keyof typeof unV],
      how: parsed[3] === '-' ? null : unH[parsed[3] as keyof typeof unH],
      cc: parsed[4] === '-' ? null : parsed[4],
      ip: '',
    }
  }
  return Object.keys(verdicts).length ? { ts: parseInt(match[1], 36) * 1000, tz: match[2] === '-' ? '' : match[2], verdicts } : null
}

/* ---------- 文案 ---------- */

export const VERDICT_TEXT: Record<VerdictKey, { label: string; tone: string }> = {
  ok: { label: '可用', tone: 'good' },
  no: { label: '不可用', tone: 'bad' },
  reach: { label: '能打开', tone: 'ok' },
  fail: { label: '打不开', tone: 'muted' },
}

export const HOW_TEXT = { api: '官方接口', edge: '边缘识别', guess: '推测' } as const

export const SERVICE_NAME = Object.fromEntries(SERVICES.map(service => [service.id, service.name])) as Record<string, string>
export const SERVICE_CAT = Object.fromEntries(SERVICES.map(service => [service.id, service.cat])) as Record<string, UnlockCat>
