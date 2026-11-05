<script setup lang="ts">
import { computed } from 'vue'
import { usePanelStore } from '@/stores/panel'
import { useSettingsStore } from '@/stores/settings'
import Icon from '@/components/ui/Icon.vue'

const panel = usePanelStore()
const settings = useSettingsStore()

const buttonText = computed(() => {
  if (panel.isChecking) return '检测节点中'
  return panel.isRunning ? '停止测速' : '开始测速'
})

const isDisabled = computed(() => {
  return panel.isChecking || (panel.isRunning && settings.cronTab.status) || settings.cronTab.tasks !== 0
})

const emit = defineEmits<{
  (e: 'toggle'): void
}>()
</script>

<template>
  <button
    class="run-button"
    :class="{ 'is-running': panel.isRunning }"
    :disabled="isDisabled"
    @click="emit('toggle')"
  >
    <Icon v-if="panel.isChecking" name="refresh" :size="15" class="np-spin" />
    <Icon v-else-if="panel.isRunning" name="stop" :size="14" />
    <Icon v-else name="play" :size="14" />
    <span>{{ buttonText }}</span>
  </button>
</template>

<style scoped>
.run-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 40px;
  border: 1px solid var(--accent-primary);
  border-radius: var(--r-md);
  background: var(--accent-primary);
  color: var(--accent-on-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
    opacity var(--dur-fast) var(--ease);
}

.run-button:hover:not(:disabled) {
  background: var(--accent-primary-hover);
  border-color: var(--accent-primary-hover);
}

.run-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 测速进行中：停止不是错误，用安静的描边按钮 */
.run-button.is-running {
  background: var(--bg-card);
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.run-button.is-running:hover:not(:disabled) {
  background: var(--bg-subtle);
  border-color: var(--text-primary);
}
</style>
