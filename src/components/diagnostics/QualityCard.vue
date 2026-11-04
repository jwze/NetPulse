<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import DiagCard from '@/components/diagnostics/DiagCard.vue'
import { runQualityTest, type QualityResult } from '@/utils/quality'

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
    const tone = item <= 60 ? 'good' : item <= 150 ? 'ok' : 'bad'
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
  } catch (err) {
    error.value = err instanceof Error ? err.message : '测试中断'
  } finally {
    running.value = false
  }
}

onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <DiagCard
    title="链路质量"
    :hint="result ? result.target : '延迟 / 抖动 / 丢包'"
    icon="M3 12h4l2-6 4 12 3-8h5"
  >
    <template #action>
      <button class="np-btn-primary q-btn" @click="start">
        {{ running ? '停止' : '开始测试' }}
      </button>
    </template>

    <div v-if="running" class="q-progress">
      <div class="q-bar"><span :style="{ width: `${percent}%` }" /></div>
      <div class="q-progress-text">
        <span>{{ progress.done }}/{{ progress.total }}</span>
        <span class="mono">{{ progress.ms === null ? '超时' : `${progress.ms}ms` }}</span>
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
          <span class="q-value q-range">{{ result.min }}<small>ms</small> <span class="q-dash">/</span> {{ result.max }}<small>ms</small></span>
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
        <span class="np-chip" :class="result.grade.tone === 'bad' ? 'np-chip-danger' : 'np-chip-success'">{{ result.grade.label }}</span>
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
  height: 30px;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
}

.q-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px 0;
}

.q-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--bg-subtle);
  overflow: hidden;
}

.q-bar span {
  display: block;
  height: 100%;
  background: var(--color-accent);
  transition: width 0.25s ease;
}

.q-progress-text {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-muted);
  font-size: 11px;
}

.q-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.q-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 9px 11px;
  border-radius: 6px;
  background: var(--bg-subtle);
}

.q-label {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
}

.q-value {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.q-value small {
  margin-left: 1px;
  font-size: 11px;
  font-weight: 600;
  opacity: 0.6;
}

.q-range {
  font-size: 14px;
}

.q-idle {
  color: var(--text-muted);
  font-weight: 600;
}

.q-dash {
  opacity: 0.35;
}

.q-spark {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 44px;
  padding: 0 1px;
}

.q-spark-bar {
  flex: 1 1 0;
  min-width: 2px;
  border-radius: 2px 2px 0 0;
  background: currentColor;
  opacity: 0.7;
  transition: height 0.3s ease;
}

.q-spark-bar:hover {
  opacity: 1;
}

.q-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.q-foot-text {
  color: var(--text-muted);
  font-size: 11px;
}

.q-tip,
.q-error {
  color: var(--text-muted);
  font-size: 11.5px;
  line-height: 1.6;
}

.q-error {
  color: var(--color-danger);
}

.mono {
  font-family: var(--font-mono);
}
</style>
