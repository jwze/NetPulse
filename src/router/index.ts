import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import { brand } from '@/config/brand'

/** 旧的分散页面全部收敛到检测中心，老链接按 hash / query 平移过去 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: HomeView,
  },
  {
    path: '/check/:cat?/:tab?',
    name: 'Check',
    component: () => import('@/views/CheckView.vue'),
  },
  { path: '/diagnostics', redirect: to => ({ path: '/check', query: to.query, hash: to.hash }) },
  { path: '/latency', redirect: to => ({ path: '/check/network/latency', query: to.query, hash: to.hash }) },
  { path: '/ipv6', redirect: to => ({ path: '/check/network/ipv6', query: to.query, hash: to.hash }) },
  { path: '/egress', redirect: to => ({ path: '/check/network/egress', query: to.query, hash: to.hash }) },
  { path: '/ip-quality', redirect: to => ({ path: '/check/quality/ip-quality', query: to.query, hash: to.hash }) },
  { path: '/unlock', redirect: to => ({ path: '/check/privacy/unlock', query: to.query, hash: to.hash }) },
  { path: '/privacy', redirect: to => ({ path: '/check/privacy/portrait', query: to.query, hash: to.hash }) },
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
  } else if (to.name === 'Check') {
    document.title = `检测中心 · ${brand.name}`
  } else {
    document.title = `页面未找到 · ${brand.name}`
  }
})

export default router
