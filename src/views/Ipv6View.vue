<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useMessage } from 'naive-ui'
import ScorePanel from '@/components/ipv6/ScorePanel.vue'
import TestList from '@/components/ipv6/TestList.vue'
import ComparePanel from '@/components/ipv6/ComparePanel.vue'
import { useIpv6Test } from '@/composables/useIpv6Test'
import { buildIpv6Card } from '@/utils/ipv6Card'
import { downloadCanvas } from '@/utils/shareCard'
import { countryName } from '@/utils/ipInfo'

const message = useMessage()
const test = useIpv6Test()
const {
  results,
  rows,
  pairRows,
  running,
  done,
  total,
  runDuration,
  sharedCode,
  sharedTs,
  masked,
  verdict,
  problemText,
  answered,
  compare,
  compareDone,
  compareTotal,
  cc,
  elapsed,
  start,
  stop,
  destroy,
  copyShareLink,
  loadFromHash,
  addressNote,
} = test

function toggleRun() {
  if (running.value) stop()
  else void start()
}

async function copyLink() {
  if (await copyShareLink()) message.success('结果链接已复制')
  else message.error('复制失败，请重试')
}

function stamp() {
  const date = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

function exportImage() {
  const current = verdict.value
  if (!current) return
  const canvas = buildIpv6Card({
    verdict: current,
    results,
    compare: compare.value,
    cc: cc.value,
    country: countryName(cc.value, cc.value),
    date: new Date(sharedTs.value || Date.now()),
    elapsed: elapsed.value,
  })
  downloadCanvas(canvas, `netpulse-ipv6-${stamp()}.png`)
  message.success('分享图已保存')
}

onMounted(() => {
  loadFromHash()
})

onUnmounted(() => {
  destroy()
})
</script>

<template>
  <div class="np-shell pt-5 pb-14">
    <section class="v6-hero">
      <div class="v6-hero-main">
        <h1 class="v6-title">IPv6 测试</h1>
        <span v-if="sharedCode" class="np-chip v6-badge">分享结果</span>
        <span v-else-if="running" class="np-chip np-chip-success v6-badge">
          <span class="np-pulse-dot" />
          {{ done }}/{{ total }}
        </span>
        <span v-else-if="runDuration" class="v6-time">用时 {{ runDuration }}</span>
      </div>
      <div class="v6-actions">
        <template v-if="verdict">
          <button class="np-btn-ghost v6-copy" type="button" :disabled="running" @click="copyLink">
            复制链接
          </button>
          <button class="np-btn-ghost v6-copy" type="button" @click="exportImage">
            导出图片
          </button>
        </template>
        <button class="np-btn-primary v6-run" type="button" @click="toggleRun">
          {{ running ? '停止' : verdict ? '重新测试' : '开始测试' }}
        </button>
      </div>
    </section>

    <div class="v6-grid">
      <ScorePanel
        class="v6-score"
        :verdict="verdict"
        :problem-text="problemText"
        :results="results"
        :note4="addressNote(4)"
        :note6="addressNote(6)"
        :running="running"
        :masked="masked"
        @toggle-mask="masked = !masked"
      />
      <TestList class="v6-tests" :rows="rows" :answered="answered" :total="rows.length" :running="running" />
      <ComparePanel
        class="v6-cmp"
        :pairs="pairRows"
        :compare="compare"
        :done="compareDone"
        :total="compareTotal"
        :pending="!verdict && !running"
      />
    </div>
  </div>
</template>

<style scoped>
.v6-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 3px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.v6-hero-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.v6-title {
  color: var(--text-primary);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.v6-badge {
  font-size: 11px;
  padding: 3px 8px;
}

.v6-time {
  color: var(--text-muted);
  font-size: 11px;
}

.v6-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.v6-copy {
  width: auto;
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
}

.v6-copy:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.v6-run {
  height: 34px;
  padding: 0 16px;
  font-size: 13px;
}

.v6-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    'score'
    'tests'
    'cmp';
  gap: 16px;
}

.v6-score { grid-area: score; }
.v6-tests { grid-area: tests; }
.v6-cmp { grid-area: cmp; }

@media (max-width: 640px) {
  .v6-title {
    font-size: 24px;
  }

  .v6-actions {
    width: 100%;
  }

  .v6-copy {
    flex: 1 1 calc(50% - 3px);
    height: 32px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-card);
  }

  .v6-run {
    flex: 1 1 100%;
    height: 36px;
  }
}

@media (min-width: 900px) {
  .v6-grid {
    grid-template-columns: minmax(0, 1fr) minmax(320px, 380px);
    grid-template-areas:
      'score tests'
      'cmp   tests';
    align-items: start;
  }
}
</style>
