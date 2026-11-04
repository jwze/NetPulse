<script setup lang="ts">
import { computed, ref } from 'vue'
import DiagCard from '@/components/diagnostics/DiagCard.vue'
import { useHistoryStore, type HistoryEntry } from '@/stores/history'

const history = useHistoryStore()
const confirming = ref(false)
let confirmTimer = 0

const KIND_LABEL: Record<HistoryEntry['kind'], string> = {
  download: '下载',
  upload: '上传',
  quality: '质量',
}

const visible = computed(() => history.entries.slice(0, 12))

function primary(item: HistoryEntry) {
  if (item.kind === 'download' && item.speed) return `${item.speed.toFixed(2)} MB/s`
  if (item.kind === 'upload' && item.mbps) return `${item.mbps.toFixed(1)} Mbps`
  if (item.kind === 'quality' && item.latency) return `${item.latency.toFixed(1)} ms`
  return '—'
}

function secondary(item: HistoryEntry) {
  if (item.kind === 'quality') return `抖动 ${item.jitter ?? 0}ms · 丢包 ${item.loss ?? 0}%`
  if (item.kind === 'upload') return `${item.bytes ? `${(item.bytes / 1024 / 1024).toFixed(0)} MB` : '—'} · ${item.seconds?.toFixed(1) ?? '—'}s`
  return `${item.bytes ? `${(item.bytes / 1024 / 1024).toFixed(0)} MB` : '—'} · ${item.seconds?.toFixed(0) ?? '—'}s`
}

function timeText(ts: number) {
  const date = new Date(ts)
  const now = Date.now()
  const diff = now - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function handleClear() {
  if (!confirming.value) {
    confirming.value = true
    window.clearTimeout(confirmTimer)
    confirmTimer = window.setTimeout(() => { confirming.value = false }, 3000)
    return
  }
  window.clearTimeout(confirmTimer)
  confirming.value = false
  history.clear()
}
</script>

<template>
  <DiagCard title="历史记录" :hint="`本地保存 · ${history.entries.length}/50`" icon="M12 8v5l3 2 M3 12a9 9 0 1 0 3-6.7 M3 4v4h4">
    <template #action>
      <button class="np-btn-ghost hist-btn" :disabled="!history.entries.length" @click="history.exportCsv()">CSV</button>
      <button class="np-btn-ghost hist-btn" :disabled="!history.entries.length" @click="history.exportJson()">JSON</button>
      <button
        v-if="history.entries.length"
        class="np-btn-ghost hist-btn"
        :class="{ 'is-danger': confirming }"
        @click="handleClear"
      >{{ confirming ? '确认清空' : '清空' }}</button>
    </template>

    <ul v-if="visible.length" class="hist-list">
      <li v-for="item in visible" :key="item.id" class="hist-item">
        <span class="hist-kind" :class="`kind-${item.kind}`">{{ KIND_LABEL[item.kind] }}</span>
        <div class="hist-main">
          <span class="hist-value">{{ primary(item) }}</span>
          <span class="hist-sub">{{ secondary(item) }}</span>
        </div>
        <time class="hist-time">{{ timeText(item.ts) }}</time>
      </li>
    </ul>

    <p v-else class="hist-empty">
      还没有记录。跑一次测速、上传测试或链路质量测试后，结果会自动记在这里，最多保留 50 条，只存在本机浏览器。
    </p>
  </DiagCard>
</template>

<style scoped>
.hist-btn {
  width: auto;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--border);
  font-size: 11px;
  font-weight: 600;
}

.hist-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.hist-btn.is-danger {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.hist-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hist-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.hist-item:last-child {
  border-bottom: none;
}

.hist-kind {
  flex: 0 0 auto;
  width: 36px;
  padding: 2px 0;
  border-radius: 4px;
  background: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 700;
  text-align: center;
}

.kind-download {
  color: #1B9C67;
  background: rgba(80, 227, 164, 0.12);
}

.kind-upload {
  color: #0070F3;
  background: rgba(0, 112, 243, 0.1);
}

.kind-quality {
  color: #d97706;
  background: rgba(245, 166, 35, 0.12);
}

.dark .kind-download { color: #50E3A4; }
.dark .kind-upload { color: #6BA8FF; }
.dark .kind-quality { color: #F5A623; }

.hist-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
}

.hist-value {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.hist-sub {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hist-time {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 11px;
}

.hist-empty {
  color: var(--text-muted);
  font-size: 11.5px;
  line-height: 1.6;
}
</style>
