<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NSelect } from 'naive-ui'
import DiagCard from '@/components/diagnostics/DiagCard.vue'
import { useNodesStore, type NodeItem } from '@/stores/nodes'
import { useFormatter } from '@/composables/useFormatter'
import { runMultiNodeTest, type MultiNodeItem } from '@/utils/multiNode'

const MAX = 3
const DURATION = 8000

const nodesStore = useNodesStore()
const { formatBytes, formatSpeed } = useFormatter()

const selected = ref<string[]>([])
const items = ref<MultiNodeItem[]>([])
const running = ref(false)
const error = ref('')
let controller: AbortController | null = null

const flatNodes = computed<NodeItem[]>(() => {
  const seen = new Set<string>()
  const list: NodeItem[] = []
  for (const node of Object.values(nodesStore.groupedNodes).flat()) {
    if (seen.has(node.url) || node.status === false) continue
    seen.add(node.url)
    list.push(node)
  }
  return list
})

const options = computed(() => flatNodes.value.map(node => ({
  label: node.title,
  value: node.url,
})))

watch(options, (list) => {
  if (selected.value.length || !list.length) return
  selected.value = list.slice(0, MAX).map(item => item.value)
})

const maxSpeed = computed(() => Math.max(1, ...items.value.map(item => displaySpeed(item))))
const totalSpeed = computed(() => items.value.reduce((sum, item) => sum + (running.value ? item.current : item.avg), 0))

function displaySpeed(item: MultiNodeItem) {
  return running.value ? item.current : item.avg
}

function barWidth(item: MultiNodeItem) {
  return `${Math.max(1.5, (displaySpeed(item) / maxSpeed.value) * 100)}%`
}

function toneOf(item: MultiNodeItem) {
  if (!item.ok) return 'bad'
  if (displaySpeed(item) >= maxSpeed.value * 0.75) return 'good'
  if (displaySpeed(item) >= maxSpeed.value * 0.35) return 'ok'
  return 'bad'
}

function speedText(item: MultiNodeItem) {
  if (!item.ok) return '失败'
  const value = displaySpeed(item)
  if (value > 0) return formatSpeed(value)
  return running.value ? '0 B/s' : '—'
}

function stop() {
  controller?.abort()
  controller = null
}

async function start() {
  if (running.value) {
    stop()
    return
  }
  error.value = ''
  const urls = selected.value.slice(0, MAX)
  if (urls.length < 2) {
    error.value = '至少选择 2 个节点才能对比'
    return
  }

  const targets = urls.map((url) => {
    const node = flatNodes.value.find(item => item.url === url)
    return {
      url,
      title: node?.title || url,
      method: node?.method,
      headers: node?.headers,
      postData: node?.postData,
    }
  })

  items.value = targets.map(target => ({
    title: target.title,
    url: target.url,
    bytes: 0,
    avg: 0,
    peak: 0,
    current: 0,
    series: [],
    ok: true,
    error: '',
  }))

  controller = new AbortController()
  running.value = true
  try {
    items.value = await runMultiNodeTest({
      targets,
      duration: DURATION,
      signal: controller.signal,
      onTick: (next) => {
        items.value = next
      },
    })
  } catch {
    error.value = '并发测速失败，请检查节点是否允许跨域访问'
  } finally {
    running.value = false
    controller = null
  }
}

onMounted(() => {
  void nodesStore.fetchNodes()
})

onBeforeUnmount(() => {
  stop()
})
</script>

<template>
  <DiagCard
    title="多节点对比"
    hint="并发拉流"
    icon="M3 17h4v4H3zM10 9h4v12h-4zM17 3h4v18h-4z"
  >
    <template #action>
      <button class="np-btn-primary mn-btn" :disabled="selected.length < 2 && !running" @click="start">
        {{ running ? '停止' : '开始测试' }}
      </button>
    </template>

    <div class="mn-picker">
      <NSelect
        v-model:value="selected"
        multiple
        :max="MAX"
        :options="options"
        :disabled="running"
        filterable
        size="small"
        placeholder="最多选 3 个节点"
      />
      <span class="mn-hint">{{ running ? '并发进行中，总带宽被各路平分' : `同时拉取 ${MAX} 路，看线路差距` }}</span>
    </div>

    <p v-if="error" class="mn-error">{{ error }}</p>

    <ul v-if="items.length" class="mn-list">
      <li v-for="item in items" :key="item.url" class="mn-item">
        <div class="mn-row">
          <span class="mn-name" :title="item.title">{{ item.title }}</span>
          <span class="mn-speed" :class="`tone-${toneOf(item)}`">
            {{ speedText(item) }}
          </span>
        </div>
        <div class="mn-bar">
          <span class="mn-fill" :class="`fill-${toneOf(item)}`" :style="{ width: item.ok ? barWidth(item) : '100%' }" />
        </div>
        <div class="mn-meta">
          <span>峰值 {{ item.ok ? formatSpeed(item.peak) : '—' }}</span>
          <span>{{ item.ok ? formatBytes(item.bytes) : item.error }}</span>
        </div>
      </li>
    </ul>

    <p v-else-if="!running" class="mn-tip">
      并发向 2-3 个节点拉流 8 秒，比较各自抢到的带宽。适合排查「某个节点明显更慢」的情况；
      由于带宽被平分，结果不代表单节点独跑时的峰值。节点需允许跨域（CORS）才能参与对比。
    </p>

    <div v-if="items.length && !running" class="mn-total">
      <span>合计吞吐</span>
      <strong>{{ formatSpeed(totalSpeed) }}</strong>
    </div>
  </DiagCard>
</template>

<style scoped>
.mn-btn {
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
}

.mn-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mn-hint {
  color: var(--text-muted);
  font-size: 11px;
}

.mn-error {
  color: var(--color-danger);
  font-size: 12px;
}

.mn-tip {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.6;
}

.mn-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.mn-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.mn-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.mn-name {
  min-width: 0;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mn-speed {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.mn-bar {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-subtle);
  overflow: hidden;
}

.mn-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

.fill-good {
  background: var(--color-accent);
}

.fill-ok {
  background: #F5A623;
}

.fill-bad {
  background: #EE0000;
  opacity: 0.5;
}

.mn-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-muted);
  font-size: 10px;
  font-family: var(--font-mono);
}

.mn-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 11px;
}

.mn-total strong {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
}
</style>
