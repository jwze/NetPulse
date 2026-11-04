/**
 * 出口探测的网络部分：并行询问所有探测器，STUN 单独走 UDP。
 * 每个请求都带超时，任何一个失败只影响它自己那一行。
 */
import { PROBES, type EgressProbe } from '@/data/egressProbes'
import { isIp, readProbe, type CfTrace, type ProbeRow, type ReadAnswer, type SeenAddress, type StunCandidate, type Why } from '@/utils/egress'
import type { ExitGeo } from '@/utils/latency'
import { TZ_CC } from '@/data/tzCountries'

export const PROBE_TIMEOUT = 6500
export const STUN_TIMEOUT = 4500

export function tzCountry(zone: string): string {
  return TZ_CC[zone] || ''
}

export interface ProbeOutcome {
  id: string
  row: ProbeRow
  answer: ReadAnswer | null
}

async function fetchBody(url: string, signal: AbortSignal): Promise<unknown> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT)
  const stop = () => controller.abort()
  signal.addEventListener('abort', stop, { once: true })
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })
    const text = await response.text()
    if (!response.ok) {
      const error = new Error(`http ${response.status}`) as Error & { status?: number }
      error.status = response.status
      throw error
    }
    try {
      return JSON.parse(text) as unknown
    } catch {
      return text
    }
  } finally {
    window.clearTimeout(timer)
    signal.removeEventListener('abort', stop)
  }
}

export async function probeHttp(probe: EgressProbe, signal: AbortSignal): Promise<ProbeOutcome> {
  const started = performance.now()
  const row: ProbeRow = { l: [], why: undefined, ms: null }
  try {
    const body = await fetchBody(probe.url, signal)
    const answer = readProbe(probe, body as Record<string, unknown> | string)
    row.ms = Math.round(performance.now() - started)
    if (!answer) {
      row.why = 'parse'
      return { id: probe.id, row, answer: null }
    }
    const cf = answer.cf
    if (cf) row.cf = { colo: cf.colo, loc: cf.loc }
    return { id: probe.id, row, answer }
  } catch (error) {
    const err = error as Error & { status?: number }
    let why: Why = 'net'
    if (err.status) why = 'http'
    else if (err.name === 'AbortError') why = signal.aborted ? 'net' : 'timeout'
    row.why = why
    row.ms = Math.round(performance.now() - started)
    return { id: probe.id, row, answer: null }
  }
}

/* ---------- STUN ---------- */

interface Candidate {
  type: string
  address: string
  port: number
}

function parseCandidates(sdp: string): Candidate[] {
  const out: Candidate[] = []
  for (const line of sdp.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('a=candidate:')) continue
    const parts = trimmed.slice('a=candidate:'.length).split(/\s+/)
    const address = parts[4] || ''
    const port = Number(parts[5]) || 0
    const type = parts[7] || ''
    if (address && type) out.push({ type, address, port })
  }
  return out
}

async function gather(servers: string[], timeout = STUN_TIMEOUT): Promise<Candidate[]> {
  if (typeof RTCPeerConnection === 'undefined') return []
  let pc: RTCPeerConnection | null = null
  try {
    pc = new RTCPeerConnection({
      iceServers: servers.map(url => ({ urls: url })),
      iceCandidatePoolSize: 0,
    })
    pc.createDataChannel('probe')
    await pc.setLocalDescription(await pc.createOffer())
    await new Promise<void>(resolve => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        resolve()
      }
      const timer = window.setTimeout(finish, timeout)
      if (!pc) return finish()
      pc.onicegatheringstatechange = () => {
        if (pc?.iceGatheringState === 'complete') finish()
      }
      pc.onicecandidate = event => {
        if (!event.candidate) finish()
      }
      if (pc.iceGatheringState === 'complete') finish()
    })
    return parseCandidates(pc.localDescription?.sdp || '')
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

/** 每个 STUN 单独建连接：这样才知道是哪个服务器看到了哪个地址 */
export async function probeStun(probe: EgressProbe): Promise<ProbeOutcome> {
  const row: ProbeRow = { l: [], why: undefined, ms: null }
  const started = performance.now()
  const candidates = await gather([probe.url])
  row.ms = Math.round(performance.now() - started)
  const srflx = candidates.find(item => item.type === 'srflx' && isIp(item.address))
  if (!srflx) {
    row.why = 'stun'
    return { id: probe.id, row, answer: null }
  }
  return { id: probe.id, row, answer: { ip: srflx.address } }
}

/** 一个连接同时问所有 STUN，只用来看 NAT 映射端口 */
export async function probeNatMapping(): Promise<{ candidates: StunCandidate[]; seen: Record<string, string> }> {
  const udp = PROBES.filter(probe => probe.read === 'stun')
  const candidates = await gather(udp.map(probe => probe.url), 5500)
  const seen: Record<string, string> = {}
  const single = await Promise.all(udp.map(async probe => ({ id: probe.id, list: await gather([probe.url]) })))
  for (const item of single) {
    const srflx = item.list.find(candidate => candidate.type === 'srflx' && isIp(candidate.address))
    if (srflx) seen[item.id] = srflx.address
  }
  return {
    candidates: candidates
      .filter(candidate => candidate.type === 'srflx' && isIp(candidate.address))
      .map(candidate => ({ ip: candidate.address, port: candidate.port })),
    seen,
  }
}

/* ---------- 汇总 ---------- */

export interface EgressRun {
  rows: Record<string, ProbeRow>
  seen: SeenAddress[]
  geo: Record<string, ExitGeo>
  cf: Record<string, CfTrace>
  nat: { candidates: StunCandidate[]; seen: Record<string, string> } | null
}

export async function runEgress(
  signal: AbortSignal,
  onRow: (outcome: ProbeOutcome) => void,
): Promise<EgressRun> {
  const rows: Record<string, ProbeRow> = {}
  const seen: SeenAddress[] = []
  const geo: Record<string, ExitGeo> = {}
  const cf: Record<string, CfTrace> = {}
  let nat: EgressRun['nat'] = null

  const natTask = probeNatMapping().then(result => {
    nat = result
  })

  await Promise.all(
    PROBES.map(async probe => {
      if (signal.aborted) return
      const outcome = probe.read === 'stun' ? await probeStun(probe) : await probeHttp(probe, signal)
      if (signal.aborted) return
      rows[outcome.id] = outcome.row
      if (outcome.answer) {
        seen.push({ ip: outcome.answer.ip, probe: outcome.id })
        if (outcome.answer.geo) geo[outcome.answer.ip] = outcome.answer.geo
        if (outcome.answer.cf) cf[outcome.id] = outcome.answer.cf
      }
      onRow(outcome)
    }),
  )
  await natTask
  return { rows, seen, geo, cf, nat }
}
