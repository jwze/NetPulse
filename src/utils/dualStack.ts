/**
 * 双栈探测：v4 / v6 各请求一个只监听对应协议栈的公开服务。
 * 成功即代表该协议可用，同时拿到对应出口地址。
 */
import { linkSignals, elapsed } from '@/utils/abort'

export interface StackProbe {
  family: 'IPv4' | 'IPv6'
  ok: boolean
  address: string
  ms: number | null
}

const TARGETS: { family: StackProbe['family']; url: string }[] = [
  { family: 'IPv4', url: 'https://v4.ident.me' },
  { family: 'IPv6', url: 'https://v6.ident.me' },
]

async function probeOne(family: StackProbe['family'], url: string, timeout: number, outer?: AbortSignal): Promise<StackProbe> {
  const link = linkSignals(timeout, outer)
  const start = performance.now()
  try {
    const resp = await fetch(url, {
      cache: 'no-store',
      mode: 'cors',
      referrerPolicy: 'no-referrer',
      signal: link.signal,
    })
    if (!resp.ok) throw new Error(String(resp.status))
    const text = (await resp.text()).trim()
    if (!text) throw new Error('空响应')
    return { family, ok: true, address: text, ms: elapsed(start) }
  } catch {
    return { family, ok: false, address: '', ms: null }
  } finally {
    link.release()
  }
}

export async function probeDualStack(timeout = 4000, outer?: AbortSignal): Promise<StackProbe[]> {
  return Promise.all(TARGETS.map(item => probeOne(item.family, item.url, timeout, outer)))
}
