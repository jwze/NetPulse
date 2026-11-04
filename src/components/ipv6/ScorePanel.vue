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

const SCORE_TIP = [
  '满分 10 分：',
  '4  能打开只有 IPv6 的网站',
  '2  IPv6 大数据包不丢',
  '2  双栈网站打开不用等',
  '1  不靠 DNS 也能连 IPv6',
  '1  浏览器优先走 IPv6',
  '−1 IPv6 首次响应超过 3 秒',
].join('\n')

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
  <section class="np-card score-card">
    <div class="score-top">
      <div class="score-ring" :class="`s-${tone}`" :title="SCORE_TIP" tabindex="0">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring-bg" cx="60" cy="60" r="52" />
          <circle class="ring-fg" cx="60" cy="60" r="52" :style="{ strokeDasharray: dash, opacity: score ? 1 : 0 }" />
        </svg>
        <span class="ring-num"><b>{{ score ?? '–' }}</b><i>/10</i></span>
      </div>
      <div class="score-r">
        <h2 class="score-head" :class="verdict ? `s-${tone}` : ''">
          {{ verdict ? HEAD_TEXT[verdict.head] : (running ? '正在测试…' : '尚未测试') }}
        </h2>
        <p class="score-probs">{{ problemText }}</p>
      </div>
    </div>

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
  </section>
</template>

<style scoped>
.score-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
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
  font-weight: 700;
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
  font-weight: 650;
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
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}

.addr-head h3 {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.addr-eye {
  color: var(--text-muted);
  font-size: 11px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 0;
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
  font-weight: 600;
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
  font-weight: 600;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.addr-ip:hover {
  color: var(--accent);
}

.addr-ip.is-copied {
  color: #16a34a;
}

.dark .addr-ip.is-copied {
  color: #50e3a4;
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

.s-great { color: #16a34a; }
.s-good { color: #2563eb; }
.s-ok { color: #7c3aed; }
.s-warn { color: #d97706; }
.s-bad { color: #dc2626; }

.dark .s-great { color: #50e3a4; }
.dark .s-good { color: #60a5fa; }
.dark .s-ok { color: #a78bfa; }
.dark .s-warn { color: #f5a623; }
.dark .s-bad { color: #ff5c4e; }

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
