<script setup lang="ts">
defineProps<{
  title: string
  hint?: string
}>()
</script>

<template>
  <section class="np-card np-panel diag-card">
    <header class="np-panel-head diag-head">
      <h2 class="np-panel-title">{{ title }}</h2>
      <span v-if="hint" class="np-panel-meta">{{ hint }}</span>
      <div v-if="$slots.action" class="diag-action">
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
  gap: 10px;
}

.diag-action {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex: 0 0 auto;
}
</style>
