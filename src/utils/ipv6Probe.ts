/**
 * 真正的探测：跑一项测试，取最先响应的站点，再在已建好的连接上量三次往返。
 * 与 1ms.dog 的 ipv6-test 同一套思路，全部由浏览器直接发起。
 */

import { TIMEOUT, TESTS, type V6Host, type V6Side, type V6Test } from '@/data/ipv6Hosts'
import { famOf, readAnswer, sameIp, type Answer, type TestResult } from '@/utils/ipv6'

const now = () => performance.now()

function hostLabel(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** 问一个站点：耗时和它说的地址。失败或超时都抛错 */
async function ask(host: V6Host, signal: AbortSignal): Promise<{ ms: number } & Answer> {
  const t0 = now()
  const res = await fetch(host.url, {
    mode: host.read ? 'cors' : 'no-cors',
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal,
  })
  if (host.read && !res.ok) throw new Error(`http ${res.status}`)
  const answer = host.read && host.read !== 'any' ? readAnswer(host.read, await res.text()) : {}
  const ms = now() - t0
  if (!answer) throw new Error('unreadable')
  return { ms, ...answer }
}

export interface RunOptions {
  signal?: AbortSignal
  /** 是否在连接就绪后再量三次往返 */
  rtt?: boolean
  /** 单项超时，默认 TIMEOUT */
  timeout?: number
}

/**
 * 一项测试：几个站点同时问，用最先答上来的那个。
 * 第一次应答含 DNS、TCP、TLS；随后连接已热，再发三次取最小值作为往返。
 */
export async function runTest(test: V6Test | V6Side, options: RunOptions = {}): Promise<TestResult> {
  const { signal, rtt = true, timeout = TIMEOUT } = options
  const ctl = new AbortController()
  const stop = () => ctl.abort()
  signal?.addEventListener('abort', stop)
  const timer = setTimeout(() => ctl.abort(), timeout)

  try {
    const won = await Promise.any(test.hosts.map(host => ask(host, ctl.signal).then(answer => ({ host, answer }))))
    clearTimeout(timer)
    ctl.abort() // 其余站点认输

    const { host, answer } = won
    const fam = famOf(answer.ip) || test.fam
    const out: TestResult = {
      ok: true,
      ms: answer.ms,
      host: hostLabel(host.url),
      ip: answer.ip || '',
      fam,
      asn: answer.asn || 0,
      cc: answer.cc || '',
    }

    if (rtt && (host.read || host.warm)) {
      const times: number[] = []
      const warmSignal = signal ?? AbortSignal.timeout(timeout)
      for (let i = 0; i < 3 && !signal?.aborted; i += 1) {
        try {
          times.push((await ask(host, warmSignal)).ms)
        } catch {
          break
        }
      }
      if (times.length) out.rtt = Math.min(...times)
    }
    return out
  } catch {
    clearTimeout(timer)
    const aborted = signal?.aborted
    return { ok: false, err: aborted ? 'abort' : ctl.signal.aborted ? 'timeout' : 'fail' }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', stop)
  }
}

/**
 * 某个地址属于哪个网络（ASN 与国家），问 Cloudflare Radar 对应协议的入口。
 * 地址与它看到的不一致（分流代理）或没有应答时返回 null。
 */
export async function lookupNetwork(fam: 4 | 6, ip: string, signal?: AbortSignal): Promise<{ asn: number; cc: string } | null> {
  const host = TESTS.find(test => test.id === `v${fam}`)?.hosts.find(item => item.read === 'radar')
  if (!host) return null

  const ctl = new AbortController()
  const stop = () => ctl.abort()
  signal?.addEventListener('abort', stop)
  const timer = setTimeout(() => ctl.abort(), 6000)
  try {
    const res = await fetch(host.url, {
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: ctl.signal,
    })
    if (!res.ok) return null
    const answer = readAnswer('radar', await res.text())
    if (!answer?.ip || !sameIp(answer.ip, ip)) return null
    return { asn: answer.asn || 0, cc: answer.cc || '' }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', stop)
  }
}
