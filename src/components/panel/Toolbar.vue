<script setup lang="ts">
import Icon from '@/components/ui/Icon.vue'

const emit = defineEmits<{
  (e: 'openScreen'): void
  (e: 'openSettings'): void
  (e: 'openNodes'): void
  (e: 'openCard'): void
}>()

const actions = [
  { key: 'nodes', label: '节点', icon: 'list', event: 'openNodes' },
  { key: 'card', label: '成绩卡', icon: 'card', event: 'openCard' },
  { key: 'screen', label: '息屏', icon: 'monitor', event: 'openScreen' },
  { key: 'settings', label: '设置', icon: 'sliders', event: 'openSettings' },
] as const

function handleClick(event: string) {
  switch (event) {
    case 'openNodes': emit('openNodes'); break
    case 'openScreen': emit('openScreen'); break
    case 'openSettings': emit('openSettings'); break
    case 'openCard': emit('openCard'); break
  }
}
</script>

<template>
  <div class="tools">
    <button
      v-for="action in actions"
      :key="action.key"
      class="tool-btn"
      @click="handleClick(action.event)"
    >
      <Icon :name="action.icon" :size="15" />
      <span>{{ action.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.tools {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
}

.tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 52px;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease);
}

.tool-btn:hover {
  border-color: var(--border-subtle);
  background: var(--bg-subtle);
  color: var(--text-primary);
}
</style>
