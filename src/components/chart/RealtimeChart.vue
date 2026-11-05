<script setup lang="ts">
import { ref, computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { LegacyGridContainLabel } from 'echarts/features'
import VChart from 'vue-echarts'
import { useSettingsStore } from '@/stores/settings'
import { useAppStore } from '@/stores/app'
import { useNetworkStore } from '@/stores/network'
import { usePanelStore } from '@/stores/panel'
import { useFormatter } from '@/composables/useFormatter'
import { formatDateTime } from '@/utils/date'
import Icon from '@/components/ui/Icon.vue'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegacyGridContainLabel])

const settings = useSettingsStore()
const appStore = useAppStore()
const networkStore = useNetworkStore()
const panel = usePanelStore()
const { formatSpeed } = useFormatter()
const chartRef = ref()

const speedData = ref<[number, number][]>([[Date.now(), 0]])
const latencyData = ref<[number, number][]>([[Date.now(), 0]])

function formatChartTime(value: number) {
  return formatDateTime(new Date(value).toISOString())
}

/** 坐标轴只留数字与量级，单位交给图例 */
function formatAxisSpeed(bytesPerSec: number) {
  const mb = bytesPerSec / 1024 / 1024
  if (mb >= 1000) return `${(mb / 1024).toFixed(1)}G`
  if (mb >= 10) return `${Math.round(mb)}M`
  if (mb >= 1) return `${mb.toFixed(1)}M`
  return `${Math.round(bytesPerSec / 1024)}K`
}

function tooltipFormatter(params: any[]) {
  const rows = Array.isArray(params) ? params : []
  const speedPoint = rows.find(item => item.seriesName === '速率')
  const latencyPoint = rows.find(item => item.seriesName === '延迟')
  const timeValue = speedPoint?.data?.[0] ?? latencyPoint?.data?.[0] ?? Date.now()
  const speedValue = Number(speedPoint?.data?.[1]) || 0
  const latencyValue = Number(latencyPoint?.data?.[1]) || 0

  return `
    <div style="font-family:inherit;font-size:11px;color:var(--text-muted);margin-bottom:6px;font-variant-numeric:tabular-nums;">${formatChartTime(timeValue)}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;line-height:1.9;">
      <span style="font-size:12px;color:var(--text-secondary);">速率</span>
      <strong style="font-family:var(--font-mono);font-size:12px;font-weight:500;color:var(--trace);">${formatSpeed(speedValue)}</strong>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;line-height:1.9;">
      <span style="font-size:12px;color:var(--text-secondary);">延迟</span>
      <strong style="font-family:var(--font-mono);font-size:12px;font-weight:500;color:var(--text-primary);">${latencyValue > 0 ? Math.round(latencyValue) + ' ms' : '—'}</strong>
    </div>
  `
}

const hasData = computed(() => speedData.value.some(([, value]) => value > 0))

const option = computed(() => {
  const isDark = appStore.isDark
  const axisColor = isDark ? '#677678' : '#78878A'
  const gridColor = isDark ? 'rgba(230,237,238,0.06)' : 'rgba(16,23,25,0.06)'
  const traceColor = isDark ? '#F0744A' : '#BF4012'
  const secondColor = isDark ? '#8A999B' : '#6B7A7D'

  return {
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#14181A' : '#FFFFFF',
      borderColor: isDark ? 'rgba(230,237,238,0.11)' : 'rgba(16,23,25,0.11)',
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: isDark ? '#E6EDEE' : '#101719' },
      extraCssText: 'z-index:40 !important;pointer-events:none;border-radius: var(--r-md);box-shadow:0 4px 12px rgba(0,0,0,0.08);',
      formatter: tooltipFormatter,
    },
    grid: { left: 8, right: 8, top: 12, bottom: 22, containLabel: true },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      axisLabel: {
        show: true,
        color: axisColor,
        fontSize: 10,
        fontFamily: 'ui-monospace, monospace',
        hideOverlap: true,
        formatter: (value: number) => {
          const date = new Date(value)
          return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
        },
      },
      axisTick: { show: false },
      axisLine: { show: true, lineStyle: { color: gridColor } },
      splitLine: { show: true, lineStyle: { color: gridColor } },
    },
    yAxis: [
      {
        type: 'value',
        min: 0,
        max: hasData.value ? undefined : 1024 * 1024,
        axisLabel: {
          show: true,
          color: axisColor,
          fontSize: 10,
          fontFamily: 'ui-monospace, monospace',
          margin: 8,
          formatter: (value: number) => formatAxisSpeed(value),
        },
        splitLine: { lineStyle: { color: gridColor } },
        splitNumber: 3,
        axisLine: { show: false },
        axisTick: { show: false },
      },
      {
        type: 'value',
        min: 0,
        max: hasData.value ? undefined : 100,
        axisLabel: {
          show: true,
          color: axisColor,
          fontSize: 10,
          fontFamily: 'ui-monospace, monospace',
          margin: 8,
          formatter: (value: number) => (value > 0 ? `${Math.round(value)}` : '0'),
        },
        splitLine: { show: false },
        splitNumber: 3,
        axisLine: { show: false },
        axisTick: { show: false },
      },
    ],
    series: [
      {
        name: '速率',
        type: 'line',
        smooth: 0.25,
        showSymbol: false,
        yAxisIndex: 0,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: isDark ? 'rgba(240, 116, 74, 0.16)' : 'rgba(191, 64, 18, 0.12)' },
              { offset: 1, color: 'rgba(191, 64, 18, 0)' },
            ],
          },
        },
        lineStyle: { color: traceColor, width: 1.5 },
        itemStyle: { color: traceColor },
        data: speedData.value,
      },
      {
        name: '延迟',
        type: 'line',
        smooth: 0.25,
        showSymbol: false,
        yAxisIndex: 1,
        lineStyle: { color: secondColor, width: 1, type: [3, 3] },
        itemStyle: { color: secondColor },
        data: latencyData.value,
      },
    ],
  }
})

function addDataPoint(speed: number, latency: number) {
  const now = Date.now()
  const latencyValue = latency || panel.latencyNow || networkStore.localLatencyMs || networkStore.cloudflareLatencyMs || 0
  speedData.value.push([now, Number.isFinite(speed) ? speed : 0])
  latencyData.value.push([now, Number.isFinite(latencyValue) ? latencyValue : 0])

  if (speedData.value.length > 200) {
    speedData.value = speedData.value.slice(-100)
    latencyData.value = latencyData.value.slice(-100)
  }
}

function clearData() {
  speedData.value = [[Date.now(), 0]]
  latencyData.value = [[Date.now(), 0]]
}

defineExpose({ addDataPoint, clearData })
</script>

<template>
  <div class="trace">
    <div class="trace-head">
      <div class="legend">
        <span class="legend-item">
          <i class="swatch swatch-trace" aria-hidden="true" />
          速率
          <em>MB/s</em>
        </span>
        <span class="legend-item">
          <i class="swatch swatch-second" aria-hidden="true" />
          延迟
          <em>ms</em>
        </span>
      </div>

      <button
        class="np-btn-ghost small"
        :aria-label="settings.chartShow ? '隐藏曲线' : '显示曲线'"
        @click="settings.chartShow = !settings.chartShow"
      >
        <Icon :name="settings.chartShow ? 'eye' : 'eye-off'" :size="15" />
      </button>
    </div>

    <div v-show="settings.chartShow" class="paper">
      <VChart ref="chartRef" :option="option" autoresize />
      <p v-if="!hasData" class="hint">
        <span class="hint-mark" aria-hidden="true" />
        开始测速后，曲线会在这里逐秒描出
      </p>
    </div>

    <div v-show="!settings.chartShow" class="hidden-note">
      <Icon name="eye-off" :size="14" />
      曲线已隐藏
    </div>
  </div>
</template>

<style scoped>
.trace {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  min-height: 0;
}

.trace-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.legend {
  display: flex;
  align-items: center;
  gap: 16px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.legend-item em {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-style: normal;
  font-size: 10px;
}

.swatch {
  width: 12px;
  height: 2px;
  border-radius: 1px;
}

.swatch-trace {
  background: var(--trace);
}

.swatch-second {
  background: var(--trace-second);
}

.small {
  width: 28px;
  height: 28px;
}

/* 描迹纸：细网格 + 底部基线 */
.paper {
  position: relative;
  flex: 1;
  height: 232px;
  min-height: 200px;
  min-width: 0;
  border-radius: var(--r-sm);
  background-image:
    linear-gradient(to right, var(--grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px);
  background-size: 48px 32px;
  background-position: 0 0;
}

.paper::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 22px;
  height: 1px;
  background: var(--grid-line-strong);
  pointer-events: none;
}

.hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 12px;
  pointer-events: none;
}

.hint-mark {
  width: 14px;
  height: 1px;
  background: var(--trace);
  opacity: 0.7;
}

.hidden-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 232px;
  border-radius: var(--r-sm);
  background: var(--bg-subtle);
  color: var(--text-muted);
  font-size: 12px;
}

@media (max-width: 640px) {
  .paper,
  .hidden-note {
    height: 180px;
  }
}
</style>
