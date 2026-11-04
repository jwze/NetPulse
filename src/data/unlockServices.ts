/**
 * 各流媒体与 AI 服务，以及浏览器能拿到的最强信号：
 *   trace  服务自己域名上的 Cloudflare trace，读出它看到的国家（允许跨域）
 *   api    服务自己的地区接口，任何网页都能读（同一个接口命令行脚本也用）
 *   reach  只能确认这条线路上打不打得开，国家取多数服务看到的那个（推测）
 * 跳转计数需要自建服务器，这里没有采用，所以 Netflix 一类的片库地区只能推测。
 */

export type UnlockCat = 'ai' | 'video' | 'social' | 'local'

export const CATS: { id: UnlockCat; label: string }[] = [
  { id: 'ai', label: 'AI' },
  { id: 'video', label: '影音' },
  { id: 'social', label: '社交' },
  { id: 'local', label: '地区服务' },
]

export type ReaderId =
  | 'trace'
  | 'openai'
  | 'dazn'
  | 'kktv'
  | 'tvb'
  | 'sbs'
  | 'philo'
  | 'nbc'
  | 'dmm'
  | 'shudder'
  | 'bein'
  | 'zdf'
  | 'fod'
  | 'mgtv'
  | 'ten'
  | 'molotov'
  | 'nhk'
  | 'sling'
  | 'itv'
  | 'telasa'
  | 'catchplay'
  | 'aetv'

export interface UnlockProbe {
  kind: 'trace' | 'api' | 'reach'
  url: string
  read?: ReaderId
  init?: { method: string; headers: Record<string, string>; body: string }
}

export interface UnlockService {
  id: string
  cat: UnlockCat
  name: string
  site: string
  probe: UnlockProbe
  allow?: string
  deny?: string
  only?: string
}

/** OpenAI 支持的国家与地区（ChatGPT 与 API 共用） */
const OPENAI =
  'AL DZ AF AX AD AO AG AR AM AW AU AT AZ BS BH BD BB BE BZ BM BJ BT BO BA BW BR BN BG BF BI CV KH CM CA KY CF TD CL CO KM CG CD CR CI HR CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FO FJ FI FR GF PF TF GA GM GE DE GH GR GD GL GT GP GN GW GY HT VA HN HU IS IN ID IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MA MZ MM NA NR NP NL NC NZ NI NE NG MK NO OM PK PW PS PA PG PY PE PH PL PT QA RE RO RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA KR SS ES LK SR SE CH SD SJ TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VN WF YE ZM ZW'
/** Anthropic 支持的国家与地区 */
const ANTHROPIC =
  'AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CO KM CG CD CR CI HR CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GP GN GW GY HT HN HU IS IN ID IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ NA NR NP NL NZ NI NE NG MK NO OM PK PW PS PA PG PY PE PH PL PT QA RO RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SO SB ZA KR SS ES LK SD SR SE CH TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VN ZM ZW'
/** Gemini 应用支持的国家与地区 */
const GEMINI =
  'AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BH BD BB BE BZ BJ BM BT BO BA BW BR IO VG BN BG BF BI CV KH CM CA BQ KY CF TD CL CX CC CO KM CK CR CI HR CW CZ CD DK DJ DM DO EC EG SV GQ ER EE SZ FK FO FJ FI FR GF PF TF GA GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM HN HK HU IS IN ID IQ IE IM IL IT JM JP JE JO KZ KE KI XK KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA CY CG RE RO RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS KR SS ES LK SD SR SJ SE CH TW TJ TZ TH BS GM TL TG TK TO TT TN TR TM TC TV VI UG UA AE GB US UM UY UZ VU VA VE VN WF EH YE ZM ZW'
const NETFLIX_NO = 'CN KP RU SY'
const STREAM_GONE_RU = 'CN RU BY CU IR KP SY'
const SANCTIONED = 'CU IR KP SY'
/** 这些国家 / 地区政府封锁了对应的社交服务 */
const BLOCK = {
  youtube: 'CN KP IR TM',
  x: 'CN KP IR RU TM MM',
  instagram: 'CN KP IR RU TM',
  telegram: 'CN IR KP',
  whatsapp: 'CN KP',
  discord: 'CN RU TR',
  reddit: 'CN',
  facebook: 'CN KP IR RU TM MM',
  threads: 'CN KP IR RU TM MM',
  signal: 'CN IR RU',
  line: 'CN',
  snapchat: 'CN KP IR',
  pinterest: 'CN',
  google: 'CN KP',
  wikipedia: 'CN',
  roblox: 'CN TR QA KW JO OM',
  soundcloud: 'CN',
}

const trace = (url: string): UnlockProbe => ({ kind: 'trace', url, read: 'trace' })
const reach = (url: string): UnlockProbe => ({ kind: 'reach', url })

export const SERVICES: UnlockService[] = [
  // AI
  { id: 'chatgpt', cat: 'ai', name: 'ChatGPT', site: 'https://chatgpt.com/', allow: OPENAI, probe: { kind: 'api', url: 'https://api.openai.com/compliance/cookie_requirements', read: 'openai' } },
  { id: 'claude', cat: 'ai', name: 'Claude', site: 'https://claude.ai/', allow: ANTHROPIC, probe: trace('https://claude.ai/cdn-cgi/trace') },
  { id: 'gemini', cat: 'ai', name: 'Gemini', site: 'https://gemini.google.com/', allow: GEMINI, probe: reach('https://gemini.google.com/generate_204') },
  { id: 'copilot', cat: 'ai', name: 'Copilot', site: 'https://copilot.microsoft.com/', deny: `CN RU BY ${SANCTIONED}`, probe: trace('https://copilot.microsoft.com/cdn-cgi/trace') },
  { id: 'grok', cat: 'ai', name: 'Grok', site: 'https://grok.com/', deny: `CN ${SANCTIONED}`, probe: trace('https://grok.com/cdn-cgi/trace') },
  { id: 'perplexity', cat: 'ai', name: 'Perplexity', site: 'https://www.perplexity.ai/', deny: SANCTIONED, probe: trace('https://www.perplexity.ai/cdn-cgi/trace') },
  { id: 'mistral', cat: 'ai', name: 'Le Chat', site: 'https://chat.mistral.ai/', deny: SANCTIONED, probe: trace('https://chat.mistral.ai/cdn-cgi/trace') },
  { id: 'poe', cat: 'ai', name: 'Poe', site: 'https://poe.com/', deny: `CN ${SANCTIONED}`, probe: trace('https://poe.com/cdn-cgi/trace') },
  { id: 'characterai', cat: 'ai', name: 'Character.AI', site: 'https://character.ai/', deny: SANCTIONED, probe: trace('https://character.ai/cdn-cgi/trace') },
  { id: 'metaai', cat: 'ai', name: 'Meta AI', site: 'https://www.meta.ai/', probe: reach('https://www.meta.ai/robots.txt') },

  // 国际流媒体
  { id: 'netflix', cat: 'video', name: 'Netflix', site: 'https://www.netflix.com/', deny: NETFLIX_NO, probe: reach('https://www.netflix.com/') },
  { id: 'disney', cat: 'video', name: 'Disney+', site: 'https://www.disneyplus.com/', probe: reach('https://www.disneyplus.com/robots.txt') },
  { id: 'dazn', cat: 'video', name: 'DAZN', site: 'https://www.dazn.com/', probe: { kind: 'api', url: 'https://startup.core.indazn.com/misl/v5/Startup', read: 'dazn', init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ Version: '2', LandingPageKey: 'generic', Languages: 'zh', Platform: 'web', Manufacturer: '', PromoCode: '', PlatformAttributes: {} }) } } },
  { id: 'crunchyroll', cat: 'video', name: 'Crunchyroll', site: 'https://www.crunchyroll.com/', deny: `CN ${SANCTIONED}`, probe: trace('https://www.crunchyroll.com/cdn-cgi/trace') },
  { id: 'peacock', cat: 'video', name: 'Peacock', site: 'https://www.peacocktv.com/', only: 'US', probe: reach('https://www.peacocktv.com/robots.txt') },
  { id: 'philo', cat: 'video', name: 'Philo', site: 'https://www.philo.com/', only: 'US', probe: { kind: 'api', url: 'https://content-us-east-2-fastly-b.www.philo.com/geo', read: 'philo' } },
  { id: 'nbc', cat: 'video', name: 'NBC', site: 'https://www.nbc.com/', only: 'US', probe: { kind: 'api', url: 'https://geolocation.digitalsvc.apps.nbcuni.com/geolocation/live/usa', read: 'nbc', init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ adobeMvpdId: null, serviceZip: null, device: 'web' }) } } },
  { id: 'shudder', cat: 'video', name: 'Shudder', site: 'https://www.shudder.com/', probe: { kind: 'api', url: 'https://www.shudder.com/', read: 'shudder' } },
  { id: 'bein', cat: 'video', name: 'beIN CONNECT', site: 'https://connect.beinsports.com/', probe: { kind: 'api', url: 'https://proxies.bein-mena-production.eu-west-2.tuc.red/proxy/availableOffers', read: 'bein' } },
  { id: 'twitch', cat: 'video', name: 'Twitch', site: 'https://www.twitch.tv/', deny: 'CN', probe: reach('https://www.twitch.tv/robots.txt') },
  { id: 'primevideo', cat: 'video', name: 'Prime Video', site: 'https://www.primevideo.com/', deny: STREAM_GONE_RU, probe: reach('https://www.primevideo.com/robots.txt') },
  { id: 'appletv', cat: 'video', name: 'Apple TV+', site: 'https://tv.apple.com/', deny: STREAM_GONE_RU, probe: reach('https://tv.apple.com/robots.txt') },
  { id: 'max', cat: 'video', name: 'HBO Max', site: 'https://www.hbomax.com/', probe: reach('https://www.hbomax.com/robots.txt') },
  { id: 'hulu', cat: 'video', name: 'Hulu', site: 'https://www.hulu.com/', only: 'US', probe: reach('https://www.hulu.com/robots.txt') },
  { id: 'paramount', cat: 'video', name: 'Paramount+', site: 'https://www.paramountplus.com/', probe: reach('https://www.paramountplus.com/robots.txt') },
  { id: 'tubi', cat: 'video', name: 'Tubi', site: 'https://tubitv.com/', probe: reach('https://tubitv.com/robots.txt') },
  { id: 'pluto', cat: 'video', name: 'Pluto TV', site: 'https://pluto.tv/', probe: reach('https://pluto.tv/robots.txt') },
  { id: 'espn', cat: 'video', name: 'ESPN+', site: 'https://plus.espn.com/', only: 'US', probe: reach('https://plus.espn.com/robots.txt') },
  { id: 'fubo', cat: 'video', name: 'Fubo', site: 'https://www.fubo.tv/', allow: 'US CA', probe: reach('https://www.fubo.tv/robots.txt') },
  { id: 'viu', cat: 'video', name: 'Viu', site: 'https://www.viu.com/', probe: reach('https://www.viu.com/robots.txt') },
  { id: 'viki', cat: 'video', name: 'Viki', site: 'https://www.viki.com/', deny: 'CN', probe: reach('https://www.viki.com/robots.txt') },
  { id: 'viaplay', cat: 'video', name: 'Viaplay', site: 'https://viaplay.com/', allow: 'DK FI IS NO SE', probe: reach('https://viaplay.com/robots.txt') },
  { id: 'skyshowtime', cat: 'video', name: 'SkyShowtime', site: 'https://www.skyshowtime.com/', allow: 'AL AD BA BG HR CZ DK FI HU XK ME MK NO NL PL PT RO RS SK SI ES SE', probe: reach('https://www.skyshowtime.com/robots.txt') },
  { id: 'acorn', cat: 'video', name: 'Acorn TV', site: 'https://acorn.tv/', allow: 'US PR CA AU NZ ES', probe: reach('https://acorn.tv/robots.txt') },
  { id: 'catchplay', cat: 'video', name: 'CATCHPLAY+', site: 'https://www.catchplay.com/', allow: 'TW ID SG', probe: { kind: 'api', url: 'https://sunapi.catchplay.com/geo', read: 'catchplay' } },
  { id: 'nowtv', cat: 'video', name: 'NOW', site: 'https://www.nowtv.com/', allow: 'GB IE', probe: reach('https://www.nowtv.com/robots.txt') },
  { id: 'spotify', cat: 'video', name: 'Spotify', site: 'https://open.spotify.com/', deny: STREAM_GONE_RU, probe: reach('https://open.spotify.com/robots.txt') },
  { id: 'pandora', cat: 'video', name: 'Pandora', site: 'https://www.pandora.com/', only: 'US', probe: reach('https://www.pandora.com/robots.txt') },
  { id: 'deezer', cat: 'video', name: 'Deezer', site: 'https://www.deezer.com/', probe: reach('https://www.deezer.com/robots.txt') },
  { id: 'soundcloud', cat: 'video', name: 'SoundCloud', site: 'https://soundcloud.com/', deny: BLOCK.soundcloud, probe: reach('https://soundcloud.com/robots.txt') },

  // 社交
  { id: 'tiktok', cat: 'social', name: 'TikTok', site: 'https://www.tiktok.com/', deny: 'IN AF CN KP IR', probe: reach('https://www.tiktok.com/robots.txt') },
  { id: 'youtube', cat: 'social', name: 'YouTube', site: 'https://www.youtube.com/', deny: BLOCK.youtube, probe: reach('https://www.youtube.com/generate_204') },
  { id: 'x', cat: 'social', name: 'X', site: 'https://x.com/', deny: BLOCK.x, probe: trace('https://x.com/cdn-cgi/trace') },
  { id: 'instagram', cat: 'social', name: 'Instagram', site: 'https://www.instagram.com/', deny: BLOCK.instagram, probe: reach('https://www.instagram.com/robots.txt') },
  { id: 'telegram', cat: 'social', name: 'Telegram', site: 'https://telegram.org/', deny: BLOCK.telegram, probe: reach('https://telegram.org/robots.txt') },
  { id: 'whatsapp', cat: 'social', name: 'WhatsApp', site: 'https://web.whatsapp.com/', deny: BLOCK.whatsapp, probe: reach('https://web.whatsapp.com/robots.txt') },
  { id: 'discord', cat: 'social', name: 'Discord', site: 'https://discord.com/', deny: BLOCK.discord, probe: reach('https://discord.com/robots.txt') },
  { id: 'reddit', cat: 'social', name: 'Reddit', site: 'https://www.reddit.com/', deny: BLOCK.reddit, probe: reach('https://www.reddit.com/robots.txt') },
  { id: 'facebook', cat: 'social', name: 'Facebook', site: 'https://www.facebook.com/', deny: BLOCK.facebook, probe: reach('https://www.facebook.com/') },
  { id: 'messenger', cat: 'social', name: 'Messenger', site: 'https://www.messenger.com/', deny: BLOCK.facebook, probe: reach('https://www.messenger.com/robots.txt') },
  { id: 'threads', cat: 'social', name: 'Threads', site: 'https://www.threads.com/', deny: BLOCK.threads, probe: reach('https://www.threads.com/robots.txt') },
  { id: 'signal', cat: 'social', name: 'Signal', site: 'https://signal.org/', deny: BLOCK.signal, probe: reach('https://signal.org/robots.txt') },
  { id: 'line', cat: 'social', name: 'LINE', site: 'https://line.me/', deny: BLOCK.line, probe: reach('https://line.me/robots.txt') },
  { id: 'snapchat', cat: 'social', name: 'Snapchat', site: 'https://www.snapchat.com/', deny: BLOCK.snapchat, probe: reach('https://www.snapchat.com/robots.txt') },
  { id: 'pinterest', cat: 'social', name: 'Pinterest', site: 'https://www.pinterest.com/', deny: BLOCK.pinterest, probe: reach('https://www.pinterest.com/robots.txt') },
  { id: 'google', cat: 'social', name: 'Google', site: 'https://www.google.com/', deny: BLOCK.google, probe: reach('https://www.google.com/generate_204') },
  { id: 'wikipedia', cat: 'social', name: 'Wikipedia', site: 'https://www.wikipedia.org/', deny: BLOCK.wikipedia, probe: reach('https://www.wikipedia.org/robots.txt') },
  { id: 'roblox', cat: 'social', name: 'Roblox', site: 'https://www.roblox.com/', deny: BLOCK.roblox, probe: reach('https://www.roblox.com/robots.txt') },

  // 地区服务
  { id: 'kktv', cat: 'local', name: 'KKTV', site: 'https://www.kktv.me/', only: 'TW', probe: { kind: 'api', url: 'https://api.kktv.me/v3/ipcheck', read: 'kktv' } },
  { id: 'tvb', cat: 'local', name: 'TVB Anywhere+', site: 'https://www.tvbanywhere.com/', probe: { kind: 'api', url: 'https://uapisfm.tvbanywhere.com.sg/geoip/check/platform/android', read: 'tvb' } },
  { id: 'sbs', cat: 'local', name: 'SBS On Demand', site: 'https://www.sbs.com.au/ondemand/', only: 'AU', probe: { kind: 'api', url: 'https://www.sbs.com.au/api/v3/network?context=odwebsite', read: 'sbs' } },
  { id: 'fod', cat: 'local', name: 'FOD', site: 'https://fod.fujitv.co.jp/', only: 'JP', probe: { kind: 'api', url: 'https://geocontrol1.stream.ne.jp/fod-geo/check.xml', read: 'fod' } },
  { id: 'dmm', cat: 'local', name: 'DMM TV', site: 'https://tv.dmm.com/', only: 'JP', probe: { kind: 'api', url: 'https://api.beacon.dmm.com/v1/streaming/start', read: 'dmm', init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ player_name: 'dmmtv_browser', player_version: '0.0.0', content_type_detail: 'VOD_SVOD', content_id: '11uvjcm4fw2wdu7drtd1epnvz', purchase_product_id: null }) } } },
  { id: 'zdf', cat: 'local', name: 'ZDF', site: 'https://www.zdf.de/', only: 'DE', probe: { kind: 'api', url: 'https://ssl.zdf.de/geo/de/geo.txt/', read: 'zdf' } },
  { id: 'nhk', cat: 'local', name: 'NHK ONE', site: 'https://www.nhk.or.jp/', only: 'JP', probe: { kind: 'api', url: 'https://location-plus.nhk.jp/geoip/area.json', read: 'nhk' } },
  { id: 'telasa', cat: 'local', name: 'TELASA', site: 'https://www.telasa.jp/', only: 'JP', probe: { kind: 'api', url: 'https://api-videopass-anon.kddi-video.com/v1/playback/system_status', read: 'telasa' } },
  { id: 'jcom', cat: 'local', name: 'J:COM STREAM', site: 'https://linkvod.myjcom.jp/', only: 'JP', probe: trace('https://id.zaq.ne.jp/cdn-cgi/trace') },
  { id: 'abema', cat: 'local', name: 'ABEMA', site: 'https://abema.tv/', only: 'JP', probe: reach('https://abema.tv/robots.txt') },
  { id: 'unext', cat: 'local', name: 'U-NEXT', site: 'https://video.unext.jp/', only: 'JP', probe: reach('https://video.unext.jp/robots.txt') },
  { id: 'tver', cat: 'local', name: 'TVer', site: 'https://tver.jp/', only: 'JP', probe: reach('https://tver.jp/robots.txt') },
  { id: 'hulujp', cat: 'local', name: 'Hulu 日本', site: 'https://www.hulu.jp/', only: 'JP', probe: reach('https://www.hulu.jp/robots.txt') },
  { id: 'lemino', cat: 'local', name: 'Lemino', site: 'https://lemino.docomo.ne.jp/', only: 'JP', probe: reach('https://lemino.docomo.ne.jp/robots.txt') },
  { id: 'danime', cat: 'local', name: 'd动画商店', site: 'https://animestore.docomo.ne.jp/', only: 'JP', probe: reach('https://animestore.docomo.ne.jp/robots.txt') },
  { id: 'wowow', cat: 'local', name: 'WOWOW', site: 'https://www.wowow.co.jp/', only: 'JP', probe: reach('https://www.wowow.co.jp/robots.txt') },
  { id: 'radiko', cat: 'local', name: 'radiko', site: 'https://radiko.jp/', only: 'JP', probe: reach('https://radiko.jp/robots.txt') },
  { id: 'videomarket', cat: 'local', name: 'VideoMarket', site: 'https://www.videomarket.jp/', only: 'JP', probe: reach('https://www.videomarket.jp/robots.txt') },
  { id: 'rakutenjp', cat: 'local', name: '乐天 TV 日本', site: 'https://tv.rakuten.co.jp/', only: 'JP', probe: reach('https://tv.rakuten.co.jp/robots.txt') },
  { id: 'mora', cat: 'local', name: 'mora', site: 'https://mora.jp/', only: 'JP', probe: reach('https://mora.jp/robots.txt') },
  { id: 'wavve', cat: 'local', name: 'Wavve', site: 'https://www.wavve.com/', only: 'KR', probe: reach('https://www.wavve.com/robots.txt') },
  { id: 'tving', cat: 'local', name: 'TVING', site: 'https://www.tving.com/', only: 'KR', probe: reach('https://www.tving.com/robots.txt') },
  { id: 'coupang', cat: 'local', name: 'Coupang Play', site: 'https://www.coupangplay.com/', only: 'KR', probe: reach('https://www.coupangplay.com/robots.txt') },
  { id: 'watcha', cat: 'local', name: 'Watcha', site: 'https://watcha.com/', only: 'KR', probe: reach('https://watcha.com/robots.txt') },
  { id: 'spotv', cat: 'local', name: 'SPOTV NOW', site: 'https://www.spotvnow.co.kr/', only: 'KR', probe: reach('https://www.spotvnow.co.kr/robots.txt') },
  { id: '4gtv', cat: 'local', name: '四季线上', site: 'https://www.4gtv.tv/', only: 'TW', probe: trace('https://www.4gtv.tv/cdn-cgi/trace') },
  { id: 'litv', cat: 'local', name: 'LiTV 立视', site: 'https://www.litv.tv/', only: 'TW', probe: trace('https://proxy.svc.litv.tv/cdn-cgi/trace') },
  { id: 'bahamut', cat: 'local', name: '巴哈姆特动画疯', site: 'https://ani.gamer.com.tw/', allow: 'TW HK MO', probe: trace('https://ani.gamer.com.tw/cdn-cgi/trace') },
  { id: 'hami', cat: 'local', name: 'Hami Video', site: 'https://hamivideo.hinet.net/', only: 'TW', probe: reach('https://hamivideo.hinet.net/robots.txt') },
  { id: 'myvideo', cat: 'local', name: 'myVideo', site: 'https://www.myvideo.net.tw/', only: 'TW', probe: reach('https://www.myvideo.net.tw/robots.txt') },
  { id: 'friday', cat: 'local', name: 'friDay影音', site: 'https://video.friday.tw/', only: 'TW', probe: reach('https://video.friday.tw/robots.txt') },
  { id: 'ofiii', cat: 'local', name: '欧飞', site: 'https://www.ofiii.com/', only: 'TW', probe: reach('https://www.ofiii.com/robots.txt') },
  { id: 'linetv', cat: 'local', name: 'LINE TV', site: 'https://www.linetv.tw/', only: 'TW', probe: reach('https://www.linetv.tw/robots.txt') },
  { id: 'mytvsuper', cat: 'local', name: 'myTV SUPER', site: 'https://www.mytvsuper.com/', only: 'HK', probe: reach('https://www.mytvsuper.com/robots.txt') },
  { id: 'nowe', cat: 'local', name: 'Now E', site: 'https://www.nowe.com/', only: 'HK', probe: reach('https://www.nowe.com/robots.txt') },
  { id: 'viutv', cat: 'local', name: 'ViuTV', site: 'https://viu.tv/', only: 'HK', probe: reach('https://viu.tv/robots.txt') },
  { id: 'hoytv', cat: 'local', name: 'HOY TV', site: 'https://hoy.tv/', only: 'HK', probe: reach('https://hoy.tv/robots.txt') },
  { id: 'hotstar', cat: 'local', name: 'JioHotstar', site: 'https://www.hotstar.com/', only: 'IN', probe: reach('https://www.hotstar.com/robots.txt') },
  { id: 'sonyliv', cat: 'local', name: 'Sony LIV', site: 'https://www.sonyliv.com/', only: 'IN', probe: reach('https://www.sonyliv.com/robots.txt') },
  { id: 'tataplay', cat: 'local', name: 'Tata Play Binge', site: 'https://www.tataplaybinge.com/', only: 'IN', probe: reach('https://www.tataplaybinge.com/robots.txt') },
  { id: 'mxplayer', cat: 'local', name: 'MX Player', site: 'https://www.mxplayer.in/', only: 'IN', probe: reach('https://www.mxplayer.in/robots.txt') },
  { id: 'mewatch', cat: 'local', name: 'meWATCH', site: 'https://www.mewatch.sg/', only: 'SG', probe: reach('https://www.mewatch.sg/robots.txt') },
  { id: 'starhub', cat: 'local', name: 'StarHub TV+', site: 'https://www.starhubtvplus.com/', only: 'SG', probe: reach('https://www.starhubtvplus.com/robots.txt') },
  { id: 'vidio', cat: 'local', name: 'Vidio', site: 'https://www.vidio.com/', only: 'ID', probe: reach('https://www.vidio.com/robots.txt') },
  { id: 'trueid', cat: 'local', name: 'TrueID', site: 'https://tv.trueid.net/', only: 'TH', probe: reach('https://tv.trueid.net/robots.txt') },
  { id: 'aisplay', cat: 'local', name: 'AIS PLAY', site: 'https://aisplay.ais.co.th/', only: 'TH', probe: reach('https://aisplay.ais.co.th/robots.txt') },
  { id: 'sooka', cat: 'local', name: 'sooka', site: 'https://sooka.my/', only: 'MY', probe: reach('https://sooka.my/robots.txt') },
  { id: 'galaxyplay', cat: 'local', name: 'Galaxy Play', site: 'https://galaxyplay.vn/', only: 'VN', probe: reach('https://galaxyplay.vn/robots.txt') },
  { id: 'tv360', cat: 'local', name: 'TV360', site: 'https://tv360.vn/', only: 'VN', probe: reach('https://tv360.vn/robots.txt') },
  { id: 'kplus', cat: 'local', name: 'K+', site: 'https://www.kplus.vn/', only: 'VN', probe: reach('https://www.kplus.vn/robots.txt') },
  { id: 'tenplay', cat: 'local', name: '10 Play', site: 'https://10play.com.au/', only: 'AU', probe: { kind: 'api', url: 'https://e410fasadvz.global.ssl.fastly.net/geo', read: 'ten' } },
  { id: 'stan', cat: 'local', name: 'Stan', site: 'https://www.stan.com.au/', only: 'AU', probe: reach('https://www.stan.com.au/robots.txt') },
  { id: 'binge', cat: 'local', name: 'Binge', site: 'https://binge.com.au/', only: 'AU', probe: reach('https://binge.com.au/robots.txt') },
  { id: 'kayo', cat: 'local', name: 'Kayo Sports', site: 'https://kayosports.com.au/', only: 'AU', probe: reach('https://kayosports.com.au/robots.txt') },
  { id: '7plus', cat: 'local', name: '7plus', site: 'https://7plus.com.au/', only: 'AU', probe: reach('https://7plus.com.au/robots.txt') },
  { id: 'iview', cat: 'local', name: 'ABC iview', site: 'https://iview.abc.net.au/', only: 'AU', probe: reach('https://iview.abc.net.au/robots.txt') },
  { id: '9now', cat: 'local', name: '9Now', site: 'https://www.9now.com.au/', only: 'AU', probe: reach('https://www.9now.com.au/robots.txt') },
  { id: 'threenow', cat: 'local', name: 'ThreeNow', site: 'https://www.threenow.co.nz/', only: 'NZ', probe: reach('https://www.threenow.co.nz/robots.txt') },
  { id: 'neon', cat: 'local', name: 'Neon', site: 'https://www.neontv.co.nz/', only: 'NZ', probe: reach('https://www.neontv.co.nz/robots.txt') },
  { id: 'skygonz', cat: 'local', name: 'Sky Go NZ', site: 'https://www.skygo.co.nz/', only: 'NZ', probe: reach('https://www.skygo.co.nz/robots.txt') },
  { id: 'itvx', cat: 'local', name: 'ITVX', site: 'https://www.itv.com/', only: 'GB', probe: { kind: 'api', url: 'https://simulcast.itv.com/playlist/itvonline/ITV', read: 'itv' } },
  { id: 'channel4', cat: 'local', name: 'Channel 4', site: 'https://www.channel4.com/', only: 'GB', probe: reach('https://www.channel4.com/robots.txt') },
  { id: 'my5', cat: 'local', name: 'My5', site: 'https://www.channel5.com/', only: 'GB', probe: reach('https://www.channel5.com/robots.txt') },
  { id: 'skygo', cat: 'local', name: 'Sky Go', site: 'https://www.sky.com/watch/sky-go', allow: 'GB IE', probe: reach('https://www.sky.com/robots.txt') },
  { id: 'molotov', cat: 'local', name: 'Molotov', site: 'https://www.molotov.tv/', only: 'FR', probe: { kind: 'api', url: 'https://fapi.molotov.tv/v1/open-europe/is-france', read: 'molotov' } },
  { id: 'francetv', cat: 'local', name: 'france.tv', site: 'https://www.france.tv/', only: 'FR', probe: reach('https://www.france.tv/robots.txt') },
  { id: 'joyn', cat: 'local', name: 'Joyn', site: 'https://www.joyn.de/', allow: 'DE AT CH', probe: reach('https://www.joyn.de/robots.txt') },
  { id: 'rtlplus', cat: 'local', name: 'RTL+', site: 'https://plus.rtl.de/', only: 'DE', probe: reach('https://plus.rtl.de/robots.txt') },
  { id: 'skyde', cat: 'local', name: 'Sky Go Germany', site: 'https://www.sky.de/', allow: 'DE AT', probe: reach('https://www.sky.de/robots.txt') },
  { id: 'skych', cat: 'local', name: 'Sky Switzerland', site: 'https://www.sky.ch/', only: 'CH', probe: reach('https://www.sky.ch/robots.txt') },
  { id: 'raiplay', cat: 'local', name: 'RaiPlay', site: 'https://www.raiplay.it/', only: 'IT', probe: reach('https://www.raiplay.it/robots.txt') },
  { id: 'movistar', cat: 'local', name: 'Movistar Plus+', site: 'https://www.movistarplus.es/', only: 'ES', probe: reach('https://www.movistarplus.es/robots.txt') },
  { id: 'npo', cat: 'local', name: 'NPO Start', site: 'https://npo.nl/', only: 'NL', probe: reach('https://npo.nl/robots.txt') },
  { id: 'videoland', cat: 'local', name: 'Videoland', site: 'https://www.videoland.com/', only: 'NL', probe: reach('https://www.videoland.com/robots.txt') },
  { id: 'nlziet', cat: 'local', name: 'NLZIET', site: 'https://www.nlziet.nl/', only: 'NL', probe: trace('https://nlziet.nl/cdn-cgi/trace') },
  { id: 'amediateka', cat: 'local', name: 'Amediateka', site: 'https://www.amediateka.ru/', only: 'RU', probe: reach('https://www.amediateka.ru/robots.txt') },
  { id: 'sling', cat: 'local', name: 'Sling TV', site: 'https://www.sling.com/', only: 'US', probe: { kind: 'api', url: 'https://p-geo.movetv.com/geo', read: 'sling' } },
  { id: 'starz', cat: 'local', name: 'STARZ', site: 'https://www.starz.com/', only: 'US', probe: reach('https://www.starz.com/robots.txt') },
  { id: 'aetv', cat: 'local', name: 'A&E', site: 'https://play.aetv.com/', only: 'US', probe: { kind: 'api', url: 'https://link.theplatform.com/s/xc6n8B/UR27JDU0bu2s/', read: 'aetv' } },
  { id: 'cw', cat: 'local', name: 'The CW', site: 'https://www.cwtv.com/', only: 'US', probe: trace('https://www.cwtv.com/cdn-cgi/trace') },
  { id: 'directv', cat: 'local', name: 'DIRECTV Stream', site: 'https://stream.directv.com/', only: 'US', probe: trace('https://www.atttvnow.com/cdn-cgi/trace') },
  { id: 'mgmplus', cat: 'local', name: 'MGM+', site: 'https://www.mgmplus.com/', only: 'US', probe: reach('https://www.mgmplus.com/robots.txt') },
  { id: 'nflplus', cat: 'local', name: 'NFL+', site: 'https://www.nfl.com/plus/', only: 'US', probe: reach('https://www.nfl.com/robots.txt') },
  { id: 'cbcgem', cat: 'local', name: 'CBC Gem', site: 'https://gem.cbc.ca/', only: 'CA', probe: reach('https://gem.cbc.ca/robots.txt') },
  { id: 'crave', cat: 'local', name: 'Crave', site: 'https://www.crave.ca/', only: 'CA', probe: reach('https://www.crave.ca/robots.txt') },
  { id: 'mgtv', cat: 'local', name: '芒果TV', site: 'https://www.mgtv.com/', only: 'CN', probe: { kind: 'api', url: 'https://pcweb.api.mgtv.com/player/video?video_id=22028443&type=pch5', read: 'mgtv' } },
  { id: 'bilibili', cat: 'local', name: '哔哩哔哩', site: 'https://www.bilibili.com/', only: 'CN', probe: reach('https://www.bilibili.com/robots.txt') },
  { id: 'iqiyi', cat: 'local', name: '爱奇艺', site: 'https://www.iqiyi.com/', only: 'CN', probe: reach('https://www.iqiyi.com/robots.txt') },
  { id: 'youku', cat: 'local', name: '优酷', site: 'https://www.youku.com/', only: 'CN', probe: reach('https://www.youku.com/robots.txt') },
  { id: 'netease', cat: 'local', name: '网易云音乐', site: 'https://music.163.com/', only: 'CN', probe: reach('https://music.163.com/robots.txt') },
]

export const SERVICE_IDS = SERVICES.map(service => service.id)

export const CAT_LABEL = Object.fromEntries(CATS.map(cat => [cat.id, cat.label])) as Record<UnlockCat, string>
