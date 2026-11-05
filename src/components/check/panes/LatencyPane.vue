<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { NSelect, useMessage } from 'naive-ui'
import PaneBar from '@/components/check/PaneBar.vue'
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
  if (probe.loadFromHash()) return
  void probe.start()
})

onUnmounted(() => {
  probe.destroy()
})
</script>

<template>
  <div class="pane">
    <PaneBar hint="按类别列出常用服务，取多次采样的中位数">
      <span v-if="sharedCode" class="np-chip">分享结果</span>
      <span v-else-if="running" class="np-chip np-chip-success">
        <span class="np-pulse-dot" />
        {{ progressText }}
      </span>

      <template #actions>
        <button class="np-btn-quiet" type="button" :disabled="!answered.n" @click="copyLink">
          复制链接
        </button>
        <button class="np-btn-quiet" type="button" :disabled="!verdict" @click="exportImage">
          导出图片
        </button>
        <button class="np-btn-primary np-btn-run" type="button" @click="toggleRun">
          {{ running ? '停止' : '开始探测' }}
        </button>
      </template>
    </PaneBar>

    <p v-if="error" class="lat-error">{{ error }}</p>

    <div class="np-split">
      <div class="np-main">
        <section class="np-card np-panel lat-card">
          <header class="np-panel-head lat-card-head">
            <div class="lat-card-title">
              <h2>服务延迟</h2>
              <span class="np-panel-meta font-mono">{{ answered.ok }}/{{ answered.n || rows.length }}</span>
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

      <aside class="np-aside">
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
        <section v-if="compare" class="np-card np-panel compare-card">
          <header class="np-panel-head">
            <h2>与上次对比</h2>
            <span class="np-panel-meta font-mono">{{ new Date(compare.ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</span>
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
      </aside>
    </div>
  </div>
</template>

<style scoped>
.pane {
  min-width: 0;
}

.lat-error {
  margin-bottom: 12px;
  color: var(--color-danger);
  font-size: 12px;
}

.lat-card {
  gap: 8px;
}

.lat-card-head {
  flex-wrap: wrap;
  gap: 10px;
}

.lat-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.lat-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lat-select {
  width: 116px;
}

.lat-select-sm {
  width: 80px;
}

.lat-axis {
  display: grid;
  grid-template-columns: minmax(0, 118px) minmax(0, 1fr) 62px 52px;
  align-items: end;
  gap: 10px;
  padding: 2px 10px 0;
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
  font-size: 10px;
}

.lat-axis-ms,
.lat-axis-extra {
  text-align: right;
}

.lat-groups {
  display: flex;
  flex-direction: column;
}

.lat-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 10px 0 2px;
  padding: 5px 10px;
  border-radius: var(--r-xs);
  background: var(--bg-subtle);
}

.lat-group:first-child .lat-group-head {
  margin-top: 0;
}

.lat-group-label {
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 500;
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
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 11px;
}

.compare-card {
  gap: 10px;
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
  color: var(--tone-bad);
}

.is-faster {
  color: var(--tone-good);
}

.dark .is-slower {
  color: var(--tone-bad);
}

.dark .is-faster {
  color: var(--tone-good);
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

  .lat-controls {
    width: 100%;
  }

  .lat-select {
    flex: 1 1 calc(50% - 4px);
  }
}
</style>
