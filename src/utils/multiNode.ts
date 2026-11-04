/**
 * 多节点并发同测：同时向多个测速节点拉流，对比各自的实际吞吐。
 *
 * 注意这是「并发」而不是「轮询」：总带宽会被几个节点平分，因此结果反映的是
 * 线路之间的相对表现（谁先抢到带宽、谁更稳定），不代表单节点独跑时的峰值。
 */
import { safeWebNodeHeaders } from '@/utils/webNodeHeaders'

export interface MultiNodeTarget {
  title: string
  url: string
  method?: string
  headers?: string
  postData?: string
}

export interface MultiNodeItem {
  title: string
  url: string
  bytes: number
  /** 平均速度，bytes/s */
  avg: number
  /** 峰值速度，bytes/s */
  peak: number
  /** 最近一次采样速度，bytes/s */
  current: number
  series: number[]
  ok: boolean
  error: string
}

export interface MultiNodeOptions {
  targets: MultiNodeTarget[]
  /** 测试时长（毫秒） */
  duration?: number
  signal?: AbortSignal
  onTick?: (items: MultiNodeItem[]) => void
}

function buildRequest(target: MultiNodeTarget) {
  const method = (target.method || 'GET').toUpperCase()
  const headerResult = safeWebNodeHeaders(target.headers, target.url)
  return {
    method,
    headers: headerResult.headers,
    body: method === 'POST' ? target.postData || '' : undefined,
  }
}

function bust(url: string, attempt: number) {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}_np=${Date.now()}.${attempt}`
}

async function drain(
  target: MultiNodeTarget,
  index: number,
  state: MultiNodeItem[],
  deadline: number,
  signal?: AbortSignal,
) {
  const config = buildRequest(target)
  let attempt = 0

  while (!signal?.aborted && performance.now() < deadline) {
    try {
      const response = await fetch(bust(target.url, attempt), {
        method: config.method,
        body: config.body,
        headers: config.headers,
        cache: 'no-store',
        mode: 'cors',
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        signal,
      })
      if (!response.ok || !response.body) throw new Error(`响应异常 ${response.status}`)

      const reader = response.body.getReader()
      while (!signal?.aborted && performance.now() < deadline) {
        const { value, done } = await reader.read()
        if (done) break
        if (value) state[index].bytes += value.byteLength
      }
      await reader.cancel().catch(() => undefined)
    } catch (err) {
      if (signal?.aborted) return
      // 单个节点失败不影响其他节点，直接标记并退出该路
      state[index].ok = false
      state[index].error = err instanceof Error ? err.message : String(err)
      return
    }
    attempt += 1
  }
}

export async function runMultiNodeTest(options: MultiNodeOptions): Promise<MultiNodeItem[]> {
  const duration = options.duration ?? 8000
  const targets = options.targets.slice(0, 4)
  const state: MultiNodeItem[] = targets.map(target => ({
    title: target.title,
    url: target.url,
    bytes: 0,
    avg: 0,
    peak: 0,
    current: 0,
    series: [],
    ok: true,
    error: '',
  }))

  // 单独一个控制器：到点主动 abort，否则卡在 reader.read() 的流永远不结束
  const inner = new AbortController()
  const stopTimer = window.setTimeout(() => inner.abort(), duration)
  const forwardAbort = () => inner.abort()
  if (options.signal?.aborted) inner.abort()
  options.signal?.addEventListener('abort', forwardAbort, { once: true })

  const started = performance.now()
  const deadline = started + duration
  let lastAt = started
  const lastBytes = state.map(() => 0)

  const emit = () => {
    options.onTick?.(state.map(item => ({ ...item, series: [...item.series] })))
  }

  const timer = window.setInterval(() => {
    const now = performance.now()
    const dt = Math.max(0.2, (now - lastAt) / 1000)
    state.forEach((item, index) => {
      const speed = (item.bytes - lastBytes[index]) / dt
      item.current = speed
      item.series.push(speed)
      item.peak = Math.max(item.peak, speed)
      lastBytes[index] = item.bytes
    })
    lastAt = now
    emit()
  }, 500)

  try {
    await Promise.all(targets.map((target, index) => drain(target, index, state, deadline, inner.signal)))
  } finally {
    window.clearInterval(timer)
    window.clearTimeout(stopTimer)
    options.signal?.removeEventListener('abort', forwardAbort)
  }

  const elapsed = Math.max(1, (performance.now() - started) / 1000)
  state.forEach((item) => {
    item.avg = item.bytes / elapsed
    item.current = 0
    if (item.ok && item.bytes === 0) {
      item.ok = false
      item.error = '未收到数据'
    }
  })
  emit()
  return state
}
