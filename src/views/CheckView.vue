<script setup lang="ts">
import { computed, defineAsyncComponent, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CHECK_CATEGORIES, DEFAULT_CAT, DEFAULT_TAB, checkPath, findCategory, findTab } from '@/config/check'

const LOADERS: Record<string, () => Promise<{ default: Component }>> = {
  'overview/overview': () => import('@/components/check/panes/OverviewPane.vue'),
  'network/egress': () => import('@/components/check/panes/EgressPane.vue'),
  'network/latency': () => import('@/components/check/panes/LatencyPane.vue'),
  'network/ipv6': () => import('@/components/check/panes/Ipv6Pane.vue'),
  'network/multinode': () => import('@/components/check/panes/MultiNodePane.vue'),
  'quality/quality': () => import('@/components/check/panes/NetQualityPane.vue'),
  'quality/upload': () => import('@/components/check/panes/UploadPane.vue'),
  'quality/ip-quality': () => import('@/components/check/panes/IpQualityPane.vue'),
  'quality/dns': () => import('@/components/check/panes/DnsPane.vue'),
  'privacy/unlock': () => import('@/components/check/panes/UnlockPane.vue'),
  'privacy/portrait': () => import('@/components/check/panes/PrivacyPane.vue'),
  'privacy/webrtc': () => import('@/components/check/panes/WebRtcPane.vue'),
}

const route = useRoute()
const router = useRouter()

const category = computed(() => findCategory(String(route.params.cat || '')) || findCategory(DEFAULT_CAT)!)
const tab = computed(() => findTab(category.value.id, String(route.params.tab || '')) || category.value.tabs[0])

const paneCache = new Map<string, Component>()
const pane = computed(() => {
  const key = `${category.value.id}/${tab.value.id}`
  const loader = LOADERS[key] || LOADERS[`${DEFAULT_CAT}/${DEFAULT_TAB}`]
  let component = paneCache.get(key)
  if (!component) {
    component = defineAsyncComponent(loader)
    paneCache.set(key, component)
  }
  return component
})

function go(catId: string, tabId?: string) {
  const target = tabId || findCategory(catId)?.tabs[0].id
  if (!target) return
  const path = checkPath(catId, target)
  if (route.path === path) return
  void router.push(path)
}
</script>

<template>
  <div class="np-shell check-page">
    <header class="check-head">
      <div class="check-head-main">
        <h1 class="np-page-title">检测中心</h1>
        <p class="np-page-sub">所有检测收在这里，打开即自动检测；只有占带宽的几项需要手动开始</p>
      </div>
    </header>

    <div class="cat-row">
      <nav class="cat-bar" aria-label="检测分类">
        <button
          v-for="cat in CHECK_CATEGORIES"
          :key="cat.id"
          type="button"
          class="cat-btn"
          :class="{ 'is-active': cat.id === category.id }"
          @click="go(cat.id)"
        >
          {{ cat.label }}
        </button>
      </nav>
      <p v-if="category.tabs.length > 1" class="cat-desc">{{ tab.desc }}</p>
    </div>

    <nav v-if="category.tabs.length > 1" class="tab-bar" aria-label="检测项">
      <button
        v-for="item in category.tabs"
        :key="item.id"
        type="button"
        class="check-tab"
        :class="{ 'is-active': item.id === tab.id }"
        :title="item.desc"
        @click="go(category.id, item.id)"
      >
        {{ item.label }}
        <span v-if="!item.auto" class="manual-flag">手动</span>
      </button>
    </nav>

    <KeepAlive>
      <component :is="pane" />
    </KeepAlive>
  </div>
</template>

<style scoped>
.check-page {
  padding-top: 24px;
  padding-bottom: 64px;
}

.check-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.check-head-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.cat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.cat-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: var(--r-md);
  background: var(--bg-subtle);
}

.cat-btn {
  height: 30px;
  padding: 0 14px;
  border: none;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 12px;
  font-weight: 400;
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease), background-color var(--dur-fast) var(--ease),
    box-shadow var(--dur-fast) var(--ease);
}

.cat-btn:hover {
  color: var(--text-primary);
}

.cat-btn.is-active {
  background: var(--bg-card);
  box-shadow: inset 0 0 0 1px var(--border);
  color: var(--text-primary);
  font-weight: 500;
}

.cat-desc {
  color: var(--text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.tab-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 20px;
  scrollbar-width: none;
}

.tab-bar::-webkit-scrollbar {
  display: none;
}

.check-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  height: 36px;
  padding: 0 12px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--dur-fast) var(--ease);
}

.check-tab:hover {
  color: var(--text-secondary);
}

.check-tab.is-active {
  color: var(--text-primary);
  font-weight: 500;
}

.check-tab.is-active::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: -1px;
  height: 1.5px;
  background: var(--text-primary);
}

.manual-flag {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0;
  padding: 1px 4px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-xs);
  line-height: 1.4;
}

@media (max-width: 640px) {
  .cat-bar {
    width: 100%;
  }

  .cat-btn {
    flex: 1;
    padding: 0 8px;
  }

  .cat-desc {
    display: none;
  }
}
</style>
