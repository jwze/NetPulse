<script setup lang="ts">
import { onMounted } from 'vue'
import { useMessage } from 'naive-ui'
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
  <div class="np-shell pt-5 pb-14">
    <section class="iq-hero">
      <div class="iq-hero-main">
        <h1 class="iq-title">IP 质量</h1>
        <span v-if="running" class="np-chip np-chip-success iq-badge">
          <span class="np-pulse-dot" />
          {{ done }}/{{ total }}
        </span>
        <span v-else-if="elapsed" class="iq-time">用时 {{ elapsed }}s</span>
      </div>
      <div class="iq-form">
        <input
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
        <button class="np-btn-ghost iq-copy" type="button" :disabled="!ip || running" @click="copy">复制链接</button>
      </div>
    </section>

    <p v-if="error" class="iq-error">{{ error }}</p>

    <div class="iq-grid">
      <QualityScore class="iq-col-score" :assessment="assessment" :ip="ip" :is-own="isOwn" :running="running" />
      <div class="iq-col-side">
        <section v-if="assessment" class="np-card iq-uses">
          <header class="iq-card-head"><h2>能用来做什么</h2></header>
          <ul class="iq-use-list">
            <li v-for="(item, key) in assessment.uses" :key="key" class="iq-use">
              <span class="iq-use-label">{{ USE_LABEL[key] || key }}</span>
              <span class="iq-use-badge" :class="`is-${item.lv}`">
                {{ item.lv === 'good' ? '可用' : item.lv === 'warn' ? '受限' : '不可用' }}
              </span>
              <span class="iq-use-why">{{ USE_WHY[item.why] || '' }}</span>
            </li>
          </ul>
        </section>
        <section class="np-card iq-else">
          <header class="iq-card-head"><h2>去来源网站核对</h2></header>
          <div class="iq-links">
            <a v-for="[label, url] in ELSEWHERE" :key="label" class="iq-link" :href="url(ip)" target="_blank" rel="noreferrer noopener">
              {{ label }}
            </a>
          </div>
        </section>
      </div>
      <SourceList
        class="iq-col-sources"
        :results="results"
        :dnsbl="dnsbl"
        :ip="ip"
        :running="running"
        :total="total"
        :done="done"
      />
    </div>
  </div>
</template>

<style scoped>
.iq-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 3px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.iq-hero-main {
  display: flex;
  align-items: center;
  gap: 10px;
}

.iq-title {
  color: var(--text-primary);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.iq-badge {
  font-size: 11px;
  padding: 3px 8px;
}

.iq-time {
  color: var(--text-muted);
  font-size: 11px;
}

.iq-form {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.iq-input {
  width: 240px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
}

.iq-input:focus {
  border-color: var(--text-muted);
}

.iq-run {
  height: 34px;
  padding: 0 16px;
  font-size: 13px;
}

.iq-copy {
  width: auto;
  height: 34px;
  padding: 0 10px;
  font-size: 12px;
}

.iq-copy:disabled { opacity: 0.45; cursor: not-allowed; }

.iq-error {
  margin-bottom: 12px;
  color: #dc2626;
  font-size: 12px;
}

.dark .iq-error { color: #FF5C4E; }

.iq-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    'score'
    'uses'
    'sources';
  gap: 16px;
  align-items: start;
}

.iq-col-score { grid-area: score; }
.iq-col-side { grid-area: uses; display: flex; flex-direction: column; gap: 16px; }
.iq-col-sources { grid-area: sources; }

.iq-card-head h2 {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.iq-uses {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.iq-use-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
}

.iq-use {
  display: grid;
  grid-template-columns: 76px 48px minmax(0, 1fr);
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

.iq-else {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.iq-links {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.iq-link {
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 11px;
  text-decoration: none;
}

.iq-link:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

@media (max-width: 640px) {
  .iq-title { font-size: 24px; }
  .iq-form { width: 100%; }
  .iq-input { flex: 1 1 100%; width: auto; }
  .iq-run { flex: 1 1 calc(60% - 3px); }
  .iq-copy { flex: 1 1 calc(40% - 3px); }
}

@media (min-width: 960px) {
  .iq-grid {
    grid-template-columns: minmax(0, 380px) minmax(0, 1fr);
    grid-template-areas:
      'score sources'
      'uses  sources';
  }
}
</style>
