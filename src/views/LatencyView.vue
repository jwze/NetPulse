<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { NSelect, useMessage } from 'naive-ui'
import VerdictPanel from '@/components/latency/VerdictPanel.vue'
import ExitPanel from '@/components/latency/ExitPanel.vue'
import ServiceLane from '@/components/latency/ServiceLane.vue'
import { useLatencyProbe } from '@/composables/useLatencyProbe'
import { CATS, PACK_LABELS } from '@/data/latencyServices'
import { fmtDelta, fmtMs, posOf, tierOf } from '@/utils/latency'
import { buildLatencyCard } from '@/utils/latencyCard'
import { downloadCanvas } from '@/utils/shareCard'
import { countryName } from '@/utils/ipInfo'

const message = useMessage()
const probe = useLatencyProbe()
const {
  running,
  progress,
  pack,
  exits,
  exitState,
  exitUnknown,
  hiddenNote,
  error,
  samples,
  sharedCode,
  rows,
  verdict,
  uses,
  compare,
  answered,
  localSegment,
  globalSegment,
  mask,
  shared,
  warp,
} = probe

const packOptions = computed(() => Object.entries(PACK_LABELS).map(([value, label]) => ({ value, label })))
const sampleOptions = [
  { value: 3, label: '3 次' },
  { value: 5, label: '5 次' },
]

const ORDER: string[] = ['local', 'ai', 'web', 'video', 'social', 'dev', 'game', 'cdn']

const groups = computed(() => ORDER.map(id => {
  const cat = CATS.find(c => c.id === id)!
  const list = rows.value.filter(row => row.cat === id)
  return { ...cat, rows: list }
}).filter(group => group.rows.length))

const axis = [5, 30, 80, 150, 300, 1000].map(ms => ({ ms, left: posOf(ms) * 100 }))

const progressText = computed(() => `${progress.value.done}/${progress.value.total}`)

const localLabel = computed(() => `本地常用 · ${PACK_LABELS[pack.value] || ''}`)

function toggleRun() {
  if (running.value) probe.stop()
  else void probe.start()
}

async function copyLink() {
  const ok = await probe.copyShareLink()
  if (ok) message.success('结果链接已复制')
  else message.error('复制失败，请重试')
}

const exitText = computed(() => {
  const main = exits.value[0]
  if (!main) return ''
  return [
    main.cc ? countryName(main.cc, main.cc) : '',
    main.city,
    main.org,
  ].filter(Boolean).join(' · ')
})

function stamp() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

function exportImage() {
  const current = verdict.value
  if (!current) return
  const canvas = buildLatencyCard({
    verdict: current,
    uses: uses.value,
    rows: rows.value,
    answered: answered.value,
    exitText: exitText.value,
    date: new Date(shared.value?.ts ?? Date.now()),
  })
  downloadCanvas(canvas, `netpulse-latency-${stamp()}.png`)
  message.success('分享图已保存')
}

onMounted(() => {
  probe.loadFromHash()
})

onUnmounted(() => {
  probe.destroy()
})
</script>

<template>
  <div class="np-shell pt-5 pb-14">
    <section class="lat-hero">
      <div class="lat-hero-main">
        <h1 class="lat-title">全球延迟</h1>
        <span v-if="sharedCode" class="np-chip lat-badge">分享结果</span>
        <span v-else-if="running" class="np-chip np-chip-success lat-badge">
          <span class="np-pulse-dot" />
          {{ progressText }}
        </span>
      </div>
      <button class="np-btn-primary lat-run" type="button" @click="toggleRun">
        {{ running ? '停止' : '开始探测' }}
      </button>
    </section>

    <p v-if="error" class="lat-error">{{ error }}</p>

    <div class="lat-layout">
      <div class="lat-side">
        <VerdictPanel
          :verdict="verdict"
          :uses="uses"
          :answered="answered"
          :running="running"
        />
        <ExitPanel
          :exits="exits"
          :state="exitState"
          :unknown="exitUnknown"
          :mask="mask"
          :note="hiddenNote"
          :warp="warp"
          @toggle-mask="mask = !mask"
        />
        <section v-if="compare" class="np-card compare-card">
          <header class="compare-head">
            <h3>与上次对比</h3>
            <span class="compare-time font-mono">{{ new Date(compare.ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</span>
          </header>
          <p v-if="!compare.changed.length" class="compare-empty">两次结果基本一致。</p>
          <ul v-else class="compare-list">
            <li v-for="row in compare.changed.slice(0, 8)" :key="row.id" class="compare-row">
              <span class="compare-name">{{ row.name }}</span>
              <span class="compare-pair font-mono">{{ fmtMs(row.a) }} → {{ fmtMs(row.b) }}</span>
              <span
                class="compare-delta font-mono"
                :class="row.delta == null ? '' : row.delta > 0 ? 'is-slower' : 'is-faster'"
              >
                {{ row.delta == null ? (row.b == null ? '失去响应' : '恢复') : `${fmtDelta(row.delta)}ms` }}
              </span>
            </li>
          </ul>
        </section>
      </div>

      <section class="np-card lat-card">
        <header class="lat-card-head">
          <div class="lat-card-title">
            <h3>服务延迟</h3>
            <span class="lat-count font-mono">{{ answered.ok }}/{{ answered.n || rows.length }}</span>
          </div>
          <div class="lat-controls">
            <NSelect
              :value="pack"
              :options="packOptions"
              size="small"
              class="lat-select"
              :disabled="running"
              @update:value="probe.setPack"
            />
            <NSelect
              v-model:value="samples"
              :options="sampleOptions"
              size="small"
              class="lat-select lat-select-sm"
              :disabled="running"
            />
            <button class="np-btn-ghost lat-copy" type="button" :disabled="!answered.n" @click="copyLink">
              复制链接
            </button>
            <button class="np-btn-ghost lat-copy" type="button" :disabled="!verdict" @click="exportImage">
              导出图片
            </button>
          </div>
        </header>

        <div class="lat-axis">
          <span class="lat-axis-name">服务</span>
          <div class="lat-axis-track">
            <span
              v-for="(tick, index) in axis"
              :key="tick.ms"
              class="lat-tick font-mono"
              :class="`tick-${index}`"
              :style="{ left: `${tick.left}%` }"
            >{{ tick.ms }}</span>
          </div>
          <span class="lat-axis-ms">中位</span>
          <span class="lat-axis-extra">抖动</span>
        </div>

        <div class="lat-groups">
          <div v-for="group in groups" :key="group.id" class="lat-group">
            <div class="lat-group-head">
              <span class="lat-group-label">{{ group.id === 'local' ? localLabel : group.label }}</span>
              <span class="lat-group-count font-mono">{{ group.rows.filter(r => r.median != null).length }}/{{ group.rows.length }}</span>
            </div>
            <ServiceLane v-for="row in group.rows" :key="row.id" :row="row" />
          </div>
        </div>

        <footer v-if="verdict" class="lat-foot">
          <span>本地 {{ fmtMs(localSegment.med) }}ms · 海外 {{ fmtMs(globalSegment.med) }}ms · 整体 {{ fmtMs(verdict.med) }}ms</span>
          <span class="font-mono">{{ tierOf(verdict.med).label }}</span>
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.lat-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 3px;
  margin-bottom: 14px;
}

.lat-hero-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.lat-title {
  color: var(--text-primary);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.lat-badge {
  font-size: 11px;
  padding: 3px 8px;
}

.lat-run {
  flex: 0 0 auto;
  height: 34px;
  padding: 0 16px;
  font-size: 13px;
}

.lat-error {
  margin-bottom: 12px;
  color: var(--color-danger);
  font-size: 12px;
}

.lat-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

.lat-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
  order: 2;
  min-width: 0;
}

.lat-card {
  order: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lat-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.lat-card-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.lat-card-title h3 {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.lat-count {
  color: var(--text-muted);
  font-size: 11px;
}

.lat-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.lat-select {
  width: 120px;
}

.lat-select-sm {
  width: 84px;
}

.lat-copy {
  width: auto;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}

.lat-axis {
  display: grid;
  grid-template-columns: minmax(0, 118px) minmax(0, 1fr) 62px 52px;
  align-items: end;
  gap: 10px;
  padding: 4px 10px 0;
  color: var(--text-muted);
  font-size: 10px;
}

.lat-axis-track {
  position: relative;
  height: 14px;
}

.lat-tick {
  position: absolute;
  bottom: 0;
  transform: translateX(-50%);
  color: var(--text-muted);
  font-size: 9px;
}

.lat-axis-ms {
  text-align: right;
}

.lat-axis-extra {
  text-align: right;
}

.lat-groups {
  display: flex;
  flex-direction: column;
}

.lat-group + .lat-group {
  margin-top: 6px;
}

.lat-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px 4px;
  border-top: 1px solid var(--border-subtle);
}

.lat-group:first-child .lat-group-head {
  border-top: none;
}

.lat-group-label {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.lat-group-count {
  color: var(--text-muted);
  font-size: 10px;
}

.lat-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 11px;
}

.compare-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compare-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.compare-head h3 {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.compare-time {
  color: var(--text-muted);
  font-size: 10px;
}

.compare-empty {
  color: var(--text-secondary);
  font-size: 12px;
}

.compare-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  list-style: none;
}

.compare-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.compare-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.compare-pair {
  color: var(--text-muted);
}

.compare-delta {
  color: var(--text-secondary);
  min-width: 52px;
  text-align: right;
}

.is-slower {
  color: #dc2626;
}

.is-faster {
  color: #16a34a;
}

.dark .is-slower {
  color: #f87171;
}

.dark .is-faster {
  color: #4ade80;
}

@media (max-width: 640px) {
  .lat-axis {
    grid-template-columns: minmax(0, 92px) minmax(0, 1fr) 54px;
  }

  .lat-axis-extra {
    display: none;
  }

  .lat-tick.tick-1,
  .lat-tick.tick-3 {
    display: none;
  }

  .lat-title {
    font-size: 24px;
  }

  .lat-controls {
    width: 100%;
  }

  .lat-select {
    flex: 1 1 calc(50% - 3px);
  }

  .lat-copy {
    flex: 1 1 40%;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-card);
  }
}

@media (min-width: 1024px) {
  .lat-layout {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
    align-items: start;
  }

  .lat-card {
    order: 1;
  }

  .lat-side {
    order: 2;
  }
}
</style>
