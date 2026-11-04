/**
 * 上传测速：向 Cloudflare 测速端点的 /__up 并发 POST 固定大小数据块。
 * 浏览器拿不到上传进度，因此用「完成量 / 总耗时」估算吞吐。
 */
export const UPLOAD_TARGET = 'https://speed.cloudflare.com/__up'

export interface UploadResult {
  /** 估算上传带宽，Mbps */
  mbps: number
  bytes: number
  seconds: number
  requests: number
}

export interface UploadProgress {
  bytes: number
  seconds: number
  mbps: number
  /** 0-1，按时间进度 */
  ratio: number
}

export interface UploadOptions {
  /** 测试时长（毫秒） */
  duration?: number
  concurrency?: number
  chunkBytes?: number
  signal?: AbortSignal
  onProgress?: (state: UploadProgress) => void
}

function buildPayload(size: number) {
  const bytes = new Uint8Array(size)
  let seed = 0x2f6e2b1
  for (let i = 0; i < size; i += 4) {
    seed = (seed * 1103515245 + 12345) >>> 0
    bytes[i] = seed & 0xff
    if (i + 1 < size) bytes[i + 1] = (seed >>> 8) & 0xff
    if (i + 2 < size) bytes[i + 2] = (seed >>> 16) & 0xff
    if (i + 3 < size) bytes[i + 3] = (seed >>> 24) & 0xff
  }
  return new Blob([bytes], { type: 'text/plain' })
}

export async function runUploadTest(options: UploadOptions = {}): Promise<UploadResult> {
  const duration = options.duration ?? 8000
  const concurrency = Math.max(1, Math.min(8, options.concurrency ?? 4))
  const chunkBytes = Math.max(256 * 1024, options.chunkBytes ?? 2 * 1024 * 1024)
  const payload = buildPayload(chunkBytes)
  const controller = new AbortController()
  const onOuterAbort = () => controller.abort()
  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', onOuterAbort, { once: true })
  }

  const startedAt = performance.now()
  const deadline = startedAt + duration
  let bytes = 0
  let requests = 0
  let failure = ''

  const emit = () => {
    const seconds = Math.max(0.001, (performance.now() - startedAt) / 1000)
    options.onProgress?.({
      bytes,
      seconds,
      mbps: (bytes * 8) / seconds / 1e6,
      ratio: Math.min(1, (performance.now() - startedAt) / duration),
    })
  }

  async function worker() {
    while (!controller.signal.aborted && performance.now() < deadline) {
      try {
        const resp = await fetch(UPLOAD_TARGET, {
          method: 'POST',
          body: payload,
          cache: 'no-store',
          mode: 'cors',
          signal: controller.signal,
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        bytes += chunkBytes
        requests += 1
        emit()
        await resp.body?.cancel().catch(() => undefined)
      } catch (err) {
        if (controller.signal.aborted) return
        failure = err instanceof Error ? err.message : String(err)
        // 连续失败没有意义，直接收工
        controller.abort()
        return
      }
    }
  }

  const guard = window.setTimeout(() => controller.abort(), duration + 4000)
  try {
    await Promise.all(Array.from({ length: concurrency }, () => worker()))
  } finally {
    window.clearTimeout(guard)
    options.signal?.removeEventListener('abort', onOuterAbort)
  }

  const seconds = Math.max(0.001, (performance.now() - startedAt) / 1000)
  if (!requests) {
    throw new Error(failure ? `上传测试失败：${failure}` : '上传测试未能完成，可能是网络不可达')
  }

  return {
    mbps: (bytes * 8) / seconds / 1e6,
    bytes,
    seconds,
    requests,
  }
}
