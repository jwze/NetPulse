/**
 * IPv6 测试的节点清单。
 *
 * 每项测试同时问几个站点，用最先响应的那个：一家被墙或变慢不会让整项失败。
 * 同一项里刻意混入不同网络（Cloudflare / Google / DNSPod / 阿里 DNS / ipify / icanhazip），
 * 所以在大陆、境外、只有 IPv6 的网络上都能测出结果。
 *
 *   v4   只有 A 记录的站点：IPv4 通不通，出去的是哪个地址
 *   v6   只有 AAAA 记录的站点：IPv6 通不通，DNS 有没有给出 AAAA
 *   ds   两种地址都有：浏览器选了哪个，会不会先等 IPv6 超时
 *   big  IPv6 站点的 3.5 KB URL，新连接：满尺寸数据包能不能双向通过（PMTU 黑洞时小请求正常、大请求卡死）
 *   lit6 不带域名的 IPv6 地址：不靠 DNS 能不能连
 *   lit4 不带域名的 IPv4 地址：只有 IPv6 的网络靠 NAT64 打开 IPv4 网站时，这项会失败
 */

export type ReadMode = 'text' | 'trace' | 'radar' | 'any' | null

export interface V6Host {
  url: string
  /** 怎么从响应里取地址：text 正文即地址，trace Cloudflare 的 key=value，radar 的 JSON，any 只关心通不通，null 为 no-cors */
  read: ReadMode
  /** no-cors 的站点也计时往返 */
  warm?: boolean
}

export interface V6Test {
  id: string
  fam: 0 | 4 | 6
  hosts: V6Host[]
}

export interface V6Pair {
  id: string
  name: string
  /** 节点位置：全球、大陆除外、大陆 */
  where: 'global' | 'nocn' | 'cn'
  v4: V6Host
  v6: V6Host
}

export interface V6Side {
  id: string
  fam: 4 | 6
  pair: string
  hosts: V6Host[]
}

/** 单项超时；10 秒还没答案的页面本身已经不可用了 */
export const TIMEOUT = 10000
/** 对比用的单侧只测往返，等 6 秒足够；不然被墙的节点会把整轮拖到 10 秒 */
export const SIDE_TIMEOUT = 6000
/** 第一次响应超过这个时间就算慢，双栈测试按它扣分 */
export const SLOW = 3000
/** 把请求 URL 撑到 3.5 KB，逼两端都用满尺寸的数据包 */
export const PAD = 'x'.repeat(3500)

export const TESTS: V6Test[] = [
  {
    id: 'v4',
    fam: 4,
    hosts: [
      { url: 'https://ipv4.ddnspod.com/', read: 'text' },
      { url: 'https://ipv4.icanhazip.com/', read: 'text' },
      { url: 'https://ipv4-check-perf.radar.cloudflare.com/', read: 'radar' },
    ],
  },
  {
    id: 'v6',
    fam: 6,
    hosts: [
      { url: 'https://ipv6.ddnspod.com/', read: 'text' },
      { url: 'https://ipv6.icanhazip.com/', read: 'text' },
      { url: 'https://ipv6-check-perf.radar.cloudflare.com/', read: 'radar' },
    ],
  },
  {
    id: 'ds',
    fam: 0,
    hosts: [
      { url: 'https://cloudflare.com/cdn-cgi/trace', read: 'trace' },
      { url: 'https://icanhazip.com/', read: 'text' },
      { url: 'https://api64.ipify.org/', read: 'text' },
    ],
  },
  {
    id: 'big',
    fam: 6,
    hosts: [
      { url: `https://v6.ident.me/?pad=${PAD}`, read: 'text' },
      { url: `https://ipv6.icanhazip.com/?pad=${PAD}`, read: 'text' },
      { url: `https://[2606:4700:4700::1001]/cdn-cgi/trace?pad=${PAD}`, read: 'trace' },
      { url: `https://[2001:4860:4860::8844]/resolve?name=v6.ident.me&random_padding=${PAD}`, read: 'any' },
    ],
  },
  {
    id: 'lit6',
    fam: 6,
    hosts: [
      { url: 'https://[2606:4700:4700::1111]/cdn-cgi/trace', read: 'trace' },
      { url: 'https://[2606:4700:4700::64]/cdn-cgi/trace', read: 'trace' },
      { url: 'https://[2001:4860:4860::6464]/resolve?name=v6.ident.me&type=AAAA', read: 'any' },
    ],
  },
  {
    id: 'lit4',
    fam: 4,
    hosts: [
      { url: 'https://1.0.0.1/cdn-cgi/trace', read: 'trace' },
      { url: 'https://8.8.4.4/resolve?name=v6.ident.me&type=A', read: 'any' },
      { url: 'https://223.5.5.5/resolve?name=v6.ident.me&type=1', read: 'any' },
    ],
  },
]

/** 同一个网络分别走 IPv4 和 IPv6，同时各测一次，差值只反映线路 */
export const PAIRS: V6Pair[] = [
  {
    id: 'cf',
    name: 'Cloudflare',
    where: 'global',
    v4: { url: 'https://1.0.0.1/cdn-cgi/trace', read: 'trace' },
    // 不用 ::1001：大数据包测试要占一个全新连接
    v6: { url: 'https://[2606:4700:4700::1111]/cdn-cgi/trace', read: 'trace' },
  },
  {
    id: 'gg',
    name: 'Google',
    where: 'nocn',
    v4: { url: 'https://8.8.8.8/resolve?name=v6.ident.me&type=A', read: 'any' },
    v6: { url: 'https://[2001:4860:4860::8888]/resolve?name=v6.ident.me&type=A', read: 'any' },
  },
  {
    id: 'ak',
    name: 'Akamai',
    where: 'global',
    v4: { url: 'https://ipv4.whatismyip.akamai.com/', read: null, warm: true },
    v6: { url: 'https://ipv6.whatismyip.akamai.com/', read: null, warm: true },
  },
  {
    id: 'dp',
    name: 'DNSPod',
    where: 'cn',
    v4: { url: 'https://ipv4.ddnspod.com/', read: 'text' },
    v6: { url: 'https://ipv6.ddnspod.com/', read: 'text' },
  },
]

export const SIDES: V6Side[] = PAIRS.flatMap(pair => ([4, 6] as const).map(fam => ({
  id: `${pair.id}${fam}`,
  fam,
  pair: pair.id,
  hosts: [fam === 4 ? pair.v4 : pair.v6],
})))

export const TEST_IDS = TESTS.map(t => t.id)
export const SIDE_IDS = SIDES.map(s => s.id)
export const KNOWN_IDS = new Set([...TEST_IDS, ...SIDE_IDS])

/** 侧栏与卡片上的名字 */
export const TEST_LABEL: Record<string, string> = {
  v4: '只有 IPv4 的网站',
  v6: '只有 IPv6 的网站',
  ds: '双栈网站',
  big: 'IPv6 大数据包',
  lit6: 'IPv6 地址直连',
  lit4: 'IPv4 地址直连',
}

/** 悬停说明：这一项到底在测什么 */
export const TEST_DESC: Record<string, string> = {
  v4: '看 IPv4 通不通，以及出口地址',
  v6: '需要网络有 IPv6，DNS 也要给出 AAAA 记录',
  ds: '两种地址都有的网站，看浏览器选了哪个、要不要等',
  big: '新连接上发满尺寸的数据包；这项不通，网页会卡在加载',
  lit6: '不查 DNS，直接连一个 IPv6 地址',
  lit4: '直接连 IPv4 地址，用来识别只有 IPv6 的 NAT64 网络',
}

export const PAIR_WHERE: Record<V6Pair['where'], string> = {
  global: '全球节点',
  nocn: '全球（大陆除外）',
  cn: '中国大陆节点',
}
