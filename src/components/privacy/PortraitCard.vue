<script setup lang="ts">
import type { Label, Portrait } from '@/utils/privacy'

defineProps<{
  portrait: Portrait | null
  labels: Label[]
  running: boolean
  shared: boolean
}>()
</script>

<template>
  <section class="np-card np-panel pv-portrait">
    <header class="np-panel-head">
      <h2>网站眼里的你</h2>
      <span v-if="shared" class="np-chip pv-flag">分享的画像</span>
      <span v-else-if="portrait" class="np-panel-meta font-mono">指纹 {{ portrait.fpid }}</span>
      <span v-else class="np-panel-meta">{{ running ? '读取中…' : '等待探测' }}</span>
    </header>

    <p v-if="portrait" class="pv-sentence">
      出口在 <b>{{ portrait.place }}</b>，是 <b>{{ portrait.isp }}</b> 的{{ portrait.nettype }}，替你解析域名的是
      <b>{{ portrait.dns }}</b> 的服务器；这台 <b>{{ portrait.device }}</b> 上跑着 <b>{{ portrait.browser }}</b>，
      <b>{{ portrait.screen }}</b> 的屏幕、<b>{{ portrait.gpu }}</b>；语言 <b>{{ portrait.langs }}</b>、时区
      <b>{{ portrait.tz }}</b>，看起来像是 <b>{{ portrait.nat }}</b> 的人。{{ portrait.shield === '没有：浏览器原样报出指纹' ? '' : '它还看得出：' + portrait.shield + '。' }}
    </p>
    <p v-else class="pv-empty">
      {{ running ? '正在读这台设备的信息…' : '点「开始探测」，看看网站不用询问就能读到什么。' }}
    </p>

    <ul class="pv-labels">
      <li v-for="item in labels" :key="item.id">{{ item.text }}</li>
    </ul>
  </section>
</template>

<style scoped>
.pv-portrait {
  gap: 10px;
}

.pv-flag {
  font-size: 10px;
  padding: 2px 7px;
}

.pv-sentence {
  min-height: 76px;
  color: var(--text-secondary);
  font-size: 12.5px;
  line-height: 2;
}

.pv-sentence b {
  color: var(--text-primary);
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--bg-subtle);
}

.pv-empty {
  display: flex;
  align-items: center;
  min-height: 76px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.7;
}

.pv-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-height: 24px;
  list-style: none;
}

.pv-labels li {
  padding: 2px 7px;
  border: 1px solid var(--border-subtle);
  border-radius: 3px;
  color: var(--text-secondary);
  font-size: 10px;
}
</style>
