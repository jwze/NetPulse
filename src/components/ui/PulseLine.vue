<script setup lang="ts">
/**
 * 签名细节：一条 12px 高的脉冲波形。
 * 只有真正在跑的时候它才动；静止时是一条平线。
 */
withDefaults(defineProps<{
  live?: boolean
  width?: number
  height?: number
}>(), {
  live: false,
  width: 56,
  height: 14,
})
</script>

<template>
  <svg
    class="pulse"
    :class="{ 'is-live': live }"
    :width="width"
    :height="height"
    viewBox="0 0 60 14"
    fill="none"
    aria-hidden="true"
  >
    <path
      class="pulse-base"
      d="M1 7h15l2.5-3.6L21 10.6 23.6 3 26.4 11 29 7h6l2-2.4L39 9.4 41 7h18"
      stroke="currentColor"
      stroke-width="1.25"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
.pulse {
  display: block;
  flex: 0 0 auto;
  color: var(--text-muted);
}

.pulse-base {
  opacity: 0.55;
  transition: opacity var(--dur) var(--ease);
}

.is-live .pulse-base {
  color: var(--trace);
  opacity: 1;
  stroke-dasharray: 24 46;
  stroke-dashoffset: 70;
  animation: pulse-travel 2.4s linear infinite;
}

@keyframes pulse-travel {
  to { stroke-dashoffset: -46; }
}

@media (prefers-reduced-motion: reduce) {
  .is-live .pulse-base { animation: none; }
}
</style>
