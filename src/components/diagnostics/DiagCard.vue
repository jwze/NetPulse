<script setup lang="ts">
defineProps<{
  title: string
  icon?: string
  hint?: string
}>()
</script>

<template>
  <section class="np-card np-panel diag-card">
    <header class="np-panel-head diag-head">
      <div class="diag-title">
        <span class="diag-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path :d="icon || 'M12 12h.01'" />
          </svg>
        </span>
        <h2>{{ title }}</h2>
        <span v-if="hint" class="np-panel-meta diag-hint">{{ hint }}</span>
      </div>
      <div class="diag-action">
        <slot name="action" />
      </div>
    </header>
    <slot />
  </section>
</template>

<style scoped>
.diag-card {
  height: 100%;
  min-width: 0;
}

.diag-head {
  gap: 12px;
}

.diag-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.diag-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  color: var(--text-secondary);
}

.diag-icon svg {
  width: 100%;
  height: 100%;
}

.diag-hint {
  overflow: hidden;
  text-overflow: ellipsis;
}

.diag-action {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}
</style>
