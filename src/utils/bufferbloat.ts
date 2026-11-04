/**
 * Bufferbloat（满载延迟）评级。
 *
 * 原理：先在没有负载时测一组往返延迟作为基线，再在下载压满带宽的同时
 * 持续打小请求。两者之差就是「多出来的排队延迟」——路由器缓冲区越大、
 * 队列管理越差，这个增量越离谱，视频会议和游戏就越容易卡。
 *
 * 分档阈值沿用 Waveform 那一套（按增量 +5 / +30 / +60 / +200 / +400ms），
 * 与单纯的延迟高低无关，只看「满载时变差了多少」。
 */
import { pickTarget, probeOnce, type QualityProbeTarget } from '@/utils/quality'

export type BloatTone = 'good' | 'ok' | 'bad'

export interface BloatGrade {
  key: string
  label: string
  tone: BloatTone
}

export interface BloatThreshold extends BloatGrade {
  /** 增量上限，闭区间；最后一级为 Infinity */
  max: number
  /** 刻度条上的短说明 */
  hint: string
}

export const BLOAT_THRESHOLDS: BloatThreshold[] = [
  { key: 'A+', max: 5, label: '几乎无感', hint: '0-5ms', tone: 'good' },
  { key: 'A', max: 30, label: '轻微', hint: '5-30ms', tone: 'good' },
  { key: 'B', max: 60, label: '可感知', hint: '30-60ms', tone: 'good' },
  { key: 'C', max: 200, label: '明显卡顿', hint: '60-200ms', tone: 'ok' },
  { key: 'D', max: 400, label: '严重', hint: '200-400ms', tone: 'bad' },
  { key: 'F', max: Infinity, label: '基本不可用', hint: '>400ms', tone: 'bad' },
]

export function gradeBloat(increase: number | null | undefined): BloatGrade | null {
  if (increase === null || increase === undefined) return null
  if (!Number.isFinite(increase)) return null
  const hit = BLOAT_THRESHOLDS.find(item => increase <= item.max) ?? BLOAT_THRESHOLDS[BLOAT_THRESHOLDS.length - 1]
  return { key: hit.key, label: hit.label, tone: hit.tone }
}

export function medianOf(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return Number(value.toFixed(1))
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

export interface IdleBaseline {
  ms: number | null
  target: QualityProbeTarget
}

/**
 * 空闲基线：多测一次并丢掉第一发，避免 DNS / TCP / TLS 握手把基线抬高。
 * 全程约 5 × 120ms，对「点开始」的等待感影响很小。
 */
export async function measureIdleLatency(options: {
  count?: number
  interval?: number
  timeout?: number
  signal?: AbortSignal
} = {}): Promise<IdleBaseline> {
  const count = options.count ?? 5
  const interval = options.interval ?? 120
  const timeout = options.timeout ?? 2500
  const target = await pickTarget(timeout, options.signal)
  const samples: number[] = []

  for (let i = 0; i <= count; i++) {
    if (options.signal?.aborted) break
    const ms = await probeOnce(target.url, timeout, options.signal)
    // 第 0 发是冷启动，只用来建连，不计入基线
    if (i > 0 && ms !== null) samples.push(ms)
    if (i < count) await wait(interval, options.signal)
  }

  return { ms: medianOf(samples), target }
}

export interface LoadedProbeHandle {
  stop: () => void
  done: Promise<void>
}

/**
 * 满载采样：每 interval 打一次小请求，回调给出该次往返延迟。
 * 只发几 KB 的 HEAD，几乎不影响正在跑的下载吞吐。
 */
export function startLoadedProbe(options: {
  target: QualityProbeTarget
  interval?: number
  timeout?: number
  signal?: AbortSignal
  onSample: (ms: number | null) => void
}): LoadedProbeHandle {
  const interval = options.interval ?? 500
  const timeout = options.timeout ?? 3000
  let stopped = false

  const done = (async () => {
    // 压测刚起步的一小段时间带宽还没吃满，先等一拍再开始采样
    await wait(Math.max(interval, 800), options.signal)
    while (!stopped && !options.signal?.aborted) {
      const ms = await probeOnce(options.target.url, timeout, options.signal)
      if (stopped) break
      options.onSample(ms)
      await wait(interval, options.signal)
    }
  })()

  return {
    stop() {
      stopped = true
    },
    done,
  }
}
