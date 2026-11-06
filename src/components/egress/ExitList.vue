<script setup lang="ts">
import { computed } from 'vue'
import { maskIp, type EgressExit } from '@/utils/egress'
import { countryName } from '@/utils/ipInfo'

const props = defineProps<{
  exits: EgressExit[]
  masked: boolean
  running: boolean
}>()

const rows = computed(() =>
  props.exits.map(exit => ({
    ...exit,
    ips: exit.ips.map(ip => (props.masked ? maskIp(ip) : ip)),
    place: [countryName(exit.cc, exit.cc), exit.city].filter(Boolean).join(' · '),
    flags: [
      exit.v4 && exit.v6 ? '双栈' : exit.v6 ? 'IPv6' : 'IPv4',
      ...(exit.dc ? ['机房'] : []),
      ...(exit.warp ? ['WARP'] : []),
    ],
  })),
)
</script>

<template>
  <section class="np-card np-panel eg-exits">
    <header class="np-panel-head">
      <h2>出口</h2>
      <span class="np-panel-meta font-mono">{{ exits.length }}</span>
    </header>

    <p v-if="!rows.length" class="np-empty eg-empty">
      {{ running ? '正在探测' : '—' }}
    </p>

    <ul v-else class="eg-list">
      <li v-for="exit in rows" :key="exit.key" class="eg-item">
        <div class="eg-letter" :class="`is-${exit.kind}`">{{ exit.letter }}</div>
        <div class="eg-body">
          <div class="eg-top">
            <span class="eg-place">{{ exit.place || '未知位置' }}</span>
            <span class="eg-kind">{{ exit.kind === 'proxy' ? '代理' : '本地' }}</span>
            <span v-for="flag in exit.flags" :key="flag" class="eg-flag">{{ flag }}</span>
          </div>
          <div class="eg-ips font-mono">
            <span v-for="ip in exit.ips" :key="ip">{{ ip }}</span>
          </div>
          <div class="eg-org">
            {{ exit.org || '未知网络' }}<template v-if="exit.asn"> · AS{{ exit.asn }}</template>
            · {{ exit.probes.length }} 个探测器
          </div>
        </div>
      </li>
    </ul>

    <p v-if="rows.length > 1" class="eg-note">D 本地线路 · P 代理</p>
  </section>
</template>

<style scoped>
.eg-exits {
  min-width: 0;
}

.eg-empty {
  min-height: 92px;
}

.eg-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  list-style: none;
}

.eg-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-xs);
  background: var(--bg-subtle);
}

.eg-letter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border-radius: var(--r-xs);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
}

.eg-letter.is-local {
  background: var(--tone-good-bg);
  color: var(--tone-good);
}

.eg-letter.is-proxy {
  background: var(--tone-warn-bg);
  color: var(--tone-warn);
}

.dark .eg-letter.is-local { color: var(--tone-good); }
.dark .eg-letter.is-proxy { color: var(--tone-warn); }

.eg-body {
  min-width: 0;
  flex: 1;
}

.eg-top {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.eg-place {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
}

.eg-kind {
  color: var(--text-muted);
  font-size: 11px;
}

.eg-flag {
  padding: 1px 5px;
  border: 1px solid var(--border);
  border-radius: var(--r-xs);
  color: var(--text-muted);
  font-size: 10px;
}

.eg-ips {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 11px;
}

.eg-org {
  margin-top: 3px;
  color: var(--text-muted);
  font-size: 11px;
  overflow-wrap: anywhere;
}

.eg-note {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
}
</style>
