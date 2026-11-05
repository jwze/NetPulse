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

const statusText = computed(() => {
  if (bloat.value.active) return '采样中'
  return hasResult.value ? '已完成' : '待测'
})

const footText = computed(() => {
  if (bloat.value.active) return '正在压满带宽，同时每 500ms 探测一次往返延迟'
  if (!hasResult.value) return '开始测速时会同步探测：先取空闲延迟基线，再测满载时的排队延迟'
  return `增量越小越好，视频会议与在线游戏最在意这一项${bloat.value.target ? ` · 探测目标 ${bloat.value.target}` : ''}`
})

function msText(value: number | null) {
  return value === null ? '—' : `${Math.round(value)}`
}

function deltaText(value: number | null) {
  if (value === null) return '—'
  return `${value > 0 ? '+' : ''}${Math.round(value)}`
}
</script>

<template>
  <section class="np-card bloat-card">
    <header class="np-panel-head">
      <h2 class="np-panel-title">
        满载延迟
        <span class="sub">Bufferbloat</span>
      </h2>
      <span class="status" :class="{ live: bloat.active }">
        <span v-if="bloat.active" class="np-live-dot" />
        {{ statusText }}
      </span>
    </header>

    <div class="bloat-body">
      <div class="grade" :class="toneClass">
        <span class="grade-key">{{ hasResult ? bloat.grade : '—' }}</span>
        <span class="grade-label">{{ gradeLabel }}</span>
      </div>

      <dl class="metrics">
        <div>
          <dt>空闲延迟</dt>
          <dd>{{ msText(bloat.idleMs) }}<em>ms</em></dd>
        </div>
        <div>
          <dt>满载延迟</dt>
          <dd>{{ msText(bloat.loadedMs) }}<em>ms</em></dd>
        </div>
        <div>
          <dt>增量</dt>
          <dd :class="toneClass">{{ deltaText(bloat.increaseMs) }}<em>ms</em></dd>
        </div>
      </dl>
    </div>

    <div class="ruler" role="img" aria-label="Bufferbloat 评级刻度，A+ 到 F">
      <div class="ruler-track">
        <span
          v-for="(item, index) in BLOAT_THRESHOLDS"
          :key="item.key"
          class="seg"
          :class="[`seg-${item.tone}`, { active: index === currentIndex }]"
        />
        <span
          v-if="currentIndex >= 0"
          class="cursor"
          :class="`seg-${BLOAT_THRESHOLDS[currentIndex].tone}`"
          :style="{ left: `calc(${(currentIndex + 0.5) / BLOAT_THRESHOLDS.length * 100}% )` }"
        />
      </div>
      <div class="ruler-labels">
        <span
          v-for="(item, index) in BLOAT_THRESHOLDS"
          :key="item.key"
          class="tick"
          :class="{ active: index === currentIndex, [`seg-${item.tone}`]: true }"
        >
          <b>{{ item.key }}</b>
          <em>{{ item.hint }}</em>
        </span>
      </div>
    </div>

    <p class="foot">{{ footText }}</p>
  </section>
</template>

<style scoped>
.bloat-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
}

.sub {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.status.live {
  color: var(--trace);
}

.bloat-body {
  display: flex;
  align-items: center;
  gap: 32px;
  flex-wrap: wrap;
}

.grade {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-width: 76px;
}

.grade-key {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 40px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.04em;
}

.grade.tone-good .grade-key { color: var(--tone-good); }
.grade.tone-ok .grade-key { color: var(--tone-warn); }
.grade.tone-bad .grade-key { color: var(--tone-bad); }

.grade-label {
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.metrics {
  display: flex;
  gap: 40px;
  flex-wrap: wrap;
}

.metrics dt {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.metrics dd {
  display: flex;
  align-items: baseline;
  gap: 3px;
  margin: 4px 0 0;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.metrics dd em {
  color: var(--text-muted);
  font-style: normal;
  font-size: 10px;
  font-weight: 400;
}

.ruler {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ruler-track {
  position: relative;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 4px;
  height: 8px;
}

.seg {
  height: 8px;
  border-radius: 1px;
  transition: background-color var(--dur) var(--ease);
}

/* 刻度本身按档位淡淡分段，测完才知道落点 */
.seg.seg-good { background: color-mix(in srgb, var(--tone-good) 16%, var(--bg-subtle)); }
.seg.seg-ok { background: color-mix(in srgb, var(--tone-warn) 16%, var(--bg-subtle)); }
.seg.seg-bad { background: color-mix(in srgb, var(--tone-bad) 14%, var(--bg-subtle)); }

.seg.active.seg-good { background: var(--tone-good); }
.seg.active.seg-ok { background: var(--tone-warn); }
.seg.active.seg-bad { background: var(--tone-bad); }

.cursor {
  position: absolute;
  top: -7px;
  width: 1px;
  height: 6px;
  transform: translateX(-50%);
  background: var(--text-primary);
  transition: left var(--dur) var(--ease);
}

.cursor.seg-good { background: var(--tone-good); }
.cursor.seg-ok { background: var(--tone-warn); }
.cursor.seg-bad { background: var(--tone-bad); }

.ruler-labels {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 4px;
}

.tick {
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
}

.tick b {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
}

.tick em {
  font-family: var(--font-mono);
  font-style: normal;
  font-size: 10px;
  letter-spacing: 0;
  opacity: 0.7;
}

.tick.active.seg-good { color: var(--tone-good); }
.tick.active.seg-ok { color: var(--tone-warn); }
.tick.active.seg-bad { color: var(--tone-bad); }

.tick.active b {
  font-weight: 500;
}

.foot {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.6;
}

@media (max-width: 640px) {
  .bloat-body {
    gap: 20px;
  }

  .metrics {
    gap: 24px;
  }

  .tick em {
    display: none;
  }
}
</style>
