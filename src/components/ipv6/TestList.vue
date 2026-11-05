<script setup lang="ts">
import type { Ipv6Row } from '@/composables/useIpv6Test'

defineProps<{
  rows: Ipv6Row[]
  answered: number
  total: number
  running: boolean
}>()
</script>

<template>
  <section class="np-card np-panel test-card">
    <header class="np-panel-head">
      <h2 class="np-panel-title">测试项目</h2>
      <span class="np-panel-meta">{{ answered }} / {{ total }}</span>
    </header>

    <ol class="test-list">
      <li
        v-for="row in rows"
        :key="row.id"
        class="test-row"
        :class="`is-${row.state}`"
        :title="row.desc"
      >
        <span class="mark" aria-hidden="true" />
        <span class="name">{{ row.label }}</span>
        <span class="value">
          <b>{{ row.main }}</b>
          <span v-if="row.sub" class="sub">{{ row.sub }}</span>
        </span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.test-card {
  gap: 12px;
}

.test-list {
  list-style: none;
  display: flex;
  flex-direction: column;
}

.test-row {
  display: grid;
  grid-template-columns: 5px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 11px 0;
  border-top: 1px solid var(--border-subtle);
}

.test-row:first-child {
  border-top: none;
}

.mark {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--border);
}

.is-ok .mark { background: var(--tone-good); }
.is-warn .mark { background: var(--tone-warn); }
.is-bad .mark { background: var(--tone-bad); }

.name {
  min-width: 0;
  color: var(--text-primary);
  font-size: 12px;
  cursor: default;
}

.is-wait .name {
  color: var(--text-secondary);
}

.value {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  min-width: 0;
  text-align: right;
}

.value b {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.is-warn .value b { color: var(--tone-warn); }
.is-bad .value b { color: var(--tone-bad); }

.sub {
  max-width: 190px;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 520px) {
  .sub {
    max-width: 132px;
  }
}
</style>
