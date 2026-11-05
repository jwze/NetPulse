<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import DiagCard from '@/components/diagnostics/DiagCard.vue'
import { runQualityTest, type QualityResult } from '@/utils/quality'
import { useHistoryStore } from '@/stores/history'

const history = useHistoryStore()

const COUNT = 20

const running = ref(false)
const progress = ref({ done: 0, total: COUNT, ms: null as number | null })
const result = ref<QualityResult | null>(null)
const error = ref('')
let controller: AbortController | null = null

const percent = computed(() => Math.round((progress.value.done / progress.value.total) * 100))

const bars = computed(() => {
  const samples = result.value?.samples ?? []
  const values = samples.map(item => item ?? 0)
  const max = Math.max(20, ...values) * 1.1
  return samples.map(item => {
    if (item === null) return { height: 8, tone: 'bad', label: '超时' }
    const height = Math.max(12, Math.round((item / max) * 100))
    // 只有需要提醒的样本才上色，其余保持中性，读起来才有主次
    const tone = item <= 60 ? 'norm' : item <= 150 ? 'ok' : 'bad'
    return { height, tone, label: `${item}ms` }
  })
})

async function start() {
  if (running.value) {
    controller?.abort()
    return
  }
  running.value = true
  error.value = ''
  result.value = null
  progress.value = { done: 0, total: COUNT, ms: null }
  controller = new AbortController()
  try {
    result.value = await runQualityTest({
      count: COUNT,
      interval: 250,
      signal: controller.signal,
      onProgress: (done, total, ms) => {
        progress.value = { done, total, ms }
      },
    })
    if (result.value.received > 0 && !controller.signal.aborted) {
      history.add({
        kind: 'quality',
        latency: result.value.avg,
        jitter: result.value.jitter,
        loss: result.value.loss,
        node: result.value.target,
      })
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '测试中断'
  } finally {
    running.value = false
  }
}

onMounted(() => {
  void start()
})

onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <DiagCard
    title="链路质量"
    :hint="result ? result.target : ''"
  >
    <template #action>
      <button class="np-btn-quiet q-btn" @click="start">
        {{ running ? '停止' : '开始测试' }}
      </button>
    </template>

    <div v-if="running" class="q-progress">
      <div class="q-bar"><span :style="{ width: `${percent}%` }" /></div>
      <div class="q-progress-text">
        <span>{{ progress.done }} / {{ progress.total }}</span>
        <span>{{ progress.ms === null ? '超时' : `${progress.ms} ms` }}</span>
      </div>
    </div>

    <template v-else-if="result">
      <div class="q-grid">
        <div class="q-cell">
          <span class="q-label">平均延迟</span>
          <span class="q-value" :class="`tone-${result.grade.tone}`">{{ result.avg }}<small>ms</small></span>
        </div>
        <div class="q-cell">
          <span class="q-label">抖动</span>
          <span class="q-value">{{ result.jitter }}<small>ms</small></span>
        </div>
        <div class="q-cell">
          <span class="q-label">丢包</span>
          <span class="q-value" :class="result.loss > 0 ? 'tone-bad' : ''">{{ result.loss }}<small>%</small></span>
        </div>
        <div class="q-cell">
          <span class="q-label">最低 / 最高</span>
          <span class="q-value q-range">{{ result.min }}<small>ms</small><span class="q-dash">/</span>{{ result.max }}<small>ms</small></span>
        </div>
      </div>

      <div class="q-spark" :aria-label="`${result.sent} 次探测的延迟分布`">
        <span
          v-for="(bar, index) in bars"
          :key="index"
          class="q-spark-bar"
          :class="`tone-${bar.tone}`"
          :style="{ height: `${bar.height}%` }"
          :title="bar.label"
        />
      </div>

      <p class="q-foot">
        <span class="q-grade" :class="`tone-${result.grade.tone}`">{{ result.grade.label }}</span>
        <span class="q-foot-text">共 {{ result.sent }} 次探测，收到 {{ result.received }} 次</span>
      </p>
    </template>

    <template v-else>
      <div class="q-grid">
        <div v-for="label in ['平均延迟', '抖动', '丢包', '最低 / 最高']" :key="label" class="q-cell">
          <span class="q-label">{{ label }}</span>
          <span class="q-value q-idle">—</span>
        </div>
      </div>
      <p class="q-tip">
        连续发送 20 个小请求测量往返延迟。抖动反映稳定性，丢包会直接体现为超时；两者比单次延迟更影响游戏与会议体验。
      </p>
    </template>

    <p v-if="error" class="q-error">{{ error }}</p>
  </DiagCard>
</template>

<style scoped>
.q-btn {
  height: 26px;
  padding: 0 10px;
  font-size: 11px;
}

.q-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}

.q-bar {
  height: 3px;
  border-radius: 1px;
  background: var(--bg-subtle);
  overflow: hidden;
}

.q-bar span {
  display: block;
  height: 100%;
  background: var(--trace);
  transition: width var(--dur) linear;
}

.q-progress-text {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.q-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (min-width: 720px) {
  .q-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.q-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 0 0 8px;
}

@media (min-width: 720px) {
  .q-cell {
    padding: 0 0 0 16px;
    border-left: 1px solid var(--border-subtle);
  }

  .q-cell:first-child {
    padding-left: 0;
    border-left: none;
  }
}

@media (max-width: 719px) {
  .q-cell {
    padding-bottom: 12px;
  }

  .q-cell:nth-child(even) {
    padding-left: 16px;
  }
}

.q-label {
  color: var(--text-muted);
  font-size: 11px;
}

.q-value {
  display: flex;
  align-items: baseline;
  gap: 2px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.q-value small {
  font-size: 10px;
  font-weight: 400;
  color: var(--text-muted);
}

.q-range {
  font-size: 14px;
  gap: 3px;
}

.q-idle {
  color: var(--text-muted);
}

.q-dash {
  color: var(--border-strong);
}

.q-spark {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 40px;
  padding-top: 8px;
  border-bottom: 1px solid var(--border-subtle);
}

.q-spark-bar {
  flex: 1 1 0;
  min-width: 2px;
  background: currentColor;
  transition: height var(--dur) var(--ease);
}

.q-spark-bar.tone-norm {
  color: var(--text-muted);
  opacity: 0.45;
}

.q-spark-bar.tone-ok {
  color: var(--tone-warn);
}

.q-spark-bar.tone-bad {
  color: var(--tone-bad);
}

.q-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.q-grade {
  font-size: 11px;
}

.q-grade.tone-good { color: var(--tone-good); }
.q-grade.tone-ok { color: var(--tone-warn); }
.q-grade.tone-bad { color: var(--tone-bad); }

.q-foot-text {
  color: var(--text-muted);
  font-size: 11px;
}

.q-tip,
.q-error {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.6;
}

.q-error {
  color: var(--tone-bad);
}
</style>
