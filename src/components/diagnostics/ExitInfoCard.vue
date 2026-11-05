<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useClipboard } from '@vueuse/core'
import DiagCard from '@/components/diagnostics/DiagCard.vue'
import { fetchIpInfo, type IpInfo } from '@/utils/ipInfo'
import { probeDualStack, type StackProbe } from '@/utils/dualStack'

const { copy, copied } = useClipboard()
const info = ref<IpInfo | null>(null)
const stacks = ref<StackProbe[]>([])
const loading = ref(true)
const stackLoading = ref(true)
const error = ref('')

async function loadInfo() {
  loading.value = true
  error.value = ''
  try {
    info.value = await fetchIpInfo()
  } catch {
    error.value = '出口信息获取失败，接口可能被网络环境拦截'
  } finally {
    loading.value = false
  }
}

async function loadStacks() {
  stackLoading.value = true
  stacks.value = await probeDualStack()
  stackLoading.value = false
}

function refresh() {
  void loadInfo()
  void loadStacks()
}

function copyIp() {
  if (info.value?.ip) void copy(info.value.ip)
}

function copyStack(address: string) {
  if (address) void copy(address)
}

function isCurrent(stack: StackProbe) {
  return !!info.value && info.value.version === stack.family
}

const stackRows = computed<StackProbe[]>(() => {
  if (!stackLoading.value) return stacks.value
  return [
    { family: 'IPv4', ok: false, address: '', ms: null },
    { family: 'IPv6', ok: false, address: '', ms: null },
  ]
})

const ipFlags = () => {
  const item = info.value
  if (!item) return []
  const flags: { label: string; tone: 'ok' | 'bad' | '' }[] = []
  if (item.isHosting) flags.push({ label: '数据中心', tone: 'ok' })
  if (item.isProxy) flags.push({ label: '代理', tone: 'bad' })
  if (item.isVpn) flags.push({ label: 'VPN', tone: 'bad' })
  if (item.isTor) flags.push({ label: 'Tor', tone: 'bad' })
  return flags
}

onMounted(() => {
  void loadInfo()
  void loadStacks()
})
</script>

<template>
  <DiagCard
    title="出口地址"
  >
    <template #action>
      <button class="np-btn-ghost" aria-label="刷新出口信息" :disabled="loading" @click="refresh">
        <svg class="w-[15px] h-[15px]" :class="{ 'np-spin': loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </button>
    </template>

    <div v-if="loading && !info" class="ip-skeleton">
      <span class="skeleton-bar w-40" />
      <span class="skeleton-bar w-28" />
    </div>

    <p v-else-if="error && !info" class="ip-error">
      {{ error }}
      <button class="np-btn-ghost ip-retry" @click="refresh">重试</button>
    </p>

    <template v-else>
      <div class="ip-main">
        <button class="ip-value" :title="info?.ip" @click="copyIp">
          {{ info?.ip || '—' }}
          <span v-if="copied" class="ip-copied">已复制</span>
        </button>
        <div class="ip-chips">
          <span v-if="info" class="np-chip">{{ info.version }}</span>
          <span
            v-for="flag in ipFlags()"
            :key="flag.label"
            class="np-chip"
            :class="flag.tone === 'bad' ? 'np-chip-danger' : 'np-chip-success'"
          >{{ flag.label }}</span
          >
        </div>
      </div>

      <dl class="np-kv-list">
        <div class="np-kv">
          <dt>归属</dt>
          <dd>{{ info?.displayAddress || '—' }}</dd>
        </div>
        <div v-if="info?.asn" class="np-kv">
          <dt>ASN</dt>
          <dd>AS{{ info.asn }}<span v-if="info.asnOrg" class="kv-sub"> · {{ info.asnOrg }}</span></dd>
        </div>
        <div class="np-kv">
          <dt>时区</dt>
          <dd>{{ info?.timezone ? `${info.timezone} ${info.utcOffset}` : '—' }}</dd>
        </div>
        <div class="np-kv">
          <dt>数据来源</dt>
          <dd>{{ info?.source || '—' }}</dd>
        </div>
      </dl>
    </template>

    <div class="stack-row">
      <div
        v-for="stack in stackRows"
        :key="stack.family"
        class="stack-item"
        :class="{ 'is-current': !stackLoading && stack.ok && isCurrent(stack) }"
      >
        <span class="stack-label">
          {{ stack.family }}
          <em v-if="!stackLoading && stack.ok && isCurrent(stack)">当前</em>
        </span>
        <span v-if="stackLoading" class="stack-value tone-none">检测中</span>
        <button
          v-else-if="stack.ok"
          class="stack-addr font-mono"
          :title="`${stack.address}（${stack.ms}ms），点击复制`"
          @click="copyStack(stack.address)"
        >{{ stack.address }}</button>
        <span v-else class="stack-value tone-none">不可用</span>
        <span v-if="!stackLoading && stack.ok" class="stack-ms font-mono">{{ stack.ms }}ms</span>
      </div>
    </div>
  </DiagCard>
</template>

<style scoped>
.ip-skeleton {
  display: flex;
  gap: 10px;
  padding: 6px 0;
}

.skeleton-bar {
  height: 22px;
  border-radius: var(--r-xs);
  background: var(--bg-subtle);
}

.ip-error {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
}

.ip-retry {
  width: auto;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-secondary);
}

.ip-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.ip-value {
  position: relative;
  min-width: 0;
  max-width: 100%;
  border: none;
  background: transparent;
  padding: 0;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: clamp(15px, 3.4vw, 19px);
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.25;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.ip-value:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: var(--border-strong);
}

.ip-copied {
  margin-left: 8px;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
}

.ip-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.kv-sub {
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-weight: 500;
}

.stack-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.stack-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  background: transparent;
}

.stack-item.is-current {
  border-color: var(--border);
  background: var(--bg-subtle);
}

.stack-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 400;
  white-space: nowrap;
}

.stack-label em {
  color: var(--tone-good);
  font-size: 10px;
  font-style: normal;
  font-weight: 400;
  line-height: 1.6;
}

.stack-addr {
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.35;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.stack-addr:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.stack-ms {
  color: var(--text-muted);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.stack-value {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 560px) {
  .stack-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
