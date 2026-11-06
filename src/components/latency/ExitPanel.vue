<script setup lang="ts">
import { computed } from 'vue'
import { countryName } from '@/utils/ipInfo'
import type { ExitGroup } from '@/utils/latency'

const props = defineProps<{
  exits: ExitGroup[]
  state: 'idle' | 'checking' | 'done'
  unknown: number
  mask: boolean
  note: string
  warp: boolean
}>()

const emit = defineEmits<{ (e: 'toggle-mask'): void }>()

const hasExits = computed(() => props.exits.length > 0)

function place(exit: ExitGroup) {
  const country = exit.cc ? countryName(exit.cc, exit.cc) : '未知地区'
  return [country, exit.city].filter(Boolean).join(' · ')
}

function maskedIp(ip: string) {
  if (!props.mask) return ip
  if (ip.includes(':')) {
    return `${ip.split(':').slice(0, 2).join(':')}:••••`
  }
  const parts = ip.split('.')
  return `${parts[0]}.${parts[1]}.•.•`
}

function sourceText(exit: ExitGroup) {
  if (!exit.sources.length) return ''
  return exit.sources.length > 2
    ? `${exit.sources.slice(0, 2).join(' · ')} 等 ${exit.sources.length} 项`
    : exit.sources.join(' · ')
}
</script>

<template>
  <section class="np-card np-panel exit-card">
    <header class="np-panel-head">
      <h2>
        出口
        <span v-if="warp" class="np-chip exit-warp">WARP</span>
      </h2>
      <button class="np-btn-quiet exit-eye" type="button" @click="emit('toggle-mask')">
        {{ mask ? '显示 IP' : '隐藏 IP' }}
      </button>
    </header>

    <p v-if="!hasExits" class="np-empty exit-empty">
      {{ state === 'checking' ? '正在核对' : '—' }}
    </p>

    <ul v-else class="exit-list">
      <li v-for="exit in exits" :key="exit.key" class="exit-item">
        <div class="exit-top">
          <span class="exit-place">{{ place(exit) }}</span>
          <span class="np-chip exit-kind" :class="exit.proxy ? 'np-chip-danger' : 'np-chip-success'">
            {{ exit.proxy ? '代理' : '本机' }}
          </span>
        </div>
        <div class="exit-meta">
          <span v-if="exit.asn" class="font-mono">AS{{ exit.asn }}</span>
          <span v-if="exit.org" class="exit-org">{{ exit.org }}</span>
        </div>
        <div class="exit-ips font-mono">
          <span v-for="ip in exit.ips" :key="ip" class="exit-ip">{{ maskedIp(ip) }}</span>
          <span v-if="!exit.ips.length" class="exit-org">分享结果不含 IP</span>
        </div>
        <div v-if="sourceText(exit)" class="exit-src">{{ sourceText(exit) }}</div>
      </li>
    </ul>

    <p v-if="note" class="exit-note">{{ note }}</p>
    <p v-if="unknown > 0" class="exit-note">另有 {{ unknown }} 组地址未能查到归属网络。</p>
  </section>
</template>

<style scoped>
.exit-card {
  gap: 10px;
}

.exit-warp {
  padding: 2px 6px;
  font-size: 10px;
}

.exit-eye {
  height: 26px;
  padding: 0 9px;
}

.exit-empty {
  min-height: 88px;
}

.exit-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  list-style: none;
}

.exit-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  background: var(--bg-subtle);
}

.exit-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.exit-place {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
}

.exit-kind {
  flex: 0 0 auto;
  font-size: 10px;
  padding: 2px 6px;
}

.exit-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 11px;
  min-width: 0;
}

.exit-org {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exit-ips {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--text-secondary);
  font-size: 11px;
}

.exit-ip {
  overflow-wrap: anywhere;
  line-height: 1.5;
}

.exit-src {
  color: var(--text-muted);
  font-size: 10px;
}

.exit-note {
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.6;
  padding-top: 2px;
  border-top: 1px solid var(--border-subtle);
}
</style>
