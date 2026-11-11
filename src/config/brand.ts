/**
 * 品牌配置：改名 / 换文案只需要改这里。
 */
export const brand = {
  /** 英文名，用于 Logo 文字与标题 */
  name: 'net-pulse',
  /** 中文名 */
  nameZh: '网脉',
  /** 一句话定位 */
  tagline: '实时感知网络脉搏',
  /** SEO 描述 */
  description: 'net-pulse 网脉是一款纯前端的网络测速与质量监测面板，支持多线程并发压测、实时速率曲线、多出口对照、IP 质量评分、解锁检测、隐私画像与自定义测速节点。',
  /** 页脚版本号 */
  version: '1.5.0',
  /** 起始年份，用于版权行 */
  year: 2026,
} as const

export type Brand = typeof brand
