<script setup lang="ts">
import { computed } from 'vue'
import { PART_TEXT, TYPE_TEXT, noteText, type Assessment } from '@/utils/ipQuality'
import { countryName } from '@/utils/ipInfo'

const props = defineProps<{
  assessment: Assessment | null
  ip: string
  isOwn: boolean
  running: boolean
}>()

const tone = computed(() => {
  const grade = props.assessment?.grade
  if (!grade) return 'none'
  return grade === 'A' ? 'great' : grade === 'B' ? 'good' : grade === 'C' ? 'ok' : grade === 'D' ? 'warn' : 'bad'
})

const place = computed(() => {
  const s = props.assessment?.summary
  if (!s) return ''
  return [countryName(s.cc || '', s.cc || ''), s.city].filter(Boolean).join(' · ')
})

const parts = computed(() =>
  (props.assessment?.parts || [])
    .map(part => ({ ...part, label: PART_TEXT[part.k] || part.k, width: Math.min(100, (part.pts / 40) * 100) }))
    .sort((a, b) => b.pts - a.pts),
)
</script>

<template>
  <section class="np-card np-panel score">
    <header class="np-panel-head">
      <h2 class="np-panel-title">评分</h2>
      <span v-if="assessment" class="np-panel-meta score-ip">{{ ip }}</span>
      <span v-else class="np-panel-meta">{{ running ? '查询中' : '等待查询' }}</span>
    </header>

    <div v-if="assessment" class="main">
      <p class="num-line" :class="`tone-${tone}`">
        <span class="num">{{ assessment.score }}</span>
        <span class="max">/100</span>
        <span class="grade">{{ assessment.grade }}</span>
      </p>
      <p class="place">{{ place || '位置未知' }}<template v-if="isOwn"> · 本机出口</template></p>
      <p class="org">{{ assessment.summary.org || '未知网络' }}<template v-if="assessment.summary.asn"> · AS{{ assessment.summary.asn }}</template></p>
      <p v-if="assessment.summary.type" class="type">{{ TYPE_TEXT[assessment.summary.type] }}</p>
    </div>

    <div v-else class="main is-idle">
      <p class="num-line">
        <span class="num">—</span>
        <span class="max">/100</span>
      </p>
      <p class="place">{{ running ? '正在查询' : '还没有查询结果' }}</p>
    </div>

    <div v-if="parts.length" class="parts">
      <div v-for="part in parts" :key="part.k" class="part">
        <span class="part-label">{{ part.label }}</span>
        <span class="part-bar"><i :style="{ width: `${part.width}%` }" /></span>
        <span class="part-pts">−{{ part.pts }}</span>
      </div>
    </div>

    <ul v-if="assessment?.notes.length" class="notes">
      <li v-for="(note, index) in assessment.notes" :key="index" class="note">
        <span class="note-dot" :class="`is-${note.lv}`" />
        <span>{{ noteText(note) }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.score {
  min-height: 240px;
}

.score-ip {
  max-width: 58%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 10px;
}

.main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.main.is-idle {
  opacity: 0.8;
}

.num-line {
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.num {
  font-size: 40px;
  font-weight: 500;
  letter-spacing: -0.04em;
}

.max {
  color: var(--text-muted);
  font-size: 12px;
}

.grade {
  margin-left: auto;
  font-size: 15px;
  font-weight: 500;
}

.num-line.tone-great { color: var(--tone-good); }
.num-line.tone-good { color: var(--tone-good); }
.num-line.tone-ok { color: var(--tone-warn); }
.num-line.tone-warn { color: var(--tone-warn); }
.num-line.tone-bad { color: var(--tone-bad); }

.num-line.tone-none {
  color: var(--text-muted);
}

.num-line .max {
  color: var(--text-muted);
}

.place {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 12px;
}

.org {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.type {
  color: var(--text-muted);
  font-size: 11px;
}

.parts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}

.part {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr) 32px;
  align-items: center;
  gap: 8px;
}

.part-label {
  color: var(--text-secondary);
  font-size: 11px;
}

.part-bar {
  display: block;
  height: 3px;
  border-radius: 1px;
  background: var(--bg-subtle);
  overflow: hidden;
}

.part-bar i {
  display: block;
  height: 100%;
  background: var(--text-secondary);
  opacity: 0.45;
}

.part-pts {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.notes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  list-style: none;
}

.note {
  display: flex;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.55;
}

.note-dot {
  width: 5px;
  height: 5px;
  margin-top: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--text-muted);
}

.note-dot.is-good { background: var(--tone-good); }
.note-dot.is-warn { background: var(--tone-warn); }
.note-dot.is-bad { background: var(--tone-bad); }
.note-dot.is-info { background: var(--border-strong); }
</style>
