<script setup lang="ts">
import { computed } from 'vue'
import { fmtMs, posOf, tierOf } from '@/utils/latency'
import type { LatencyRow } from '@/composables/useLatencyProbe'

const props = defineProps<{ row: LatencyRow }>()

const tier = computed(() => tierOf(props.row.median))
const value = computed(() => fmtMs(props.row.median))
const lost = computed(() => props.row.median == null && props.row.state !== 'run' && props.row.state !== 'idle')
const left = computed(() => (props.row.median == null ? 0 : posOf(props.row.median) * 100))
const coldLeft = computed(() => (props.row.cold == null ? null : posOf(Math.max(props.row.cold, 1)) * 100))
const dots = computed(() => props.row.samples
  .filter((ms): ms is number => ms != null)
  .map(ms => posOf(Math.max(ms, 1)) * 100))
const hint = computed(() => {
  const parts = [props.row.name]
  if (props.row.via) parts.push(props.row.via)
  if (props.row.cold != null) parts.push(`冷启动 ${fmtMs(props.row.cold)}ms（DNS + TCP + TLS）`)
  const alive = props.row.samples.filter((ms): ms is number => ms != null)
  if (alive.length) parts.push(`样本 ${alive.map(ms => fmtMs(ms)).join(' · ')} ms`)
  if (props.row.jitter != null) parts.push(`抖动 ±${fmtMs(props.row.jitter)}ms`)
  return parts.join('\n')
})
</script>

<template>
  <div class="lane" :class="[`tone-${tier.tone}`, { 'is-lost': lost }]" :title="hint">
    <div class="lane-name">
      <span class="lane-label">{{ row.short }}</span>
      <span v-if="row.pop" class="lane-pop font-mono">{{ row.pop }}</span>
    </div>

    <div class="lane-track">
      <i
        v-if="coldLeft != null"
        class="lane-cold"
        :style="{ left: `${Math.min(coldLeft, 100)}%` }"
      />
      <i v-for="(dot, index) in dots" :key="index" class="lane-dot" :style="{ left: `${dot}%` }" />
      <i v-if="row.median != null" class="lane-median" :style="{ left: `${left}%` }" />
    </div>

    <div class="lane-ms font-mono">
      <template v-if="row.state === 'run' && row.median == null">…</template>
      <template v-else-if="lost">✕</template>
      <template v-else>{{ value }}<small v-if="row.median != null">ms</small></template>
    </div>

    <div class="lane-extra font-mono">
      <template v-if="row.jitter != null">±{{ fmtMs(row.jitter) }}</template>
      <template v-else-if="row.cold != null">冷 {{ fmtMs(row.cold) }}</template>
    </div>
  </div>
</template>

<style scoped>
.lane {
  display: grid;
  grid-template-columns: minmax(0, 118px) minmax(0, 1fr) 62px 52px;
  align-items: center;
  gap: 10px;
  height: 30px;
  padding: 0 10px;
  border-radius: var(--r-xs);
  font-size: 12px;
  color: var(--text-secondary);
  --tone: var(--text-muted);
}

.lane:hover {
  background: var(--bg-subtle);
}

.tone-great { --tone: var(--tone-good); }
.tone-good { --tone: var(--tone-good); }
.tone-ok { --tone: var(--tone-warn); }
.tone-warn { --tone: var(--tone-warn); }
.tone-bad { --tone: var(--tone-bad); }
.tone-muted { --tone: var(--text-muted); }

.dark .tone-great { --tone: var(--tone-good); }
.dark .tone-good { --tone: var(--tone-good); }
.dark .tone-ok { --tone: var(--tone-warn); }
.dark .tone-warn { --tone: var(--tone-warn); }
.dark .tone-bad { --tone: var(--tone-bad); }

.lane-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.lane-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-weight: 500;
}

.lane-pop {
  flex: 0 0 auto;
  padding: 1px 4px;
  border: 1px solid var(--border);
  border-radius: var(--r-xs);
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.2;
}

.lane-track {
  position: relative;
  height: 8px;
  border-radius: var(--r-xs);
  background: var(--bg-subtle);
}

.lane-cold {
  position: absolute;
  top: -3px;
  width: 1px;
  height: 14px;
  background: var(--text-muted);
  opacity: 0.35;
  transform: translateX(-0.5px);
}

.lane-dot {
  position: absolute;
  top: 2px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--tone);
  opacity: 0.45;
  transform: translateX(-2px);
}

.lane-median {
  position: absolute;
  top: -2px;
  width: 3px;
  height: 12px;
  border-radius: var(--r-xs);
  background: var(--tone);
  transform: translateX(-1.5px);
}

.lane-ms {
  text-align: right;
  color: var(--tone);
  font-weight: 500;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.lane-ms small {
  margin-left: 1px;
  font-size: 10px;
  font-weight: 500;
  opacity: 0.75;
}

.lane-extra {
  text-align: right;
  color: var(--text-muted);
  font-size: 10px;
  white-space: nowrap;
}

.is-lost .lane-track {
  background: var(--bg-input);
  opacity: 0.7;
}

.is-lost .lane-ms {
  color: var(--text-muted);
  font-weight: 500;
}

@media (max-width: 640px) {
  .lane {
    grid-template-columns: minmax(0, 92px) minmax(0, 1fr) 54px;
    gap: 8px;
  }

  .lane-extra {
    display: none;
  }
}
</style>
