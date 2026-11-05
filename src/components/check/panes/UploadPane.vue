<script setup lang="ts">
import UploadCard from '@/components/diagnostics/UploadCard.vue'
</script>

<template>
  <div class="pane pane-narrow">
    <p class="pane-note">
      <span class="pane-note-tag">手动</span>
      上传测速会持续占满上行 8 秒，进入页面不自动开始。
    </p>
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
