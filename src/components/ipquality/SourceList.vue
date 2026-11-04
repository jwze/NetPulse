<script setup lang="ts">
import { computed } from 'vue'
import { TYPE_TEXT, type DnsblResult, type SourceResult } from '@/utils/ipQuality'
import { SOURCES } from '@/utils/ipQualityProbe'

const props = defineProps<{
  results: SourceResult[]
  dnsbl: DnsblResult[]
  ip: string
  running: boolean
  total: number
  done: number
}>()

const siteOf = (id: string, ip: string) => SOURCES.find(source => source.id === id)?.site?.(ip) || ''

const rows = computed(() =>
  props.results.map(result => {
    const data = result.data || {}
    const facts: string[] = []
    if (data.cc) facts.push(data.cc + (data.city ? ` · ${data.city}` : ''))
    if (data.asn) facts.push(`AS${data.asn}`)
    if (data.type) facts.push(TYPE_TEXT[data.type])
    if (data.org) facts.push(data.org)
    if (data.host) facts.push(data.host)
    if (data.regCc) facts.push(`注册 ${data.regCc}`)
    if (data.rir) facts.push(data.rir)
    if (data.risk != null) facts.push(`风险 ${data.risk}`)
    if (data.ports?.length) facts.push(`端口 ${data.ports.slice(0, 6).join(',')}`)
    const flags = [
      ...(data.proxy ? ['代理'] : []),
      ...(data.vpn ? ['VPN'] : []),
      ...(data.tor ? ['Tor'] : []),
      ...(data.relay ? ['中继'] : []),
      ...(data.abuser ? ['滥用'] : []),
    ]
    return {
      id: result.id,
      name: result.name,
      error: result.error,
      ms: result.ms,
      facts: facts.join(' · '),
      flags,
      site: siteOf(result.id, props.ip),
    }
  }),
)

const checked = computed(() => props.dnsbl.filter(item => item.listed !== null).length)
</script>

<template>
  <section class="np-card iq-sources">
    <header class="iq-head">
      <h2>来源明细</h2>
      <span class="iq-count font-mono">{{ done }}/{{ total }}</span>
    </header>

    <ul class="iq-rows">
      <li v-for="row in rows" :key="row.id" class="iq-row">
        <span class="iq-status" :class="row.error ? 'is-fail' : 'is-ok'">{{ row.error ? '✕' : '✓' }}</span>
        <div class="iq-row-body">
          <div class="iq-row-top">
            <a v-if="row.site && !row.error" class="iq-row-name" :href="row.site" target="_blank" rel="noreferrer noopener">{{ row.name }}</a>
            <span v-else class="iq-row-name">{{ row.name }}</span>
            <span v-for="flag in row.flags" :key="flag" class="iq-flag">{{ flag }}</span>
            <span class="iq-ms font-mono">{{ row.error ? '' : `${row.ms} ms` }}</span>
          </div>
          <p class="iq-row-facts">{{ row.error ? '没有返回结果' : row.facts || '没有更多字段' }}</p>
        </div>
      </li>
      <li v-if="!rows.length" class="iq-row is-empty">
        {{ running ? '等待来源返回…' : '还没有查询结果' }}
      </li>
    </ul>

    <div class="iq-dnsbl">
      <div class="iq-subhead">
        <span>邮件黑名单</span>
        <span class="font-mono">{{ dnsbl.filter(item => item.listed).length }}/{{ checked }}</span>
      </div>
      <p v-if="checked === 0" class="iq-bl-note">IPv6 地址不参与邮件黑名单查询。</p>
      <div v-else class="iq-bl">
        <span
          v-for="item in dnsbl"
          :key="item.id"
          class="iq-bl-item"
          :class="item.listed === null ? 'is-unknown' : item.listed ? 'is-listed' : 'is-clear'"
        >{{ item.name }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.iq-sources {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.iq-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.iq-head h2 {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.iq-count {
  color: var(--text-muted);
  font-size: 11px;
}

.iq-rows {
  display: flex;
  flex-direction: column;
  list-style: none;
}

.iq-row {
  display: flex;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.iq-row:last-child {
  border-bottom: none;
}

.iq-row.is-empty {
  color: var(--text-muted);
  font-size: 12px;
}

.iq-status {
  width: 14px;
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 18px;
}

.iq-status.is-ok { color: #16a34a; }
.iq-status.is-fail { color: var(--text-muted); }

.dark .iq-status.is-ok { color: #50E3A4; }

.iq-row-body {
  min-width: 0;
  flex: 1;
}

.iq-row-top {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}

.iq-row-name {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}

a.iq-row-name:hover {
  text-decoration: underline;
}

.iq-flag {
  padding: 0 5px;
  border: 1px solid var(--border);
  border-radius: 3px;
  color: #b45309;
  font-size: 10px;
}

.dark .iq-flag { color: #F5A623; }

.iq-ms {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 10px;
}

.iq-row-facts {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.iq-dnsbl {
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
}

.iq-subhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.iq-bl-note {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 11px;
}

.iq-bl {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 7px;
}

.iq-bl-item {
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-muted);
  font-size: 10px;
}

.iq-bl-item.is-clear { color: #16a34a; border-color: rgba(22, 163, 74, 0.3); }
.iq-bl-item.is-listed { color: #dc2626; border-color: rgba(220, 38, 38, 0.35); background: rgba(220, 38, 38, 0.06); }
.iq-bl-item.is-unknown { opacity: 0.55; }

.dark .iq-bl-item.is-clear { color: #50E3A4; }
.dark .iq-bl-item.is-listed { color: #FF5C4E; }
</style>
