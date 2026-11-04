/**
 * 生成 PWA / iOS 所需的 PNG 图标。
 * 图形与 public/favicon.svg 保持一致，改图标时同步修改此处与 SVG 后重新执行：
 *   npm run icons
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const PUBLIC = path.join(ROOT, 'public')

const BG_FROM = '#17191D'
const BG_TO = '#06070A'
const ACCENT = '#3B82F6'

/** 图标主体（64 单位坐标系）的包围盒，用于居中 */
const LOGO_CENTER = { x: 29, y: 34 }
const LOGO_WIDTH = 46

const LOGO_PATH = 'M8 34h9l4-12 6 24 5-16 3 8h5'

/**
 * @param {object} opt
 * @param {number} opt.size    输出像素边长
 * @param {number} opt.ratio   图标主体占画布宽度的比例
 * @param {number} opt.radius  圆角半径（相对 512 画布）
 */
function buildSvg({ size, ratio, radius }) {
  const k = Number(((size * ratio) / LOGO_WIDTH).toFixed(4))
  const rx = Number(((radius / 512) * size).toFixed(2))
  const half = size / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BG_FROM}" />
      <stop offset="1" stop-color="${BG_TO}" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)" />
  <g transform="translate(${half} ${half}) scale(${k}) translate(${-LOGO_CENTER.x} ${-LOGO_CENTER.y})">
    <path d="${LOGO_PATH}" fill="none" stroke="${ACCENT}" stroke-width="4"
      stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="48.5" cy="38" r="3.5" fill="${ACCENT}" />
  </g>
</svg>`
}

const targets = [
  // 常规 PWA 图标：圆角，四角透明
  { file: 'pwa-192x192.png', size: 192, ratio: 0.74, radius: 112 },
  { file: 'pwa-512x512.png', size: 512, ratio: 0.74, radius: 112 },
  // maskable：满幅背景，主体收进 80% 安全区，避免被系统裁切
  { file: 'pwa-maskable-512x512.png', size: 512, ratio: 0.56, radius: 0 },
  // iOS 添加到主屏：不支持透明，系统自行切圆角
  { file: 'apple-touch-icon.png', size: 180, ratio: 0.76, radius: 0 },
]

await mkdir(PUBLIC, { recursive: true })

for (const target of targets) {
  const svg = buildSvg(target)
  const out = path.join(PUBLIC, target.file)
  const info = await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, palette: false })
    .toFile(out)
  console.log(`✓ ${target.file}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(1)}KB`)
}

// 同时把同一份图形写回 favicon.svg，保证 SVG 与 PNG 完全一致
const faviconSvg = buildSvg({ size: 64, ratio: 0.72, radius: 112 })
await writeFile(path.join(PUBLIC, 'favicon.svg'), faviconSvg + '\n', 'utf8')
console.log('✓ favicon.svg')
