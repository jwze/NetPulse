<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useMessage } from 'naive-ui'
import PaneBar from '@/components/check/PaneBar.vue'
import PortraitCard from '@/components/privacy/PortraitCard.vue'
import SnifferList from '@/components/privacy/SnifferList.vue'
import CheckCard from '@/components/privacy/CheckCard.vue'
import { usePrivacy } from '@/composables/usePrivacy'

const message = useMessage()
const privacy = usePrivacy()
const { rows, running, done, total, masked, elapsed, sharedCode, shared, verdicts, score, portrait, labels, verdict, start, stop, destroy, loadFromHash, copyShareLink } = privacy

function toggleRun() {
  if (running.value) stop()
  else void start()
}

async function copyLink() {
  if (await copyShareLink()) message.success('结果链接已复制')
  else message.error('复制失败，请重试')
}

onMounted(() => {
  if (loadFromHash()) return
  void start()
})

onUnmounted(() => {
  destroy()
})
</script>

<template>
  <div class="pane">
    <PaneBar>
      <span v-if="sharedCode" class="np-chip">分享结果</span>
      <span v-else-if="running" class="np-chip np-chip-success">
        <span class="np-pulse-dot" />
        {{ done }}/{{ total }}
      </span>
      <span v-else-if="elapsed" class="np-page-meta">用时 {{ elapsed }}s</span>

      <template #actions>
        <button v-if="portrait" class="np-btn-quiet" type="button" @click="masked = !masked">
          {{ masked ? '显示地址' : '隐藏地址' }}
        </button>
        <button v-if="portrait" class="np-btn-quiet" type="button" :disabled="running" @click="copyLink">
          复制链接
        </button>
        <button class="np-btn-primary np-btn-run" type="button" @click="toggleRun">
          {{ running ? '停止' : portrait ? '重新探测' : '开始探测' }}
        </button>
      </template>
    </PaneBar>

    <PortraitCard :portrait="portrait" :labels="labels" :running="running" :shared="!!shared" />

    <div class="np-split pv-split">
      <div class="np-main">
        <SnifferList :rows="rows" :masked="masked" :running="running" />
      </div>

      <aside class="np-aside">
        <CheckCard
          :verdicts="verdicts"
          :score="score"
          :title="verdict.title"
          :tone="verdict.tone"
          :running="running"
          :shared-levels="shared?.checks || null"
        />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.pane {
  min-width: 0;
}

.pv-split {
  margin-top: 16px;
}
</style>
