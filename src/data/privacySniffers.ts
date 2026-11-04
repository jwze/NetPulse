/**
 * 隐私画像里「网站能读到什么」的清单。每一行是一种长期存在的读取方式：
 * 请求本身（服务器看到的），或者一个不用询问就能调用的浏览器接口。
 *   id  行标识
 *   name 名称
 *   m   怎么读到的，原样展示
 *   s  敏感：隐藏地址时打码
 */
export type GroupId = 'net' | 'exit' | 'hdr' | 'loc' | 'dev' | 'brw' | 'fp'

export interface Sniffer {
  id: string
  name: string
  m: string
  s?: 1
}

export const GROUPS: { id: GroupId; label: string; rows: Sniffer[] }[] = [
  {
    id: 'net',
    label: '网络',
    rows: [
      { id: 'ip', name: '出口地址', m: 'CF-Connecting-IP', s: 1 },
      { id: 'geo', name: '所在城市', m: 'request.cf.city', s: 1 },
      { id: 'coords', name: '经纬度', m: 'request.cf.latitude', s: 1 },
      { id: 'isp', name: '运营商', m: 'request.cf.asOrganization' },
      { id: 'dns', name: 'DNS 解析器', m: 'edns.ip-api.com', s: 1 },
      { id: 'tzip', name: '出口时区', m: 'request.cf.timezone' },
      { id: 'ptr', name: '反向解析', m: 'DNS PTR', s: 1 },
      { id: 'edge', name: '边缘节点', m: 'request.cf.colo' },
      { id: 'proto', name: '连接协议', m: 'request.cf.tlsVersion' },
      { id: 'kex', name: '密钥交换', m: '/cdn-cgi/trace · kex, sni' },
      { id: 'warp', name: 'WARP', m: '/cdn-cgi/trace · warp' },
      { id: 'clock', name: '本机时间', m: 'Date.now()' },
      { id: 'webrtc', name: 'STUN 看到的地址', m: 'RTCPeerConnection · STUN', s: 1 },
      { id: 'lan', name: '内网地址', m: 'WebRTC host candidate' },
      { id: 'v6mac', name: 'IPv6 里的网卡号', m: 'EUI-64 (ff:fe)', s: 1 },
    ],
  },
  {
    id: 'exit',
    label: '各站点看到的出口',
    rows: [
      { id: 'ex_cn', name: '国内站点', m: 'myip.ipip.net', s: 1 },
      { id: 'ex_intl', name: '国际站点', m: 'api.ip.sb', s: 1 },
      { id: 'ex_claude', name: 'Claude', m: 'claude.ai/cdn-cgi/trace', s: 1 },
      { id: 'ex_cf', name: 'Cloudflare', m: 'www.cloudflare.com/cdn-cgi/trace', s: 1 },
    ],
  },
  {
    id: 'hdr',
    label: '请求头',
    rows: [
      { id: 'h_ua', name: 'User-Agent', m: 'navigator.userAgent' },
      { id: 'h_lang', name: 'Accept-Language', m: 'navigator.languages' },
      { id: 'h_chua', name: 'Sec-CH-UA', m: 'userAgentData.brands' },
      { id: 'h_plat', name: 'Sec-CH-UA-Platform', m: 'userAgentData.platform' },
      { id: 'h_enc', name: 'Accept-Encoding', m: '浏览器自己决定' },
      { id: 'h_dnt', name: 'DNT · Sec-GPC', m: 'navigator.doNotTrack' },
      { id: 'h_ref', name: 'Referer', m: 'document.referrer' },
    ],
  },
  {
    id: 'loc',
    label: '语言与时区',
    rows: [
      { id: 'langs', name: '语言偏好', m: 'navigator.languages' },
      { id: 'locale', name: '区域设置', m: 'Intl.DateTimeFormat' },
      { id: 'tz', name: '时区', m: 'Intl …timeZone' },
      { id: 'hour', name: '时钟格式', m: 'Intl …hourCycle' },
      { id: 'week', name: '一周从哪天开始', m: 'Intl.Locale weekInfo' },
      { id: 'fmt', name: '数字与日期格式', m: 'Intl.NumberFormat' },
      { id: 'icu', name: 'ICU 数据量', m: 'Intl.supportedValuesOf' },
      { id: 'kbd', name: '键盘布局', m: 'navigator.keyboard' },
      { id: 'voices', name: '语音包', m: 'speechSynthesis' },
    ],
  },
  {
    id: 'dev',
    label: '设备',
    rows: [
      { id: 'os', name: '系统', m: 'userAgentData' },
      { id: 'browser', name: '浏览器', m: 'userAgentData.brands' },
      { id: 'arch', name: '架构与位数', m: '…architecture · bitness' },
      { id: 'screen', name: '屏幕', m: 'screen · devicePixelRatio' },
      { id: 'hz', name: '刷新率', m: 'requestAnimationFrame' },
      { id: 'screens', name: '多屏', m: 'screen.isExtended' },
      { id: 'win', name: '窗口', m: 'innerWidth · availHeight' },
      { id: 'scrollbar', name: '滚动条宽度', m: 'offsetWidth − clientWidth' },
      { id: 'gpu', name: '显卡', m: 'WebGL RENDERER' },
      { id: 'glx', name: 'WebGL 能力', m: 'MAX_TEXTURE_SIZE' },
      { id: 'cpu', name: 'CPU 核心数', m: 'hardwareConcurrency' },
      { id: 'mem', name: '内存', m: 'navigator.deviceMemory' },
      { id: 'heap', name: 'JS 内存上限', m: 'performance.memory' },
      { id: 'touch', name: '触屏', m: 'maxTouchPoints' },
      { id: 'battery', name: '电池', m: 'navigator.getBattery' },
      { id: 'conn', name: '网络类型', m: 'navigator.connection' },
      { id: 'audiohw', name: '音频硬件', m: 'AudioContext.sampleRate' },
      { id: 'codecs', name: '视频格式', m: 'MediaSource.isTypeSupported' },
      { id: 'storage', name: '存储配额', m: 'storage.estimate' },
    ],
  },
  {
    id: 'brw',
    label: '浏览器环境',
    rows: [
      { id: 'scheme', name: '深浅色', m: 'prefers-color-scheme' },
      { id: 'motion', name: '动态效果', m: 'prefers-reduced-motion' },
      { id: 'gamut', name: '色域与亮度', m: 'color-gamut · dynamic-range' },
      { id: 'a11y', name: '辅助功能', m: 'prefers-contrast · forced-colors' },
      { id: 'sysui', name: '默认字号', m: 'font-size: medium' },
      { id: 'display', name: '打开方式', m: 'display-mode' },
      { id: 'dnt', name: '跟踪声明', m: 'doNotTrack · GPC' },
      { id: 'cookies', name: 'Cookie', m: 'navigator.cookieEnabled' },
      { id: 'perms', name: '权限状态', m: 'permissions.query' },
      { id: 'apis', name: '敏感接口', m: 'usb · serial · hid' },
      { id: 'pdf', name: '内置 PDF', m: 'pdfViewerEnabled' },
      { id: 'webdriver', name: '自动化标记', m: 'navigator.webdriver' },
      { id: 'adblock', name: '广告拦截', m: 'bait element' },
      { id: 'history', name: '访问深度', m: 'history.length' },
      { id: 'fonts', name: '本机字体', m: 'canvas measureText' },
    ],
  },
  {
    id: 'fp',
    label: '指纹',
    rows: [
      { id: 'engine', name: 'JS 引擎', m: 'Error.stack' },
      { id: 'engver', name: '引擎真实版本', m: 'JS feature probes' },
      { id: 'lies', name: '谎言检测', m: 'Function.prototype.toString' },
      { id: 'cssv', name: 'CSS 特性', m: 'CSS.supports' },
      { id: 'canvas', name: 'Canvas 指纹', m: 'canvas.toDataURL' },
      { id: 'webgl', name: 'WebGL 指纹', m: 'WebGL getParameter' },
      { id: 'audio', name: '音频指纹', m: 'OfflineAudioContext' },
      { id: 'mathfp', name: '数学函数指纹', m: 'Math.* → SHA-256' },
      { id: 'emoji', name: 'Emoji 版本', m: 'emoji measureText' },
      { id: 'fontfp', name: '字体指纹', m: 'fonts → SHA-256' },
      { id: 'domrect', name: '元素尺寸', m: 'getClientRects · Range' },
      { id: 'textm', name: '文字度量', m: 'measureText actualBoundingBox' },
      { id: 'keys', name: '引擎接口数', m: 'window · HTMLElement · CSS keys' },
      { id: 'timer', name: '计时精度', m: 'performance.now()' },
      { id: 'fpid', name: '整体指纹', m: 'SHA-256' },
      { id: 'hwid', name: '硬件编号', m: 'screen · cores · GPU · fonts' },
      { id: 'rand', name: '每次是否一样', m: 'canvas × 2' },
      { id: 'shield', name: '防护是谁', m: 'navigator.brave · noise · lies' },
    ],
  },
]

export const SNIFFERS: Sniffer[] = GROUPS.flatMap(group => group.rows)
export const SNIFFER_IDS = SNIFFERS.map(row => row.id)

/** 隐藏地址时打码的行 */
export const SENSITIVE = new Set(SNIFFERS.filter(row => row.s).map(row => row.id))

/** 伪装检测：每项的等级与建议 */
export const CHECKS = ['tz', 'lang', 'syslang', 'dns', 'split', 'webrtc', 'dc', 'ua', 'tamper', 'fp', 'bot'] as const
export type CheckId = (typeof CHECKS)[number]
/** 不说明「你在哪」，只在隐私场景计分 */
export const NOT_COUNTED: CheckId[] = ['fp']
