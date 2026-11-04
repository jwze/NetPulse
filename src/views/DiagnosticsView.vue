<script setup lang="ts">
import ExitInfoCard from '@/components/diagnostics/ExitInfoCard.vue'
import ClientInfoCard from '@/components/diagnostics/ClientInfoCard.vue'
import DnsLookupCard from '@/components/diagnostics/DnsLookupCard.vue'
import QualityCard from '@/components/diagnostics/QualityCard.vue'
import UploadCard from '@/components/diagnostics/UploadCard.vue'
</script>

<template>
  <div class="np-shell pt-5 pb-14">
    <section class="hero">
      <h1 class="hero-title">网络诊断</h1>
      <p class="hero-sub">
        出口地址、双栈支持、DNS 解析与链路质量，全部在浏览器里完成，不上传任何数据。
      </p>
    </section>

    <div class="diag-grid">
      <ExitInfoCard />
      <ClientInfoCard />
      <div class="span-full"><DnsLookupCard /></div>
      <QualityCard />
      <UploadCard />
    </div>
  </div>
</template>

<style scoped>
.hero {
  margin-top: 3px;
  margin-bottom: 14px;
}

.hero-title {
  color: var(--text-primary);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.hero-sub {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.diag-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  align-items: start;
}

.span-full {
  display: flex;
}

.span-full > * {
  flex: 1;
}

@media (min-width: 900px) {
  .diag-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .span-full {
    grid-column: 1 / -1;
  }
}
</style>
