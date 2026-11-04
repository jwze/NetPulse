<script setup lang="ts">
import type { Ipv6Row } from '@/composables/useIpv6Test'

defineProps<{
  rows: Ipv6Row[]
  answered: number
  total: number
  running: boolean
}>()

const MARK: Record<Ipv6Row['state'], string> = {
  wait: '·',
  ok: '✓',
  warn: '!',
  bad: '✕',
}
</script>

<template>
  <section class="np-card np-panel test-card">
    <header class="np-panel-head">
      <h2>测试项目</h2>
      <span class="np-panel-meta font-mono">{{ answered }}/{{ total }}</span>
    </header>

    <ol class="test-list">
      <li
        v-for="row in rows"
        :key="row.id"
        class="test-row"
        :class="`is-${row.state}`"
        :title="row.desc"
      >
        <span class="test-mark" aria-hidden="true">{{ MARK[row.state] }}</span>
        <span class="test-name">{{ row.label }}</span>
        <span class="test-value">
          <b class="font-mono">{{ row.main }}</b>
          <span v-if="row.sub" class="test-sub">{{ row.sub }}</span>
        </span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.test-card {
  gap: 2px;
}

.test-list {
  list-style: none;
  display: flex;
  flex-direction: column;
}

.test-row {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 74px;
  padding: 9px 0;
  border-top: 1px solid var(--border-subtle);
}

.test-row:first-child {
  border-top: none;
}

.test-mark {
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
}

.is-wait .test-mark,
.is-wait .test-name,
.is-wait .test-value b {
  color: var(--text-muted);
}

.is-ok .test-mark {
  color: #16a34a;
}

.is-warn .test-mark {
  color: #d97706;
}

.is-bad .test-mark {
  color: #dc2626;
}

.dark .is-ok .test-mark { color: #50e3a4; }
.dark .is-warn .test-mark { color: #f5a623; }
.dark .is-bad .test-mark { color: #ff5c4e; }

.test-name {
  min-width: 0;
  color: var(--text-primary);
  font-size: 13px;
  cursor: default;
}

.is-wait .test-name {
  color: var(--text-secondary);
}

.test-value {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  min-width: 0;
  text-align: right;
}

.test-value b {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.is-warn .test-value b {
  color: #d97706;
}

.is-bad .test-value b {
  color: #dc2626;
}

.dark .is-warn .test-value b { color: #f5a623; }
.dark .is-bad .test-value b { color: #ff5c4e; }

.test-sub {
  max-width: 190px;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 520px) {
  .test-sub {
    max-width: 132px;
  }
}
</style>
