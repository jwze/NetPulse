<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import DiagCard from '@/components/diagnostics/DiagCard.vue'
import { probeNat, type NatProbeResult } from '@/utils/webrtc'
import { fetchIpInfo } from '@/utils/ipInfo'

const result = ref<NatProbeResult | null>(null)
const running = ref(false)
const error = ref('')

const natChipClass = computed(() => {
  switch (result.value?.natType) {
    case 'open':
    case 'cone':
      return 'np-chip-success'
    case 'blocked':
    case 'unsupported':
      return 'np-chip-danger'
    default:
      return ''
  }
})

const doubleNatTone = computed(() => {
  if (result.value?.doubleNat === false) return 'good'
  if (result.value?.doubleNat === true) return 'ok'
  return ''
})

async function run() {
  if (running.value) return
  running.value = true
  error.value = ''
  try {
    const ipTask = fetchIpInfo().then(info => info.ip).catch(() => undefined)
    result.value = await probeNat(ipTask)
  } catch {
    error.value = '探测失败，浏览器可能禁用了 WebRTC 或拦截了 UDP'
  } finally {
    running.value = false
  }
}

onMounted(() => {
  void run()
})
</script>

<template>
  <DiagCard
    title="网络拓扑"
  >
    <template #action>
      <button class="np-btn-ghost" aria-label="重新探测" :disabled="running" @click="run">
        <svg class="w-[15px] h-[15px]" :class="{ 'np-spin': running }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </button>
    </template>

    <div v-if="running && !result" class="rtc-skeleton">
      <span class="skeleton-bar w-32" />
      <span class="skeleton-bar w-48" />
      <span class="skeleton-bar w-24" />
    </div>

    <p v-else-if="error" class="rtc-error">{{ error }}</p>

    <template v-else-if="result">
      <div class="rtc-headline">
        <span class="np-chip" :class="natChipClass">
          {{ result.natLabel }}
        </span>
        <span v-if="result.doubleNat !== null" class="np-chip" :class="doubleNatTone === 'good' ? 'np-chip-success' : ''">
          {{ result.doubleNatLabel }}
        </span>
        <span class="rtc-elapsed">{{ result.exitProtocol }} 出口 · {{ result.candidateCount }} 个候选 · {{ result.elapsed }}s</span>
      </div>

      <div class="rtc-grid">
        <dl class="np-kv-list">
          <div class="np-kv">
            <dt>内网地址</dt>
            <dd>
              <template v-if="result.localIps.length">{{ result.localIps.join(' · ') }}</template>
              <span v-else-if="result.mdnsHidden" class="rtc-muted">已被浏览器隐藏（mDNS）</span>
              <span v-else class="rtc-muted">未获取</span>
            </dd>
          </div>
          <div v-if="result.localV6.length" class="np-kv">
            <dt>IPv6 内网</dt>
            <dd>{{ result.localV6.join(' · ') }}</dd>
          </div>
          <div v-for="item in result.mappings" :key="item.key" class="np-kv">
            <dt>{{ item.label }} STUN</dt>
            <dd>{{ item.address }}:{{ item.port }}</dd>
          </div>
          <div v-if="!result.mappings.length" class="np-kv">
            <dt>STUN 映射</dt>
            <dd class="rtc-muted">无响应</dd>
          </div>
        </dl>

        <div class="rtc-side">
          <p v-if="result.natHint" class="rtc-note">{{ result.natHint }}</p>
          <p v-if="result.doubleNatReason" class="rtc-note">{{ result.doubleNatReason }}</p>
          <p v-if="result.mdnsHidden" class="rtc-note">mDNS 混淆，内网地址不可读</p>
        </div>
      </div>
    </template>

    <p v-else class="rtc-note">正在通过 STUN 探测本机网络环境…</p>
  </DiagCard>
</template>

<style scoped>
.rtc-headline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.rtc-elapsed {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 11px;
  font-family: var(--font-mono);
  white-space: nowrap;
}

.rtc-note {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.6;
}

.rtc-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px 32px;
  align-items: start;
}

.rtc-side {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 4px;
}

@media (min-width: 900px) {
  .rtc-grid {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  }
}

.rtc-muted {
  color: var(--text-muted);
  font-weight: 500;
}

.rtc-error {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.rtc-skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-bar {
  display: block;
  height: 12px;
  border-radius: var(--r-xs);
  background: var(--bg-subtle);
  animation: rtc-fade 1.4s ease-in-out infinite;
}

.w-24 { width: 96px; }
.w-32 { width: 128px; }
.w-48 { width: 192px; }

@keyframes rtc-fade {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
</style>
