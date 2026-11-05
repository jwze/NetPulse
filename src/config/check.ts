/**
 * 检测中心的目录：一级是分类，二级是具体检测项。
 * 导航、路由与页面标题都从这张表推导，新增检测项只需要在这里登记 + 写一个 pane。
 */

export interface CheckTab {
  id: string
  label: string
  /** 一句话说明，显示在分页标题旁 */
  desc: string
  /** 是否进入即自动检测；占用带宽的项目保持手动 */
  auto: boolean
}

export interface CheckCategory {
  id: string
  label: string
  desc: string
  tabs: CheckTab[]
}

export const CHECK_CATEGORIES: CheckCategory[] = [
  {
    id: 'overview',
    label: '概览',
    desc: '出口与本机环境',
    tabs: [
      { id: 'overview', label: '总览', desc: '出口地址、双栈与运行环境，进入即检测', auto: true },
    ],
  },
  {
    id: 'network',
    label: '网络',
    desc: '出口、延迟与双栈',
    tabs: [
      { id: 'egress', label: '出口对照', desc: '访问不同目的地时用的是哪条出口', auto: true },
      { id: 'latency', label: '全球延迟', desc: '常用服务与海外节点的往返延迟', auto: true },
      { id: 'ipv6', label: 'IPv6 双栈', desc: 'IPv6 能力评分与同目标 IPv4/IPv6 对比', auto: true },
      { id: 'multinode', label: '多节点测速', desc: '并发拉流比较线路差距，占用带宽', auto: false },
    ],
  },
  {
    id: 'quality',
    label: '质量',
    desc: '链路、带宽与地址信誉',
    tabs: [
      { id: 'quality', label: '链路质量', desc: '平均延迟、抖动与丢包', auto: true },
      { id: 'upload', label: '上传带宽', desc: '上行吞吐实测，占用带宽', auto: false },
      { id: 'ip-quality', label: 'IP 质量', desc: '多来源核对地址用途与风险', auto: true },
      { id: 'dns', label: 'DNS 解析', desc: '同一域名在多家解析器上的结果', auto: true },
    ],
  },
  {
    id: 'privacy',
    label: '隐私',
    desc: '内容可达性与暴露面',
    tabs: [
      { id: 'unlock', label: '解锁检测', desc: '流媒体与 AI 服务在当前线路是否可用', auto: true },
      { id: 'portrait', label: '隐私画像', desc: '指纹、时区、DNS 与地址暴露面', auto: true },
      { id: 'webrtc', label: '网络拓扑', desc: 'NAT 类型与内网地址泄露', auto: true },
    ],
  },
]

export const DEFAULT_CAT = CHECK_CATEGORIES[0].id
export const DEFAULT_TAB = CHECK_CATEGORIES[0].tabs[0].id

export function findCategory(id: string) {
  return CHECK_CATEGORIES.find(item => item.id === id) || null
}

export function findTab(catId: string, tabId: string) {
  return findCategory(catId)?.tabs.find(item => item.id === tabId) || null
}

/** 概览只有一页，URL 收敛为 /check，其余分类带完整路径 */
export function checkPath(catId: string, tabId: string) {
  if (catId === DEFAULT_CAT) return '/check'
  return `/check/${catId}/${tabId}`
}
