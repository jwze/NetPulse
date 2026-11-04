<script setup lang="ts">
import { computed } from 'vue'
import { CATS, SERVICES } from '@/data/unlockServices'
import { HOW_TEXT, VERDICT_TEXT, type Verdict } from '@/utils/unlock'
import { countryName } from '@/utils/ipInfo'

const props = defineProps<{
  verdicts: Record<string, Verdict>
  filter: string
  running: boolean
}>()

const emit = defineEmits<{ 'update:filter': [value: string] }>()

const tabs = computed(() => [
  { id: 'all', label: '全部', n: SERVICES.length },
  ...CATS.map(cat => ({ id: cat.id, label: cat.label, n: SERVICES.filter(service => service.cat === cat.id).length })),
])

const list = computed(() =>
  SERVICES.filter(service => props.filter === 'all' || service.cat === props.filter).map(service => {
    const verdict = props.verdicts[service.id]
    return {
      id: service.id,
      name: service.name,
      site: service.site,
      cat: service.cat,
      verdict,
      label: verdict ? VERDICT_TEXT[verdict.v].label : '…',
      tone: verdict ? VERDICT_TEXT[verdict.v].tone : 'muted',
      place: verdict?.cc ? countryName(verdict.cc, verdict.cc) : '',
      how: verdict?.how ? HOW_TEXT[verdict.how] : '',
      why: verdict?.proxy ? '代理被拒' : '',
    }
  }),
)

const doneOf = (cat: string) =>
  SERVICES.filter(service => (cat === 'all' || service.cat === cat) && props.verdicts[service.id]).length
</script>

<template>
  <section class="np-card un-list">
    <header class="un-list-head">
      <div class="un-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="un-tab"
          :class="{ 'is-active': filter === tab.id }"
          type="button"
          @click="emit('update:filter', tab.id)"
        >
          {{ tab.label }}
          <span class="un-tab-count font-mono">{{ doneOf(tab.id) }}/{{ tab.n }}</span>
        </button>
      </div>
    </header>

    <ul class="un-rows">
      <li v-for="item in list" :key="item.id" class="un-row" :class="{ 'is-wait': !item.verdict }">
        <span class="un-dot" :class="`is-${item.tone}`" />
        <a class="un-name" :href="item.site" target="_blank" rel="noreferrer noopener">{{ item.name }}</a>
        <span class="un-place">{{ item.place }}</span>
        <span class="un-why">{{ item.why }}</span>
        <span class="un-how">{{ item.how }}</span>
        <span class="un-badge" :class="`is-${item.tone}`">{{ item.label }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.un-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.un-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.un-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
}

.un-tab:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.un-tab.is-active {
  border-color: var(--border);
  background: var(--bg-subtle);
  color: var(--text-primary);
  font-weight: 600;
}

.un-tab-count {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 400;
}

.un-rows {
  display: flex;
  flex-direction: column;
  list-style: none;
}

.un-row {
  display: grid;
  grid-template-columns: 6px minmax(0, 1fr) auto auto auto 56px;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.un-row:last-child {
  border-bottom: none;
}

.un-row.is-wait {
  opacity: 0.55;
}

.un-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-muted);
}

.un-dot.is-good { background: #16a34a; }
.un-dot.is-bad { background: #dc2626; }
.un-dot.is-ok { background: #d97706; }
.un-dot.is-muted { background: var(--text-muted); }

.dark .un-dot.is-good { background: #50E3A4; }
.dark .un-dot.is-bad { background: #FF5C4E; }
.dark .un-dot.is-ok { background: #F5A623; }

.un-name {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.un-name:hover {
  text-decoration: underline;
}

.un-place {
  color: var(--text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.un-why {
  color: #b45309;
  font-size: 10px;
  white-space: nowrap;
}

.dark .un-why { color: #F5A623; }

.un-how {
  color: var(--text-muted);
  font-size: 10px;
  white-space: nowrap;
}

.un-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
}

.un-badge.is-good { background: rgba(22, 163, 74, 0.1); color: #16a34a; }
.un-badge.is-bad { background: rgba(220, 38, 38, 0.1); color: #dc2626; }
.un-badge.is-ok { background: rgba(217, 119, 6, 0.12); color: #b45309; }
.un-badge.is-muted { background: var(--bg-subtle); color: var(--text-muted); }

.dark .un-badge.is-good { color: #50E3A4; }
.dark .un-badge.is-bad { color: #FF5C4E; }
.dark .un-badge.is-ok { color: #F5A623; }

@media (min-width: 960px) {
  .un-rows {
    max-height: max(320px, calc(100vh - 340px));
    overflow-y: auto;
    padding-right: 4px;
  }
}

@media (max-width: 640px) {
  .un-row {
    grid-template-columns: 6px minmax(0, 1fr) 56px;
    row-gap: 2px;
  }

  .un-place,
  .un-how,
  .un-why {
    display: none;
  }
}
</style>
