<script setup lang="ts">
import { computed } from 'vue'
import {
  CHECK_ORDER,
  PROBE_NAME,
  VERDICT_TEXT,
  findingText,
  type Findings,
} from '@/utils/egress'

const props = defineProps<{
  found: Findings | null
  verdict: 'leak' | 'ai' | 'split' | 'proxy' | 'direct' | null
  running: boolean
  answered: number
  total: number
}>()

const nameOf = (id: string) => PROBE_NAME[id] || id

const head = computed(() => (props.verdict ? VERDICT_TEXT[props.verdict] : null))

const headline = computed(() => {
  if (!props.found) {
    return props.running ? '正在向各类目的地发请求…' : '还没有探测结果'
  }
  const found = props.found
  const routeExit = String(found.route.v.a || '')
  if (props.verdict === 'split') {
    return `${routeExit} 之外的线路另有出口`
  }
  return routeExit ? `出口 ${routeExit}` : '没有可用的出口'
})

const detail = computed(() => {
  if (!props.found) {
    return props.running
      ? '国内网站、海外 IP 服务、AI 服务、常用网站、单栈主机与 STUN 会同时询问，几秒内出结果。'
      : '点「开始探测」后，会同时询问 51 个探测器，按看到的地址归并出口。'
  }
  const found = props.found
  switch (props.verdict) {
    case 'leak':
      return '网站看到的是代理，但 UDP 或 IPv6 从本地线路直接出去了：任何页面都能读到这条线路。'
    case 'ai':
      return 'AI 服务把这条线路定位在不提供服务的地区，账号与支付都可能被拒绝。'
    case 'split':
      return '规则按目的地分流：国内网站与海外目的地看到不同的地址，这是正常的规则代理行为。'
    case 'proxy':
      return `所有目的地都看到同一个代理出口 ${String(found.route.v.a || '')}。`
    case 'direct':
      return '所有目的地都看到本地线路，没有经过代理。'
    default:
      return ''
  }
})

/** 七项始终列出，探测前后卡片高度一致 */
const CHECK_LABEL: Record<string, string> = {
  route: '路线是否一致',
  except: '例外线路',
  ai: 'AI 服务可达性',
  rtc: 'WebRTC 泄露',
  nat: 'NAT 类型',
  v6: 'IPv6',
  tz: '时区与出口',
}

const checks = computed(() =>
  CHECK_ORDER.map(id => {
    const finding = props.found?.[id]
    if (!finding) {
      return { id, title: CHECK_LABEL[id] || id, text: props.running ? '正在核对…' : '', tone: 'info', level: 'none' }
    }
    if (finding.s === 'none') {
      return { id, title: CHECK_LABEL[id] || id, text: '不适用于当前结果', tone: 'info', level: 'none' }
    }
    const text = findingText(id, finding, nameOf)
    const tone =
      finding.s === 'bad' ? 'bad' : finding.s === 'warn' ? 'warn' : finding.s === 'ok' ? 'good' : 'info'
    return { id, ...text, tone, level: finding.s }
  }),
)

const icon = (tone: string) => (tone === 'bad' ? '✕' : tone === 'warn' ? '!' : tone === 'good' ? '✓' : '·')
</script>

<template>
  <section class="np-card np-panel eg-check">
    <header class="np-panel-head">
      <h2>结论</h2>
      <span class="np-panel-meta font-mono">{{ answered }}/{{ total }}</span>
    </header>

    <div class="eg-verdict">
      <span v-if="head" class="eg-dot" :class="`is-${head.tone}`" />
      <div class="eg-verdict-text">
        <h3>{{ head ? head.title : '等待探测' }}</h3>
        <p class="eg-headline">{{ headline }}</p>
      </div>
    </div>
    <p class="eg-detail">{{ detail }}</p>

    <ul class="eg-checks">
      <li v-for="item in checks" :key="item.id" class="eg-check-row">
        <span class="eg-badge" :class="`is-${item.tone}`">{{ icon(item.tone) }}</span>
        <div>
          <p class="eg-check-title" :class="`tone-${item.tone === 'info' ? 'none' : item.tone}`">{{ item.title }}</p>
          <p v-if="item.text" class="eg-check-text">{{ item.text }}</p>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.eg-check {
  gap: 10px;
}

.eg-verdict {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 2px;
}

.eg-dot {
  width: 8px;
  height: 8px;
  margin-top: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--text-muted);
}

.eg-dot.is-bad { background: var(--tone-bad); }
.eg-dot.is-ok, .eg-dot.is-good { background: var(--tone-good); }
.eg-dot.is-warn { background: var(--tone-warn); }

.dark .eg-dot.is-bad { background: var(--tone-bad); }
.dark .eg-dot.is-ok, .dark .eg-dot.is-good { background: var(--tone-good); }
.dark .eg-dot.is-warn { background: var(--tone-warn); }

.eg-verdict-text h3 {
  color: var(--text-primary);
  font-size: 19px;
  font-weight: 500;
  letter-spacing: -0.025em;
  line-height: 1.25;
}

.eg-headline {
  margin-top: 2px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 12px;
}

.eg-detail {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.eg-checks {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 2px;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
  list-style: none;
}

.eg-check-row {
  display: flex;
  gap: 8px;
  min-height: 36px;
}

.eg-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-top: 1px;
  flex: 0 0 auto;
  border-radius: 50%;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
}

.eg-badge.is-bad { background: var(--tone-bad-bg); color: var(--tone-bad); }
.eg-badge.is-warn { background: var(--tone-warn-bg); color: var(--tone-warn); }
.eg-badge.is-good { background: var(--tone-good-bg); color: var(--tone-good); }
.eg-badge.is-info { background: var(--bg-subtle); color: var(--text-muted); }

.dark .eg-badge.is-bad { color: var(--tone-bad); }
.dark .eg-badge.is-warn { color: var(--tone-warn); }
.dark .eg-badge.is-good { color: var(--tone-good); }

.eg-check-title {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
}

.eg-check-text {
  margin-top: 1px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
</style>
