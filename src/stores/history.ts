import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { downloadText } from '@/utils/download'
import { brand } from '@/config/brand'

export type HistoryKind = 'download' | 'upload' | 'quality'

export interface HistoryEntry {
  id: string
  ts: number
  kind: HistoryKind
  /** 下载速度 MB/s */
  speed?: number
  /** 上传速度 Mbps */
  mbps?: number
  /** 平均延迟 ms */
  latency?: number
  /** 抖动 ms */
  jitter?: number
  /** 丢包 % */
  loss?: number
  seconds?: number
  bytes?: number
  node?: string
  /** Bufferbloat 评级 A+ / A / B / C / D / F */
  bloat?: string
}

const STORAGE_KEY = 'np:history'
const LIMIT = 50

function load(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is HistoryEntry => (
      item && typeof item.ts === 'number' && typeof item.kind === 'string'
    )).slice(0, LIMIT)
  } catch {
    return []
  }
}

let seq = 0

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>(load())

  watch(entries, (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value.slice(0, LIMIT)))
    } catch {
      // 隐私模式下可能无法写入，忽略即可
    }
  }, { deep: true })

  function add(entry: Omit<HistoryEntry, 'id' | 'ts'>) {
    seq += 1
    const item: HistoryEntry = {
      ...entry,
      id: `${Date.now().toString(36)}-${seq}`,
      ts: Date.now(),
    }
    entries.value = [item, ...entries.value].slice(0, LIMIT)
    return item
  }

  function clear() {
    entries.value = []
  }

  function exportJson() {
    const payload = {
      product: brand.name,
      version: brand.version,
      exportedAt: new Date().toISOString(),
      entries: entries.value,
    }
    downloadText(`net-pulse-history-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8')
  }

  function exportCsv() {
    const header = ['时间', '类型', '下载(MB/s)', '上传(Mbps)', '延迟(ms)', '抖动(ms)', '丢包(%)', '流量(字节)', '时长(s)', '节点', '满载延迟评级']
    const kindLabel: Record<HistoryKind, string> = { download: '下载测速', upload: '上传测速', quality: '链路质量' }
    const rows = entries.value.map(item => [
      new Date(item.ts).toLocaleString('zh-CN'),
      kindLabel[item.kind],
      item.speed?.toFixed(2) ?? '',
      item.mbps?.toFixed(1) ?? '',
      item.latency?.toFixed(1) ?? '',
      item.jitter?.toFixed(1) ?? '',
      item.loss?.toFixed(1) ?? '',
      item.bytes ?? '',
      item.seconds?.toFixed(1) ?? '',
      item.node ?? '',
      item.bloat ?? '',
    ])
    const csv = [header, ...rows]
      .map(cols => cols.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    downloadText(`net-pulse-history-${stamp()}.csv`, `\ufeff${csv}`, 'text/csv;charset=utf-8')
  }

  return { entries, add, clear, exportJson, exportCsv }
})

function stamp() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}
