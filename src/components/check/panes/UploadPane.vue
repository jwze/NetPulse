<script setup lang="ts">
import UploadCard from '@/components/diagnostics/UploadCard.vue'
</script>

<template>
  <div class="pane pane-narrow">
    <UploadCard />
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
