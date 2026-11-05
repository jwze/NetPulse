<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useClipboard } from '@vueuse/core'
import { useNetworkStore } from '@/stores/network'
import { fetchIpInfo, type IpInfo } from '@/utils/ipInfo'
import Icon from '@/components/ui/Icon.vue'

const { copy, copied } = useClipboard()
const networkStore = useNetworkStore()

type LatencyLevel = 'good' | 'ok' | 'bad' | ''

interface LatencyState {
  ms: number | string
  level: LatencyLevel
}

const exitInfo = ref<IpInfo | null>(null)
const loading = ref(true)
const localLatency = ref<LatencyState>({ ms: '-', level: '' })
const overseasLatency = ref<LatencyState>({ ms: '-', level: '' })

let timers: number[] = []
let isVisible = true
let disposed = false

function getLevel(ms: number): LatencyLevel {
  if (ms <= 60) return 'good'
  if (ms >= 200) return 'bad'
  return 'ok'
}

/** 国内探测点（华为 204，不返回内容，适合做延迟探测） */
const CN_PROBE = 'https://connectivitycheck.platform.hicloud.com/generate_204'
/** 海外探测点（Cloudflare 204） */
const GLOBAL_PROBE = 'https://cp.cloudflare.com/generate_204'

async function probe(url: string): Promise<number | null> {
  try {
    const start = performance.now()
    await fetch(url, { method: 'HEAD', cache: 'no-store', mode: 'no-cors', referrerPolicy: 'no-referrer' })
    return Math.round(performance.now() - start)
  } catch {
    return null
  }
}

async function refreshExitInfo(first = false) {
  if (disposed || !isVisible) return
  try {
    exitInfo.value = await fetchIpInfo()
  } catch {
    if (first) exitInfo.value = null
  } finally {
    loading.value = false
  }
  if (!disposed) timers.push(window.setTimeout(() => refreshExitInfo(), 60000))
}

async function refreshLatency() {
  if (disposed || !isVisible) return
  const [cn, global] = await Promise.all([probe(CN_PROBE), probe(GLOBAL_PROBE)])
  localLatency.value = cn === null ? { ms: '-', level: '' } : { ms: cn, level: getLevel(cn) }
  overseasLatency.value = global === null ? { ms: '-', level: '' } : { ms: global, level: getLevel(global) }
  networkStore.setLocalLatency(cn ?? 0)
  networkStore.setCloudflareLatency(global ?? 0)
  if (!disposed) timers.push(window.setTimeout(refreshLatency, 5000))
}

function onVisibilityChange() {
  isVisible = document.visibilityState === 'visible'
}

function copyIp() {
  if (exitInfo.value?.ip) copy(exitInfo.value.ip)
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  void refreshExitInfo(true)
  void refreshLatency()
})

onUnmounted(() => {
  disposed = true
  document.removeEventListener('visibilitychange', onVisibilityChange)
  timers.forEach(t => clearTimeout(t))
  timers = []
})
</script>

<template>
  <section class="np-card egress-card">
    <header class="np-panel-head">
      <h2 class="np-panel-title">出口地址</h2>
      <span v-if="copied" class="copied">已复制</span>
    </header>

    <div v-if="loading" class="loading">
      <span class="np-skel" style="width: 62%" />
      <span class="np-skel" style="width: 38%" />
    </div>

    <template v-else>
      <button class="ip-row" type="button" :disabled="!exitInfo" @click="copyIp">
        <span class="ip-text" :title="exitInfo?.ip || ''">
          {{ exitInfo ? exitInfo.displayAddress : '未获取到出口信息' }}
        </span>
        <Icon v-if="exitInfo" name="copy" :size="14" class="copy-icon" />
      </button>

      <dl class="latency">
        <div>
          <dt>国内</dt>
          <dd :class="`latency-${localLatency.level || 'none'}`">
            {{ localLatency.ms }}<em v-if="localLatency.level">ms</em>
          </dd>
        </div>
        <div>
          <dt>海外</dt>
          <dd :class="`latency-${overseasLatency.level || 'none'}`">
            {{ overseasLatency.ms }}<em v-if="overseasLatency.level">ms</em>
          </dd>
        </div>
      </dl>
    </template>
  </section>
</template>

<style scoped>
.egress-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
}

.copied {
  color: var(--tone-good);
  font-size: 11px;
}

.loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 6px 0;
}

.ip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 32px;
  padding: 0;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
}

.ip-row:disabled {
  cursor: default;
}

.ip-text {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-icon {
  color: var(--text-muted);
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease);
}

.ip-row:hover .copy-icon,
.ip-row:focus-visible .copy-icon {
  opacity: 1;
}

.latency {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}

.latency dt {
  color: var(--text-muted);
  font-size: 11px;
}

.latency dd {
  display: flex;
  align-items: baseline;
  gap: 3px;
  margin: 2px 0 0;
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.latency dd em {
  font-style: normal;
  font-size: 10px;
  font-weight: 400;
  opacity: 0.7;
}

.latency-good { color: var(--tone-good); }
.latency-ok { color: var(--tone-warn); }
.latency-bad { color: var(--tone-bad); }
.latency-none { color: var(--text-muted); }
</style>
