<script setup lang="ts">
import { onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import PageHead from '@/components/common/PageHead.vue'
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
  <div class="np-shell np-page">
    <PageHead title="IP 质量">
      <span v-if="running" class="np-chip np-chip-success">
        <span class="np-pulse-dot" />
        {{ done }}/{{ total }}
      </span>
      <span v-else-if="elapsed" class="np-page-meta">用时 {{ elapsed }}s</span>

      <template #actions>
        <button class="np-btn-quiet" type="button" :disabled="!ip || running" @click="copy">
          复制链接
        </button>
      </template>
    </PageHead>

    <section class="np-card iq-query">
      <label class="iq-query-label" for="iq-ip">查询地址</label>
      <input
        id="iq-ip"
        v-model="input"
        class="iq-input font-mono"
        type="text"
        inputmode="text"
        spellcheck="false"
        placeholder="任意公网 IP，留空查本机"
        @keyup.enter="query()"
      />
      <button class="np-btn-primary iq-run" type="button" :disabled="running" @click="query()">
        {{ running ? '查询中…' : '查询' }}
      </button>
    </section>

    <p v-if="error" class="iq-error">{{ error }}</p>

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

        <section class="np-card np-panel iq-uses">
          <header class="np-panel-head">
            <h2>能用来做什么</h2>
            <span v-if="assessment" class="np-panel-meta font-mono">{{ Object.keys(assessment.uses).length }} 项</span>
          </header>
          <ul v-if="assessment" class="iq-use-list">
            <li v-for="(item, key) in assessment.uses" :key="key" class="iq-use">
              <span class="iq-use-label">{{ USE_LABEL[key] || key }}</span>
              <span class="iq-use-badge" :class="`is-${item.lv}`">
                {{ item.lv === 'good' ? '可用' : item.lv === 'warn' ? '受限' : '不可用' }}
              </span>
              <span class="iq-use-why">{{ USE_WHY[item.why] || '' }}</span>
            </li>
          </ul>
          <p v-else class="np-empty iq-uses-empty">查到地址后按用途给结论</p>
        </section>

        <section class="np-card np-panel iq-else">
          <header class="np-panel-head">
            <h2>去来源网站核对</h2>
            <span class="np-panel-meta">{{ ELSEWHERE.length }} 处</span>
          </header>
          <div class="iq-links">
            <a v-for="[label, url] in ELSEWHERE" :key="label" class="iq-link" :href="url(ip)" target="_blank" rel="noreferrer noopener">
              {{ label }}
            </a>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.iq-query {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 14px 16px;
}

.iq-query-label {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
}

.iq-input {
  flex: 1;
  min-width: 0;
  height: 34px;
  padding: 0 11px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.iq-input:focus {
  border-color: var(--text-muted);
  background: var(--bg-card);
}

.iq-run {
  flex: 0 0 auto;
  height: 34px;
  padding: 0 20px;
  font-size: 13px;
}

.iq-error {
  margin-bottom: 12px;
  color: #dc2626;
  font-size: 12px;
}

.dark .iq-error { color: #FF5C4E; }

.iq-use-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
}

.iq-use {
  display: grid;
  grid-template-columns: 68px 46px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.iq-use-label {
  color: var(--text-secondary);
  font-size: 12px;
}

.iq-use-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
}

.iq-use-badge.is-good { background: rgba(22, 163, 74, 0.1); color: #16a34a; }
.iq-use-badge.is-warn { background: rgba(217, 119, 6, 0.12); color: #b45309; }
.iq-use-badge.is-bad { background: rgba(220, 38, 38, 0.1); color: #dc2626; }

.dark .iq-use-badge.is-good { color: #50E3A4; }
.dark .iq-use-badge.is-warn { color: #F5A623; }
.dark .iq-use-badge.is-bad { color: #FF5C4E; }

.iq-use-why {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.iq-uses-empty {
  min-height: 116px;
}

.iq-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.iq-link {
  padding: 4px 9px;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 11px;
  text-decoration: none;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.iq-link:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

@media (max-width: 640px) {
  .iq-query {
    flex-wrap: wrap;
  }

  .iq-query-label {
    flex: 1 1 100%;
  }

  .iq-input {
    flex: 1 1 calc(100% - 96px);
  }

  .iq-run {
    flex: 1 1 88px;
  }
}
</style>
