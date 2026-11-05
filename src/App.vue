<script setup lang="ts">
import { NConfigProvider, NMessageProvider, darkTheme, type GlobalThemeOverrides } from 'naive-ui'
import { computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppFooter from '@/components/layout/AppFooter.vue'

const appStore = useAppStore()
const theme = computed(() => appStore.isDark ? darkTheme : null)

onMounted(() => {
  appStore.initTheme()
})

const fontFamily = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
const fontFamilyMono = "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace"

const lightOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#101719',
    primaryColorHover: '#23302F',
    primaryColorPressed: '#101719',
    primaryColorSuppl: '#BF4012',
    borderRadius: '10px',
    borderRadiusSmall: '6px',
    fontFamily,
    fontFamilyMono,
    fontSize: '13px',
    textColor1: '#101719',
    textColor2: '#4C5A5C',
    textColor3: '#78878A',
    dividerColor: 'rgba(16, 23, 25, 0.11)',
    hoverColor: '#EDF1F1',
    borderColor: 'rgba(16, 23, 25, 0.11)',
    bodyColor: '#F5F7F7',
    cardColor: '#FFFFFF',
    inputColor: '#FFFFFF',
  },
  Button: {
    borderRadiusMedium: '10px',
    borderRadiusLarge: '10px',
    fontWeight: '500',
    fontWeightStrong: '500',
    textColorPrimary: '#FFFFFF',
    colorPrimary: '#101719',
    colorHoverPrimary: '#23302F',
    colorPressedPrimary: '#101719',
    colorFocusPrimary: '#101719',
    borderPrimary: '1px solid #101719',
    borderHoverPrimary: '1px solid #23302F',
    borderPressedPrimary: '1px solid #101719',
    borderFocusPrimary: '1px solid #101719',
    rippleColorPrimary: 'rgba(16, 23, 25, 0.1)',
  },
  Card: { borderRadius: '14px' },
  Tooltip: { borderRadius: '6px' },
  Pagination: { borderRadius: '6px' },
}

const darkOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#E6EDEE',
    primaryColorHover: '#FFFFFF',
    primaryColorPressed: '#E6EDEE',
    primaryColorSuppl: '#F0744A',
    borderRadius: '10px',
    borderRadiusSmall: '6px',
    fontFamily,
    fontFamilyMono,
    fontSize: '13px',
    textColor1: '#E6EDEE',
    textColor2: '#9AA7A9',
    textColor3: '#677678',
    dividerColor: 'rgba(230, 237, 238, 0.11)',
    hoverColor: '#161A1C',
    borderColor: 'rgba(230, 237, 238, 0.11)',
    bodyColor: '#090B0C',
    cardColor: '#0E1113',
    modalColor: '#0E1113',
    popoverColor: '#14181A',
    tableColor: '#0E1113',
    inputColor: '#121618',
    actionColor: '#161A1C',
  },
  Button: {
    borderRadiusMedium: '10px',
    borderRadiusLarge: '10px',
    fontWeight: '500',
    fontWeightStrong: '500',
    textColorPrimary: '#090B0C',
    colorPrimary: '#E6EDEE',
    colorHoverPrimary: '#FFFFFF',
    colorPressedPrimary: '#E6EDEE',
    colorFocusPrimary: '#E6EDEE',
    borderPrimary: '1px solid #E6EDEE',
    borderHoverPrimary: '1px solid #FFFFFF',
    borderPressedPrimary: '1px solid #E6EDEE',
    borderFocusPrimary: '1px solid #E6EDEE',
    rippleColorPrimary: 'rgba(230, 237, 238, 0.1)',
  },
  Card: { borderRadius: '14px', color: '#0E1113' },
  Tooltip: { borderRadius: '6px', color: '#14181A', textColor: '#E6EDEE' },
  Pagination: { borderRadius: '6px' },
}

const themeOverrides = computed(() => appStore.isDark ? darkOverrides : lightOverrides)
</script>

<template>
  <NConfigProvider :theme="theme" :theme-overrides="themeOverrides">
    <NMessageProvider>
      <div class="app-root">
        <AppHeader />
        <main class="app-main">
          <router-view v-slot="{ Component }">
            <Transition name="fade" mode="out-in">
              <component :is="Component" />
            </Transition>
          </router-view>
        </main>
        <AppFooter />
      </div>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style scoped>
.app-root {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  overflow-x: hidden;
  background: var(--bg-body);
}

.app-main {
  flex: 1;
}
</style>
