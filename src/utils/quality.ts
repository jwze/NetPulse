/**
 * 链路质量测试：连续小请求测延迟，由此得出抖动与丢包。
 * 只发 HEAD 请求（no-cors 不读响应体），开销极小。
 */
import { linkSignals } from '@/utils/abort'

export interface QualityProbeTarget {
  label: string
  url: string
}

export const QUALITY_TARGETS: QualityProbeTarget[] = [
  { label: '华为云 204', url: 'https://connectivitycheck.platform.hicloud.com/generate_204' },
  { label: 'Cloudflare 204', url: 'https://cp.cloudflare.com/generate_204' },
]

export interface QualityResult {
  target: string
  sent: number
  received: number
  /** 百分比，0-100 */
  loss: number
  min: number
  avg: number
  median: number
  max: number
  jitter: number
  grade: { label: string; tone: 'good' | 'ok' | 'bad' | 'none' }
  samples: (number | null)[]
}

export interface QualityOptions {
  count?: number
  interval?: number
  timeout?: number
  signal?: AbortSignal
  onProgress?: (done: number, total: number, ms: number | null) => void
}

export async function probeOnce(url: string, timeout: number, outer?: AbortSignal) {
  const link = linkSignals(timeout, outer)
  const start = performance.now()
  try {
    await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: link.signal,
    })
    return Math.round(performance.now() - start)
  } catch {
    return null
  } finally {
    link.release()
  }
}

function wait(ms: number, signal?: AbortSignal) {
  if (ms <= 0) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(done, ms)
    function done() {
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    if (signal?.aborted) return done()
    signal?.addEventListener('abort', done, { once: true })
  })
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function gradeOf(avg: number, jitter: number, loss: number): QualityResult['grade'] {
  if (loss >= 5) return { label: '较差', tone: 'bad' }
  if (avg <= 40 && jitter <= 10) return { label: '优秀', tone: 'good' }
  if (avg <= 80 && jitter <= 30) return { label: '良好', tone: 'good' }
  if (avg <= 150) return { label: '一般', tone: 'ok' }
  return { label: '较差', tone: 'bad' }
}

/** 先各打一次，挑延迟更低的目标做正式采样 */
export async function pickTarget(timeout: number, outer?: AbortSignal): Promise<QualityProbeTarget> {
  const results = await Promise.all(
    QUALITY_TARGETS.map(async target => ({ target, ms: await probeOnce(target.url, timeout, outer) })),
  )
  const reachable = results.filter(item => item.ms !== null).sort((a, b) => (a.ms as number) - (b.ms as number))
  return (reachable[0] || results[0]).target
}

export async function runQualityTest(options: QualityOptions = {}): Promise<QualityResult> {
  const count = options.count ?? 20
  const interval = options.interval ?? 250
  const timeout = options.timeout ?? 3000
  const target = await pickTarget(timeout, options.signal)
  const samples: (number | null)[] = []

  for (let i = 0; i < count; i++) {
    if (options.signal?.aborted) break
    const ms = await probeOnce(target.url, timeout, options.signal)
    samples.push(ms)
    options.onProgress?.(i + 1, count, ms)
    if (i < count - 1) await wait(interval, options.signal)
  }

  const valid = samples.filter((item): item is number => item !== null)
  const sent = samples.length
  const received = valid.length
  const loss = sent ? Number((((sent - received) / sent) * 100).toFixed(1)) : 0

  let jitter = 0
  if (valid.length > 1) {
    let sum = 0
    for (let i = 1; i < valid.length; i++) sum += Math.abs(valid[i] - valid[i - 1])
    jitter = Number((sum / (valid.length - 1)).toFixed(1))
  }

  const avg = valid.length ? Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1)) : 0

  return {
    target: target.label,
    sent,
    received,
    loss,
    min: valid.length ? Math.min(...valid) : 0,
    avg,
    median: Number(median(valid).toFixed(1)),
    max: valid.length ? Math.max(...valid) : 0,
    jitter,
    grade: gradeOf(avg, jitter, loss),
    samples,
  }
}
