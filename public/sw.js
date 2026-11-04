/*
 * 离线缓存：只缓存同源静态资源，第三方接口（IP / DNS / 测速）一律不缓存。
 * 策略：导航 network-first（断网回落到缓存的 index.html），静态资源 cache-first。
 * 注意：静态服务器普遍返回 Vary: Origin，缓存匹配必须 ignoreVary，
 * 否则预热的资源在页面请求（带 Origin 头）时匹配不上。
 */
const VERSION = 'np-v4'
const SHELL_CACHE = `${VERSION}-shell`
const ASSET_CACHE = `${VERSION}-assets`
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/pwa-192x192.png']

/** 预热：首页 + 构建产出的全部 js/css（precache.json 由 vite 插件生成） */
async function precache(cache) {
  await cache.addAll(SHELL_URLS)
  try {
    const manifest = await fetch('/precache.json', { cache: 'reload' }).then(resp => resp.json())
    const files = Array.isArray(manifest && manifest.files) ? manifest.files : []
    await Promise.all(files.map(file => cache.add(file).catch(() => undefined)))
  } catch {
    // 清单缺失（例如旧构建）时降级为解析首页，联网后再按需缓存
    try {
      const html = await fetch('/index.html', { cache: 'reload' }).then(resp => resp.text())
      const urls = Array.from(html.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g)).map(match => match[1])
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
        cache.put('/index.html', response.clone()).catch(() => undefined)
        return response
      } catch {
        const cached = await caches.match('/index.html', { ignoreVary: true })
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
