/**
 * 解锁检测的网络部分：每个服务只发一个请求，读得到就读，读不到就只看通不通。
 * 并发 14 路，单个 8 秒超时。
 */
import { SERVICES, type UnlockService } from '@/data/unlockServices'
import { READERS, type ProbeReply } from '@/utils/unlock'

export const CONCURRENCY = 14
export const TIMEOUT = 8000

async function once(service: UnlockService): Promise<ProbeReply> {
  const { probe } = service
  if (probe.kind === 'reach') {
    try {
      await fetch(probe.url, {
        mode: 'no-cors',
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: AbortSignal.timeout(TIMEOUT),
      })
      return { reach: true }
    } catch (error) {
      const name = (error as Error).name
      return { reach: false, err: name === 'TimeoutError' ? 'timeout' : 'net' }
    }
  }

  try {
    const response = await fetch(probe.url, {
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(TIMEOUT),
      ...(probe.init ? { method: probe.init.method, headers: probe.init.headers, body: probe.init.body } : {}),
    })
    const text = await response.text()
    const reader = probe.read ? READERS[probe.read] : null
    const answer = reader ? reader(response.status, text) : null
    if (probe.kind === 'trace' && !response.ok) return { err: 'http', status: response.status, reach: false }
    if (!answer && !response.ok) return { err: 'http', status: response.status, reach: true }
    if (!answer) return { err: 'parse', status: response.status, reach: true }
    return { status: response.status, answer, reach: true }
  } catch (error) {
    const name = (error as Error).name
    return { err: name === 'TimeoutError' ? 'timeout' : 'net', reach: false }
  }
}

export async function runUnlock(
  signal: AbortSignal,
  onReply: (id: string, reply: ProbeReply, done: number) => void,
): Promise<Record<string, ProbeReply>> {
  const replies: Record<string, ProbeReply> = {}
  let index = 0
  let done = 0

  const worker = async () => {
    while (index < SERVICES.length) {
      if (signal.aborted) return
      const service = SERVICES[index++]
      const reply = await once(service)
      if (signal.aborted) return
      replies[service.id] = reply
      done += 1
      onReply(service.id, reply, done)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return replies
}
