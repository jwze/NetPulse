<script setup lang="ts">
defineProps<{
  hint?: string
}>()
</script>

<template>
  <div class="pane-bar">
    <div class="pane-bar-main">
      <span v-if="hint" class="pane-hint">{{ hint }}</span>
      <slot />
    </div>

    <div v-if="$slots.actions" class="pane-bar-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.pane-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  min-height: 30px;
  margin-bottom: 12px;
}

.pane-bar-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.pane-hint {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
}

.pane-bar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .pane-bar {
    gap: 8px;
    margin-bottom: 10px;
  }

  .pane-bar-actions {
    width: 100%;
  }

  .pane-bar-actions :deep(.np-btn-quiet) {
    flex: 1 1 calc(50% - 4px);
    height: 34px;
  }

  .pane-bar-actions :deep(.np-btn-primary) {
    flex: 1 1 100%;
    height: 36px;
  }
}
</style>
