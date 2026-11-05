<script setup lang="ts">
import { computed } from 'vue'
import { PAIR_WHERE } from '@/data/ipv6Hosts'
import { CMP_HINT, cmpText, fmtMs, type Compare, type TestResult, type Tone } from '@/utils/ipv6'

interface PairRow {
  id: string
  name: string
  where: 'global' | 'nocn' | 'cn'
  v4?: TestResult
  v6?: TestResult
  diff: number | null
  both: boolean
}

const props = defineProps<{
  pairs: PairRow[]
  compare: Compare
  done: number
  total: number
  pending: boolean
}>()

const max = computed(() => Math.max(1, ...props.pairs.flatMap(pair => [pair.v4?.rtt, pair.v6?.rtt]).filter((v): v is number => v != null)))

const tone = computed<Tone>(() => {
  switch (props.compare.key) {
    case 'same':
    case '6fast': return 'great'
    case '6slow':
    case 'no6': return 'warn'
    case '6much': return 'bad'
    default: return 'warn'
  }
})

function ratio(ms: number | null | undefined): number {
  if (ms == null) return 0
  return Math.max(0.03, Math.min(1, ms / max.value))
}

function diffText(pair: PairRow): string {
  if (!pair.v4 || !pair.v6) return '…'
  if (!pair.both || pair.diff == null) return '—'
  if (pair.diff === 0) return '±0'
  return `${pair.diff > 0 ? '+' : '−'}${fmtMs(Math.abs(pair.diff))}`
}

function diffTone(pair: PairRow): string {
  if (!pair.both || pair.diff == null) return ''
  if (Math.abs(pair.diff) <= Math.max(10, (pair.v4!.rtt ?? 0) * 0.15)) return ''
  return pair.diff > 0 ? 'is-slow' : 'is-fast'
}

const title = computed(() => (props.pending ? '尚未测试' : cmpText(props.compare)))
const hint = computed(() => (props.pending ? '' : CMP_HINT[props.compare.key]))
</script>

<template>
  <section class="np-card np-panel cmp-card">
    <header class="np-panel-head">
      <h2>IPv4 与 IPv6 对比</h2>
      <span class="np-panel-meta font-mono">{{ done }}/{{ total }}</span>
    </header>

    <p class="cmp-verdict" :class="pending ? 's-muted' : `s-${tone}`">{{ title }}</p>
    <p v-if="hint" class="cmp-hint">{{ hint }}</p>

    <div class="cmp-table">
      <div class="cmp-row cmp-title">
        <span>网络</span>
        <span>IPv4</span>
        <span>IPv6</span>
        <span class="cmp-diff">差值</span>
      </div>
      <div v-for="pair in pairs" :key="pair.id" class="cmp-row">
        <span class="cmp-name" :title="PAIR_WHERE[pair.where]">{{ pair.name }}</span>
        <span class="cmp-cell">
          <b class="font-mono" :class="{ 'is-muted': !pair.v4?.ok }">{{ pair.v4 ? (pair.v4.ok && pair.v4.rtt != null ? fmtMs(pair.v4.rtt) : '—') : '…' }}</b>
          <i class="cmp-bar"><em :style="{ transform: `scaleX(${pair.v4?.ok ? ratio(pair.v4.rtt) : 0})` }" /></i>
        </span>
        <span class="cmp-cell">
          <b class="font-mono" :class="{ 'is-muted': !pair.v6?.ok }">{{ pair.v6 ? (pair.v6.ok && pair.v6.rtt != null ? fmtMs(pair.v6.rtt) : '—') : '…' }}</b>
          <i class="cmp-bar"><em :style="{ transform: `scaleX(${pair.v6?.ok ? ratio(pair.v6.rtt) : 0})` }" /></i>
        </span>
        <span class="cmp-diff font-mono" :class="diffTone(pair)">{{ diffText(pair) }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cmp-card {
  gap: 4px;
}

.cmp-verdict {
  margin-top: 4px;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 500;
  letter-spacing: -0.02em;
}

.cmp-hint {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.cmp-table {
  margin-top: 10px;
}

.cmp-row {
  display: grid;
  grid-template-columns: minmax(70px, 1.2fr) minmax(64px, 1fr) minmax(64px, 1fr) 58px;
  align-items: center;
  gap: 12px;
  padding: 9px 0;
  border-top: 1px solid var(--border-subtle);
}

.cmp-title {
  padding: 0 0 6px;
  border-top: none;
  color: var(--text-muted);
  font-size: 10px;
  letter-spacing: 0.04em;
}

.cmp-name {
  color: var(--text-primary);
  font-size: 12px;
  cursor: default;
}

.cmp-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cmp-cell b {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
}

.cmp-cell b.is-muted {
  color: var(--text-muted);
}

.cmp-bar {
  display: block;
  max-width: 128px;
  height: 3px;
  border-radius: var(--r-xs);
  background: var(--bg-subtle);
  overflow: hidden;
}

.cmp-bar em {
  display: block;
  height: 100%;
  border-radius: var(--r-xs);
  background: var(--text-muted);
  transform-origin: left center;
  transition: transform 0.35s ease;
}

.cmp-diff {
  color: var(--text-secondary);
  font-size: 12px;
  text-align: right;
}

.is-slow { color: var(--tone-warn); }
.is-fast { color: var(--tone-good); }

.dark .is-slow { color: var(--tone-warn); }
.dark .is-fast { color: var(--tone-good); }

.s-muted { color: var(--text-secondary); }
.s-great { color: var(--tone-good); }
.s-good { color: var(--tone-good); }
.s-ok { color: var(--tone-warn); }
.s-warn { color: var(--tone-warn); }
.s-bad { color: var(--tone-bad); }

.dark .s-great { color: var(--tone-good); }
.dark .s-good { color: var(--tone-good); }
.dark .s-ok { color: var(--tone-warn); }
.dark .s-warn { color: var(--tone-warn); }
.dark .s-bad { color: var(--tone-bad); }

@media (max-width: 520px) {
  .cmp-row {
    grid-template-columns: minmax(58px, 1fr) minmax(54px, 1fr) minmax(54px, 1fr) 48px;
    gap: 8px;
  }

  .cmp-verdict {
    font-size: 15px;
  }
}
</style>
