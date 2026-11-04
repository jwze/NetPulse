<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useMessage } from 'naive-ui'
import PageHead from '@/components/common/PageHead.vue'
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
  <div class="np-shell np-page">
    <PageHead title="IPv6 测试">
      <span v-if="sharedCode" class="np-chip">分享结果</span>
      <span v-else-if="running" class="np-chip np-chip-success">
        <span class="np-pulse-dot" />
        {{ done }}/{{ total }}
      </span>
      <span v-else-if="runDuration" class="np-page-meta">用时 {{ runDuration }}</span>

      <template #actions>
        <button v-if="verdict" class="np-btn-quiet" type="button" :disabled="running" @click="copyLink">
          复制链接
        </button>
        <button v-if="verdict" class="np-btn-quiet" type="button" @click="exportImage">
          导出图片
        </button>
        <button class="np-btn-primary np-btn-run" type="button" @click="toggleRun">
          {{ running ? '停止' : verdict ? '重新测试' : '开始测试' }}
        </button>
      </template>
    </PageHead>

    <div class="np-split np-split--main-first">
      <div class="np-main">
        <ScorePanel
          :verdict="verdict"
          :problem-text="problemText"
          :results="results"
          :note4="addressNote(4)"
          :note6="addressNote(6)"
          :running="running"
          :masked="masked"
          @toggle-mask="masked = !masked"
        />
        <ComparePanel
          :pairs="pairRows"
          :compare="compare"
          :done="compareDone"
          :total="compareTotal"
          :pending="!verdict && !running"
        />
      </div>

      <aside class="np-aside">
        <TestList :rows="rows" :answered="answered" :total="rows.length" :running="running" />
      </aside>
    </div>
  </div>
</template>
