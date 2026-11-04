<script setup lang="ts">
import PageHead from '@/components/common/PageHead.vue'
import ExitInfoCard from '@/components/diagnostics/ExitInfoCard.vue'
import ClientInfoCard from '@/components/diagnostics/ClientInfoCard.vue'
import DnsLookupCard from '@/components/diagnostics/DnsLookupCard.vue'
import QualityCard from '@/components/diagnostics/QualityCard.vue'
import UploadCard from '@/components/diagnostics/UploadCard.vue'
import MultiNodeCard from '@/components/diagnostics/MultiNodeCard.vue'
import WebRtcCard from '@/components/diagnostics/WebRtcCard.vue'
import HistoryCard from '@/components/diagnostics/HistoryCard.vue'
</script>

<template>
  <div class="np-shell np-page">
    <PageHead title="网络诊断" />

    <div class="diag-grid">
      <ExitInfoCard />
      <ClientInfoCard />
      <div class="span-full"><DnsLookupCard /></div>
      <QualityCard />
      <UploadCard />
      <div class="span-full"><MultiNodeCard /></div>
      <WebRtcCard />
      <HistoryCard />
    </div>
  </div>
</template>

<style scoped>
.diag-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
}

.span-full {
  display: flex;
  grid-column: 1 / -1;
}

.span-full > * {
  flex: 1;
}

@media (min-width: 900px) {
  .diag-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
