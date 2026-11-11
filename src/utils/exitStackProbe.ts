/**
 * 出口地址的网络部分：国内 / 海外各问一次单栈主机，拿回该协议栈真实的出口地址，
 * 同一个请求的往返时间顺带作为该象限的延迟读数。
 */
import { EXIT_TARGETS, type ExitTarget } from '@/data/exitStacks'
import { elapsed, linkSignals } from '@/utils/abort'
import { isIp } from '@/utils/egress'
import type { ExitReading } from '@/utils/exitStack'

export const EXIT_TIMEOUT = 5000

interface Reading {
  ip: string
  ms: number
}

async function askOnce(url: string, family: 4 | 6, timeout: number, outer?: AbortSignal): Promise<Reading | null> {
  const link = linkSignals(timeout, outer)
  const start = performance.now()
  try {
    const resp = await fetch(url, {
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: link.signal,
    })
    if (!resp.ok) return null
    const text = (await resp.text()).trim()
    if (!isIp(text)) return null
    // 单栈域名回了个别的协议栈，说明 DNS 或线路不对，这一格按不可用算
    if ((text.includes(':') ? 6 : 4) !== family) return null
    return { ip: text, ms: elapsed(start) }
  } catch {
    return null
  } finally {
    link.release()
  }
}

async function askTarget(target: ExitTarget, warm: boolean, timeout: number, outer?: AbortSignal): Promise<ExitReading> {
  const miss: ExitReading = { region: target.region, family: target.family, ip: '', ms: null }
  const first = await askOnce(target.url, target.family, timeout, outer)
  if (!first) return miss
  if (!warm) return { region: target.region, family: target.family, ...first }
  // 首问要握手，DNS 与 TLS 都算进了往返；再问一次拿复用连接后的读数
  const second = await askOnce(target.url, target.family, timeout, outer)
  return { region: target.region, family: target.family, ...(second ?? first) }
}

/** 四个象限一起问，任何一个失败只影响它自己那一行 */
export async function probeExits(
  options: { warm?: boolean; timeout?: number; signal?: AbortSignal } = {},
): Promise<ExitReading[]> {
  const { warm = false, timeout = EXIT_TIMEOUT, signal } = options
  return Promise.all(EXIT_TARGETS.map(target => askTarget(target, warm, timeout, signal)))
}
