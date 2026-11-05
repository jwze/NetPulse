<script setup lang="ts">
import MultiNodeCard from '@/components/diagnostics/MultiNodeCard.vue'
</script>

<template>
  <div class="pane pane-narrow">
    <p class="pane-note">
      <span class="pane-note-tag">手动</span>
      会同时拉满多条线路的下行带宽，进入页面不自动开始。
    </p>
    <MultiNodeCard />
  </div>
</template>

<style scoped>
.pane {
  min-width: 0;
}

.pane-narrow {
  max-width: 760px;
}
</style>
