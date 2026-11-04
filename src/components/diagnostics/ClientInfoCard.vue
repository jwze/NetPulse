<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import DiagCard from '@/components/diagnostics/DiagCard.vue'
import { collectClientInfo, enrichClientInfo, connectionQuality, type ClientInfo } from '@/utils/clientInfo'

const info = ref<ClientInfo>(collectClientInfo())

const quality = computed(() => connectionQuality(info.value))
const protocolLabel = computed(() => {
  const value = info.value.protocol
  if (value.includes('h3') || value.includes('quic')) return 'HTTP/3'
  if (value.includes('h2')) return 'HTTP/2'
  if (value.includes('1.1')) return 'HTTP/1.1'
  return value || '未知'
})
const memoryText = computed(() => (info.value.memory ? `${info.value.memory} GB` : '未暴露'))
const coresText = computed(() => (info.value.cores ? `${info.value.cores} 核` : '未暴露'))

onMounted(async () => {
  info.value = await enrichClientInfo(info.value)
})
</script>

<template>
  <DiagCard title="本机环境" icon="M4 4h16v12H4z M8 20h8 M12 16v4">
    <div class="proto-row">
      <div>
        <div class="proto-label">当前页面协议</div>
        <div class="proto-value">{{ protocolLabel }}</div>
      </div>
      <div class="proto-right">
        <span class="np-chip">{{ quality.label }}</span>
        <span v-if="info.mobile !== null" class="np-chip">{{ info.mobile ? '移动端' : '桌面端' }}</span>
      </div>
    </div>

    <dl class="np-kv-list">
      <div class="np-kv">
        <dt>网络类型</dt>
        <dd>{{ info.effectiveType }}<span v-if="info.downlink !== null" class="kv-sub"> · 约 {{ info.downlink }} Mbps</span></dd>
      </div>
      <div class="np-kv">
        <dt>浏览器</dt>
        <dd>{{ info.browser }}</dd>
      </div>
      <div class="np-kv">
        <dt>系统</dt>
        <dd>{{ info.platform }}<span v-if="info.architecture" class="kv-sub"> · {{ info.architecture }}</span></dd>
      </div>
      <div class="np-kv">
        <dt>语言 / 时区</dt>
        <dd>{{ info.language }}<span class="kv-sub"> · {{ info.timezone }}</span></dd>
      </div>
      <div class="np-kv">
        <dt>硬件</dt>
        <dd>{{ coresText }}<span class="kv-sub"> · 内存 {{ memoryText }}</span></dd>
      </div>
      <div class="np-kv">
        <dt>屏幕</dt>
        <dd>{{ info.screen }}<span class="kv-sub"> @{{ info.dpr }}x</span></dd>
      </div>
    </dl>
  </DiagCard>
</template>

<style scoped>
.proto-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 7px;
  background: var(--bg-subtle);
}

.proto-label {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
}

.proto-value {
  margin-top: 2px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.proto-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.kv-sub {
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-weight: 500;
}
</style>
