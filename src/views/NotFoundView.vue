<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="lost np-shell">
    <div class="lost-record">
      <div class="lost-head">
        <span class="np-label">路由查询</span>
        <span class="lost-mark">无应答</span>
      </div>

      <div class="lost-body">
        <p class="lost-code">404</p>
        <div class="lost-meta">
          <p class="lost-desc">这个地址没有记录</p>
          <p class="lost-hint">可能已被移除，或者链接拼错了。</p>
        </div>
      </div>

      <!-- 描迹到此为止：前面还有信号，后面是平的 -->
      <svg class="lost-trace" viewBox="0 0 560 48" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="34" x2="560" y2="34" class="trace-base" />
        <path
          d="M0 34h48l6-12 7 20 6-8h44l5-14 6 22 6-8h40l6-16 6 24 6-8h44l5-10 6 18 6-8h40l6-6 5 12 6-6h44"
          class="trace-live"
        />
        <line x1="358" y1="34" x2="560" y2="34" class="trace-dead" />
        <line x1="352" y1="22" x2="360" y2="46" class="trace-cut" />
      </svg>

      <div class="lost-actions">
        <button class="np-btn-primary" @click="router.push('/')">回到测速台</button>
        <button class="np-btn-quiet" @click="router.push('/check')">去检测中心</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lost {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  min-height: calc(100vh - 200px);
  padding-top: clamp(48px, 9vh, 96px);
}

.lost-record {
  width: 100%;
  max-width: 560px;
  padding: 20px 22px 22px;
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  background: var(--bg-card);
  box-shadow: var(--shadow-sm);
}

.lost-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-subtle);
}

.lost-mark {
  color: var(--tone-bad);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
}

.lost-body {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  padding: 22px 0 18px;
}

.lost-code {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 64px;
  font-weight: 400;
  line-height: 0.86;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}

.lost-meta {
  padding-bottom: 4px;
}

.lost-desc {
  color: var(--text-primary);
  font-size: 14px;
}

.lost-hint {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
}

.lost-trace {
  display: block;
  width: 100%;
  height: 48px;
}

.trace-base {
  stroke: var(--grid-line-strong);
  stroke-width: 1;
}

.trace-live {
  fill: none;
  stroke: var(--trace);
  stroke-width: 1.5;
  stroke-linejoin: round;
}

.trace-dead {
  stroke: var(--text-muted);
  stroke-width: 1;
  stroke-dasharray: 2 4;
  opacity: 0.5;
}

.trace-cut {
  stroke: var(--tone-bad);
  stroke-width: 1.5;
  opacity: 0.5;
}

.lost-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}

.lost-actions .np-btn-primary,
.lost-actions .np-btn-quiet {
  height: 34px;
  padding: 0 16px;
  font-size: 12px;
}

@media (max-width: 559px) {
  .lost-body {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .lost-code {
    font-size: 52px;
  }
}
</style>
