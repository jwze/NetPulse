import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import { brand } from '@/config/brand'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: HomeView,
  },
  {
    path: '/diagnostics',
    name: 'Diagnostics',
    component: () => import('@/views/DiagnosticsView.vue'),
  },
  {
    path: '/latency',
    name: 'Latency',
    component: () => import('@/views/LatencyView.vue'),
  },
  {
    path: '/ipv6',
    name: 'Ipv6',
    component: () => import('@/views/Ipv6View.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFoundView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach((to) => {
  if (to.path === '/') {
    document.title = `${brand.name} · ${brand.tagline}`
  } else if (to.name === 'Diagnostics') {
    document.title = `网络诊断 · ${brand.name}`
  } else if (to.name === 'Latency') {
    document.title = `全球延迟 · ${brand.name}`
  } else if (to.name === 'Ipv6') {
    document.title = `IPv6 测试 · ${brand.name}`
  } else {
    document.title = `页面未找到 · ${brand.name}`
  }
})

export default router
