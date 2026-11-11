import type { CustomNode } from '@/stores/nodes'
import { findCustomNodeDuplicate, normalizeNodeLabel, normalizeNodeUrl } from '@/utils/customNodes'

export interface NodeProfileFile {
  type: 'net-pulse_node_profile'
  version: 1
  exportedAt: string
  nodes: CustomNode[]
}

export interface ParsedNodeProfile {
  nodes: CustomNode[]
  skippedCount: number
}

const PROFILE_TYPE = 'net-pulse_node_profile'
/** 改名前的导出文件 type，仍可导入 */
const LEGACY_PROFILE_TYPES = new Set(['netpulse_node_profile'])

function nowText() {
  const now = new Date()
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`
}

function sanitizeNode(node: Partial<CustomNode>): CustomNode | null {
  const label = normalizeNodeLabel(String(node.label || ''))
  const value = normalizeNodeUrl(String(node.value || ''))
  const group = String(node.group || '').trim().replace(/\s+/g, ' ') || '默认'
  const method = node.method === 'POST' || node.method === 'HEAD' ? node.method : 'GET'
  const httpProtocol = node.httpProtocol === 'HTTP_1_1' || node.httpProtocol === 'HTTP_2' ? node.httpProtocol : 'AUTO'
  if (!label || !/^https?:\/\/([\w-]+\.)+[\w-]+(:[0-9]+)?(\/\S*)?/.test(value)) return null
  return {
    label,
    value,
    time: String(node.time || nowText()),
    group,
    method,
    postData: method === 'POST' ? String(node.postData || '') : '',
    headers: method === 'POST' || method === 'GET' ? String(node.headers || '') : '',
    httpProtocol,
    enhanced: Boolean(node.enhanced),
  }
}

export function createNodeProfile(nodes: CustomNode[]): NodeProfileFile {
  return {
    type: PROFILE_TYPE,
    version: 1,
    exportedAt: new Date().toISOString(),
    nodes: nodes.map(node => sanitizeNode(node)).filter((node): node is CustomNode => node !== null),
  }
}

export function getNodeProfileFilename() {
  return `net-pulse_nodes_${Date.now()}.json`
}

export function isNodeProfileFilename(fileName: string) {
  return /\.json$/i.test(fileName.trim())
}

export function downloadNodeProfile(profile: NodeProfileFile) {
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = getNodeProfileFilename()
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function parseNodeProfileFile(raw: string, existingNodes: CustomNode[]): ParsedNodeProfile {
  const parsed = JSON.parse(raw) as Partial<NodeProfileFile>
  const type = String(parsed.type ?? '')
  if ((type !== PROFILE_TYPE && !LEGACY_PROFILE_TYPES.has(type)) || parsed.version !== 1 || !Array.isArray(parsed.nodes)) {
    throw new Error('配置文件格式不正确')
  }

  const seen: CustomNode[] = [...existingNodes]
  const nodes: CustomNode[] = []
  let skippedCount = 0

  for (const node of parsed.nodes) {
    const sanitized = sanitizeNode(node)
    if (!sanitized || findCustomNodeDuplicate(seen, sanitized.label, sanitized.value)) {
      skippedCount += 1
      continue
    }
    nodes.push(sanitized)
    seen.push(sanitized)
  }

  return { nodes, skippedCount }
}
