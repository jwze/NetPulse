<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import DiagCard from '@/components/diagnostics/DiagCard.vue'
import { runUploadTest, type UploadProgress, type UploadResult } from '@/utils/uploadTest'
import { useHistoryStore } from '@/stores/history'

const history = useHistoryStore()

const running = ref(false)
const live = ref<UploadProgress | null>(null)
const result = ref<UploadResult | null>(null)
const error = ref('')
let controller: AbortController | null = null

function formatMBps(mbps: number) {
  return (mbps / 8).toFixed(2)
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

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
  <DiagCard title="上传测速" hint="Cloudflare 节点" icon="M12 19V5 M5 12l7-7 7 7">
    <template #action>
      <button class="np-btn-primary up-btn" @click="start">
        {{ running ? '停止' : '开始测速' }}
      </button>
    </template>

    <div v-if="running" class="up-live">
      <div class="up-value">
        {{ live ? live.mbps.toFixed(1) : '0.0' }}<small>Mbps</small>
      </div>
      <div class="up-bar"><span :style="{ width: `${Math.round((live?.ratio ?? 0) * 100)}%` }" /></div>
      <div class="up-meta">
        <span>{{ live ? formatBytes(live.bytes) : '0 KB' }}</span>
        <span>{{ live ? `${live.seconds.toFixed(1)}s` : '0.0s' }}</span>
      </div>
    </div>

    <template v-else-if="result">
      <div class="up-result">
        <div class="up-value">
          {{ result.mbps.toFixed(1) }}<small>Mbps</small>
        </div>
        <div class="up-sub">{{ formatMBps(result.mbps) }} MB/s</div>
      </div>
      <dl class="np-kv-list">
        <div class="np-kv">
          <dt>已上传</dt>
          <dd>{{ formatBytes(result.bytes) }}</dd>
        </div>
        <div class="np-kv">
          <dt>请求数</dt>
          <dd>{{ result.requests }} 次</dd>
        </div>
        <div class="np-kv">
          <dt>用时</dt>
          <dd>{{ result.seconds.toFixed(1) }} s</dd>
        </div>
      </dl>
    </template>

    <p v-else class="up-tip">
      向 Cloudflare 测速端点并发上传数据块，估算上行带宽。上行决定直播、云盘与视频会议的画质上限。
    </p>

    <p v-if="error" class="up-error">{{ error }}</p>
  </DiagCard>
</template>

<style scoped>
.up-btn {
  height: 30px;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
}

.up-live {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0 2px;
}

.up-value {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.up-value small {
  margin-left: 4px;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.55;
}

.up-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--bg-subtle);
  overflow: hidden;
}

.up-bar span {
  display: block;
  height: 100%;
  background: var(--color-accent);
  transition: width 0.2s linear;
}

.up-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
}

.up-result {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.up-sub {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
}

.up-tip,
.up-error {
  color: var(--text-muted);
  font-size: 11.5px;
  line-height: 1.6;
}

.up-error {
  color: var(--color-danger);
}
</style>
