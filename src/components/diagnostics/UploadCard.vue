<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import DiagCard from '@/components/diagnostics/DiagCard.vue'
import { runUploadTest, type UploadProgress, type UploadResult } from '@/utils/uploadTest'
import { useHistoryStore } from '@/stores/history'

const history = useHistoryStore()

const running = ref(false)
const live = ref<UploadProgress | null>(null)
const result = ref<UploadResult | null>(null)
const error = ref('')
let controller: AbortController | null = null

const mbps = computed(() => {
  if (running.value) return live.value?.mbps ?? 0
  return result.value?.mbps ?? null
})

const readout = computed(() => (mbps.value === null ? '0.0' : mbps.value.toFixed(1)))

const ratio = computed(() => {
  if (running.value) return Math.round((live.value?.ratio ?? 0) * 100)
  return result.value ? 100 : 0
})

function formatMBps(value: number) {
  return `${(value / 8).toFixed(2)} MB/s`
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

const bytesText = computed(() => {
  if (running.value) return live.value ? formatBytes(live.value.bytes) : '0 KB'
  return result.value ? formatBytes(result.value.bytes) : '—'
})

const requestsText = computed(() => (result.value && !running.value ? `${result.value.requests} 次` : '—'))

const secondsText = computed(() => {
  if (running.value) return live.value ? `${live.value.seconds.toFixed(1)} s` : '0.0 s'
  return result.value ? `${result.value.seconds.toFixed(1)} s` : '—'
})

async function start() {
  if (running.value) {
    controller?.abort()
    return
  }
  running.value = true
  error.value = ''
  result.value = null
  live.value = null
  controller = new AbortController()
  try {
    result.value = await runUploadTest({
      duration: 8000,
      concurrency: 4,
      signal: controller.signal,
      onProgress: (state) => {
        live.value = state
      },
    })
    history.add({
      kind: 'upload',
      mbps: result.value.mbps,
      bytes: result.value.bytes,
      seconds: result.value.seconds,
      node: 'Cloudflare — __up',
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : '上传测试失败'
  } finally {
    running.value = false
  }
}

onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <DiagCard title="上传测速">
    <template #action>
      <button class="np-btn-primary up-btn" :class="{ live: running }" @click="start">
        {{ running ? '停止' : '开始测速' }}
      </button>
    </template>

    <div class="up-body">
      <div class="up-readout">
        <span class="up-value" :class="{ idle: mbps === null, live: running }">{{ readout }}</span>
        <span class="up-unit">Mbps</span>
        <span v-if="mbps !== null" class="up-alt">{{ formatMBps(mbps) }}</span>
      </div>

      <div class="up-scale">
        <span class="up-fill" :style="{ width: `${ratio}%` }" />
      </div>

      <div class="up-metrics">
        <div class="up-metric">
          <span class="up-metric-label">已上传</span>
          <span class="up-metric-value">{{ bytesText }}</span>
        </div>
        <div class="up-metric">
          <span class="up-metric-label">请求数</span>
          <span class="up-metric-value">{{ requestsText }}</span>
        </div>
        <div class="up-metric">
          <span class="up-metric-label">用时</span>
          <span class="up-metric-value">{{ secondsText }}</span>
        </div>
      </div>

      <p v-if="error" class="up-error">{{ error }}</p>
    </div>
  </DiagCard>
</template>

<style scoped>
.up-btn {
  height: 30px;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--r-sm);
}

.up-btn.live {
  background: var(--tone-bad);
  border-color: var(--tone-bad);
}

.up-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.up-readout {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.up-value {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 40px;
  font-weight: 400;
  line-height: 1;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}

.up-unit {
  color: var(--text-secondary);
  font-size: 12px;
}

.up-value.idle {
  color: var(--text-muted);
  opacity: 0.45;
}

.up-value.live {
  color: var(--trace);
}

.up-alt {
  margin-left: 6px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
}

/* 上行占用带：跑起来才填，停止后留满格 */
.up-scale {
  position: relative;
  height: 5px;
  border-radius: var(--r-xs);
  background: var(--bg-subtle);
  overflow: hidden;
}

/* 分格刻度：静止时也看得出量程 */
.up-scale::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    90deg,
    var(--border) 0 1px,
    transparent 1px 10%
  );
}

.up-fill {
  display: block;
  height: 100%;
  border-radius: var(--r-xs);
  background: var(--trace);
  transition: width 0.2s linear;
}

.up-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}

.up-metric {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.up-metric + .up-metric {
  padding-left: 16px;
  border-left: 1px solid var(--border-subtle);
}

.up-metric-label {
  color: var(--text-muted);
  font-size: 10px;
}

.up-metric-value {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.up-error {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.6;
}

.up-error {
  color: var(--tone-bad);
}
</style>
