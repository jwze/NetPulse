<script setup lang="ts">
import { computed } from 'vue'
import { fmtMs, type Segment, type Verdict, USE_TEXT, type UseStatus } from '@/utils/latency'

interface UseRow {
  id: string
  label: string
  seg: Segment
  status: UseStatus
}

const props = defineProps<{
  verdict: Verdict | null
  uses: UseRow[]
  answered: { ok: number; n: number }
  running: boolean
}>()

const headline = computed(() => props.verdict?.title || (props.running ? '正在探测…' : '等待探测'))
const tone = computed(() => props.verdict?.tone || 'muted')
const detail = computed(() => {
  if (props.verdict) return props.verdict.detail
  return props.running ? '正在确认出口并逐个测量服务往返。' : '开始后会先确认出口线路，再逐个测量服务的真实往返。'
})

/** 三格始终存在，探测前后高度不变 */
const stats = computed(() => {
  const { local, global, med } = props.verdict || { local: null, global: null, med: null }
  return [
    { key: 'local', label: '本地常用', med: local?.med ?? null, ok: local?.ok ?? 0, n: local?.n ?? 0 },
    { key: 'global', label: '海外服务', med: global?.med ?? null, ok: global?.ok ?? 0, n: global?.n ?? 0 },
    { key: 'all', label: '整体', med: med ?? null, ok: 0, n: 0 },
  ]
})
</script>

<template>
  <section class="np-card np-panel verdict-card" :class="`tone-${tone}`">
    <header class="np-panel-head">
      <h2>延迟结论</h2>
      <span v-if="answered.n" class="np-panel-meta font-mono">{{ answered.ok }}/{{ answered.n }}</span>
    </header>

    <div class="verdict-main">
      <span class="verdict-dot" />
      <h3>{{ headline }}</h3>
    </div>
    <p class="verdict-text">{{ detail }}</p>

    <div class="verdict-stats">
      <div v-for="item in stats" :key="item.key" class="verdict-stat">
        <span class="verdict-label">{{ item.label }}</span>
        <span class="verdict-value font-mono">
          {{ item.med != null ? fmtMs(item.med) : '—' }}<small v-if="item.med != null">ms</small>
        </span>
        <span v-if="item.n" class="verdict-sub font-mono">{{ item.ok }}/{{ item.n }}</span>
      </div>
    </div>

    <div class="verdict-uses">
      <span
        v-for="use in uses"
        :key="use.id"
        class="use-chip"
        :class="`use-${use.status}`"
        :title="`${use.label}：${fmtMs(use.seg.med)}ms，${use.seg.ok}/${use.seg.n} 有响应`"
      >
        {{ use.label }}
        <b>{{ USE_TEXT[use.status] }}</b>
      </span>
      <span v-if="!uses.length" class="verdict-uses-empty">开始后按用途给出可用性</span>
    </div>
  </section>
</template>

<style scoped>
.verdict-card {
  gap: 10px;
  min-height: 352px;
  --tone: var(--text-muted);
}

.tone-great { --tone: #16a34a; }
.tone-ok { --tone: #2563eb; }
.tone-warn { --tone: #d97706; }
.tone-bad { --tone: #dc2626; }
.tone-muted { --tone: var(--text-muted); }

.dark .tone-great { --tone: #4ade80; }
.dark .tone-ok { --tone: #60a5fa; }
.dark .tone-warn { --tone: #fbbf24; }
.dark .tone-bad { --tone: #f87171; }

.verdict-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.verdict-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--tone);
}

.verdict-main h3 {
  flex: 1;
  min-width: 0;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.01em;
}

.verdict-text {
  min-height: 40px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.65;
}

.verdict-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
}

.verdict-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.verdict-label {
  color: var(--text-muted);
  font-size: 11px;
}

.verdict-value {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.verdict-value small {
  margin-left: 1px;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
}

.verdict-sub {
  color: var(--text-muted);
  font-size: 10px;
}

.verdict-uses {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 58px;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
}

.verdict-uses-empty {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
}

.use-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 11px;
}

.use-chip b {
  font-weight: 600;
}

.use-great b { color: #16a34a; }
.use-ok b { color: #2563eb; }
.use-slow b { color: #d97706; }
.use-blocked b { color: #dc2626; }

.dark .use-great b { color: #4ade80; }
.dark .use-ok b { color: #60a5fa; }
.dark .use-slow b { color: #fbbf24; }
.dark .use-blocked b { color: #f87171; }
</style>
