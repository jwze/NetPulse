/**
 * 检测中心的目录：一级是分类，二级是具体检测项。
 * 导航、路由与页面标题都从这张表推导，新增检测项只需要在这里登记 + 写一个 pane。
 */

export interface CheckTab {
  id: string
  label: string
  /** 是否进入即自动检测；占用带宽的项目保持手动 */
  auto: boolean
}

export interface CheckCategory {
  id: string
  label: string
  tabs: CheckTab[]
}

export const CHECK_CATEGORIES: CheckCategory[] = [
  {
    id: 'overview',
    label: '概览',
    tabs: [
      { id: 'overview', label: '总览', auto: true },
    ],
  },
  {
    id: 'network',
    label: '网络',
    tabs: [
      { id: 'egress', label: '出口对照', auto: true },
      { id: 'latency', label: '全球延迟', auto: true },
      { id: 'ipv6', label: 'IPv6 双栈', auto: true },
      { id: 'multinode', label: '多节点测速', auto: false },
    ],
  },
  {
    id: 'quality',
    label: '质量',
    tabs: [
      { id: 'quality', label: '链路质量', auto: true },
      { id: 'upload', label: '上传带宽', auto: false },
      { id: 'ip-quality', label: 'IP 质量', auto: true },
      { id: 'dns', label: 'DNS 解析', auto: true },
    ],
  },
  {
    id: 'privacy',
    label: '隐私',
    tabs: [
      { id: 'unlock', label: '解锁检测', auto: true },
      { id: 'portrait', label: '隐私画像', auto: true },
      { id: 'webrtc', label: '网络拓扑', auto: true },
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
