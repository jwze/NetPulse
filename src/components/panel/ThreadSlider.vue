<script setup lang="ts">
import { NSlider } from 'naive-ui'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
</script>

<template>
  <div class="field">
    <div class="field-head">
      <span class="np-label">并发线程</span>
      <span class="field-value">
        <span class="thread-num np-num">{{ settings.threadNum }}</span>
      </span>
    </div>
    <NSlider
      v-model:value="settings.threadNum"
      :min="1"
      :max="64"
      :step="1"
      :tooltip="false"
    />
    <span class="hint">移动端建议 10 以内</span>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.field-value {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.thread-num {
  font-size: 13px;
  font-weight: 500;
}

.hint {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.4;
}
</style>
