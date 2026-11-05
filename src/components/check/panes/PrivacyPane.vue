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
    <PaneBar hint="本机指纹、时区与地址暴露面，全部在浏览器本地完成">
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

        <section class="np-card np-panel pv-note">
          <header class="np-panel-head"><h2>怎么读这些结果</h2></header>
          <ul>
            <li>指纹是把画布、显卡、音频、字体和文字度量算成的一串编号：同一个浏览器同一台机器基本不变，清 Cookie 也甩不掉。</li>
            <li>伪装检测只比「你说的」和「实际露出来的」：系统时区对出口时区、语言对出口国家、DNS 对出口、IPv6 里的网卡号。</li>
            <li>一键隐藏所有地址类字段再截图；分享码里只有结论和指纹编号，不含 IP、DNS 和坐标。</li>
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

.pv-split {
  margin-top: 16px;
}

.pv-note ul {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
}

.pv-note li {
  position: relative;
  padding-left: 10px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.65;
}

.pv-note li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--text-muted);
}
</style>
