<script setup lang="ts">
import { computed, ref } from 'vue'
import { HEAD_TEXT, type TestResult, type Tone, type Verdict } from '@/utils/ipv6'
import { copyText } from '@/utils/clipboard'

const props = defineProps<{
  verdict: Verdict | null
  problemText: string
  results: Record<string, TestResult>
  note4: string
  note6: string
  running: boolean
  masked: boolean
}>()

const emit = defineEmits<{ 'toggle-mask': [] }>()

const tone = computed<Tone>(() => {
  const score = props.verdict?.score ?? 0
  if (score >= 9) return 'great'
  if (score >= 7) return 'good'
  if (score >= 5) return 'ok'
  if (score >= 1) return 'warn'
  return 'bad'
})

const score = computed(() => (props.verdict ? props.verdict.score : null))
const dash = computed(() => `${((score.value ?? 0) / 10 * 2 * Math.PI * 52).toFixed(1)} 400`)

const copied = ref<0 | 4 | 6>(0)

async function copy(fam: 4 | 6) {
  const ip = fam === 6 ? props.results.v6?.ip : props.results.v4?.ip
  if (!ip) return
  if (await copyText(ip)) {
    copied.value = fam
    setTimeout(() => { if (copied.value === fam) copied.value = 0 }, 1200)
  }
}

function ipText(fam: 4 | 6): string {
  const item = fam === 6 ? props.results.v6 : props.results.v4
  if (!item) return '…'
  if (!item.ok) return fam === 6 ? '没有 IPv6 地址' : '没有 IPv4 地址'
  if (props.masked || !item.ip) return '通过'
  return item.ip
}
</script>

<template>
  <section class="np-card np-panel score-card">
    <header class="np-panel-head">
      <h2>本次评分</h2>
      <span class="np-panel-meta">满分 10 分</span>
    </header>

    <div class="score-body">
    <div class="score-top">
      <div class="score-ring" :class="`s-${tone}`" tabindex="0">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring-bg" cx="60" cy="60" r="52" />
          <circle class="ring-fg" cx="60" cy="60" r="52" :style="{ strokeDasharray: dash, opacity: score ? 1 : 0 }" />
        </svg>
        <span class="ring-num"><b>{{ score ?? '–' }}</b><i>/10</i></span>
      </div>
      <div class="score-r">
        <h2 class="score-head">
          {{ verdict ? HEAD_TEXT[verdict.head] : (running ? '正在测试…' : '尚未测试') }}
        </h2>
        <p class="score-probs">{{ problemText }}</p>
      </div>
    </div>

    <div class="score-addr">
    <div class="addr-head">
      <h3>本机地址</h3>
      <button
        v-if="results.v6?.ip || results.v4?.ip"
        class="addr-eye"
        type="button"
        @click="emit('toggle-mask')"
      >
        {{ masked ? '显示地址' : '隐藏地址' }}
      </button>
    </div>

    <div class="addrs">
      <div class="addr">
        <span class="addr-k">IPv6</span>
        <div class="addr-body">
          <code
            v-if="!masked && results.v6?.ok && results.v6.ip"
            class="addr-ip"
            :class="{ 'is-copied': copied === 6 }"
            @click="copy(6)"
          >{{ copied === 6 ? '已复制' : results.v6.ip }}</code>
          <span v-else class="addr-none">{{ ipText(6) }}</span>
          <span class="addr-note">{{ note6 }}</span>
        </div>
      </div>
      <div class="addr">
        <span class="addr-k">IPv4</span>
        <div class="addr-body">
          <code
            v-if="!masked && results.v4?.ok && results.v4.ip"
            class="addr-ip"
            :class="{ 'is-copied': copied === 4 }"
            @click="copy(4)"
          >{{ copied === 4 ? '已复制' : results.v4.ip }}</code>
          <span v-else class="addr-none">{{ ipText(4) }}</span>
          <span class="addr-note">{{ note4 }}</span>
        </div>
      </div>
    </div>
    </div>
    </div>
  </section>
</template>

<style scoped>
.score-card {
  gap: 14px;
}

.score-body {
  display: grid;
  gap: 14px;
  align-items: start;
}

.score-addr {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

@media (min-width: 760px) {
  .score-body {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px;
    align-items: center;
  }

  .score-addr {
    align-self: stretch;
    justify-content: center;
    padding-left: 24px;
    border-left: 1px solid var(--border-subtle);
  }
}

.score-top {
  display: flex;
  align-items: center;
  gap: 18px;
}

.score-ring {
  position: relative;
  flex: 0 0 auto;
  width: 116px;
  height: 116px;
}

.score-ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-bg {
  fill: none;
  stroke: var(--border);
  stroke-width: 9;
}

.ring-fg {
  fill: none;
  stroke: currentColor;
  stroke-width: 9;
  stroke-linecap: round;
  transition: stroke-dasharray 0.45s ease, opacity 0.3s ease;
}

.ring-num {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 2px;
  color: var(--text-primary);
}

.ring-num b {
  font-size: 40px;
  font-weight: 500;
  letter-spacing: -0.04em;
  line-height: 116px;
}

.ring-num i {
  color: var(--text-muted);
  font-size: 12px;
  font-style: normal;
}

.score-r {
  min-width: 0;
}

.score-head {
  color: var(--text-primary);
  font-size: 19px;
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: -0.02em;
}

.score-probs {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.65;
}

.addr-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.addr-head h3 {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.addr-eye {
  padding: 2px 0;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
}

.addr-eye:hover {
  color: var(--text-primary);
}

.addrs {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.addr {
  display: flex;
  gap: 10px;
  align-items: baseline;
}

.addr-k {
  flex: 0 0 36px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
}

.addr-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.addr-ip {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.addr-ip:hover {
  color: var(--accent);
}

.addr-ip.is-copied {
  color: var(--tone-good);
}

.dark .addr-ip.is-copied {
  color: var(--tone-good);
}

.addr-none {
  color: var(--text-secondary);
  font-size: 13px;
}

.addr-note {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.s-great { color: var(--tone-good); }
.s-good { color: var(--tone-good); }
.s-ok { color: var(--tone-warn); }
.s-warn { color: var(--tone-warn); }
.s-bad { color: var(--tone-bad); }

.dark .s-great { color: var(--tone-good); }
.dark .s-good { color: var(--tone-good); }
.dark .s-ok { color: var(--tone-warn); }
.dark .s-warn { color: var(--tone-warn); }
.dark .s-bad { color: var(--tone-bad); }

@media (max-width: 520px) {
  .score-top {
    gap: 12px;
  }

  .score-ring {
    width: 92px;
    height: 92px;
  }

  .ring-num b {
    font-size: 32px;
    line-height: 92px;
  }

  .score-head {
    font-size: 16px;
  }
}
</style>
