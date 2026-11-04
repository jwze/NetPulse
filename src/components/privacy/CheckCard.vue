<script setup lang="ts">
import { computed } from 'vue'
import { CHECKS, type CheckId } from '@/data/privacySniffers'
import { CHECK_NAME, LEVEL_TEXT, LEVEL_TONE, type Verdict } from '@/utils/privacy'
import { grade } from '@/utils/privacyInfer'

const props = defineProps<{
  verdicts: Partial<Record<CheckId, Verdict | null>>
  score: { score: number; grade: string; counted: CheckId[] }
  title: string
  tone: string
  running: boolean
  sharedLevels?: Partial<Record<CheckId, string>> | null
}>()

const items = computed(() =>
  CHECKS.map(id => {
    const live = props.verdicts[id]
    if (live) return { id, name: CHECK_NAME[id], level: live.level, tone: LEVEL_TONE[live.level], label: LEVEL_TEXT[live.level], text: live.text }
    const shared = props.sharedLevels?.[id]
    if (shared) {
      return {
        id,
        name: CHECK_NAME[id],
        level: shared,
        tone: LEVEL_TONE[shared as keyof typeof LEVEL_TONE],
        label: LEVEL_TEXT[shared as keyof typeof LEVEL_TEXT],
        text: '来自分享的结果，只含结论',
      }
    }
    return { id, name: CHECK_NAME[id], level: 'none', tone: 'muted', label: props.running ? '检测中' : '未检测', text: '' }
  }),
)

const counts = computed(() => ({
  bad: items.value.filter(item => item.level === 'bad').length,
  warn: items.value.filter(item => item.level === 'warn').length,
}))

const hasLive = computed(() => CHECKS.some(id => !!props.verdicts[id]))

/** 打开分享链接时没有本机读数，按分享里的结论重新算一遍等级 */
const sharedScore = computed(() => {
  const levels: Record<string, 'ok' | 'warn' | 'bad' | 'info'> = {}
  for (const [id, level] of Object.entries(props.sharedLevels || {})) {
    if (level) levels[id] = level as 'ok' | 'warn' | 'bad' | 'info'
  }
  return grade(levels, CHECKS.filter(id => id !== 'fp'))
})

const displayScore = computed(() => (hasLive.value ? props.score : sharedScore.value))
const displayTone = computed(() =>
  hasLive.value ? props.tone : counts.value.bad ? 'bad' : counts.value.warn ? 'warn' : items.value.some(i => i.level !== 'none') ? 'ok' : 'none',
)
const displayTitle = computed(() =>
  hasLive.value
    ? props.title
    : counts.value.bad
      ? `分享的结果：${counts.value.bad} 处对不上`
      : counts.value.warn
        ? `分享的结果：${counts.value.warn} 处可能露馅`
        : '分享的结果：各项都对得上',
)
</script>

<template>
  <section class="np-card pv-checks">
    <header class="pv-head">
      <h2>伪装检测</h2>
      <span class="pv-score font-mono" :class="`tone-${displayTone}`">
        {{ items.some(i => i.level !== 'none') ? displayScore.grade : '—' }}
        <em v-if="items.some(i => i.level !== 'none')">{{ displayScore.score }}</em>
      </span>
    </header>

    <p v-if="items.some(i => i.level !== 'none')" class="pv-verdict" :class="`tone-${displayTone}`">{{ displayTitle }}</p>

    <ul class="pv-list">
      <li v-for="item in items" :key="item.id" class="pv-item" :class="{ 'is-empty': item.level === 'none' }">
        <span class="pv-dot" :class="`is-${item.tone}`" />
        <div class="pv-body">
          <div class="pv-line">
            <span class="pv-title">{{ item.name }}</span>
            <span class="pv-tag" :class="`is-${item.tone}`">{{ item.label }}</span>
          </div>
          <p v-if="item.text" class="pv-text">{{ item.text }}</p>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.pv-checks {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pv-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.pv-head h2 {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.pv-score {
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}

.pv-score em {
  margin-left: 3px;
  font-size: 11px;
  font-style: normal;
  font-weight: 500;
  color: var(--text-muted);
}

.tone-bad { color: #dc2626; }
.tone-warn { color: #ca8a04; }
.tone-ok { color: #16a34a; }
.tone-none { color: var(--text-muted); }

.dark .tone-bad { color: #FF5C4E; }
.dark .tone-warn { color: #F5A623; }
.dark .tone-ok { color: #50E3A4; }

.pv-verdict {
  font-size: 12px;
  line-height: 1.6;
}

.pv-list {
  display: flex;
  flex-direction: column;
  list-style: none;
}

.pv-item {
  display: grid;
  grid-template-columns: 6px minmax(0, 1fr);
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.pv-item:last-child {
  border-bottom: none;
}

.pv-item.is-empty {
  opacity: 0.55;
}

.pv-dot {
  width: 5px;
  height: 5px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--text-muted);
}

.pv-dot.is-good { background: #16a34a; }
.pv-dot.is-ok { background: #d97706; }
.pv-dot.is-bad { background: #dc2626; }
.pv-dot.is-muted { background: var(--text-muted); }

.dark .pv-dot.is-good { background: #50E3A4; }
.dark .pv-dot.is-ok { background: #F5A623; }
.dark .pv-dot.is-bad { background: #FF5C4E; }

.pv-line {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pv-title {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
}

.pv-tag {
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 600;
}

.pv-tag.is-good { background: rgba(22, 163, 74, 0.1); color: #16a34a; }
.pv-tag.is-ok { background: rgba(217, 119, 6, 0.12); color: #b45309; }
.pv-tag.is-bad { background: rgba(220, 38, 38, 0.1); color: #dc2626; }
.pv-tag.is-muted { background: var(--bg-subtle); color: var(--text-muted); }

.dark .pv-tag.is-good { color: #50E3A4; }
.dark .pv-tag.is-ok { color: #F5A623; }
.dark .pv-tag.is-bad { color: #FF5C4E; }

.pv-text {
  margin-top: 2px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.55;
}
</style>
