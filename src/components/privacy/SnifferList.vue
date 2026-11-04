<script setup lang="ts">
import { computed } from 'vue'
import { GROUPS } from '@/data/privacySniffers'

const props = defineProps<{
  rows: Record<string, string>
  masked: boolean
  running: boolean
}>()

const groups = computed(() =>
  GROUPS.map(group => ({
    ...group,
    rows: group.rows.map(row => ({
      ...row,
      value: props.masked && row.s ? (props.rows[row.id] ? '已隐藏' : '') : props.rows[row.id] || '',
      hidden: props.masked && !!row.s && !!props.rows[row.id],
    })),
  })),
)

const filled = computed(() => Object.values(props.rows).filter(Boolean).length)
</script>

<template>
  <section class="np-card pv-sniffers">
    <header class="pv-head">
      <h2>网站能读到什么</h2>
      <span class="pv-count font-mono">{{ filled }} 项</span>
    </header>

    <div class="pv-groups">
      <div v-for="group in groups" :key="group.id" class="pv-group">
        <h3>{{ group.label }}</h3>
        <ul class="pv-rows">
          <li v-for="row in group.rows" :key="row.id" class="pv-row">
            <span class="pv-name">{{ row.name }}</span>
            <span class="pv-value font-mono" :class="{ 'is-hidden': row.hidden, 'is-wait': !row.value && running }">
              {{ row.value || (running ? '读取中' : '—') }}
            </span>
            <span class="pv-method">{{ row.m }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pv-sniffers {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.pv-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.pv-head h2 {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.pv-count {
  color: var(--text-muted);
  font-size: 11px;
}

.pv-groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.pv-group h3 {
  margin-bottom: 3px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.pv-rows {
  list-style: none;
}

.pv-row {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  align-items: baseline;
  gap: 8px;
  padding: 3px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.pv-row:last-child {
  border-bottom: none;
}

.pv-name {
  color: var(--text-secondary);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pv-value {
  color: var(--text-primary);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pv-value.is-hidden {
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

.pv-value.is-wait {
  color: var(--text-muted);
}

.pv-method {
  display: none;
  color: var(--text-muted);
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (min-width: 560px) {
  .pv-row {
    grid-template-columns: 132px minmax(0, 1fr) 140px;
  }

  .pv-method {
    display: block;
  }
}
</style>
