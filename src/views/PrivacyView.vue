<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useMessage } from 'naive-ui'
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
  loadFromHash()
})

onUnmounted(() => {
  destroy()
})
</script>

<template>
  <div class="np-shell pt-5 pb-14">
    <section class="pv-hero">
      <div class="pv-hero-main">
        <h1 class="pv-h1">隐私画像</h1>
        <span v-if="sharedCode" class="np-chip pv-flag">分享结果</span>
        <span v-else-if="running" class="np-chip np-chip-success pv-flag">
          <span class="np-pulse-dot" />
          {{ done }}/{{ total }}
        </span>
        <span v-else-if="elapsed" class="pv-time">用时 {{ elapsed }}s</span>
      </div>

      <div class="pv-actions">
        <button v-if="portrait" class="np-btn-ghost pv-act" type="button" @click="masked = !masked">
          {{ masked ? '显示地址' : '隐藏地址' }}
        </button>
        <button v-if="portrait" class="np-btn-ghost pv-act" type="button" :disabled="running" @click="copyLink">复制链接</button>
        <button class="np-btn-primary pv-run" type="button" @click="toggleRun">
          {{ running ? '停止' : portrait ? '重新探测' : '开始探测' }}
        </button>
      </div>
    </section>

    <div class="pv-grid">
      <div class="pv-main-col">
        <PortraitCard :portrait="portrait" :labels="labels" :running="running" :shared="!!shared" />
        <SnifferList :rows="rows" :masked="masked" :running="running" />
      </div>

      <div class="pv-side">
        <CheckCard
          :verdicts="verdicts"
          :score="score"
          :title="verdict.title"
          :tone="verdict.tone"
          :running="running"
          :shared-levels="shared?.checks || null"
        />

        <section class="np-card pv-note">
          <h2>怎么读这些结果</h2>
          <ul>
            <li>指纹是把画布、显卡、音频、字体和文字度量算成的一串编号：同一个浏览器同一台机器基本不变，清 Cookie 也甩不掉。</li>
            <li>伪装检测只比「你说的」和「实际露出来的」：系统时区对出口时区、语言对出口国家、DNS 对出口、IPv6 里的网卡号。</li>
            <li>一键隐藏所有地址类字段再截图；分享码里只有结论和指纹编号，不含 IP、DNS 和坐标。</li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pv-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 3px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.pv-hero-main {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pv-h1 {
  color: var(--text-primary);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.pv-flag {
  font-size: 11px;
  padding: 3px 8px;
}

.pv-time {
  color: var(--text-muted);
  font-size: 11px;
}

.pv-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pv-act {
  width: auto;
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
}

.pv-act:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pv-run {
  height: 34px;
  padding: 0 16px;
  font-size: 13px;
}

.pv-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.pv-main-col,
.pv-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.pv-note {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.pv-note h2 {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.pv-note ul {
  display: flex;
  flex-direction: column;
  gap: 6px;
  list-style: none;
}

.pv-note li {
  position: relative;
  padding-left: 10px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.6;
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

@media (max-width: 640px) {
  .pv-h1 { font-size: 24px; }
  .pv-actions { width: 100%; }
  .pv-act { flex: 1 1 32%; height: 32px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-card); }
  .pv-run { flex: 1 1 40%; height: 36px; }
}

@media (min-width: 960px) {
  .pv-grid {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
  }

  .pv-side {
    position: sticky;
    top: 72px;
  }
}
</style>
