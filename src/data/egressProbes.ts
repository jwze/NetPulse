/**
 * 出口探测节点：带规则的代理按目的地选线路，所以把探测器放在不同类型的
 * 目的地上，各自回报它看到的地址，就能还原出这台机器一共有几个出口。
 *
 * g     分组，见 GROUPS
 * read  如何读取应答，见 utils/egress.ts 的 READERS
 * fam   该主机只有这一种协议栈，用来单独看 IPv4 / IPv6 出口
 */

export type ProbeGroup = 'cn' | 'intl' | 'ai' | 'web' | 'stack' | 'udp'

export const GROUPS: { id: ProbeGroup; label: string }[] = [
  { id: 'cn', label: '国内网站' },
  { id: 'intl', label: 'IP 查询服务' },
  { id: 'ai', label: 'AI 服务' },
  { id: 'web', label: '常用网站' },
  { id: 'stack', label: '单栈主机' },
  { id: 'udp', label: 'WebRTC / UDP' },
]

export type Reader =
  | 'text'
  | 'trace'
  | 'ipip'
  | 'iqiyi'
  | 'ipsb'
  | 'ipinfo'
  | 'ipapico'
  | 'ipwho'
  | 'geojs'
  | 'ipleak'
  | 'identme'
  | 'ipguide'
  | 'bdc'
  | 'radar'
  | 'ipify'
  | 'stun'

export interface EgressProbe {
  id: string
  g: ProbeGroup
  name: string
  host: string
  url: string
  read: Reader
  fam?: 4 | 6
}

const trace = (id: string, g: ProbeGroup, name: string, host: string): EgressProbe => ({
  id,
  g,
  name,
  host,
  url: `https://${host}/cdn-cgi/trace`,
  read: 'trace',
})

export const PROBES: EgressProbe[] = [
  // 国内网站：分流规则通常让它们直连
  { id: 'ipip', g: 'cn', name: 'IPIP.NET', host: 'myip.ipip.net', url: 'https://myip.ipip.net/json', read: 'ipip' },
  { id: 'iqiyi', g: 'cn', name: '爱奇艺', host: 'data.video.iqiyi.com', url: 'https://data.video.iqiyi.com/v.f4v', read: 'iqiyi' },
  { id: 'ipifycn', g: 'cn', name: 'ipify.cn', host: 'api.ipify.cn', url: 'https://api.ipify.cn', read: 'text' },
  { id: 'dnspod4', g: 'cn', name: 'DNSPod', host: 'ipv4.ddnspod.com', url: 'https://ipv4.ddnspod.com', read: 'text', fam: 4 },
  { id: 'dnspod6', g: 'cn', name: 'DNSPod', host: 'ipv6.ddnspod.com', url: 'https://ipv6.ddnspod.com', read: 'text', fam: 6 },

  // 海外 IP 查询服务
  { id: 'ipsb', g: 'intl', name: 'IP.SB', host: 'api.ip.sb', url: 'https://api.ip.sb/geoip', read: 'ipsb' },
  { id: 'ipinfo', g: 'intl', name: 'ipinfo.io', host: 'ipinfo.io', url: 'https://ipinfo.io/json', read: 'ipinfo' },
  { id: 'ipapico', g: 'intl', name: 'ipapi.co', host: 'ipapi.co', url: 'https://ipapi.co/json/', read: 'ipapico' },
  { id: 'ipwho', g: 'intl', name: 'ipwho.is', host: 'ipwho.is', url: 'https://ipwho.is/', read: 'ipwho' },
  { id: 'geojs', g: 'intl', name: 'GeoJS', host: 'get.geojs.io', url: 'https://get.geojs.io/v1/ip/geo.json', read: 'geojs' },
  { id: 'ipleak', g: 'intl', name: 'ipleak.net', host: 'ipleak.net', url: 'https://ipleak.net/json/', read: 'ipleak' },
  { id: 'identme', g: 'intl', name: 'ident.me', host: 'ident.me', url: 'https://ident.me/json', read: 'identme' },
  { id: 'ipguide', g: 'intl', name: 'ip.guide', host: 'ip.guide', url: 'https://ip.guide/', read: 'ipguide' },
  { id: 'icanhazip', g: 'intl', name: 'icanhazip', host: 'icanhazip.com', url: 'https://icanhazip.com', read: 'text' },
  { id: 'bdc', g: 'intl', name: 'BigDataCloud', host: 'api.bigdatacloud.net', url: 'https://api.bigdatacloud.net/data/client-ip', read: 'bdc' },

  // AI 服务：读各站点自己域名上的 Cloudflare trace
  trace('chatgpt', 'ai', 'ChatGPT', 'chatgpt.com'),
  trace('openai', 'ai', 'OpenAI', 'openai.com'),
  trace('sora', 'ai', 'Sora', 'sora.com'),
  trace('claude', 'ai', 'Claude', 'claude.ai'),
  trace('anthropic', 'ai', 'Anthropic', 'anthropic.com'),
  trace('grok', 'ai', 'Grok', 'grok.com'),
  trace('perplexity', 'ai', 'Perplexity', 'perplexity.ai'),
  trace('copilot', 'ai', 'Copilot', 'copilot.microsoft.com'),
  trace('mistral', 'ai', 'Mistral', 'mistral.ai'),
  trace('poe', 'ai', 'Poe', 'poe.com'),
  trace('characterai', 'ai', 'Character.AI', 'character.ai'),
  trace('deepl', 'ai', 'DeepL', 'deepl.com'),

  // 常用网站
  trace('cloudflare', 'web', 'Cloudflare', 'www.cloudflare.com'),
  trace('one', 'web', '1.1.1.1', 'one.one.one.one'),
  trace('gitlab', 'web', 'GitLab', 'gitlab.com'),
  trace('npm', 'web', 'npm', 'registry.npmjs.org'),
  trace('notion', 'web', 'Notion', 'notion.so'),
  trace('linear', 'web', 'Linear', 'linear.app'),
  trace('zoom', 'web', 'Zoom', 'zoom.us'),
  trace('medium', 'web', 'Medium', 'medium.com'),
  trace('coinbase', 'web', 'Coinbase', 'coinbase.com'),
  trace('crunchyroll', 'web', 'Crunchyroll', 'crunchyroll.com'),
  trace('patreon', 'web', 'Patreon', 'patreon.com'),
  trace('shopify', 'web', 'Shopify', 'shopify.com'),

  // 只有一种协议栈的主机：看各协议的出口
  { id: 'ipsb4', g: 'stack', name: 'IP.SB', host: 'api-ipv4.ip.sb', url: 'https://api-ipv4.ip.sb/geoip', read: 'ipsb', fam: 4 },
  { id: 'ipsb6', g: 'stack', name: 'IP.SB', host: 'api-ipv6.ip.sb', url: 'https://api-ipv6.ip.sb/geoip', read: 'ipsb', fam: 6 },
  { id: 'radar4', g: 'stack', name: 'Cloudflare Radar', host: 'ipv4-check-perf.radar.cloudflare.com', url: 'https://ipv4-check-perf.radar.cloudflare.com/', read: 'radar', fam: 4 },
  { id: 'radar6', g: 'stack', name: 'Cloudflare Radar', host: 'ipv6-check-perf.radar.cloudflare.com', url: 'https://ipv6-check-perf.radar.cloudflare.com/', read: 'radar', fam: 6 },
  { id: 'ipify4', g: 'stack', name: 'ipify', host: 'api4.ipify.org', url: 'https://api4.ipify.org/?format=json', read: 'ipify', fam: 4 },
  { id: 'ipify6', g: 'stack', name: 'ipify', host: 'api6.ipify.org', url: 'https://api6.ipify.org/?format=json', read: 'ipify', fam: 6 },
  { id: 'icanhaz4', g: 'stack', name: 'icanhazip', host: 'ipv4.icanhazip.com', url: 'https://ipv4.icanhazip.com', read: 'text', fam: 4 },
  { id: 'icanhaz6', g: 'stack', name: 'icanhazip', host: 'ipv6.icanhazip.com', url: 'https://ipv6.icanhazip.com', read: 'text', fam: 6 },

  // UDP：只转发 TCP 的代理会让 STUN 看到另一个地址
  { id: 'stun-cf', g: 'udp', name: 'Cloudflare', host: 'stun.cloudflare.com', url: 'stun:stun.cloudflare.com:3478', read: 'stun' },
  { id: 'stun-google', g: 'udp', name: 'Google', host: 'stun.l.google.com', url: 'stun:stun.l.google.com:19302', read: 'stun' },
  { id: 'stun-twilio', g: 'udp', name: 'Twilio', host: 'global.stun.twilio.com', url: 'stun:global.stun.twilio.com:3478', read: 'stun' },
  { id: 'stun-mi', g: 'udp', name: '小米', host: 'stun.miwifi.com', url: 'stun:stun.miwifi.com:3478', read: 'stun' },
  { id: 'stun-bili', g: 'udp', name: '哔哩哔哩', host: 'stun.chat.bilibili.com', url: 'stun:stun.chat.bilibili.com:3478', read: 'stun' },
  { id: 'stun-hitv', g: 'udp', name: '芒果 TV', host: 'stun.hitv.com', url: 'stun:stun.hitv.com:3478', read: 'stun' },
]

export const PROBE_IDS = PROBES.map(probe => probe.id)

/** 这些国家/地区不向 ChatGPT 与 Claude 提供服务 */
export const AI_BLOCKED = ['CN', 'HK', 'MO', 'RU', 'BY', 'IR', 'KP', 'SY', 'CU']

export const AI_CHECK = ['chatgpt', 'openai', 'claude', 'anthropic']
