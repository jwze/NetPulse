/*
 * 离线缓存：只缓存同源静态资源，第三方接口（IP / DNS / 测速）一律不缓存。
 * 策略：导航 network-first（断网回落到缓存的 index.html），静态资源 cache-first。
 * 注意一：静态服务器普遍返回 Vary: Origin，缓存匹配必须 ignoreVary，
 * 否则预热的资源在页面请求（带 Origin 头）时匹配不上。
 * 注意二：站点可能部署在子路径（GitHub Pages 项目站点），
 * 根路径一律由 registration.scope 推出，不写死 '/'。
 */
const VERSION = 'np-v5'
const SHELL_CACHE = `${VERSION}-shell`
const ASSET_CACHE = `${VERSION}-assets`

/** 站点根，形如 '/' 或 '/net-pulse/' */
const BASE = new URL(self.registration.scope).pathname
const INDEX_URL = `${BASE}index.html`
const SHELL_URLS = [
  BASE,
  INDEX_URL,
  `${BASE}manifest.webmanifest`,
  `${BASE}favicon.svg`,
  `${BASE}pwa-192x192.png`,
]

/** 预热：首页 + 构建产出的全部 js/css（precache.json 由 vite 插件生成，路径已含站点根） */
async function precache(cache) {
  await cache.addAll(SHELL_URLS)
  try {
    const manifest = await fetch(`${BASE}precache.json`, { cache: 'reload' }).then(resp => resp.json())
    const files = Array.isArray(manifest && manifest.files) ? manifest.files : []
    await Promise.all(files.map(file => cache.add(file).catch(() => undefined)))
  } catch {
    // 清单缺失（例如旧构建）时降级为解析首页，联网后再按需缓存
    try {
      const html = await fetch(INDEX_URL, { cache: 'reload' }).then(resp => resp.text())
      const pattern = new RegExp(`(?:href|src)="(?:[^"]*?)(${BASE}assets/[^"]+)"`, 'g')
      const urls = Array.from(html.matchAll(pattern)).map(match => match[1])
      await Promise.all(urls.map(url => cache.add(url).catch(() => undefined)))
    } catch {
      // 预热失败不影响主流程
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => precache(cache))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => !key.startsWith(VERSION)).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        const cache = await caches.open(SHELL_CACHE)
        cache.put(INDEX_URL, response.clone()).catch(() => undefined)
        return response
      } catch {
        const cached = await caches.match(INDEX_URL, { ignoreVary: true })
        return cached || Response.error()
      }
    })())
    return
  }

  event.respondWith((async () => {
    const hit = await caches.match(request, { ignoreVary: true })
    if (hit) return hit
    try {
      const response = await fetch(request)
      if (response.ok && response.type === 'basic') {
        caches.open(ASSET_CACHE).then(cache => cache.put(request, response.clone())).catch(() => undefined)
      }
      return response
    } catch (error) {
      const fallback = await caches.match(request, { ignoreVary: true, ignoreSearch: true })
      if (fallback) return fallback
      throw error
    }
  })())
})
