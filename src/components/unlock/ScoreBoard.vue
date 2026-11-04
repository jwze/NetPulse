<script setup lang="ts">
import { computed } from 'vue'
import { CATS } from '@/data/unlockServices'
import type { ScoreCard } from '@/utils/unlock'

const props = defineProps<{
  card: ScoreCard
  counts: { ok: number; no: number; reach: number; fail: number }
  running: boolean
}>()

const cells = computed(() =>
  CATS.map(cat => {
    const bucket = props.card.cats[cat.id]
    return {
      id: cat.id,
      label: cat.label,
      grade: bucket?.g || (cat.id === 'local' ? (bucket?.places.length ? '✓' : '—') : '—'),
      detail:
        cat.id === 'local'
          ? `${bucket?.places.length || 0} 个地区`
          : bucket?.n
            ? `${bucket.ok}/${bucket.n} 可用`
            : '—',
    }
  }),
)

const tone = (grade?: string) => (!grade || grade === '—' ? 'none' : grade === 'S' || grade === 'A' ? 'great' : grade === 'B' ? 'good' : grade === 'C' ? 'ok' : 'bad')
</script>

<template>
  <section class="np-card np-panel un-board">
    <header class="np-panel-head">
      <h2>成绩单</h2>
      <span class="np-panel-meta font-mono">
        可用 {{ counts.ok }} · 不可用 {{ counts.no }} · 待定 {{ counts.reach }} · 打不开 {{ counts.fail }}
      </span>
    </header>

    <div class="un-cells">
      <div v-for="cell in cells" :key="cell.id" class="un-cell">
        <span class="un-grade" :class="`tone-${tone(cell.grade)}`">{{ cell.grade }}</span>
        <span class="un-cell-label">{{ cell.label }}</span>
        <span class="un-cell-detail">{{ cell.detail }}</span>
      </div>
      <div class="un-cell is-total">
        <span class="un-grade" :class="`tone-${tone(card.total || undefined)}`">{{ card.total || '—' }}</span>
        <span class="un-cell-label">总评</span>
        <span class="un-cell-detail">{{ running ? '检测中' : card.total ? '三类合计' : '未检测' }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.un-board {
  margin-bottom: 16px;
}

.un-cells {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.un-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 9px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 5px;
  background: var(--bg-subtle);
  min-width: 0;
}

.un-cell.is-total {
  border-color: var(--border);
  background: var(--bg-card);
}

.un-grade {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}

.un-cell-label {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

.un-cell-detail {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 10px;
  white-space: nowrap;
}

.tone-great { color: #16a34a; }
.tone-good { color: #0d9488; }
.tone-ok { color: #ca8a04; }
.tone-bad { color: #dc2626; }
.tone-none { color: var(--text-muted); }

.dark .tone-great { color: #50E3A4; }
.dark .tone-good { color: #4FD1C5; }
.dark .tone-ok { color: #F5A623; }
.dark .tone-bad { color: #FF5C4E; }

@media (max-width: 719px) {
  .un-cell.is-total {
    grid-column: 1 / -1;
  }
}

@media (min-width: 720px) {
  .un-cells {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .un-cell {
    min-height: 88px;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 3px;
  }

  .un-cell-detail {
    margin-left: 0;
  }
}
</style>
