<script setup lang="ts">
import MultiNodeCard from '@/components/diagnostics/MultiNodeCard.vue'
</script>

<template>
  <div class="pane pane-narrow">
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
