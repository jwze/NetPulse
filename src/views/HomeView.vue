<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { NSelect, useMessage } from 'naive-ui'
import { useNodesStore } from '@/stores/nodes'
import { usePanelStore } from '@/stores/panel'
import { useSettingsStore } from '@/stores/settings'
import { useNetworkStore } from '@/stores/network'
import { useSpeedRunner } from '@/composables/useSpeedRunner'
import { useFormatter } from '@/composables/useFormatter'
import { validateSpeedNodeUrl } from '@/utils/nodeConnectivity'
import NetworkPanel from '@/components/panel/NetworkPanel.vue'
import RealtimeChart from '@/components/chart/RealtimeChart.vue'
import ExitIpInfo from '@/components/ip/ExitIpInfo.vue'
import StatsRow from '@/components/panel/StatsRow.vue'
import BufferbloatCard from '@/components/panel/BufferbloatCard.vue'
import ShareCardModal from '@/components/panel/ShareCardModal.vue'
import ScreenSaver from '@/components/screensaver/ScreenSaver.vue'
import PulseLine from '@/components/ui/PulseLine.vue'
import Icon from '@/components/ui/Icon.vue'

const nodesStore = useNodesStore()
const panel = usePanelStore()
const settings = useSettingsStore()
const networkStore = useNetworkStore()
const message = useMessage()
const { formatSpeed, formatBandwidth } = useFormatter()

watch(() => panel.lastError, (err) => {
  if (err) message.error(err)
})

watch(() => panel.lastWarning, (warn) => {
  if (warn) {
    message.warning(warn, { duration: 0, closable: true })
    panel.lastWarning = ''
  }
})

watch(() => nodesStore.lastNodeSwitchReason, (reason) => {
  if (reason) {
    message.error(reason)
    nodesStore.lastNodeSwitchReason = ''
  }
})

const chartRef = ref<InstanceType<typeof RealtimeChart> | null>(null)
const screenOpen = ref(false)
const cardOpen = ref(false)
const limitDialog = ref<'flow' | 'speed' | null>(null)
const limitValue = ref<number | null>(null)
const limitUnit = ref('GB')
const limitUnitOptions = computed(() => (
  limitDialog.value === 'flow'
    ? [
        { label: 'MB', value: 'MB' },
        { label: 'GB', value: 'GB' },
        { label: 'TB', value: 'TB' },
      ]
    : [
        { label: 'Kbps', value: 'Kbps' },
        { label: 'Mbps', value: 'Mbps' },
        { label: 'Gbps', value: 'Gbps' },
      ]
))

const runner = useSpeedRunner()

const statusLabel = computed(() => {
  if (panel.isChecking) return '检测节点中'
  return panel.isRunning ? '测速中' : '待命'
})

/** 大读数：数字走等宽，单位退到小字（格式化结果形如 12.3MB/s） */
const speedParts = computed(() => {
  const text = formatSpeed(panel.speed)
  if (text === '-') return { value: '0', unit: 'B/s' }
  const matched = text.match(/^([\d.]+)(.*)$/)
  if (!matched) return { value: text, unit: '' }
  return { value: matched[1], unit: matched[2] }
})

const speedBits = computed(() => (panel.speed > 0 ? `≈ ${formatBandwidth(panel.speed * 8)}` : '尚未开始'))

const latencyNow = computed(() => panel.latencyNow || networkStore.localLatencyMs || 0)

const nodeLabel = computed(() => {
  if (settings.groupMode) return settings.groupValue || '节点组'
  for (const nodes of Object.values(nodesStore.groupedNodes)) {
    const hit = nodes.find(node => node.url === settings.urlValue)
    if (hit) return hit.title
  }
  if (settings.urlValue) return settings.urlValue.replace(/^https?:\/\//, '').split('/')[0]
  return '默认节点'
})

function handleToggleRun() {
  void runner.tryStart()
}

function handleOpenScreen() {
  screenOpen.value = true
}

function handleSetFlowMax() {
  limitDialog.value = 'flow'
  limitValue.value = null
  limitUnit.value = 'GB'
}

function handleSetLimitMax() {
  limitDialog.value = 'speed'
  limitValue.value = null
  limitUnit.value = 'Mbps'
}

function saveLimit() {
  const value = Math.max(0, Number(limitValue.value) || 0)
  if (limitDialog.value === 'flow') {
    const map: Record<string, number> = {
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
      TB: 1024 * 1024 * 1024 * 1024,
    }
    settings.maxUse = Math.floor(value * map[limitUnit.value])
  } else if (limitDialog.value === 'speed') {
    const map: Record<string, number> = {
      Kbps: 1024,
      Mbps: 1024 * 1024,
      Gbps: 1024 * 1024 * 1024,
    }
    settings.maxSpeed = Math.floor(value * map[limitUnit.value])
  }
  limitDialog.value = null
}

onMounted(() => {
  runner.init()
  runner.setChartTarget(chartRef.value)
  void nodesStore.fetchNodes().then(() => {
    if (settings.autoStart) void runner.tryStart()
  })
  window.addEventListener('paste', handlePaste)
})

onUnmounted(() => {
  runner.destroy()
  window.removeEventListener('paste', handlePaste)
})

function parseUrl(text: string): string {
  const match = text.match(/https?:\/\/([\w-]+\.)+[\w-]+(:[0-9]+)?(\/\S*)?/)
  return match ? match[0] : ''
}

async function handlePaste(e: ClipboardEvent) {
  const target = e.target as HTMLElement | null
  if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return
  const text = e.clipboardData?.getData('text') || ''
  const url = parseUrl(text)
  if (!url) return

  message.info('读取剪切板链接，正在检测可用性...')
  const result = await validateSpeedNodeUrl(url)
  if (result.status) {
    settings.urlValue = url
    message.success('链接可用，已设为当前测速节点')
  } else {
    message.error(`链接不可用：${result.info}`)
  }
}
</script>

<template>
  <div class="np-shell page">
    <header class="page-head">
      <div class="page-head-main">
        <h1 class="np-page-title">测速台</h1>
        <p class="np-page-sub">浏览器内并发下载，逐秒描出真实吞吐；节点与结果只留在本机</p>
      </div>

      <div class="run-state" :class="{ live: panel.isRunning }">
        <PulseLine :live="panel.isRunning" :width="48" :height="14" />
        <span class="state-text">{{ statusLabel }}</span>
        <span class="state-time">{{ panel.runTimeShow }}</span>
      </div>
    </header>

    <div class="home-grid">
      <section class="np-card instrument">
        <header class="instrument-head">
          <span class="np-label">{{ panel.isRunning ? '实时速率' : '当前速率' }}</span>
          <span class="node-name" :title="nodeLabel">{{ nodeLabel }}</span>
        </header>

        <div class="readout">
          <p class="big" :class="{ live: panel.isRunning, idle: !panel.isRunning }">
            <span class="big-value">{{ speedParts.value }}</span>
            <span class="big-unit">{{ speedParts.unit }}</span>
          </p>
          <div class="readout-meta">
            <span class="bitrate">{{ speedBits }}</span>
            <span class="latency">
              延迟
              <b>{{ latencyNow ? Math.round(latencyNow) : '—' }}</b>
              ms
            </span>
          </div>
        </div>

        <RealtimeChart ref="chartRef" />

        <StatsRow
          @set-flow-max="handleSetFlowMax"
          @set-limit-max="handleSetLimitMax"
        />
      </section>

      <div class="home-side">
        <NetworkPanel
          @toggle-run="handleToggleRun"
          @open-screen="handleOpenScreen"
          @set-flow-max="handleSetFlowMax"
          @set-limit-max="handleSetLimitMax"
          @open-card="cardOpen = true"
        />
        <ExitIpInfo />
      </div>

      <div class="home-wide">
        <BufferbloatCard />
      </div>
    </div>

    <ScreenSaver :show="screenOpen" @close="screenOpen = false" />
    <ShareCardModal :show="cardOpen" @close="cardOpen = false" />

    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="limitDialog" class="limit-backdrop" @click.self="limitDialog = null">
          <section class="limit-modal">
            <header class="limit-head">
              <h3>{{ limitDialog === 'flow' ? '设置流量上限' : '设置带宽上限' }}</h3>
              <button class="np-btn-ghost" aria-label="关闭" @click="limitDialog = null">
                <Icon name="x" :size="14" />
              </button>
            </header>
            <div class="limit-body">
              <label for="limit-value">{{ limitDialog === 'flow' ? '流量数值' : '速率数值' }}</label>
              <input id="limit-value" v-model.number="limitValue" type="number" min="0" placeholder="留空则无上限" />
              <label for="limit-unit">单位</label>
              <NSelect
                id="limit-unit"
                v-model:value="limitUnit"
                :options="limitUnitOptions"
                class="limit-unit-select"
                size="medium"
              />
              <p v-if="limitDialog === 'speed'">浏览器限速只能限制平均速度，峰值可能仍有波动</p>
            </div>
            <footer class="limit-foot">
              <button class="np-btn-quiet" @click="limitDialog = null">取消</button>
              <button class="np-btn-primary" @click="saveLimit">保存</button>
            </footer>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.page {
  padding-top: 24px;
  padding-bottom: 64px;
}

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.page-head-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.run-state {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
}

.run-state.live {
  color: var(--text-secondary);
}

.state-text {
  font-size: 12px;
}

.state-time {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}

.home-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
}

@media (min-width: 1024px) {
  .home-grid {
    grid-template-columns: minmax(0, 1fr) 360px;
  }
}

.home-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.home-wide {
  grid-column: 1 / -1;
  min-width: 0;
}

/* ---------- 读数仪器 ---------- */

.instrument {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  padding: 20px 20px 16px;
}

.instrument-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
}

.node-name {
  min-width: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.readout {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.big {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  line-height: 0.9;
  transition: color var(--dur) var(--ease);
}

.big.live {
  color: var(--trace);
}

.big.idle {
  color: var(--text-muted);
}

.big-value {
  font-family: 'Consolas', 'DejaVu Sans Mono', ui-monospace, monospace;
  font-size: 56px;
  font-weight: 400;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums slashed-zero;
}

.big-unit {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0;
}

.readout-meta {
  display: flex;
  align-items: baseline;
  gap: 20px;
  padding-bottom: 4px;
  color: var(--text-muted);
  font-size: 11px;
}

.bitrate {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}

.latency {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.latency b {
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 640px) {
  .big-value {
    font-size: 40px;
  }

  .readout {
    gap: 12px;
  }

  .readout-meta {
    gap: 14px;
  }
}

/* ---------- 上限弹窗 ---------- */

.limit-backdrop {
  position: fixed;
  inset: 0;
  z-index: 110;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(9, 11, 12, 0.36);
}

.limit-modal {
  width: min(360px, 100%);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  background: var(--bg-card);
  box-shadow: var(--shadow-lg);
}

.limit-head,
.limit-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 16px;
}

.limit-head {
  border-bottom: 1px solid var(--border-subtle);
}

.limit-head h3 {
  font-size: 13px;
  font-weight: 500;
}

.limit-head .np-btn-ghost {
  font-size: 11px;
  color: var(--text-muted);
}

.limit-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}

.limit-body label {
  color: var(--text-muted);
  font-size: 11px;
}

.limit-body input {
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--bg-input);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
  outline: none;
  transition: border-color var(--dur-fast) var(--ease);
}

.limit-body input:focus {
  border-color: var(--text-primary);
}

.limit-unit-select {
  width: 100%;
}

.limit-body p {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
}

.limit-foot {
  justify-content: flex-end;
  border-top: 1px solid var(--border-subtle);
}

.limit-foot .np-btn-primary {
  height: 32px;
  padding: 0 14px;
  font-size: 12px;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity var(--dur-fast) var(--ease);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
