/**
 * 全球延迟探测的服务清单。
 *
 * 每个 URL 都指向服务自己的边缘节点上的小文件：不跳转、可缓存、同域，
 * 这样一次计时就是「本机 → 最近边缘节点」的一个往返，不含应用服务器处理时间。
 * 需要读取边缘节点的服务会以 cors 模式请求（仍是简单请求，无预检）。
 */

export type ServiceCat = 'ai' | 'web' | 'video' | 'social' | 'dev' | 'game' | 'cdn' | 'local'

export interface LatencyService {
  id: string
  name: string
  cat: ServiceCat
  url: string
  /** 默认 GET；IMG 用于只能用图片加载计时的主机 */
  method?: 'GET' | 'HEAD' | 'IMG'
  /** 不加随机查询串（少数 CDN 对查询串会回源） */
  raw?: boolean
  /** 边缘节点标识的读取方式 */
  pop?: 'trace' | 'x-served-by' | 'x-amz-cf-pop'
  /** 计时 URL 看不到节点时，改用同一边缘网络上的另一个地址读 */
  popUrl?: string
  /** 响应该服务的边缘网络 */
  via?: string
  /** 窄屏下的短名 */
  short?: string
}

export const CATS: { id: ServiceCat; label: string }[] = [
  { id: 'ai', label: 'AI 工具' },
  { id: 'web', label: '常用网站' },
  { id: 'video', label: '影音' },
  { id: 'social', label: '社交' },
  { id: 'dev', label: '开发' },
  { id: 'game', label: '游戏' },
  { id: 'cdn', label: 'CDN 骨干' },
  { id: 'local', label: '本地常用' },
]

export const SERVICES: LatencyService[] = [
  // AI
  { id: 'chatgpt', name: 'ChatGPT', cat: 'ai', url: 'https://chatgpt.com/favicon.ico', via: 'Cloudflare' },
  { id: 'claude', name: 'Claude', cat: 'ai', url: 'https://claude.ai/cdn-cgi/trace', via: 'Cloudflare' },
  { id: 'gemini', name: 'Gemini', cat: 'ai', url: 'https://gemini.google.com/generate_204', via: 'Google' },
  { id: 'copilot', name: 'Copilot', cat: 'ai', url: 'https://copilot.microsoft.com/cdn-cgi/trace', via: 'Cloudflare' },
  { id: 'grok', name: 'Grok', cat: 'ai', url: 'https://grok.com/cdn-cgi/trace', via: 'Cloudflare' },
  { id: 'deepseek', name: 'DeepSeek', cat: 'ai', url: 'https://chat.deepseek.com/favicon.svg' },

  // 常用网站
  { id: 'google', name: 'Google', cat: 'web', url: 'https://www.google.com/generate_204', via: 'Google' },
  { id: 'apple', name: 'Apple', cat: 'web', url: 'https://www.apple.com/favicon.ico', via: 'Apple' },
  { id: 'microsoft', name: 'Microsoft', cat: 'web', url: 'https://www.microsoft.com/favicon.ico' },
  { id: 'wikipedia', name: 'Wikipedia', cat: 'web', url: 'https://upload.wikimedia.org/favicon.ico', via: 'Wikimedia' },
  { id: 'amazon', name: 'Amazon', cat: 'web', url: 'https://www.amazon.com/favicon.ico', via: 'Amazon CloudFront' },
  { id: 'zoom', name: 'Zoom', cat: 'web', url: 'https://zoom.us/cdn-cgi/trace', via: 'Cloudflare' },

  // 影音
  { id: 'youtube', name: 'YouTube', cat: 'video', url: 'https://www.youtube.com/generate_204', via: 'Google' },
  { id: 'netflix', name: 'Netflix', cat: 'video', url: 'https://www.netflix.com/favicon.ico' },
  { id: 'tiktok', name: 'TikTok', cat: 'video', url: 'https://www.tiktok.com/favicon.ico' },
  { id: 'twitch', name: 'Twitch', cat: 'video', url: 'https://www.twitch.tv/favicon.ico' },
  { id: 'spotify', name: 'Spotify', cat: 'video', url: 'https://open.spotify.com/favicon.ico' },

  // 社交
  { id: 'x', name: 'X', cat: 'social', url: 'https://abs.twimg.com/favicons/twitter.3.ico' },
  { id: 'instagram', name: 'Instagram', cat: 'social', url: 'https://scontent.cdninstagram.com/', via: 'Meta' },
  { id: 'facebook', name: 'Facebook', cat: 'social', url: 'https://www.facebook.com/favicon.ico', via: 'Meta' },
  { id: 'whatsapp', name: 'WhatsApp', cat: 'social', url: 'https://web.whatsapp.com/favicon.ico', via: 'Meta' },
  { id: 'telegram', name: 'Telegram', cat: 'social', url: 'https://venus.web.telegram.org/apiw1' },
  { id: 'discord', name: 'Discord', cat: 'social', url: 'https://discord.com/cdn-cgi/trace', via: 'Cloudflare' },
  { id: 'reddit', name: 'Reddit', cat: 'social', url: 'https://www.reddit.com/robots.txt', via: 'Fastly' },

  // 开发
  { id: 'github', name: 'GitHub', cat: 'dev', url: 'https://github.com/favicon.ico' },
  { id: 'npm', name: 'npm', cat: 'dev', url: 'https://registry.npmjs.org/-/ping', via: 'Cloudflare' },
  { id: 'dockerhub', name: 'Docker Hub', cat: 'dev', url: 'https://registry-1.docker.io/v2/' },
  { id: 'pypi', name: 'PyPI', cat: 'dev', url: 'https://pypi.org/static/images/favicon.35549fe8.ico', via: 'Fastly' },
  { id: 'huggingface', name: 'Hugging Face', cat: 'dev', url: 'https://huggingface.co/favicon.ico', method: 'HEAD', pop: 'x-amz-cf-pop', via: 'Amazon CloudFront' },

  // 游戏
  { id: 'steam', name: 'Steam', cat: 'game', url: 'https://store.steampowered.com/favicon.ico' },
  { id: 'playstation', name: 'PlayStation', cat: 'game', url: 'https://www.playstation.com/favicon.ico', via: 'Akamai' },
  { id: 'xbox', name: 'Xbox', cat: 'game', url: 'https://www.xbox.com/favicon.ico' },
  { id: 'nintendo', name: 'Nintendo', cat: 'game', url: 'https://www.nintendo.com/favicon.ico', via: 'Fastly' },
  { id: 'epic', name: 'Epic Games', cat: 'game', url: 'https://store.epicgames.com/cdn-cgi/trace', via: 'Cloudflare' },

  // CDN 骨干
  { id: 'cloudflare', name: 'Cloudflare', cat: 'cdn', url: 'https://www.cloudflare.com/cdn-cgi/trace', raw: true, pop: 'trace', via: 'Cloudflare' },
  { id: 'akamai', name: 'Akamai', cat: 'cdn', url: 'https://store.akamai.steamstatic.com/favicon.ico', raw: true, via: 'Akamai' },
  {
    id: 'cloudfront',
    name: 'Amazon CloudFront',
    short: 'CloudFront',
    cat: 'cdn',
    url: 'https://a0.awsstatic.com/libra-css/images/site/fav/favicon.ico',
    raw: true,
    pop: 'x-amz-cf-pop',
    popUrl: 'https://huggingface.co/front/assets/huggingface_logo-noborder.svg',
    via: 'Amazon CloudFront',
  },
  { id: 'google-cdn', name: 'Google Cloud CDN', short: 'Google CDN', cat: 'cdn', url: 'https://www.gstatic.com/generate_204', raw: true, via: 'Google' },
  { id: 'fastly', name: 'Fastly', cat: 'cdn', url: 'https://fastly.jsdelivr.net/npm/jquery@3.7.1/package.json', raw: true, pop: 'x-served-by', via: 'Fastly' },
  { id: 'azure', name: 'Azure Front Door', short: 'Front Door', cat: 'cdn', url: 'https://assets.xboxservices.com/assets/f8/67/f86740d7-eedd-4d9c-a963-76af7e36c4b2.svg', raw: true, via: 'Azure Front Door' },
]

/** 本地常用包：出口国家决定默认选中哪一组，用户也可以手动切换 */
export const PACKS: Record<string, LatencyService[]> = {
  cn: [
    { id: 'baidu', name: '百度', cat: 'local', url: 'https://www.baidu.com/favicon.ico' },
    { id: 'bilibili', name: '哔哩哔哩', cat: 'local', url: 'https://www.bilibili.com/favicon.ico' },
    { id: 'wechat', name: '微信', cat: 'local', url: 'https://weixin.qq.com/favicon.ico' },
    { id: 'douyin', name: '抖音', cat: 'local', url: 'https://www.douyin.com/robots.txt' },
  ],
  tw: [
    { id: 'yahoo-tw', name: 'Yahoo奇摩', cat: 'local', url: 'https://tw.yahoo.com/favicon.ico' },
    { id: 'line-tw', name: 'LINE', cat: 'local', url: 'https://line.me/favicon.ico' },
    { id: 'ettoday', name: 'ETtoday', cat: 'local', url: 'https://www.ettoday.net/favicon.ico' },
    { id: 'ptt', name: 'PTT', cat: 'local', url: 'https://www.ptt.cc/cdn-cgi/trace' },
  ],
  jp: [
    { id: 'yahoo-jp', name: 'Yahoo! JAPAN', cat: 'local', url: 'https://www.yahoo.co.jp/favicon.ico' },
    { id: 'line', name: 'LINE', cat: 'local', url: 'https://line.me/favicon.ico' },
    { id: 'rakuten', name: '楽天', cat: 'local', url: 'https://www.rakuten.co.jp/favicon.ico' },
    { id: 'niconico', name: 'ニコニコ', cat: 'local', url: 'https://www.nicovideo.jp/favicon.ico' },
  ],
  kr: [
    { id: 'naver', name: 'NAVER', cat: 'local', url: 'https://www.naver.com/robots.txt' },
    { id: 'kakao', name: 'Kakao', cat: 'local', url: 'https://www.kakaocorp.com/robots.txt' },
    { id: 'coupang', name: 'Coupang', cat: 'local', url: 'https://image7.coupangcdn.com/image/coupang/favicon/v2/favicon.ico' },
    { id: 'daum', name: 'Daum', cat: 'local', url: 'https://www.daum.net/favicon.ico' },
  ],
  ru: [
    { id: 'yandex', name: 'Яндекс', cat: 'local', url: 'https://yandex.ru/favicon.ico' },
    { id: 'vk', name: 'VK', cat: 'local', url: 'https://vk.com/favicon.ico' },
    { id: 'wildberries', name: 'Wildberries', cat: 'local', url: 'https://www.wildberries.ru/favicon.ico' },
    { id: 'mailru', name: 'Mail.ru', cat: 'local', url: 'https://mail.ru/favicon.ico' },
  ],
  in: [
    { id: 'flipkart', name: 'Flipkart', cat: 'local', url: 'https://static-assets-web.flixcart.com/favicon.ico' },
    { id: 'hotstar', name: 'JioHotstar', cat: 'local', url: 'https://www.hotstar.com/robots.txt', method: 'HEAD' },
    { id: 'paytm', name: 'Paytm', cat: 'local', url: 'https://paytm.com/favicon.ico' },
    { id: 'amazon-in', name: 'Amazon.in', cat: 'local', url: 'https://www.amazon.in/favicon.ico' },
  ],
  sea: [
    { id: 'shopee', name: 'Shopee', cat: 'local', url: 'https://shopee.sg/favicon.ico' },
    { id: 'lazada', name: 'Lazada', cat: 'local', url: 'https://www.lazada.sg/favicon.ico' },
    { id: 'grab', name: 'Grab', cat: 'local', url: 'https://www.grab.com/robots.txt' },
    { id: 'line-sea', name: 'LINE', cat: 'local', url: 'https://line.me/favicon.ico' },
  ],
  eu: [
    { id: 'bbc', name: 'BBC', cat: 'local', url: 'https://www.bbc.co.uk/favicon.ico' },
    { id: 'booking', name: 'Booking.com', cat: 'local', url: 'https://www.booking.com/robots.txt', method: 'HEAD' },
    { id: 'zalando', name: 'Zalando', cat: 'local', url: 'https://www.zalando.com/favicon.ico' },
    { id: 'allegro', name: 'Allegro', cat: 'local', url: 'https://allegro.pl/favicon.ico' },
  ],
  latam: [
    { id: 'mercadolibre', name: 'Mercado Libre', cat: 'local', url: 'https://www.mercadolibre.com/favicon.ico' },
    { id: 'globo', name: 'Globo', cat: 'local', url: 'https://www.globo.com/favicon.ico' },
    { id: 'nubank', name: 'Nubank', cat: 'local', url: 'https://nubank.com.br/favicon.ico', method: 'HEAD' },
    { id: 'ifood', name: 'iFood', cat: 'local', url: 'https://www.ifood.com.br/cdn-cgi/trace' },
  ],
  na: [
    { id: 'espn', name: 'ESPN', cat: 'local', url: 'https://www.espn.com/favicon.ico' },
    { id: 'disneyplus', name: 'Disney+', cat: 'local', url: 'https://www.disneyplus.com/favicon.ico' },
    { id: 'yahoo', name: 'Yahoo', cat: 'local', url: 'https://www.yahoo.com/favicon.ico' },
    { id: 'target', name: 'Target', cat: 'local', url: 'https://www.target.com/favicon.ico' },
  ],
  me: [
    { id: 'talabat', name: 'talabat', cat: 'local', url: 'https://www.talabat.com/cdn-cgi/trace' },
    { id: 'careem', name: 'Careem', cat: 'local', url: 'https://www.careem.com/favicon.ico' },
    { id: 'aljazeera', name: 'Al Jazeera', cat: 'local', url: 'https://www.aljazeera.com/favicon_aje.ico' },
    { id: 'trendyol', name: 'Trendyol', cat: 'local', url: 'https://www.trendyol.com/cdn-cgi/trace' },
  ],
}

export const PACK_IDS = Object.keys(PACKS)

export const PACK_LABELS: Record<string, string> = {
  cn: '中国大陆',
  tw: '中国台湾',
  jp: '日本',
  kr: '韩国',
  ru: '俄罗斯',
  in: '印度',
  sea: '东南亚',
  eu: '欧洲',
  latam: '拉美',
  na: '北美',
  me: '中东',
}

const mapPacks = (pack: string, codes: string) =>
  Object.fromEntries(codes.split(' ').map(code => [code, pack]))

export const PACK_OF: Record<string, string> = {
  ...mapPacks('cn', 'CN'),
  ...mapPacks('tw', 'TW HK MO'),
  ...mapPacks('jp', 'JP'),
  ...mapPacks('kr', 'KR'),
  ...mapPacks('ru', 'RU BY KZ'),
  ...mapPacks('in', 'IN BD PK LK NP'),
  ...mapPacks('sea', 'SG MY TH VN ID PH'),
  ...mapPacks('eu', 'GB IE DE FR NL BE LU AT CH IT ES PT PL CZ SK HU RO BG GR SE NO DK FI IS EE LV LT SI HR UA'),
  ...mapPacks('latam', 'BR AR MX CL CO PE UY VE EC BO PY CR PA DO GT'),
  ...mapPacks('na', 'US CA'),
  ...mapPacks('me', 'AE SA QA KW BH OM EG TR IL JO'),
}

/** 日常用途评级：中位数在 smooth 内算顺畅，在 fine 内算可用，再慢就是吃力 */
export const USES: { id: string; label: string; ids: string[]; smooth: number; fine: number }[] = [
  { id: 'game', label: '游戏', ids: ['steam', 'playstation', 'xbox', 'nintendo', 'epic'], smooth: 80, fine: 150 },
  { id: 'call', label: '视频通话', ids: ['zoom', 'whatsapp', 'discord', 'telegram'], smooth: 150, fine: 250 },
  { id: 'stream', label: '流媒体', ids: ['youtube', 'netflix', 'twitch', 'tiktok', 'spotify'], smooth: 200, fine: 400 },
  { id: 'ai', label: 'AI 工具', ids: ['chatgpt', 'claude', 'gemini', 'copilot', 'grok', 'deepseek'], smooth: 200, fine: 400 },
  { id: 'dev', label: '开发工具', ids: ['github', 'npm', 'dockerhub', 'pypi', 'huggingface'], smooth: 150, fine: 300 },
]

/** 这些国家通常无法直连的服务；若它们反而快速响应，说明存在检查看不到的出口 */
export const WALLED: Record<string, string[]> = {
  CN: ['google', 'youtube', 'x', 'facebook', 'instagram', 'telegram', 'discord', 'wikipedia', 'chatgpt', 'reddit'],
  IR: ['youtube', 'x', 'facebook', 'instagram', 'telegram'],
}

/** 服务清单按分类取，本地包置于最前 */
export function servicesOf(pack: string): LatencyService[] {
  return [...(PACKS[pack] || []), ...SERVICES]
}

export function serviceById(id: string): LatencyService | undefined {
  return SERVICES.find(s => s.id === id) || PACK_IDS.flatMap(p => PACKS[p]).find(s => s.id === id)
}
