<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import DiagCard from '@/components/diagnostics/DiagCard.vue'
import {
  DNS_TYPES,
  answersSignature,
  isValidDomain,
  normalizeDomain,
  queryAll,
  statusText,
  type DnsRecordType,
  type DnsResult,
} from '@/utils/doh'

const PRESETS = ['baidu.com', 'github.com', 'cloudflare.com', 'example.com']

const domain = ref('baidu.com')
const recordType = ref<DnsRecordType>('A')
const results = ref<DnsResult[]>([])
const loading = ref(false)
const error = ref('')
let controller: AbortController | null = null

const summary = computed(() => {
  const ok = results.value.filter(item => item.ok && item.status === 0)
  if (!ok.length) return null
  const signatures = new Set(ok.map(item => answersSignature(item.answers)))
  const comparable = ok.filter(item => item.answers.length > 0).length
  return {
    reachable: results.value.filter(item => item.ok).length,
    total: results.value.length,
    /** 少于两家返回记录时不下「一致」的结论 */
    comparable,
    consistent: comparable >= 2 ? signatures.size === 1 : null,
  }
})

async function run() {
  const name = normalizeDomain(domain.value)
  if (!isValidDomain(name)) {
    error.value = '域名格式不正确，请输入类似 example.com 的域名'
    return
  }
  domain.value = name
  error.value = ''
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  results.value = []
  try {
    results.value = await queryAll(name, recordType.value, 6000, controller.signal)
  } finally {
    loading.value = false
  }
}

function pickPreset(value: string) {
  domain.value = value
  void run()
}

function pickType(type: DnsRecordType) {
  recordType.value = type
  if (results.value.length) void run()
}

onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <DiagCard
    title="DNS 解析对比"
    hint="DoH 直查，非本机 DNS"
    icon="M3 12h18 M12 3a15 15 0 0 1 0 18 M12 3a15 15 0 0 0 0 18 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"
  >
    <template #action>
      <button class="np-btn-primary dns-run" :disabled="loading" @click="run">
        <span v-if="loading" class="dns-spinner np-spin" />
        {{ loading ? '查询中' : '查询' }}
      </button>
    </template>

    <div class="dns-form">
      <input
        v-model="domain"
        class="dns-input"
        type="text"
        inputmode="url"
        spellcheck="false"
        placeholder="example.com"
        @keyup.enter="run"
      />
      <div class="dns-types">
        <button
          v-for="type in DNS_TYPES"
          :key="type"
          class="dns-type"
          :class="{ 'is-active': recordType === type }"
          @click="pickType(type)"
        >{{ type }}</button>
      </div>
    </div>

    <div class="dns-presets">
      <span class="preset-label">试试</span>
      <button v-for="item in PRESETS" :key="item" class="preset" @click="pickPreset(item)">{{ item }}</button>
    </div>

    <p v-if="error" class="dns-error">{{ error }}</p>

    <div v-if="results.length" class="dns-summary">
      <span
        v-if="summary && summary.consistent !== null"
        class="np-chip"
        :class="summary.consistent ? 'np-chip-success' : 'np-chip-danger'"
      >{{ summary.consistent ? '各家结果一致' : '存在解析差异' }}</span>
      <span
        v-else-if="summary"
        class="np-chip"
      >仅 1 家返回记录</span>
      <span class="summary-text">
        {{ summary ? `${summary.reachable}/${summary.total} 家可用` : '全部解析器不可达' }}
      </span>
    </div>

    <div v-if="results.length" class="dns-list">
      <div v-for="item in results" :key="item.providerId" class="dns-item">
        <div class="dns-item-head">
          <div class="dns-item-name">
            <span class="dns-provider">{{ item.label }}</span>
            <span class="dns-hint">{{ item.hint }}</span>
          </div>
          <div class="dns-item-state">
            <span v-if="!item.ok" class="np-chip np-chip-danger">{{ item.error }}</span>
            <template v-else>
              <span class="np-chip">{{ statusText(item.status) }}</span>
              <span v-if="item.ms !== null" class="dns-ms">{{ item.ms }}ms</span>
            </template>
          </div>
        </div>

        <ul v-if="item.answers.length" class="dns-answers">
          <li v-for="(answer, index) in item.answers" :key="`${answer.name}-${index}`" class="dns-answer">
            <span class="answer-type">{{ answer.type }}</span>
            <span class="answer-data" :title="answer.data">{{ answer.data }}</span>
            <span class="answer-ttl">{{ answer.ttl }}s</span>
          </li>
        </ul>
        <p v-else-if="item.ok" class="dns-empty">
          {{ item.status === 3 ? '该域名在递归链上不存在（NXDOMAIN）' : '没有返回记录' }}
        </p>
      </div>
    </div>

    <p v-else-if="!loading" class="dns-tip">
      对比同一域名在国内外递归解析器上的结果：差异通常来自 CDN 调度就近返回，也可能是本地 DNS 被污染或劫持。
    </p>
  </DiagCard>
</template>

<style scoped>
.dns-run {
  height: 30px;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
}

.dns-spinner {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  border-top-color: transparent;
}

.dns-form {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.dns-input {
  flex: 1 1 240px;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;
}

.dns-input:focus {
  border-color: var(--text-muted);
}

.dns-types {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-subtle);
}

.dns-type {
  min-width: 38px;
  height: 26px;
  padding: 0 6px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.dns-type:hover {
  color: var(--text-primary);
}

.dns-type.is-active {
  background: var(--bg-card);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.dns-presets {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.preset-label {
  color: var(--text-muted);
  font-size: 11px;
}

.preset {
  padding: 2px 7px;
  border: 1px dashed var(--border);
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}

.preset:hover {
  border-style: solid;
  color: var(--text-primary);
}

.dns-error {
  color: var(--color-danger);
  font-size: 12px;
}

.dns-summary {
  display: flex;
  align-items: center;
  gap: 8px;
}

.summary-text {
  color: var(--text-muted);
  font-size: 11px;
}

.dns-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dns-item {
  padding: 10px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-subtle);
}

.dns-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.dns-item-name {
  display: flex;
  align-items: baseline;
  gap: 7px;
  min-width: 0;
}

.dns-provider {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 650;
}

.dns-hint {
  color: var(--text-muted);
  font-size: 10px;
}

.dns-item-state {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.dns-ms {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.dns-answers {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.dns-answer {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.answer-type {
  flex: 0 0 auto;
  width: 42px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
}

.answer-data {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.answer-ttl {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
}

.dns-empty,
.dns-tip {
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 11.5px;
  line-height: 1.6;
}
</style>
