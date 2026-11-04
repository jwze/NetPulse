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
  <section class="np-card eg-exits">
    <header class="eg-head">
      <h2>出口</h2>
      <span class="eg-count font-mono">{{ exits.length }}</span>
    </header>

    <p v-if="!rows.length" class="eg-empty">
      {{ running ? '正在询问各类目的地…' : '还没有结果。开始探测后会列出这条线路上所有的出口。' }}
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

    <p v-if="rows.length > 1" class="eg-note">D 是本地线路，P 是代理；同一条线路的不同协议地址合并成一个出口。</p>
  </section>
</template>

<style scoped>
.eg-exits {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.eg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.eg-head h2 {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.eg-count {
  color: var(--text-muted);
  font-size: 12px;
}

.eg-empty {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
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
  border-radius: 5px;
  background: var(--bg-subtle);
}

.eg-letter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border-radius: 5px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
}

.eg-letter.is-local {
  background: rgba(22, 163, 74, 0.12);
  color: #16a34a;
}

.eg-letter.is-proxy {
  background: rgba(217, 119, 6, 0.14);
  color: #b45309;
}

.dark .eg-letter.is-local { color: #50E3A4; }
.dark .eg-letter.is-proxy { color: #F5A623; }

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
  font-weight: 600;
}

.eg-kind {
  color: var(--text-muted);
  font-size: 11px;
}

.eg-flag {
  padding: 1px 5px;
  border: 1px solid var(--border);
  border-radius: 3px;
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
