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

    <div v-else class="hist-empty">
      <div class="hist-cols">
        <span>类型</span>
        <span>结果</span>
        <span>明细</span>
        <span>时间</span>
      </div>
      <p class="hist-empty-text">还没有记录，跑一次测速或检测就会写在这里。最多 50 条，只存在本机。</p>
    </div>
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

/* 空记录：先给列名，让这块地方看起来是日志本而不是空白 */
.hist-cols {
  display: flex;
  gap: 12px;
  padding: 6px 0 8px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 10px;
}

.hist-cols span:nth-child(1) { flex: 0 0 auto; width: 24px; }
.hist-cols span:nth-child(2) { flex: 0 0 auto; }
.hist-cols span:nth-child(3) { flex: 1 1 auto; }
.hist-cols span:nth-child(4) { flex: 0 0 auto; }

.hist-empty-text {
  margin-top: 12px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.65;
}
</style>
