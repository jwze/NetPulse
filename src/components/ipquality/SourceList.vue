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

/** 按来源顺序排好，谁先返回都不改变行的位置 */
const rows = computed(() =>
  SOURCES.map(source => {
    const result = props.results.find(item => item.id === source.id)
    if (!result) return { id: source.id, name: source.name, pending: true }

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
      pending: false,
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
  <section class="np-card np-panel sources">
    <header class="np-panel-head">
      <h2 class="np-panel-title">来源明细</h2>
      <span class="np-panel-meta">{{ done }} / {{ total }}</span>
    </header>

    <ul class="rows">
      <li v-for="row in rows" :key="row.id" class="row" :class="{ 'is-pending': row.pending }">
        <span class="dot" :class="row.pending ? 'is-wait' : row.error ? 'is-fail' : 'is-ok'" />
        <div class="row-body">
          <div class="row-top">
            <a v-if="row.site && !row.error" class="row-name" :href="row.site" target="_blank" rel="noreferrer noopener">{{ row.name }}</a>
            <span v-else class="row-name">{{ row.name }}</span>
            <template v-if="row.pending">
              <span class="np-skel pending-bar" />
            </template>
            <template v-else>
              <span v-for="flag in row.flags" :key="flag" class="flag">{{ flag }}</span>
              <span class="ms">{{ row.error ? '' : `${row.ms} ms` }}</span>
            </template>
          </div>
          <p v-if="!row.pending" class="row-facts">{{ row.error ? '没有返回结果' : row.facts || '没有更多字段' }}</p>
        </div>
      </li>
    </ul>

    <div class="dnsbl">
      <div class="subhead">
        <span>邮件黑名单</span>
        <span class="count">{{ dnsbl.filter(item => item.listed).length }} / {{ checked }}</span>
      </div>
      <p v-if="checked === 0" class="bl-note">IPv6 地址不参与邮件黑名单查询</p>
      <div v-else class="bl">
        <span
          v-for="item in dnsbl"
          :key="item.id"
          class="bl-item"
          :class="item.listed === null ? 'is-unknown' : item.listed ? 'is-listed' : 'is-clear'"
        >{{ item.name }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sources {
  min-width: 0;
}

.rows {
  display: flex;
  flex-direction: column;
  list-style: none;
}

.row {
  display: flex;
  gap: 10px;
  min-height: 48px;
  padding: 9px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.row:last-child {
  border-bottom: none;
}

.row.is-pending {
  opacity: 0.55;
}

.dot {
  width: 5px;
  height: 5px;
  margin-top: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
}

.dot.is-ok { background: var(--tone-good); }
.dot.is-fail { background: var(--border-strong); }
.dot.is-wait { background: var(--border); }

.pending-bar {
  margin-left: auto;
  width: 64px;
  height: 8px;
  align-self: center;
}

.row-body {
  min-width: 0;
  flex: 1;
}

.row-top {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.row-name {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
}

a.row-name:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.flag {
  color: var(--tone-warn);
  font-size: 10px;
}

.ms {
  margin-left: auto;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.row-facts {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.dnsbl {
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}

.subhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-secondary);
  font-size: 11px;
}

.count {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
}

.bl-note {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 11px;
}

.bl {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 8px;
}

.bl-item {
  color: var(--text-muted);
  font-size: 10px;
}

.bl-item.is-clear { color: var(--text-secondary); }
.bl-item.is-listed { color: var(--tone-bad); }
.bl-item.is-unknown { opacity: 0.5; }
</style>
