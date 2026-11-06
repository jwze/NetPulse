<script setup lang="ts">
import { onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import PaneBar from '@/components/check/PaneBar.vue'
import QualityScore from '@/components/ipquality/QualityScore.vue'
import SourceList from '@/components/ipquality/SourceList.vue'
import { useIpQuality } from '@/composables/useIpQuality'
import { USE_LABEL, USE_WHY } from '@/utils/ipQuality'
import { ELSEWHERE } from '@/utils/ipQualityProbe'

const message = useMessage()
const quality = useIpQuality()
const { ip, input, results, dnsbl, running, error, done, total, elapsed, assessment, isOwn, query, init, copyLink } = quality

async function copy() {
  if (await copyLink()) message.success('链接已复制')
  else message.error('复制失败，请重试')
}

onMounted(() => {
  void init()
})
</script>

<template>
  <div class="pane">
    <PaneBar>
      <span v-if="running" class="progress">
        <span class="np-live-dot" />
        <span>{{ done }} / {{ total }}</span>
      </span>
      <span v-else-if="elapsed" class="progress done">用时 {{ elapsed }}s</span>

      <template #actions>
        <button class="np-btn-quiet" type="button" :disabled="!ip || running" @click="copy">
          复制链接
        </button>
      </template>
    </PaneBar>

    <section class="np-card query-bar">
      <label class="query-label" for="iq-ip">查询地址</label>
      <input
        id="iq-ip"
        v-model="input"
        class="query-input"
        type="text"
        inputmode="text"
        spellcheck="false"
        placeholder="公网 IP"
        @keyup.enter="query()"
      />
      <button class="np-btn-primary query-run" type="button" :disabled="running" @click="query()">
        {{ running ? '查询中' : '查询' }}
      </button>
    </section>

    <p v-if="error" class="query-error">{{ error }}</p>

    <div class="np-split">
      <div class="np-main">
        <SourceList
          :results="results"
          :dnsbl="dnsbl"
          :ip="ip"
          :running="running"
          :total="total"
          :done="done"
        />
      </div>

      <aside class="np-aside">
        <QualityScore :assessment="assessment" :ip="ip" :is-own="isOwn" :running="running" />

        <section class="np-card np-panel uses">
          <header class="np-panel-head">
            <h2 class="np-panel-title">能用来做什么</h2>
            <span v-if="assessment" class="np-panel-meta">{{ Object.keys(assessment.uses).length }} 项</span>
          </header>
          <ul v-if="assessment" class="use-list">
            <li v-for="(item, key) in assessment.uses" :key="key" class="use">
              <span class="use-label">{{ USE_LABEL[key] || key }}</span>
              <span class="use-state" :class="`is-${item.lv}`">
                <i class="state-dot" aria-hidden="true" />
                {{ item.lv === 'good' ? '可用' : item.lv === 'warn' ? '受限' : '不可用' }}
              </span>
              <span class="use-why">{{ USE_WHY[item.why] || '' }}</span>
            </li>
          </ul>
          <p v-else class="np-empty uses-empty">—</p>
        </section>

        <section class="np-card np-panel elsewhere">
          <header class="np-panel-head">
            <h2 class="np-panel-title">去来源网站核对</h2>
            <span class="np-panel-meta">{{ ELSEWHERE.length }} 处</span>
          </header>
          <div class="links">
            <a v-for="[label, url] in ELSEWHERE" :key="label" class="link" :href="url(ip)" target="_blank" rel="noreferrer noopener">
              {{ label }}
            </a>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.pane {
  min-width: 0;
}

.progress {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.progress.done {
  color: var(--text-muted);
}

.query-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 16px;
}

.query-label {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 11px;
}

.query-input {
  flex: 1;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--bg-input);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  outline: none;
  transition: border-color var(--dur-fast) var(--ease);
}

.query-input:focus {
  border-color: var(--text-primary);
}

.query-run {
  flex: 0 0 auto;
  height: 34px;
  min-width: 76px;
  padding: 0 16px;
  font-size: 12px;
}

.query-error {
  margin-bottom: 12px;
  color: var(--tone-bad);
  font-size: 12px;
}

.use-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  list-style: none;
}

.use {
  display: grid;
  grid-template-columns: 64px 56px minmax(0, 1fr);
  align-items: baseline;
  gap: 8px;
}

.use-label {
  color: var(--text-secondary);
  font-size: 12px;
}

.use-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  white-space: nowrap;
}

.state-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.use-state.is-good { color: var(--tone-good); }
.use-state.is-warn { color: var(--tone-warn); }
.use-state.is-bad { color: var(--tone-bad); }

.use-why {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.45;
}

.uses-empty {
  min-height: 112px;
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.link {
  padding: 3px 8px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-xs);
  color: var(--text-secondary);
  font-size: 11px;
  text-decoration: none;
  transition: border-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
}

.link:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

@media (max-width: 640px) {
  .query-bar {
    flex-wrap: wrap;
  }

  .query-label {
    flex: 1 1 100%;
  }

  .query-input {
    flex: 1 1 calc(100% - 96px);
  }

  .query-run {
    flex: 1 1 88px;
  }
}
</style>
