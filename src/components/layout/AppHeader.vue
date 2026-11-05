<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { brand } from '@/config/brand'
import Icon from '@/components/ui/Icon.vue'

const appStore = useAppStore()
const router = useRouter()
const route = useRoute()
const mobileMenuOpen = ref(false)
const themeMenuOpen = ref(false)

const navItems = [
  { id: 0, label: '测速台', path: '/' },
  { id: 1, label: '检测中心', path: '/check' },
]

const themeModes = [
  { key: 'light', label: '日间模式', icon: 'sun' },
  { key: 'dark', label: '夜间模式', icon: 'moon' },
  { key: 'auto', label: '跟随系统', icon: 'contrast' },
] as const

const themeIcon = () => {
  if (appStore.themeMode === 'light') return 'sun'
  if (appStore.themeMode === 'dark') return 'moon'
  return 'contrast'
}

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(`${path}/`)
}

function navigate(path: string) {
  void router.push(path)
  mobileMenuOpen.value = false
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (themeMenuOpen.value) {
    const target = event.target as Node | null
    const wrap = document.querySelector('.theme-menu-wrap')
    if (!(target && wrap?.contains(target))) themeMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>

<template>
  <header class="site-header">
    <div class="np-shell header-row">
      <a class="brand" href="#" :aria-label="`${brand.name} 首页`" @click.prevent="navigate('/')">
        <svg class="brand-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M2 12h5l2-4 3.5 9L15 8l2 4h5"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="brand-name">{{ brand.name }}</span>
      </a>

      <nav class="main-nav" aria-label="主导航">
        <a
          v-for="item in navItems"
          :key="item.id"
          class="nav-item"
          :class="{ 'is-active': isActive(item.path) }"
          @click="navigate(item.path)"
        >
          {{ item.label }}
        </a>
      </nav>

      <div class="header-actions">
        <div class="theme-menu-wrap">
          <button
            class="np-btn-ghost"
            :aria-label="'主题：' + (themeModes.find(m => m.key === appStore.themeMode)?.label || '')"
            @click="themeMenuOpen = !themeMenuOpen"
          >
            <Icon :name="themeIcon()" :size="16" />
          </button>
          <Transition name="menu-fade">
            <div v-if="themeMenuOpen" class="theme-menu" @click="themeMenuOpen = false">
              <button
                v-for="mode in themeModes"
                :key="mode.key"
                :class="{ active: appStore.themeMode === mode.key }"
                @click="appStore.setThemeMode(mode.key)"
              >
                <Icon :name="mode.icon" :size="14" />
                {{ mode.label }}
                <Icon v-if="appStore.themeMode === mode.key" name="check" :size="14" class="menu-check" />
              </button>
            </div>
          </Transition>
        </div>

        <button
          class="np-btn-ghost mobile-menu-trigger"
          :aria-label="mobileMenuOpen ? '关闭菜单' : '打开菜单'"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <Icon :name="mobileMenuOpen ? 'x' : 'menu'" :size="16" />
        </button>
      </div>
    </div>

    <Transition name="fade-slide">
      <nav v-if="mobileMenuOpen" class="mobile-nav" aria-label="主导航">
        <div class="np-shell">
          <a
            v-for="item in navItems"
            :key="item.id"
            class="mobile-nav-item"
            :class="{ 'is-active': isActive(item.path) }"
            @click="navigate(item.path)"
          >
            {{ item.label }}
          </a>
        </div>
      </nav>
    </Transition>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--bg-body);
  border-bottom: 1px solid var(--border-subtle);
}

.header-row {
  display: flex;
  align-items: center;
  height: 56px;
  gap: 24px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  color: var(--text-primary);
  text-decoration: none;
  cursor: pointer;
  user-select: none;
}

.brand-mark {
  width: 20px;
  height: 20px;
  color: var(--trace);
}

.brand-name {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.01em;
  line-height: 1;
}

.main-nav {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.nav-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 100%;
  padding: 0 10px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 400;
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--dur-fast) var(--ease);
}

.nav-item:hover {
  color: var(--text-secondary);
}

.nav-item.is-active {
  color: var(--text-primary);
  font-weight: 500;
}

.nav-item.is-active::after {
  content: '';
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: -1px;
  height: 1.5px;
  background: var(--text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}

.mobile-menu-trigger {
  display: none;
}

.mobile-nav {
  border-top: 1px solid var(--border-subtle);
  padding: 8px 0;
  background: var(--bg-body);
}

.mobile-nav-item {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 8px;
  border-radius: var(--r-sm);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.mobile-nav-item.is-active {
  color: var(--text-primary);
  background: var(--bg-subtle);
  font-weight: 500;
}

.theme-menu-wrap {
  position: relative;
}

.theme-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 200;
  min-width: 148px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-md);
}

.theme-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 32px;
  padding: 0 8px;
  border: none;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
}

.theme-menu button:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.theme-menu button.active {
  color: var(--text-primary);
  font-weight: 500;
}

.menu-check {
  margin-left: auto;
  color: var(--text-muted);
}

.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease);
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 1023px) {
  .main-nav {
    display: none;
  }

  .mobile-menu-trigger {
    display: inline-flex;
  }

  .header-row {
    justify-content: space-between;
  }
}
</style>
