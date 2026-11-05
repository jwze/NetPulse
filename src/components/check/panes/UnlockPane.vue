<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useMessage } from 'naive-ui'
import PaneBar from '@/components/check/PaneBar.vue'
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
  if (loadFromHash()) return
  void start()
})

onUnmounted(() => {
  destroy()
})
</script>

<template>
  <div class="pane">
    <PaneBar hint="流媒体与 AI 服务在当前线路的可达情况">
      <span v-if="sharedCode" class="np-chip">分享结果</span>
      <span v-else-if="running" class="np-chip np-chip-success">
        <span class="np-pulse-dot" />
        {{ done }}/{{ total }}
      </span>
      <span v-else-if="elapsed" class="np-page-meta">用时 {{ elapsed }}s</span>

      <template #actions>
        <button v-if="done" class="np-btn-quiet" type="button" :disabled="running" @click="copyLink">
          复制链接
        </button>
        <button class="np-btn-primary np-btn-run" type="button" @click="toggleRun">
          {{ running ? '停止' : done ? '重新检测' : '开始检测' }}
        </button>
      </template>
    </PaneBar>

    <ScoreBoard :card="card" :counts="counts" :running="running" />

    <div class="np-split np-split--main-first">
      <div class="np-main">
        <ServiceRows :verdicts="verdicts" v-model:filter="filter" :running="running" />
      </div>

      <aside class="np-aside">
        <section class="np-card np-panel un-advice">
          <header class="np-panel-head">
            <h2>分流建议</h2>
            <span class="np-panel-meta font-mono">{{ adviceText.length }} 条</span>
          </header>
          <div class="un-advice-body">
            <ul v-if="adviceText.length" class="un-advice-list">
              <li v-for="item in adviceText" :key="item.id">{{ item.text }}</li>
            </ul>
            <p v-else class="np-empty">
              检测后列出哪个服务在哪个地区不可用、该把域名分到哪条线路。
            </p>
          </div>
        </section>

        <section class="np-card np-panel un-exits">
          <header class="np-panel-head">
            <h2>各服务看到的地区</h2>
            <span class="np-panel-meta font-mono">{{ exits.length }}</span>
          </header>
          <div class="un-exits-body">
            <ul v-if="exits.length" class="un-exit-list">
              <li v-for="exit in exits" :key="exit.cc" class="un-exit">
                <span class="un-exit-cc">{{ countryName(exit.cc, exit.cc) }}</span>
                <span class="un-exit-ids">{{ exit.ids.length }} 个服务</span>
              </li>
            </ul>
            <p v-else class="np-empty">检测后按服务看到的地区分组。</p>
          </div>
          <p v-if="exits.length > 1" class="un-note">不同服务看到不同的国家，说明规则按域名分流。</p>
        </section>

        <section class="np-card np-panel un-how">
          <header class="np-panel-head"><h2>怎么判定</h2></header>
          <ul class="un-how-list">
            <li><b>Cloudflare trace</b><span>读它看到的国家，最直接。</span></li>
            <li><b>服务自己的接口</b><span>读地区与片源；NBC 需要 POST，DAZN 需要先有登录态。</span></li>
            <li><b>纯连通性</b><span>读不到信息时按能不能打开推测，列表里标成「推测」。</span></li>
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

.un-advice,
.un-exits,
.un-how {
  min-width: 0;
}

.un-advice-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
}

.un-advice-list li {
  position: relative;
  padding-left: 10px;
  color: var(--text-secondary);
  font-size: 11.5px;
  line-height: 1.6;
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

/* 建议条数会随结果增加，固定高度内部滚动，避免把下面的卡推来推去 */
.un-advice-body {
  height: 236px;
  overflow-y: auto;
  padding-right: 2px;
}

.un-exits-body {
  min-height: 128px;
  max-height: 220px;
  overflow-y: auto;
}

.un-advice-body .np-empty {
  height: 100%;
}

.un-exit-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  list-style: none;
}

.un-exit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 5px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.un-exit:last-child {
  border-bottom: none;
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
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
}

.un-how-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
}

.un-how-list li {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.un-how-list b {
  color: var(--text-primary);
  font-size: 11.5px;
  font-weight: 600;
}

.un-how-list span {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
}
</style>
