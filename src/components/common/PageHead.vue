<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <header class="np-page-head">
    <div class="np-page-head-main">
      <h1 class="np-page-title">{{ title }}</h1>
      <slot />
    </div>

    <div v-if="$slots.actions" class="np-page-actions">
      <slot name="actions" />
    </div>
  </header>
</template>
