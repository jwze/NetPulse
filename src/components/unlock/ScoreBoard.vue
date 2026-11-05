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
  <section class="np-card np-panel board">
    <header class="np-panel-head">
      <h2 class="np-panel-title">成绩单</h2>
      <span class="np-panel-meta">
        可用 {{ counts.ok }} · 不可用 {{ counts.no }} · 待定 {{ counts.reach }} · 打不开 {{ counts.fail }}
      </span>
    </header>

    <div class="cells">
      <div v-for="cell in cells" :key="cell.id" class="cell">
        <span class="label">{{ cell.label }}</span>
        <span class="grade" :class="`tone-${tone(cell.grade)}`">{{ cell.grade }}</span>
        <span class="detail">{{ cell.detail }}</span>
      </div>
      <div class="cell is-total">
        <span class="label">总评</span>
        <span class="grade" :class="`tone-${tone(card.total || undefined)}`">{{ card.total || '—' }}</span>
        <span class="detail">{{ running ? '检测中' : card.total ? '三类合计' : '未检测' }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.board {
  margin-bottom: 16px;
}

.cells {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
}

.cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 4px 0 4px 16px;
  border-left: 1px solid var(--border-subtle);
}

.cell:nth-child(odd) {
  padding-left: 0;
  border-left: none;
}

.cell:nth-child(n + 3) {
  border-top: 1px solid var(--border-subtle);
  padding-top: 12px;
}

.label {
  color: var(--text-muted);
  font-size: 11px;
}

.grade {
  font-family: var(--font-mono);
  font-size: 28px;
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: -0.03em;
}

.detail {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.tone-great { color: var(--tone-good); }
.tone-good { color: var(--tone-good); }
.tone-ok { color: var(--tone-warn); }
.tone-bad { color: var(--tone-bad); }
.tone-none { color: var(--text-muted); }

@media (min-width: 720px) {
  .cells {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .cell {
    padding: 4px 0 4px 20px;
  }

  .cell:nth-child(n + 3) {
    border-top: none;
    padding-top: 4px;
  }
}
</style>
