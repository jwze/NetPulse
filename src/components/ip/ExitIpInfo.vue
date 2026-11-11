<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useExitStack } from '@/composables/useExitStack'
import { FAMILIES, REGIONS } from '@/data/exitStacks'
import { latencyTone } from '@/utils/exitStack'
import { fmtMs } from '@/utils/latency'
import { copyText } from '@/utils/clipboard'
import Icon from '@/components/ui/Icon.vue'

const { blocks, loading, refresh } = useExitStack()

const copiedIp = ref('')
const spinning = ref(false)
let copiedTimer = 0

async function copy(ip: string) {
  if (!ip) return
  if (!await copyText(ip)) return
  copiedIp.value = ip
  window.clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => { copiedIp.value = '' }, 1400)
}

async function onRefresh() {
  if (spinning.value || loading.value) return
  spinning.value = true
  try {
    await refresh()
  } finally {
    spinning.value = false
  }
}

function toneOf(line: { ms: number | null }, region: 'cn' | 'global') {
  return latencyTone(line.ms, region)
}

onUnmounted(() => window.clearTimeout(copiedTimer))
</script>

<template>
  <section class="np-card exit-card">
    <header class="np-panel-head">
      <h2 class="np-panel-title">出口地址</h2>
      <div class="head-tools">
        <span v-if="copiedIp" class="copied">已复制</span>
        <button
          class="np-btn-ghost refresh"
          :disabled="loading || spinning"
          aria-label="刷新出口地址"
          @click="onRefresh"
        >
          <Icon name="refresh" :size="14" :class="{ 'np-spin': loading || spinning }" />
        </button>
      </div>
    </header>

    <div v-if="loading" class="exit-grid">
      <div v-for="region in REGIONS" :key="region.id" class="exit-block">
        <span class="exit-region">{{ region.label }}</span>
        <div class="exit-lines">
          <div v-for="family in FAMILIES" :key="family" class="exit-skel">
            <span class="np-skel skel-addr" />
            <span class="np-skel skel-geo" />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="exit-grid">
      <div v-for="block in blocks" :key="block.region" class="exit-block">
        <span class="exit-region">{{ block.label }}</span>
        <div class="exit-lines">
          <template v-for="line in block.lines" :key="line.family">
            <button class="exit-line" :disabled="!line.ip" @click="copy(line.ip)">
              <span class="fam">IPv{{ line.family }}</span>
              <span class="addr" :title="line.ip || ''">{{ line.ip || '不可用' }}</span>
              <span class="ms" :class="line.ip ? `tone-${toneOf(line, block.region)}` : ''">
                <template v-if="line.ms != null">{{ fmtMs(line.ms) }}<em>ms</em></template>
                <template v-else>—</template>
              </span>
            </button>
            <p class="exit-geo">
              <template v-if="line.ip && line.area">
                <span v-if="line.sameAsPrev" class="same">同上</span>
                <template v-else>
                  <span>{{ line.area }}</span>
                  <span v-if="line.carrier" class="carrier"> · {{ line.carrier }}</span>
                  <span v-if="line.asn" class="asn">{{ line.asn }}</span>
                </template>
              </template>
              <span v-else class="dash">—</span>
            </p>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.exit-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
}

.head-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.copied {
  color: var(--tone-good);
  font-size: 11px;
}

.refresh {
  width: 20px;
  height: 20px;
  color: var(--text-muted);
}

.exit-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.exit-block {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 4px 10px;
  min-height: 74px;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}

.exit-block:first-child {
  padding-top: 0;
  border-top: 0;
}

.exit-region {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}

.exit-lines {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.exit-line {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 6px;
  width: 100%;
  height: 18px;
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
}

.exit-line:disabled {
  cursor: default;
}

.fam {
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.6;
  letter-spacing: 0;
}

.addr {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exit-line:disabled .addr {
  color: var(--text-muted);
  font-weight: 400;
}

.exit-line:not(:disabled):hover .addr {
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: var(--border-strong);
}

.ms {
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ms em {
  margin-left: 1px;
  font-style: normal;
  font-size: 9px;
  opacity: 0.65;
}

/* 判色要盖过 .ms 自己的颜色，所以带上 .ms 一起写 */
.ms.tone-good { color: var(--tone-good); }
.ms.tone-warn { color: var(--tone-warn); }
.ms.tone-bad { color: var(--tone-bad); }
.ms.tone-none { color: var(--text-muted); }

.exit-geo {
  height: 16px;
  margin: 0;
  padding-left: 32px;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 16px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.exit-geo .same {
  color: var(--text-muted);
  opacity: 0.75;
}

.exit-geo .carrier {
  color: var(--text-secondary);
}

.exit-geo .asn {
  margin-left: 4px;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.exit-geo .dash {
  opacity: 0.6;
}

/* 骨架与成品同高，条也从地址列起，出结果时不顶开页面 */
.exit-skel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 36px;
  padding: 2px 0 0 32px;
}

.skel-addr {
  width: 76%;
  height: 12px;
}

.skel-geo {
  width: 52%;
  height: 10px;
}

@media (max-width: 400px) {
  .exit-geo {
    font-size: 10px;
  }
}
</style>
