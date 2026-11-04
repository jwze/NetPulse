<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useMessage } from 'naive-ui'
import { PROBES } from '@/data/egressProbes'
import PageHead from '@/components/common/PageHead.vue'
import CheckList from '@/components/egress/CheckList.vue'
import ExitList from '@/components/egress/ExitList.vue'
import ProbeList from '@/components/egress/ProbeList.vue'
import { useEgress } from '@/composables/useEgress'
import { oddProbes } from '@/utils/egress'

const message = useMessage()
const probe = useEgress()
const { rows, exits, found, running, masked, sharedCode, progress, elapsed, verdict, start, stop, destroy, loadFromHash, copyShareLink } = probe

const odd = computed(() => oddProbes(exits.value))
const answered = computed(() => Object.keys(rows).length)
const total = PROBES.length

function toggleRun() {
  if (running.value) stop()
  else void start()
}

async function copyLink() {
  if (await copyShareLink()) message.success('结果链接已复制')
  else message.error('复制失败，请重试')
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
    <PageHead title="出口对照">
      <span v-if="sharedCode" class="np-chip">分享结果</span>
      <span v-else-if="running" class="np-chip np-chip-success">
        <span class="np-pulse-dot" />
        {{ progress.done }}/{{ progress.total }}
      </span>
      <span v-else-if="elapsed" class="np-page-meta">用时 {{ elapsed }}s</span>

      <template #actions>
        <button v-if="exits.length" class="np-btn-quiet" type="button" @click="masked = !masked">
          {{ masked ? '显示 IP' : '隐藏 IP' }}
        </button>
        <button v-if="exits.length" class="np-btn-quiet" type="button" :disabled="running" @click="copyLink">
          复制链接
        </button>
        <button class="np-btn-primary np-btn-run" type="button" @click="toggleRun">
          {{ running ? '停止' : exits.length ? '重新探测' : '开始探测' }}
        </button>
      </template>
    </PageHead>

    <div class="np-split">
      <div class="np-main">
        <ProbeList :rows="rows" :odd="odd" :masked="masked" />
      </div>

      <aside class="np-aside">
        <CheckList
          :found="found"
          :verdict="verdict"
          :running="running"
          :answered="answered"
          :total="total"
        />
        <ExitList :exits="exits" :masked="masked" :running="running" />
      </aside>
    </div>
  </div>
</template>
