/** 给一次网络请求加超时，并跟随外部取消信号 */
export function linkSignals(timeoutMs: number, outer?: AbortSignal) {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  const onAbort = () => ctrl.abort()
  if (outer) {
    if (outer.aborted) ctrl.abort()
    else outer.addEventListener('abort', onAbort, { once: true })
  }
  return {
    signal: ctrl.signal,
    release() {
      window.clearTimeout(timer)
      outer?.removeEventListener('abort', onAbort)
    },
  }
}

export function elapsed(start: number) {
  return Math.max(0, Math.round(performance.now() - start))
}
