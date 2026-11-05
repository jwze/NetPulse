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
        <p class="check-sub">
          所有网络检测收在这里，按用途分类；打开即自动检测，只有占带宽的项目需要手动开始。
        </p>
      </div>
    </header>

    <nav class="check-cats" aria-label="检测分类">
      <button
        v-for="cat in CHECK_CATEGORIES"
        :key="cat.id"
        type="button"
        class="check-cat"
        :class="{ 'is-active': cat.id === category.id }"
        @click="go(cat.id)"
      >
        <span class="check-cat-label">{{ cat.label }}</span>
        <span class="check-cat-desc">{{ cat.desc }}</span>
      </button>
    </nav>

    <nav class="check-tabs" aria-label="检测项">
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
        <span v-if="!item.auto" class="check-tab-flag">手动</span>
      </button>
    </nav>

    <KeepAlive>
      <component :is="pane" />
    </KeepAlive>
  </div>
</template>

<style scoped>
.check-page {
  padding-top: 20px;
  padding-bottom: 56px;
}

.check-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.check-head-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.check-sub {
  max-width: 640px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.check-cats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 14px;
}

.check-cat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--bg-card);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.check-cat:hover {
  border-color: var(--text-muted);
}

.check-cat.is-active {
  border-color: var(--text-primary);
  background: var(--bg-subtle);
}

.check-cat-label {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.check-cat-desc {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.check-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  padding-bottom: 1px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
  scrollbar-width: none;
}

.check-tabs::-webkit-scrollbar {
  display: none;
}

.check-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  padding: 8px 12px 10px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.15s ease;
}

.check-tab:hover {
  color: var(--text-primary);
}

.check-tab.is-active {
  color: var(--text-primary);
  font-weight: 600;
}

.check-tab.is-active::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: -1px;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--text-primary);
}

.check-tab-flag {
  padding: 1px 5px;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 600;
  line-height: 1.5;
}

@media (max-width: 760px) {
  .check-cats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .check-cat-desc {
    display: none;
  }

  .check-cat {
    align-items: center;
    padding: 9px 10px;
  }
}
</style>
