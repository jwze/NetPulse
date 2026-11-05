<script setup lang="ts">
import { brand } from '@/config/brand'
</script>

<template>
  <footer class="site-footer">
    <div class="np-shell footer-row">
      <span>&copy; {{ new Date().getFullYear() }} {{ brand.name }}</span>
      <span class="footer-sep" aria-hidden="true">/</span>
      <span class="footer-version">v{{ brand.version }}</span>
      <span class="footer-note">{{ brand.tagline }}</span>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  margin-top: 48px;
  border-top: 1px solid var(--border-subtle);
}

.footer-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  color: var(--text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.footer-sep {
  color: var(--border-strong);
}

.footer-version {
  font-family: var(--font-mono);
}

.footer-note {
  margin-left: auto;
  letter-spacing: 0.02em;
}

@media (max-width: 640px) {
  .footer-row {
    height: auto;
    padding-block: 12px 20px;
    flex-wrap: wrap;
  }

  .footer-note {
    margin-left: 0;
    flex: 1 0 100%;
  }
}
</style>
