<script setup lang="ts">
import { computed } from 'vue'
import { NSelect, NTooltip } from 'naive-ui'
import { useNodesStore } from '@/stores/nodes'
import { useSettingsStore } from '@/stores/settings'
import { useClipboard } from '@vueuse/core'
import { usePanelStore } from '@/stores/panel'
import Icon from '@/components/ui/Icon.vue'

const nodesStore = useNodesStore()
const settings = useSettingsStore()
const panel = usePanelStore()
const { copy, copied } = useClipboard()

const selectOptions = computed(() => {
  if (settings.groupMode) {
    return Object.entries(nodesStore.groupedNodes)
      .map(([groupName, nodes]) => ({
        label: `${groupName} · ${nodes.filter(node => node.status).length} 个节点`,
        value: groupName,
        disabled: !nodes.some(node => node.status),
      }))
      .filter(option => !option.disabled)
  }
  const options: any[] = []
  for (const [groupName, nodes] of Object.entries(nodesStore.groupedNodes)) {
    if (nodes.length === 0) continue

    options.push({
      type: 'group',
      label: groupName,
      key: groupName,
      children: nodes.map(node => ({
        label: node.title,
        value: node.url,
        disabled: !node.status,
      })),
    })
  }
  return options
})

const selectedValue = computed({
  get: () => settings.groupMode ? settings.groupValue : settings.urlValue,
  set: (value: string) => {
    if (settings.groupMode) settings.groupValue = value
    else settings.urlValue = value
  },
})

const emit = defineEmits<{
  (e: 'editNodes'): void
}>()

function copyUrl() {
  if (!settings.groupMode && settings.urlValue) {
    copy(settings.urlValue)
  }
}
</script>

<template>
  <div class="field">
    <div class="field-head">
      <span class="np-label">测速节点</span>
      <div class="field-actions">
        <NTooltip trigger="hover">
          <template #trigger>
            <button class="np-btn-ghost small" :disabled="settings.groupMode" @click="copyUrl" aria-label="复制节点链接">
              <Icon :name="copied ? 'check' : 'copy'" :size="14" />
            </button>
          </template>
          {{ settings.groupMode ? '节点联测不提供单一链接' : copied ? '已复制' : '复制链接' }}
        </NTooltip>
        <NTooltip trigger="hover">
          <template #trigger>
            <button class="np-btn-ghost small" @click="emit('editNodes')" aria-label="自定义节点">
              <Icon name="edit" :size="14" />
            </button>
          </template>
          自定义节点
        </NTooltip>
      </div>
    </div>

    <NSelect
      v-model:value="selectedValue"
      :options="selectOptions"
      :placeholder="settings.groupMode ? '选择节点组' : '选择节点'"
      :disabled="panel.isChecking"
      size="medium"
    />
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.field-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.small {
  width: 24px;
  height: 24px;
}

.field :deep(.n-select) {
  width: 100%;
}
</style>
