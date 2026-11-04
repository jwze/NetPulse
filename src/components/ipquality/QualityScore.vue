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
  <section class="np-card np-panel iq-score">
    <header class="np-panel-head">
      <h2>评分</h2>
      <span v-if="assessment" class="np-panel-meta font-mono iq-ip">{{ ip }}</span>
      <span v-else class="np-panel-meta">{{ running ? '查询中…' : '等待查询' }}</span>
    </header>

    <div v-if="assessment" class="iq-main">
      <div class="iq-grade" :class="`tone-${tone}`">{{ assessment.grade }}</div>
      <div class="iq-main-text">
        <p class="iq-number"><b>{{ assessment.score }}</b><span>/100</span></p>
        <p class="iq-place">{{ place || '位置未知' }}<template v-if="isOwn"> · 本机出口</template></p>
        <p class="iq-org">{{ assessment.summary.org || '未知网络' }}<template v-if="assessment.summary.asn"> · AS{{ assessment.summary.asn }}</template></p>
        <p v-if="assessment.summary.type" class="iq-type">{{ TYPE_TEXT[assessment.summary.type] }}</p>
      </div>
    </div>

    <div v-else class="iq-main is-idle">
      <div class="iq-grade tone-none">—</div>
      <div class="iq-main-text">
        <p class="iq-number"><b>—</b><span>/100</span></p>
        <p class="iq-place">{{ running ? '正在询问 IP 情报来源…' : '还没有查询结果' }}</p>
        <p class="iq-org">{{ running ? '12 个来源会同时回答' : '查本机，或在上面填一个公网地址' }}</p>
      </div>
    </div>

    <div v-if="parts.length" class="iq-parts">
      <div v-for="part in parts" :key="part.k" class="iq-part">
        <span class="iq-part-label">{{ part.label }}</span>
        <span class="iq-part-bar"><i :style="{ width: `${part.width}%` }" /></span>
        <span class="iq-part-pts font-mono">−{{ part.pts }}</span>
      </div>
    </div>

    <ul v-if="assessment?.notes.length" class="iq-notes">
      <li v-for="(note, index) in assessment.notes" :key="index" class="iq-note">
        <span class="iq-note-dot" :class="`is-${note.lv}`" />
        <span>{{ noteText(note) }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.iq-score {
  min-height: 268px;
}

.iq-ip {
  color: var(--text-muted);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.iq-main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 68px;
}

.iq-main.is-idle {
  opacity: 0.75;
}

.iq-grade {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 68px;
  height: 68px;
  flex: 0 0 auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-family: var(--font-mono);
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -0.04em;
}

.iq-grade.tone-great { color: #16a34a; border-color: rgba(22, 163, 74, 0.35); background: rgba(22, 163, 74, 0.06); }
.iq-grade.tone-good { color: #0d9488; border-color: rgba(13, 148, 136, 0.35); background: rgba(13, 148, 136, 0.06); }
.iq-grade.tone-ok { color: #ca8a04; border-color: rgba(202, 138, 4, 0.35); background: rgba(202, 138, 4, 0.06); }
.iq-grade.tone-warn { color: #d97706; border-color: rgba(217, 119, 6, 0.35); background: rgba(217, 119, 6, 0.06); }
.iq-grade.tone-bad { color: #dc2626; border-color: rgba(220, 38, 38, 0.35); background: rgba(220, 38, 38, 0.06); }

.dark .iq-grade.tone-great { color: #50E3A4; }
.dark .iq-grade.tone-good { color: #4FD1C5; }
.dark .iq-grade.tone-ok { color: #F5A623; }
.dark .iq-grade.tone-warn { color: #F5A623; }
.dark .iq-grade.tone-bad { color: #FF5C4E; }

.iq-main-text {
  min-width: 0;
}

.iq-number {
  color: var(--text-primary);
  font-family: var(--font-mono);
  line-height: 1;
}

.iq-number b {
  font-size: 26px;
  font-weight: 700;
}

.iq-number span {
  color: var(--text-muted);
  font-size: 12px;
}

.iq-place {
  margin-top: 3px;
  color: var(--text-secondary);
  font-size: 12px;
}

.iq-org {
  margin-top: 1px;
  color: var(--text-muted);
  font-size: 11px;
  overflow-wrap: anywhere;
}

.iq-type {
  margin-top: 1px;
  color: var(--text-muted);
  font-size: 11px;
}

.iq-parts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
}

.iq-part {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) 34px;
  align-items: center;
  gap: 8px;
}

.iq-part-label {
  color: var(--text-secondary);
  font-size: 11px;
}

.iq-part-bar {
  display: block;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-subtle);
  overflow: hidden;
}

.iq-part-bar i {
  display: block;
  height: 100%;
  background: #dc2626;
  opacity: 0.65;
}

.dark .iq-part-bar i {
  background: #FF5C4E;
}

.iq-part-pts {
  color: var(--text-muted);
  font-size: 11px;
  text-align: right;
}

.iq-notes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  list-style: none;
}

.iq-note {
  display: flex;
  gap: 7px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.55;
}

.iq-note-dot {
  width: 5px;
  height: 5px;
  margin-top: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--text-muted);
}

.iq-note-dot.is-good { background: #16a34a; }
.iq-note-dot.is-warn { background: #d97706; }
.iq-note-dot.is-bad { background: #dc2626; }
.iq-note-dot.is-info { background: var(--text-muted); }

.dark .iq-note-dot.is-good { background: #50E3A4; }
.dark .iq-note-dot.is-warn { background: #F5A623; }
.dark .iq-note-dot.is-bad { background: #FF5C4E; }
</style>
