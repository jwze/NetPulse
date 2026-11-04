<script setup lang="ts">
import { computed } from 'vue'
import { usePanelStore } from '@/stores/panel'
import { BLOAT_THRESHOLDS } from '@/utils/bufferbloat'

const panel = usePanelStore()
const bloat = computed(() => panel.bloat)

const hasResult = computed(() => Boolean(bloat.value.grade))
const currentIndex = computed(() => BLOAT_THRESHOLDS.findIndex(item => item.key === bloat.value.grade))
const gradeLabel = computed(() => {
  if (!hasResult.value) return bloat.value.active ? '采样中' : '未测'
  return BLOAT_THRESHOLDS[currentIndex.value]?.label || ''
})
const toneClass = computed(() => (bloat.value.tone ? `tone-${bloat.value.tone}` : 'tone-none'))

const footText = computed(() => {
  if (bloat.value.active) return '正在压满带宽，同时持续探测往返延迟…'
  if (!hasResult.value) return '开始测速时会同步探测：先测空闲延迟，再测满载时的排队延迟。'
  return `增量越小越好。视频会议与在线游戏最在意这一项，${bloat.value.target ? `探测目标 ${bloat.value.target}` : '结果仅供参考'}。`
})

function msText(value: number | null) {
  return value === null ? '—' : `${Math.round(value)} ms`
}

function deltaText(value: number | null) {
  if (value === null) return '—'
  return `${value > 0 ? '+' : ''}${Math.round(value)} ms`
}
</script>

<template>
  <section class="np-card bloat-card">
    <header class="bloat-head">
      <div class="bloat-title">
        <span class="bloat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12h4l2.5-7 4 14 2.5-7h5" />
          </svg>
        </span>
        <h3>满载延迟</h3>
        <span class="bloat-sub">Bufferbloat</span>
      </div>
      <span class="np-chip" :class="{ 'np-chip-success': bloat.active }">
        <span v-if="bloat.active" class="np-pulse-dot chip-dot" />
        {{ bloat.active ? '采样中' : hasResult ? '已完成' : '待测' }}
      </span>
    </header>

    <div class="bloat-body">
      <div class="grade-box" :class="toneClass">
        <span class="grade-key">{{ hasResult ? bloat.grade : '—' }}</span>
        <span class="grade-label">{{ gradeLabel }}</span>
      </div>

      <dl class="bloat-metrics">
        <div>
          <dt>空闲延迟</dt>
          <dd>{{ msText(bloat.idleMs) }}</dd>
        </div>
        <div>
          <dt>满载延迟</dt>
          <dd>{{ msText(bloat.loadedMs) }}</dd>
        </div>
        <div>
          <dt>增量</dt>
          <dd :class="toneClass">{{ deltaText(bloat.increaseMs) }}</dd>
        </div>
      </dl>
    </div>

    <div class="bloat-scale" role="img" aria-label="Bufferbloat 评级刻度">
      <span
        v-for="(item, index) in BLOAT_THRESHOLDS"
        :key="item.key"
        class="scale-seg"
        :class="[`seg-${item.tone}`, { active: index === currentIndex }]"
      >
        <b>{{ item.key }}</b>
        <em>{{ item.hint }}</em>
      </span>
    </div>

    <p class="bloat-foot">{{ footText }}</p>
  </section>
</template>

<style scoped>
.bloat-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px;
}

.bloat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.bloat-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.bloat-icon {
  display: inline-flex;
  width: 20px;
  height: 20px;
  color: var(--text-secondary);
  flex: 0 0 auto;
}

.bloat-icon svg {
  width: 100%;
  height: 100%;
}

.bloat-title h3 {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.bloat-sub {
  color: var(--text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.chip-dot {
  width: 6px;
  height: 6px;
}

.bloat-body {
  display: flex;
  align-items: stretch;
  gap: 18px;
}

.grade-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 84px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-left-width: 3px;
  border-radius: 6px;
  background: var(--bg-subtle);
}

.grade-box.tone-good {
  border-left-color: #16a34a;
}

.grade-box.tone-ok {
  border-left-color: #d97706;
}

.grade-box.tone-bad {
  border-left-color: #dc2626;
}

.grade-box.tone-none {
  border-left-color: var(--border);
}

.grade-key {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 26px;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.04em;
}

.grade-box.tone-good .grade-key {
  color: #16a34a;
}

.grade-box.tone-ok .grade-key {
  color: #d97706;
}

.grade-box.tone-bad .grade-key {
  color: #dc2626;
}

.grade-box.tone-none .grade-key {
  color: var(--text-muted);
}

.grade-label {
  color: var(--text-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.bloat-metrics {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  align-content: center;
}

.bloat-metrics > div {
  min-width: 0;
}

.bloat-metrics dt {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.bloat-metrics dd {
  margin: 2px 0 0;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.bloat-metrics dd.tone-good {
  color: #16a34a;
}

.bloat-metrics dd.tone-ok {
  color: #d97706;
}

.bloat-metrics dd.tone-bad {
  color: #dc2626;
}

.dark .bloat-metrics dd.tone-good {
  color: #50E3A4;
}

.dark .bloat-metrics dd.tone-ok {
  color: #F5A623;
}

.dark .bloat-metrics dd.tone-bad {
  color: #FF5C4E;
}

.bloat-scale {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 3px;
}

.scale-seg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 2px 5px;
  border-radius: 4px;
  background: var(--bg-subtle);
  color: var(--text-muted);
  transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.scale-seg b {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.1;
}

.scale-seg em {
  font-style: normal;
  font-size: 9px;
  line-height: 1.1;
  opacity: 0.75;
  white-space: nowrap;
}

.scale-seg.active.seg-good {
  background: rgba(22, 163, 74, 0.12);
  color: #16a34a;
  transform: translateY(-1px);
}

.scale-seg.active.seg-ok {
  background: rgba(217, 119, 6, 0.12);
  color: #b45309;
  transform: translateY(-1px);
}

.scale-seg.active.seg-bad {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
  transform: translateY(-1px);
}

.bloat-foot {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.55;
}

.dark .grade-box.tone-good .grade-key,
.dark .scale-seg.active.seg-good {
  color: #50E3A4;
}

.dark .grade-box.tone-ok .grade-key,
.dark .scale-seg.active.seg-ok {
  color: #F5A623;
}

.dark .grade-box.tone-bad .grade-key,
.dark .scale-seg.active.seg-bad {
  color: #FF5C4E;
}

.dark .scale-seg.active.seg-good {
  background: rgba(80, 227, 164, 0.12);
}

.dark .scale-seg.active.seg-ok {
  background: rgba(245, 166, 35, 0.12);
}

.dark .scale-seg.active.seg-bad {
  background: rgba(255, 92, 78, 0.12);
}

@media (max-width: 520px) {
  .bloat-body {
    gap: 12px;
  }

  .grade-box {
    min-width: 72px;
    padding: 8px 10px;
  }

  .grade-key {
    font-size: 22px;
  }

  .bloat-metrics dd {
    font-size: 13px;
  }

  .scale-seg em {
    display: none;
  }
}
</style>
