<script setup lang="ts">
import { computed } from 'vue'
import { ICONS } from './icon-paths'

const props = withDefaults(defineProps<{
  name: string
  size?: number
  stroke?: number
}>(), {
  size: 16,
  stroke: 1.5,
})

const inner = computed(() => ICONS[props.name] ?? '')
</script>

<template>
  <svg
    class="np-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    v-html="inner"
  />
</template>

<style scoped>
.np-icon {
  display: block;
  flex: 0 0 auto;
}
</style>
