<script setup lang="ts">
import { computed, ref } from 'vue'
import NodeSelector from './NodeSelector.vue'
import ThreadSlider from './ThreadSlider.vue'
import ControlButton from './ControlButton.vue'
import Toolbar from './Toolbar.vue'
import SettingsPanel from './SettingsPanel.vue'
import CustomNodes from './CustomNodes.vue'
import { useSettingsStore } from '@/stores/settings'
import { useFormatter } from '@/composables/useFormatter'

type PanelView = 'main' | 'settings' | 'nodes'
const currentView = ref<PanelView>('main')
const settings = useSettingsStore()
const { formatBytes, formatBandwidth } = useFormatter()

const flowLimit = computed(() => settings.maxUse > 0 ? formatBytes(settings.maxUse) : '不限')
const speedLimit = computed(() => settings.maxSpeed > 0 ? formatBandwidth(settings.maxSpeed) : '不限')
const scheduleStatus = computed(() => settings.cronTab.status ? '已开启' : '未开启')
const rotationStatus = computed(() => settings.nodeRotation.enabled ? '已开启' : '未开启')
const groupModeStatus = computed(() => settings.groupMode ? '已开启' : '未开启')

const modeLabel = computed(() => {
  if (settings.nodeRotation.enabled) return '节点轮换'
  if (settings.groupMode) return '节点组'
  return '单节点'
})

const emit = defineEmits<{
  (e: 'toggleRun'): void
  (e: 'openScreen'): void
  (e: 'setFlowMax'): void
  (e: 'setLimitMax'): void
  (e: 'openCard'): void
}>()

function switchView(view: PanelView) {
  currentView.value = view
}
</script>

<template>
  <section class="np-card control-card">
    <header class="np-panel-head">
      <h2 class="np-panel-title">{{ currentView === 'main' ? '控制台' : currentView === 'settings' ? '设置' : '自定义节点' }}</h2>
      <span class="np-panel-meta">{{ currentView === 'main' ? modeLabel : '返回控制台' }}</span>
    </header>

    <Transition name="fade-slide" mode="out-in">
      <div v-if="currentView === 'main'" key="main" class="control-body">
        <NodeSelector @edit-nodes="switchView('nodes')" />
        <ThreadSlider />
        <ControlButton @toggle="emit('toggleRun')" />

        <hr class="np-rule" />

        <Toolbar
          @open-nodes="switchView('nodes')"
          @open-screen="emit('openScreen')"
          @open-settings="switchView('settings')"
          @open-card="emit('openCard')"
        />

        <hr class="np-rule" />

        <div class="run-summary">
          <div class="summary-cell">
            <span class="np-label">线程</span>
            <strong class="np-num">{{ settings.threadNum }}</strong>
          </div>
          <div class="summary-cell">
            <span class="np-label">流量上限</span>
            <strong class="np-num summary-text">{{ flowLimit }}</strong>
          </div>
          <div class="summary-cell">
            <span class="np-label">带宽上限</span>
            <strong class="np-num summary-text">{{ speedLimit }}</strong>
          </div>
        </div>

        <p class="modes-line">
          定时任务{{ scheduleStatus }} · 节点联测{{ groupModeStatus }} · 节点轮换{{ rotationStatus }}
        </p>
      </div>

      <SettingsPanel v-else-if="currentView === 'settings'" key="settings" />
      <CustomNodes v-else-if="currentView === 'nodes'" key="nodes" @back="switchView('main')" />
    </Transition>
  </section>
</template>

<style scoped>
.control-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
}

.control-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.run-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.summary-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.summary-cell strong {
  font-size: 14px;
  font-weight: 500;
}

.summary-cell strong.summary-text {
  font-size: 13px;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modes-line {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.6;
}
</style>
