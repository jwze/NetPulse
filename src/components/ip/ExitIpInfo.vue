<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useClipboard } from '@vueuse/core'
import { useNetworkStore } from '@/stores/network'

const { copy, copied } = useClipboard()
const networkStore = useNetworkStore()

interface ExitInfo {
  ip: string
  address: string
}

type LatencyLevel = 'good' | 'ok' | 'bad' | ''

interface LatencyState {
  ms: number | string
  level: LatencyLevel
}

const exitInfo = ref<ExitInfo | null>(null)
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

/** 国家码转中文名，纯前端、无需接口 */
function countryName(code: string | undefined, fallback: string | undefined) {
  if (code) {
    try {
      const display = new Intl.DisplayNames(['zh-CN'], { type: 'region' }).of(code)
      if (display && display !== code) return display
    } catch {
      // 忽略不支持 Intl.DisplayNames 的环境
    }
  }
  return fallback || ''
}

/** 运营商名称太长，去掉通用后缀 */
function shortenIsp(isp: string) {
  return isp
    .replace(/\b(communications?|corporation|corp\.?|co\.?,?\s*ltd\.?|limited|ltd\.?|inc\.?|group|company|holding|technologies|technology)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 28)
}

function composeAddress(country: string, region: string, city: string, isp: string) {
  const parts: string[] = []
  const push = (value?: string) => {
    const text = (value || '').trim()
    if (!text) return
    if (parts.some(item => item.toLowerCase() === text.toLowerCase())) return
    parts.push(text)
  }
  push(country)
  push(city && city !== region ? city : region)
  const area = parts.join(' ')
  const carrier = shortenIsp(isp)
  return carrier ? `${area} · ${carrier}` : area
}

async function fetchFromIpwho() {
  const resp = await fetch('https://ipwho.is/', { cache: 'no-store', referrerPolicy: 'no-referrer' })
  if (!resp.ok) throw new Error(`ipwho ${resp.status}`)
  const data = await resp.json()
  if (data?.success === false || !data?.ip) throw new Error('ipwho empty')
  const country = countryName(data.country_code, data.country)
  const address = composeAddress(country, data.region || '', data.city || '', data.connection?.isp || data.connection?.org || '')
  return { ip: String(data.ip), address: address || String(data.ip) } as ExitInfo
}

async function fetchFromIpapi() {
  const resp = await fetch('https://ipapi.co/json/', { cache: 'no-store', referrerPolicy: 'no-referrer' })
  if (!resp.ok) throw new Error(`ipapi ${resp.status}`)
  const data = await resp.json()
  if (!data?.ip) throw new Error('ipapi empty')
  const country = countryName(data.country_code, data.country_name)
  const address = composeAddress(country, data.region || '', data.city || '', data.org || '')
  return { ip: String(data.ip), address: address || String(data.ip) } as ExitInfo
}

async function refreshExitInfo(first = false) {
  if (disposed || !isVisible) return
  try {
    exitInfo.value = await fetchFromIpwho()
  } catch {
    try {
      exitInfo.value = await fetchFromIpapi()
    } catch {
      if (first) exitInfo.value = null
    }
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
  <div class="np-card flex-1">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <div class="w-5 h-5 flex items-center justify-center" style="color: var(--text-secondary)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <h3 class="text-[14px] font-semibold tracking-tight" style="color: var(--text-primary)">
          出口地址
        </h3>
      </div>
      <span v-if="copied" class="text-[11px]" style="color: var(--color-success)">已复制</span>
    </div>

    <div v-if="loading" class="flex items-center gap-2 py-2">
      <div
        class="w-3 h-3 rounded-full np-spin"
        style="border: 1.5px solid var(--border); border-top-color: var(--text-primary)"
      />
      <span class="text-[12px]" style="color: var(--text-muted)">正在检测...</span>
    </div>

    <template v-else>
      <div class="ip-row" :class="{ 'is-empty': !exitInfo }" @click="copyIp">
        <div class="ip-main">
          <span class="ip-label">出口</span>
          <span class="ip-address" :title="exitInfo?.ip || ''">
            {{ exitInfo ? exitInfo.address : '未获取到出口信息' }}
          </span>
        </div>
        <span v-if="exitInfo" class="ip-copy">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </span>
      </div>

      <div class="latency-grid">
        <div class="latency-item">
          <span class="latency-label">国内</span>
          <span class="ip-latency" :class="`latency-${localLatency.level || 'none'}`">{{ localLatency.ms }} ms</span>
        </div>
        <div class="latency-item">
          <span class="latency-label">海外</span>
          <span class="ip-latency" :class="`latency-${overseasLatency.level || 'none'}`">{{ overseasLatency.ms }} ms</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
  padding: 8px 10px;
  border-radius: 7px;
  background: var(--bg-subtle);
  cursor: pointer;
  transition: background 0.15s ease;
}

.ip-row:hover {
  background: var(--bg-input-hover);
}

.ip-row.is-empty {
  cursor: default;
}

.ip-main {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  flex: 1;
}

.ip-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 18px;
  flex: 0 0 auto;
  border-radius: 5px;
  background: var(--bg-card);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 750;
}

.ip-address {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ip-copy {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  color: var(--text-muted);
}

.ip-copy svg {
  width: 100%;
  height: 100%;
}

.latency-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 6px;
}

.latency-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 7px;
  background: var(--bg-subtle);
}

.latency-label {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
}

.ip-latency {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 54px;
  height: 20px;
  border-radius: 6px;
  background: var(--bg-card);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}

.latency-good {
  background: rgba(80, 227, 164, 0.12);
  color: #16a34a;
}

.latency-ok {
  background: rgba(245, 166, 35, 0.14);
  color: #d97706;
}

.latency-bad {
  background: rgba(238, 0, 0, 0.08);
  color: #dc2626;
}

.latency-none {
  color: var(--text-muted);
}
</style>
