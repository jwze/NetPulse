import { defineStore } from 'pinia'
import { ref } from 'vue'
import { brand } from '@/config/brand'

type ThemeMode = 'light' | 'dark' | 'auto'

export const useAppStore = defineStore('app', () => {
  const themeMode = ref<ThemeMode>((localStorage.getItem('themeMode') as ThemeMode) || 'auto')
  const isDark = ref(false)
  const siteName = ref(brand.name)
  const siteVersion = ref(brand.version)

  let mediaQuery: MediaQueryList | null = null

  function applyTheme() {
    if (themeMode.value === 'auto') {
      isDark.value = mediaQuery?.matches ?? false
    } else {
      isDark.value = themeMode.value === 'dark'
    }
    document.documentElement.classList.toggle('dark', isDark.value)
  }

  function setThemeMode(mode: ThemeMode) {
    themeMode.value = mode
    localStorage.setItem('themeMode', mode)
    applyTheme()
  }

  function toggleDark() {
    if (themeMode.value === 'light') setThemeMode('dark')
    else if (themeMode.value === 'dark') setThemeMode('auto')
    else setThemeMode('light')
  }

  function initTheme() {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', applyTheme)
    applyTheme()
  }

  return { isDark, themeMode, siteName, siteVersion, toggleDark, setThemeMode, initTheme }
})
