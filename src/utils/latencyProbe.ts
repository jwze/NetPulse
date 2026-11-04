/**
 * 全球延迟的网络层：真实 HTTPS 往返计时、边缘节点识别、多来源出口探测。
 *
 * 计时方法与主流测速站一致：先发一次不计时的请求完成 DNS + TCP + TLS，
 * 之后每次请求都复用同一条连接，只量「本机 → 边缘节点」的一个往返。
 */

import type { LatencyService } from '@/data/latencyServices'
import {
  geoOf,
  groupExits,
  ipFamily,
  looksLikeDatacenter,
  median as medianOf,
  jitter as jitterOf,
  type ExitGeo,
  type ExitGroup,
  type ExitSeen,
} from '@/utils/latency'

export const TIMEOUT = 4000
export const WARM_TIMEOUT = 5000
const GAP = 120
export const CONCURRENCY = 8

export type ServiceState = 'idle' | 'run' | 'done' | 'stop'

export interface ServiceResult {
  cold: number | null
  samples: (number | null)[]
  median: number | null
  jitter: number | null
  pop: string | null
  state: ServiceState
}

export function emptyResult(): ServiceResult {
  return { cold: null, samples: [], median: null, jitter: null, pop: null, state: 'idle' }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function bust(url: string) {
  const token = Math.random().toString(36).slice(2, 10)
  return `${url}${url.includes('?') ? '&' : '?'}_np=${token}`
}

function timeoutSignal(parent: AbortSignal, ms: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  const onAbort = () => controller.abort()
  parent.addEventListener('abort', onAbort, { once: true })
  return {
    signal: controller.signal,
    done() {
      clearTimeout(timer)
      parent.removeEventListener('abort', onAbort)
    },
  }
}

async function readPop(service: LatencyService, response: Response): Promise<string | null> {
  try {
    if (service.pop === 'trace') {
      const text = await response.text()
      return /\bcolo=([A-Z]{3})\b/.exec(text)?.[1] || null
    }
    if (service.pop === 'x-served-by') {
      return /([A-Z]{3})\s*$/.exec(response.headers.get('x-served-by') || '')?.[1] || null
    }
    if (service.pop === 'x-amz-cf-pop') {
      return /^[A-Z]{3}/.exec(response.headers.get('x-amz-cf-pop') || '')?.[0] || null
    }
  } catch {
    // 读不到节点不影响计时
  }
  return null
}

/** 图片加载计时，用于会重置 fetch 的主机 */
function probeImage(url: string, timeout: number, signal: AbortSignal): Promise<number | null> {
  return new Promise(resolve => {
    const image = new Image()
    let settled = false
    const finish = (value: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      image.onload = image.onerror = null
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), timeout)
    signal.addEventListener('abort', () => finish(null), { once: true })
    const started = performance.now()
    image.onload = image.onerror = () => finish(performance.now() - started)
    image.referrerPolicy = 'no-referrer'
    image.src = url
  })
}

interface ProbeOutcome {
  ms: number | null
  pop: string | null
}

async function probe(
  service: LatencyService,
  timeout: number,
  signal: AbortSignal,
  cors: boolean,
): Promise<ProbeOutcome> {
  const url = service.raw ? service.url : bust(service.url)
  if (service.method === 'IMG') {
    return { ms: await probeImage(url, timeout, signal), pop: null }
  }

  const started = performance.now()
  const scoped = timeoutSignal(signal, timeout)
  try {
    const response = await fetch(url, {
      method: service.method || 'GET',
      mode: cors ? 'cors' : 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: scoped.signal,
    })
    // 先把时间量下来，读响应体只为了拿边缘节点
    const ms = performance.now() - started
    const pop = cors && service.pop ? await readPop(service, response) : null
    return { ms, pop }
  } catch {
    return { ms: null, pop: null }
  } finally {
    scoped.done()
  }
}

async function readSiblingPop(service: LatencyService, signal: AbortSignal): Promise<string | null> {
  if (!service.popUrl || !service.pop) return null
  const scoped = timeoutSignal(signal, WARM_TIMEOUT)
  try {
    const response = await fetch(service.popUrl, {
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: scoped.signal,
    })
    return await readPop(service, response)
  } catch {
    return null
  } finally {
    scoped.done()
  }
}

/** 一个服务的一次采样；节点能读就读，读不到就退回 no-cors，不影响计时 */
async function sample(
  service: LatencyService,
  timeout: number,
  signal: AbortSignal,
  state: { noPop: boolean },
): Promise<ProbeOutcome> {
  if (!service.pop || service.popUrl || state.noPop) {
    return probe(service, timeout, signal, false)
  }
  const withCors = await probe(service, timeout, signal, true)
  if (withCors.ms == null && !signal.aborted) {
    const fallback = await probe(service, timeout, signal, false)
    if (fallback.ms != null) state.noPop = true
    return fallback
  }
  return withCors
}

/**
 * 跑完一个服务：一次预热（DNS + TCP + TLS，不计入统计）后连续采样，
 * 两次连续失败就放弃，避免为不通的服务耗掉整轮时间。
 */
export async function runService(
  service: LatencyService,
  count: number,
  signal: AbortSignal,
  onUpdate: (result: ServiceResult) => void,
  onSample?: (ms: number | null) => void,
): Promise<ServiceResult> {
  const result = emptyResult()
  result.state = 'run'
  onUpdate({ ...result })

  const state = { noPop: false }
  const warm = await sample(service, WARM_TIMEOUT, signal, state)
  result.cold = warm.ms
  if (warm.pop) result.pop = warm.pop
  onUpdate({ ...result })

  if (service.popUrl) {
    void readSiblingPop(service, signal).then(pop => {
      if (pop) {
        result.pop = pop
        onUpdate({ ...result, samples: [...result.samples] })
      }
    })
  }

  let fails = warm.ms == null ? 2 : 0
  while (result.samples.length < count && !signal.aborted && fails < 2) {
    await sleep(GAP + Math.random() * 80)
    if (signal.aborted) break
    const outcome = await sample(service, TIMEOUT, signal, state)
    if (signal.aborted) break
    result.samples.push(outcome.ms == null ? null : Math.round(outcome.ms * 10) / 10)
    if (outcome.pop) result.pop = outcome.pop
    fails = outcome.ms == null ? fails + 1 : 0
    onSample?.(outcome.ms)
    onUpdate({ ...result, samples: [...result.samples] })
  }

  result.state = signal.aborted ? 'stop' : 'done'
  result.median = medianOf(result.samples)
  result.jitter = jitterOf(result.samples)
  onUpdate({ ...result, samples: [...result.samples] })
  return result
}

/* ---------- 出口探测 ---------- */

interface CheckAnswer {
  ip: string
  geo?: ExitGeo | null
}

export interface ExitReport {
  groups: ExitGroup[]
  /** 有响应但无法归属到任何出口的地址数（多半是拿不到地理信息） */
  unknown: number
  warp: boolean
}

async function fetchJson(url: string, timeout: number, signal: AbortSignal): Promise<any> {
  const scoped = timeoutSignal(signal, timeout)
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: scoped.signal,
    })
    if (!response.ok) throw new Error(String(response.status))
    return await response.json()
  } finally {
    scoped.done()
  }
}

async function stunAddresses(timeout: number): Promise<string[]> {
  if (typeof RTCPeerConnection === 'undefined') return []
  let pc: RTCPeerConnection | null = null
  try {
    pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] })
    pc.createDataChannel('probe')
    const addresses = new Set<string>()
    const collected = new Promise<void>(resolve => {
      const timer = setTimeout(resolve, timeout)
      pc!.onicecandidate = event => {
        if (!event.candidate) {
          clearTimeout(timer)
          resolve()
          return
        }
        const text = event.candidate.candidate
        const parts = text.split(' ')
        if (/ typ srflx /.test(text) && parts[4]) addresses.add(parts[4])
      }
    })
    await pc.setLocalDescription(await pc.createOffer())
    await collected
    return [...addresses]
  } catch {
    return []
  } finally {
    try {
      pc?.close()
    } catch {
      // 关闭失败不影响结果
    }
  }
}

async function lookupGeo(ip: string, signal: AbortSignal): Promise<ExitGeo | null> {
  try {
    const data = await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`, 5000, signal)
    if (data?.success === false) throw new Error('no geo')
    return {
      cc: String(data?.country_code || '').toUpperCase(),
      city: data?.city || '',
      asn: typeof data?.connection?.asn === 'number' ? data.connection.asn : null,
      org: data?.connection?.org || data?.connection?.isp || '',
    }
  } catch {
    try {
      const data = await fetchJson(`https://api.ip.sb/geoip/${encodeURIComponent(ip)}`, 5000, signal)
      return {
        cc: String(data?.country_code || '').toUpperCase(),
        city: data?.city || '',
        asn: typeof data?.asn === 'number' ? data.asn : null,
        org: data?.isp || data?.asn_organization || '',
      }
    } catch {
      return null
    }
  }
}

/**
 * 同时问多个地方「我是谁」：不同站点可能看到不同出口（分流代理），
 * 只有只支持单栈的主机、WebRTC 才能看到另一条路径的地址。
 */
export async function checkExits(signal: AbortSignal): Promise<ExitReport> {
  const seen: ExitSeen[] = []
  const geo: Record<string, ExitGeo> = {}
  let warp = false

  const checks: [string, () => Promise<CheckAnswer | CheckAnswer[] | null>][] = [
    ['Cloudflare', async () => {
      const scoped = timeoutSignal(signal, 6000)
      try {
        const response = await fetch('https://www.cloudflare.com/cdn-cgi/trace', {
          cache: 'no-store',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          signal: scoped.signal,
        })
        if (!response.ok) return null
        const text = await response.text()
        const ip = /^ip=(.+)$/m.exec(text)?.[1]?.trim()
        const warpValue = /^warp=(.+)$/m.exec(text)?.[1]?.trim()
        if (warpValue && warpValue !== 'off') warp = true
        return ip ? { ip } : null
      } finally {
        scoped.done()
      }
    }],
    ['ip.sb', async () => {
      const data = await fetchJson('https://api.ip.sb/geoip', 5000, signal)
      if (!data?.ip) return null
      return {
        ip: data.ip,
        geo: {
          cc: String(data.country_code || '').toUpperCase(),
          city: data.city || '',
          asn: typeof data.asn === 'number' ? data.asn : null,
          org: data.isp || data.asn_organization || '',
        },
      }
    }],
    ['ipwho.is', async () => {
      const data = await fetchJson('https://ipwho.is/', 5000, signal)
      if (!data?.ip || data.success === false) return null
      return {
        ip: data.ip,
        geo: {
          cc: String(data.country_code || '').toUpperCase(),
          city: data.city || '',
          asn: typeof data.connection?.asn === 'number' ? data.connection.asn : null,
          org: data.connection?.org || data.connection?.isp || '',
        },
      }
    }],
    ['ipinfo.io', async () => {
      const data = await fetchJson('https://ipinfo.io/json', 5000, signal)
      if (!data?.ip) return null
      const org = String(data.org || '')
      const asn = /AS(\d+)/.exec(org)?.[1]
      return {
        ip: data.ip,
        geo: {
          cc: String(data.country || '').toUpperCase(),
          city: data.city || '',
          asn: asn ? Number(asn) : null,
          org: org.replace(/^AS\d+\s*/, ''),
        },
      }
    }],
    ['仅 IPv4', async () => {
      const data = await fetchJson('https://v4.ident.me/json', 4000, signal)
      return data?.ip && ipFamily(data.ip) === 4 ? { ip: data.ip } : null
    }],
    ['仅 IPv6', async () => {
      const data = await fetchJson('https://v6.ident.me/json', 4000, signal)
      return data?.ip && ipFamily(data.ip) === 6 ? { ip: data.ip } : null
    }],
    ['WebRTC', async () => {
      const addresses = await stunAddresses(3000)
      return addresses.length ? addresses.map(ip => ({ ip })) : null
    }],
  ]

  await Promise.allSettled(checks.map(async ([by, run]) => {
    try {
      const answer = await run()
      for (const item of answer ? (Array.isArray(answer) ? answer : [answer]) : []) {
        if (!item?.ip) continue
        seen.push({ ip: item.ip, by })
        if (item.geo?.cc) geo[item.ip] = item.geo
      }
    } catch {
      // 单个来源失败不影响其它来源
    }
  }))

  // 只被无地理信息的来源看到时，补一次查询；最多 5 个，避免拖长一轮
  const missing = [...new Set(seen.map(s => s.ip))].filter(ip => !geoOf(geo, ip)).slice(0, 5)
  await Promise.allSettled(missing.map(async ip => {
    const info = await lookupGeo(ip, signal)
    if (info?.cc) geo[ip] = info
  }))

  const groups = groupExits(seen, geo)
  const unknown = groups.filter(g => !g.cc && !g.asn).length
  return { groups, unknown, warp }
}

export { looksLikeDatacenter }
