<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePanelStore } from '@/stores/panel'

const panel = usePanelStore()
const predictOpen = ref(false)

const emit = defineEmits<{
  (e: 'setFlowMax'): void
  (e: 'setLimitMax'): void
}>()

function handleResetTraffic() {
  panel.resetTraffic()
}

/** 「12.4GB」拆成数字与单位，数字用等宽，单位退到小字 */
function splitUnit(text: string) {
  const raw = (text || '').trim()
  if (!raw || raw === '-') return { value: '—', unit: '' }
  const matched = raw.match(/^([\d.]+)(.*)$/)
  if (!matched) return { value: raw, unit: '' }
  return { value: matched[1], unit: matched[2] }
}

const total = computed(() => splitUnit(panel.show.allUsed))
const speed = computed(() => splitUnit(panel.show.speed))
const bandwidth = computed(() => splitUnit(panel.show.speedBit))
const runTime = computed(() => ({ value: panel.runTimeShow || '00s', unit: '' }))
</script>

<template>
  <div class="readings">
    <div class="reading" role="button" tabindex="0" @click="emit('setFlowMax')" @keydown.enter="emit('setFlowMax')">
      <span class="np-label">总流量</span>
      <p class="reading-value">
        <span class="np-num">{{ total.value }}</span>
        <span v-if="total.unit" class="unit">{{ total.unit }}</span>
      </p>
      <div class="reading-foot">
        <span>累计下载</span>
        <button
          class="reset"
          type="button"
          :disabled="panel.bytesUsed <= 0"
          @click.stop="handleResetTraffic"
        >
          重置
        </button>
      </div>
    </div>

    <div
      class="reading speed-reading"
      role="button"
      tabindex="0"
      @mouseenter="predictOpen = true"
      @mouseleave="predictOpen = false"
      @focus="predictOpen = true"
      @blur="predictOpen = false"
      @click="predictOpen = !predictOpen"
    >
      <span class="np-label">{{ panel.isRunning ? '实时速度' : '平均速度' }}</span>
      <p class="reading-value" :class="{ live: panel.isRunning }">
        <span class="np-num">{{ speed.value }}</span>
        <span v-if="speed.unit" class="unit">{{ speed.unit }}</span>
      </p>
      <div class="reading-foot">
        <span v-if="panel.isRunning" class="np-live-dot" />
        <span>{{ panel.isRunning ? '正在采样' : '已停止' }}</span>
      </div>

      <Transition name="predict-pop">
        <div v-if="predictOpen" class="predict-panel" @click.stop>
          <span class="predict-title">按当前速度估算用量</span>
          <dl class="predict-grid">
            <div><dt>每分钟</dt><dd>{{ panel.predict.min }}</dd></div>
            <div><dt>每小时</dt><dd>{{ panel.predict.hour }}</dd></div>
            <div><dt>每天</dt><dd>{{ panel.predict.day }}</dd></div>
            <div><dt>每月</dt><dd>{{ panel.predict.mon }}</dd></div>
          </dl>
        </div>
      </Transition>
    </div>

    <div class="reading" role="button" tabindex="0" @click="emit('setLimitMax')" @keydown.enter="emit('setLimitMax')">
      <span class="np-label">带宽</span>
      <p class="reading-value">
        <span class="np-num">{{ bandwidth.value }}</span>
        <span v-if="bandwidth.unit" class="unit">{{ bandwidth.unit }}</span>
      </p>
      <div class="reading-foot"><span>峰值吞吐</span></div>
    </div>

    <div class="reading">
      <span class="np-label">运行时长</span>
      <p class="reading-value">
        <span class="np-num">{{ runTime.value }}</span>
      </p>
      <div class="reading-foot"><span>本次会话</span></div>
    </div>
  </div>
</template>

<style scoped>
.readings {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 1px solid var(--border-subtle);
}

@media (min-width: 720px) {
  .readings {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.reading {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 14px 0 0;
  cursor: pointer;
}

@media (min-width: 720px) {
  .reading {
    padding: 14px 20px 0;
    border-left: 1px solid var(--border-subtle);
  }

  .reading:first-child {
    padding-left: 0;
    border-left: none;
  }
}

@media (max-width: 719px) {
  .reading {
    padding: 12px 0 0;
  }

  .reading:nth-child(even) {
    padding-left: 16px;
    border-left: 1px solid var(--border-subtle);
  }

  .reading:nth-child(n + 3) {
    margin-top: 12px;
    border-top: 1px solid var(--border-subtle);
    padding-top: 12px;
  }
}

.reading-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 20px;
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.1;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: color var(--dur-fast) var(--ease);
}

.reading-value.live {
  color: var(--trace);
}

.unit {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0;
}

.reading-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 16px;
  color: var(--text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.reading:hover .np-label {
  color: var(--text-secondary);
}

.reset {
  margin-left: auto;
  padding: 0;
  border: none;
  background: none;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 11px;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: var(--border-strong);
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease);
}

.reset:hover:not(:disabled) {
  color: var(--text-primary);
}

.reset:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.speed-reading {
  outline: none;
}

.predict-panel {
  position: absolute;
  left: 0;
  top: calc(100% + 8px);
  z-index: 30;
  width: min(260px, calc(100vw - 40px));
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-md);
}

.predict-title {
  display: block;
  margin-bottom: 8px;
  color: var(--text-muted);
  font-size: 11px;
}

.predict-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}

.predict-grid dt {
  color: var(--text-muted);
  font-size: 11px;
}

.predict-grid dd {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.predict-pop-enter-active,
.predict-pop-leave-active {
  transition: opacity var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease);
}

.predict-pop-enter-from,
.predict-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
