<script setup lang="ts">
import { brand } from '@/config/brand'

const year = new Date().getFullYear()
</script>

<template>
  <footer class="mt-auto" style="margin-top: 40px; border-top: 1px solid var(--border); background: var(--bg-body)">
    <div class="np-shell footer-row">
      <div class="footer-left">
        <span>&copy; {{ year }}</span>
        <span class="font-medium" style="color: var(--text-secondary)">{{ brand.name }}</span>
        <span class="np-chip font-mono" style="padding: 2px 6px; font-size: 11px; line-height: 1">v{{ brand.version }}</span>
      </div>
      <div class="footer-right">纯前端 · 无账号 · 数据仅存本地</div>
    </div>
  </footer>
</template>

<style scoped>
.footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 34px;
  font-size: 12px;
  color: var(--text-muted);
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.footer-right {
  flex: 0 0 auto;
  white-space: nowrap;
}

@media (max-width: 520px) {
  .footer-row {
    height: auto;
    padding-block: 10px;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}
</style>
