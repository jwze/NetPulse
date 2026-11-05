<script setup lang="ts">
import DnsLookupCard from '@/components/diagnostics/DnsLookupCard.vue'
</script>

<template>
  <div class="pane">
    <DnsLookupCard />
  </div>
</template>

<style scoped>
.pane {
  min-width: 0;
}
</style>
