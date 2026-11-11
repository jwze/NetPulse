/**
 * 出口地址的四象限探测目标：国内 / 海外 × IPv4 / IPv6。
 *
 * 每个域名只监听一种协议栈，所以它回报的地址就是该协议栈真实的出口；
 * 同一个请求的往返时间顺带作为该象限的延迟读数。
 * 走国内站点与海外站点分别探测，带分流规则的代理会在这里露出两个不同的出口。
 */

export type ExitRegion = 'cn' | 'global'

export interface ExitTarget {
  region: ExitRegion
  family: 4 | 6
  name: string
  url: string
}

export const EXIT_TARGETS: ExitTarget[] = [
  { region: 'cn', family: 4, name: 'DNSPod', url: 'https://ipv4.ddnspod.com' },
  { region: 'cn', family: 6, name: 'DNSPod', url: 'https://ipv6.ddnspod.com' },
  { region: 'global', family: 4, name: 'ipify', url: 'https://api4.ipify.org' },
  { region: 'global', family: 6, name: 'ipify', url: 'https://api6.ipify.org' },
]

export const REGIONS: { id: ExitRegion; label: string }[] = [
  { id: 'cn', label: '国内' },
  { id: 'global', label: '海外' },
]

export const FAMILIES: (4 | 6)[] = [4, 6]
