<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useMessage } from 'naive-ui'
import ScoreBoard from '@/components/unlock/ScoreBoard.vue'
import ServiceRows from '@/components/unlock/ServiceRows.vue'
import { useUnlock } from '@/composables/useUnlock'
import { SERVICE_NAME } from '@/utils/unlock'
import { countryName } from '@/utils/ipInfo'

const message = useMessage()
const unlock = useUnlock()
const { verdicts, running, done, total, elapsed, sharedCode, filter, counts, card, exits, advice, start, stop, destroy, loadFromHash, copyShareLink } = unlock

const adviceText = computed(() =>
  advice.value.map(item => {
    const name = SERVICE_NAME[item.id] || item.id
    if (item.k === 'fail') return { id: item.id, text: `${name} 完全打不开，检查它的域名有没有走代理。` }
    if (item.k === 'to') {
      return {
        id: item.id,
        text: `${name} 在 ${countryName(item.at, item.at)} 不可用，而 ${countryName(item.to || '', item.to || '')} 在支持列表里：把这个域名分到那条线路。`,
      }
    }
    return { id: item.id, text: `${name} 在 ${countryName(item.at, item.at)} 不可用，当前没有可用的线路，需要换节点。` }
  }),
)

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
    <section class="un-hero">
      <div class="un-hero-main">
        <h1 class="un-title">解锁检测</h1>
        <span v-if="sharedCode" class="np-chip un-badge-flag">分享结果</span>
        <span v-else-if="running" class="np-chip np-chip-success un-badge-flag">
          <span class="np-pulse-dot" />
          {{ done }}/{{ total }}
        </span>
        <span v-else-if="elapsed" class="un-time">用时 {{ elapsed }}s</span>
      </div>
      <div class="un-actions">
        <template v-if="done">
          <button class="np-btn-ghost un-act" type="button" :disabled="running" @click="copyLink">复制链接</button>
        </template>
        <button class="np-btn-primary un-run" type="button" @click="toggleRun">
          {{ running ? '停止' : done ? '重新检测' : '开始检测' }}
        </button>
      </div>
    </section>

    <ScoreBoard class="un-scoreboard" :card="card" :counts="counts" :running="running" />

    <div class="un-grid">
      <ServiceRows class="un-col-list" :verdicts="verdicts" v-model:filter="filter" :running="running" />

      <div class="un-col-side">
        <section v-if="adviceText.length" class="np-card un-advice">
          <header class="un-card-head"><h2>分流建议</h2></header>
          <ul class="un-advice-list">
            <li v-for="item in adviceText" :key="item.id">{{ item.text }}</li>
          </ul>
        </section>

        <section v-if="exits.length" class="np-card un-exits">
          <header class="un-card-head"><h2>各服务看到的地区</h2></header>
          <ul class="un-exit-list">
            <li v-for="exit in exits" :key="exit.cc" class="un-exit">
              <span class="un-exit-cc">{{ countryName(exit.cc, exit.cc) }}</span>
              <span class="un-exit-ids">{{ exit.ids.length }} 个服务</span>
            </li>
          </ul>
          <p v-if="exits.length > 1" class="un-note">不同服务看到不同的国家，说明规则按域名分流。</p>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.un-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 3px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.un-hero-main {
  display: flex;
  align-items: center;
  gap: 10px;
}

.un-title {
  color: var(--text-primary);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.un-badge-flag {
  font-size: 11px;
  padding: 3px 8px;
}

.un-time {
  color: var(--text-muted);
  font-size: 11px;
}

.un-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.un-act {
  width: auto;
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
}

.un-act:disabled { opacity: 0.45; cursor: not-allowed; }

.un-run {
  height: 34px;
  padding: 0 16px;
  font-size: 13px;
}

.un-scoreboard {
  margin-bottom: 16px;
}

.un-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.un-col-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.un-card-head h2 {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.un-advice,
.un-exits {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.un-advice-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  list-style: none;
}

.un-advice-list li {
  position: relative;
  padding-left: 10px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.55;
}

.un-advice-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--text-muted);
}

.un-exit-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  list-style: none;
}

.un-exit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.un-exit-cc {
  color: var(--text-primary);
  font-size: 12px;
}

.un-exit-ids {
  color: var(--text-muted);
  font-size: 11px;
}

.un-note {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
}

@media (max-width: 640px) {
  .un-title { font-size: 24px; }
  .un-actions { width: 100%; }
  .un-act { flex: 1 1 40%; height: 32px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-card); }
  .un-run { flex: 1 1 56%; height: 36px; }
}

@media (min-width: 960px) {
  .un-grid {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
  }
}
</style>
