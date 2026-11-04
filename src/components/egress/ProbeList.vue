<script setup lang="ts">
import { computed } from 'vue'
import { GROUPS, PROBES } from '@/data/egressProbes'
import type { ProbeRow } from '@/utils/egress'
import { fmtMs } from '@/utils/latency'

const props = defineProps<{
  rows: Record<string, ProbeRow>
  odd: Record<string, { k: 'odd' | 'leak'; x: string; y?: string }>
  masked: boolean
}>()

const groups = computed(() =>
  GROUPS.map(group => {
    const list = PROBES.filter(probe => probe.g === group.id).map(probe => {
      const row = props.rows[probe.id]
      const odd = props.odd[probe.id]
      return {
        id: probe.id,
        name: probe.name,
        host: probe.host,
        row,
        odd,
        state: !row ? 'wait' : row.why ? 'fail' : 'ok',
      }
    })
    return { ...group, list, done: list.filter(item => item.row).length }
  }),
)
</script>

<template>
  <section class="np-card eg-probes">
    <header class="eg-head">
      <h2>探测器</h2>
      <span class="eg-hint">走另一条线路的会标出来</span>
    </header>

    <div class="eg-groups">
      <div v-for="group in groups" :key="group.id" class="eg-group">
        <div class="eg-group-head">
          <span class="eg-group-label">{{ group.label }}</span>
          <span class="eg-group-count font-mono">{{ group.done }}/{{ group.list.length }}</span>
        </div>
        <ul class="eg-rows">
          <li
            v-for="item in group.list"
            :key="item.id"
            class="eg-row"
            :class="{ 'is-wait': item.state === 'wait', 'is-fail': item.state === 'fail', 'is-odd': item.odd?.k === 'odd', 'is-leak': item.odd?.k === 'leak' }"
          >
            <span class="eg-row-name">
              {{ item.name }}
              <span class="eg-row-host font-mono">{{ item.host }}</span>
            </span>
            <span v-if="item.row?.l.length" class="eg-row-letters">
              <span v-for="letter in item.row.l" :key="letter" class="eg-letter-chip font-mono">{{ letter }}</span>
            </span>
            <span class="eg-row-ms font-mono">
              <template v-if="item.row?.why">✕</template>
              <template v-else-if="item.row">{{ fmtMs(item.row.ms) }} ms</template>
              <template v-else>…</template>
            </span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.eg-probes {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.eg-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.eg-head h2 {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.eg-hint {
  color: var(--text-muted);
  font-size: 11px;
}

.eg-groups {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px 24px;
}

.eg-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--border-subtle);
}

.eg-group-label {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.eg-group-count {
  color: var(--text-muted);
  font-size: 10px;
}

.eg-rows {
  list-style: none;
}

.eg-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 46px;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.eg-row:last-child {
  border-bottom: none;
}

.eg-row-name {
  min-width: 0;
  color: var(--text-primary);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.eg-row-host {
  margin-left: 6px;
  color: var(--text-muted);
  font-size: 10px;
}

.eg-row-letters {
  display: inline-flex;
  gap: 3px;
}

.eg-letter-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 16px;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 700;
}

.eg-row-ms {
  color: var(--text-secondary);
  font-size: 11px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.eg-row.is-wait { opacity: 0.55; }
.eg-row.is-fail .eg-row-ms { color: var(--text-muted); }
.eg-row.is-fail .eg-row-name { color: var(--text-secondary); }

.eg-row.is-odd { background: rgba(217, 119, 6, 0.06); }
.eg-row.is-odd .eg-letter-chip { background: rgba(217, 119, 6, 0.14); color: #b45309; }
.eg-row.is-leak { background: rgba(220, 38, 38, 0.06); }
.eg-row.is-leak .eg-letter-chip { background: rgba(220, 38, 38, 0.14); color: #dc2626; }

.dark .eg-row.is-odd .eg-letter-chip { color: #F5A623; }
.dark .eg-row.is-leak .eg-letter-chip { color: #FF5C4E; }

@media (min-width: 720px) {
  .eg-groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
