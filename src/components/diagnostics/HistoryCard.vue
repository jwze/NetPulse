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
  <DiagCard title="历史记录" :hint="`${history.entries.length} / 50`">
    <template #action>
      <button class="np-btn-ghost text-btn" :disabled="!history.entries.length" @click="history.exportCsv()">CSV</button>
      <button class="np-btn-ghost text-btn" :disabled="!history.entries.length" @click="history.exportJson()">JSON</button>
      <button
        v-if="history.entries.length"
        class="np-btn-ghost text-btn"
        :class="{ 'is-danger': confirming }"
        @click="handleClear"
      >{{ confirming ? '确认清空' : '清空' }}</button>
    </template>

    <ul v-if="visible.length" class="hist-list">
      <li v-for="item in visible" :key="item.id" class="hist-item">
        <span class="hist-kind">{{ KIND_LABEL[item.kind] }}</span>
        <span class="hist-value">{{ primary(item) }}</span>
        <span class="hist-sub">{{ secondary(item) }}</span>
        <time class="hist-time">{{ timeText(item.ts) }}</time>
      </li>
    </ul>

    <p v-else class="hist-empty">
      还没有记录。跑一次测速、上传测试或链路质量测试后，结果会自动记在这里，最多保留 50 条，只存在本机浏览器。
    </p>
  </DiagCard>
</template>

<style scoped>
.text-btn {
  width: auto;
  height: 24px;
  padding: 0 6px;
  border-color: transparent;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0;
}

.text-btn:hover:not(:disabled) {
  border-color: var(--border);
  color: var(--text-primary);
  background: var(--bg-subtle);
}

.text-btn.is-danger {
  color: var(--tone-bad);
}

.hist-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hist-item {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.hist-item:last-child {
  border-bottom: none;
}

.hist-kind {
  flex: 0 0 auto;
  width: 24px;
  color: var(--text-muted);
  font-size: 11px;
}

.hist-value {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.hist-sub {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hist-time {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.hist-empty {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.65;
}
</style>
