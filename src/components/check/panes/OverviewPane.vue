<script setup lang="ts">
import PaneBar from '@/components/check/PaneBar.vue'
import ExitInfoCard from '@/components/diagnostics/ExitInfoCard.vue'
import ClientInfoCard from '@/components/diagnostics/ClientInfoCard.vue'
import HistoryCard from '@/components/diagnostics/HistoryCard.vue'
</script>

<template>
  <div class="pane">
    <PaneBar hint="出口地址、双栈状态与运行环境，打开即检测" />

    <div class="ov-grid">
      <div class="ov-full"><ExitInfoCard /></div>
      <ClientInfoCard />
      <HistoryCard />
    </div>
  </div>
</template>

<style scoped>
.pane {
  min-width: 0;
}

.ov-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
}

.ov-full {
  display: flex;
  grid-column: 1 / -1;
}

.ov-full > * {
  flex: 1;
}

@media (min-width: 900px) {
  .ov-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
