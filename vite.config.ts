import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

/** 构建后输出资源清单，供 Service Worker 一次性预热，保证首次离线可用 */
function precacheManifest(): Plugin {
  let base = '/'
  return {
    name: 'np-precache-manifest',
    apply: 'build',
    configResolved(config) {
      base = config.base.endsWith('/') ? config.base : `${config.base}/`
    },
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle)
        .filter(file => file.startsWith('assets/') && /\.(js|css)$/.test(file))
        .map(file => `${base}${file}`)
      this.emitFile({
        type: 'asset',
        fileName: 'precache.json',
        source: JSON.stringify({ files }),
      })
    },
  }
}

export default defineConfig({
  // 站点根路径。自建静态托管保持 '/'，GitHub Pages 项目站点由工作流注入 '/<repo>/'
  base: process.env.VITE_BASE || '/',
  plugins: [vue(), tailwindcss(), precacheManifest()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    modulePreload: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-vue', test: /node_modules[\\/](vue|vue-router|pinia)/, priority: 3 },
            { name: 'vendor-naive', test: /node_modules[\\/]naive-ui/, priority: 2 },
            { name: 'vendor-echarts', test: /node_modules[\\/](echarts|vue-echarts)/, priority: 2 },
          ],
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames(assetInfo) {
          const name = assetInfo.names?.[0] || ''
          if (/\.css$/i.test(name)) return 'assets/css/[name]-[hash][extname]'
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(name)) return 'assets/img/[name]-[hash][extname]'
          if (/\.(woff2?|eot|ttf|otf)$/i.test(name)) return 'assets/fonts/[name]-[hash][extname]'
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
  server: {
    port: 3000,
  },
})
