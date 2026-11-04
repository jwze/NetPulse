<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useMessage } from 'naive-ui'
import { PROBES } from '@/data/egressProbes'
import CheckList from '@/components/egress/CheckList.vue'
import ExitList from '@/components/egress/ExitList.vue'
import ProbeList from '@/components/egress/ProbeList.vue'
import { useEgress } from '@/composables/useEgress'
import { oddProbes } from '@/utils/egress'

const message = useMessage()
const probe = useEgress()
const { rows, exits, found, running, masked, sharedCode, progress, elapsed, verdict, start, stop, destroy, loadFromHash, copyShareLink } = probe

const odd = computed(() => oddProbes(exits.value))
const answered = computed(() => Object.keys(rows).length)
const total = PROBES.length

function toggleRun() {
  if (running.value) stop()
  else void start()
}

async function copyLink() {
  if (await copyShareLink()) message.success('结果链接已复制')
  else message.error('复制失败，请重试')
}

onMounted(() => {
  loadFromHash()
})

onUnmounted(() => {
  destroy()
})
</script>

<template>
  <div class="np-shell pt-5 pb-14">
    <section class="eg-hero">
      <div class="eg-hero-main">
        <h1 class="eg-title">出口对照</h1>
        <span v-if="sharedCode" class="np-chip eg-badge">分享结果</span>
        <span v-else-if="running" class="np-chip np-chip-success eg-badge">
          <span class="np-pulse-dot" />
          {{ progress.done }}/{{ progress.total }}
        </span>
        <span v-else-if="elapsed" class="eg-time">用时 {{ elapsed }}s</span>
      </div>
      <div class="eg-actions">
        <template v-if="exits.length">
          <button class="np-btn-ghost eg-act" type="button" @click="masked = !masked">
            {{ masked ? '显示 IP' : '隐藏 IP' }}
          </button>
          <button class="np-btn-ghost eg-act" type="button" :disabled="running" @click="copyLink">
            复制链接
          </button>
        </template>
        <button class="np-btn-primary eg-run" type="button" @click="toggleRun">
          {{ running ? '停止' : exits.length ? '重新探测' : '开始探测' }}
        </button>
      </div>
    </section>

    <div class="eg-grid">
      <CheckList
        class="eg-col-check"
        :found="found"
        :verdict="verdict"
        :running="running"
        :answered="answered"
        :total="total"
      />
      <ExitList class="eg-col-exits" :exits="exits" :masked="masked" :running="running" />
      <ProbeList class="eg-col-probes" :rows="rows" :odd="odd" :masked="masked" />
    </div>
  </div>
</template>

<style scoped>
.eg-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 3px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.eg-hero-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.eg-title {
  color: var(--text-primary);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.eg-badge {
  font-size: 11px;
  padding: 3px 8px;
}

.eg-time {
  color: var(--text-muted);
  font-size: 11px;
}

.eg-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.eg-act {
  width: auto;
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
}

.eg-act:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.eg-run {
  height: 34px;
  padding: 0 16px;
  font-size: 13px;
}

.eg-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    'check'
    'exits'
    'probes';
  gap: 16px;
  align-items: start;
}

.eg-col-check { grid-area: check; }
.eg-col-exits { grid-area: exits; }
.eg-col-probes { grid-area: probes; }

@media (max-width: 640px) {
  .eg-title {
    font-size: 24px;
  }

  .eg-actions {
    width: 100%;
  }

  .eg-act {
    flex: 1 1 calc(50% - 3px);
    height: 32px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-card);
  }

  .eg-run {
    flex: 1 1 100%;
    height: 36px;
  }
}

@media (min-width: 960px) {
  .eg-grid {
    grid-template-columns: minmax(0, 380px) minmax(0, 1fr);
    grid-template-areas:
      'check probes'
      'exits probes';
  }
}
</style>
