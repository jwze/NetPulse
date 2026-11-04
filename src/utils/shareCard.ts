/**
 * 成绩卡：把一次测速结果画成 1200×630 的分享图。
 * 全程 canvas 本地绘制，不经过任何服务端，也不上传数据。
 */
import { brand } from '@/config/brand'

export interface ShareCardData {
  /** 平均下载速度，Mbps */
  mbps: number
  /** 平均下载速度，bytes/s */
  bytesPerSecond: number
  bytes: number
  seconds: number
  node: string
  date: Date
  bloat: {
    grade: string
    increaseMs: number | null
    idleMs: number | null
    loadedMs: number | null
  } | null
}

const WIDTH = 1200
const HEIGHT = 630
const SCALE = 2

const SANS = '"Inter", system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
const MONO = '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace'

const COLOR = {
  text: '#F4F6F9',
  sub: '#8B9099',
  faint: '#5C626B',
  accent: '#3B82F6',
  border: '#20242B',
  good: '#4ADE9B',
  ok: '#F5A623',
  bad: '#FF5C4E',
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.arcTo(x + w, y, x + w, y + radius, radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
  ctx.lineTo(x + radius, y + h)
  ctx.arcTo(x, y + h, x, y + h - radius, radius)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.closePath()
}

function gradeColor(grade: string) {
  if (!grade) return COLOR.sub
  if (grade.startsWith('A') || grade === 'B') return COLOR.good
  if (grade === 'C') return COLOR.ok
  return COLOR.bad
}

function formatSpeedValue(mbps: number) {
  if (!Number.isFinite(mbps) || mbps <= 0) return '0.0'
  if (mbps >= 1000) return (mbps / 1000).toFixed(2)
  if (mbps >= 100) return mbps.toFixed(1)
  return mbps.toFixed(2)
}

function formatSpeedUnit(mbps: number) {
  return mbps >= 1000 ? 'Gbps' : 'Mbps'
}

function formatBytes(bytes: number) {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(index >= 3 ? 2 : 1)} ${units[index]}`
}

function formatDuration(seconds: number) {
  if (!seconds) return '—'
  const total = Math.round(seconds)
  const min = Math.floor(total / 60)
  const sec = total % 60
  return min > 0 ? `${min} 分 ${sec} 秒` : `${sec} 秒`
}

function formatDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 画一条品牌脉搏线，和站内图标保持一致 */
function drawPulse(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = COLOR.accent
  ctx.lineWidth = size * 0.09
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(size * 0.02, size * 0.55)
  ctx.lineTo(size * 0.28, size * 0.55)
  ctx.lineTo(size * 0.4, size * 0.16)
  ctx.lineTo(size * 0.58, size * 0.86)
  ctx.lineTo(size * 0.7, size * 0.55)
  ctx.lineTo(size * 0.98, size * 0.55)
  ctx.stroke()
  ctx.restore()
}

export function buildShareCard(data: ShareCardData): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * SCALE
  canvas.height = HEIGHT * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.scale(SCALE, SCALE)

  // 背景：深色渐变 + 右上角品牌蓝微光
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
  bg.addColorStop(0, '#101216')
  bg.addColorStop(1, '#050607')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const glow = ctx.createRadialGradient(WIDTH - 120, -60, 20, WIDTH - 120, -60, 620)
  glow.addColorStop(0, 'rgba(59, 130, 246, 0.22)')
  glow.addColorStop(1, 'rgba(59, 130, 246, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const pad = 64

  // 顶部品牌
  drawPulse(ctx, pad, 54, 40)
  ctx.fillStyle = COLOR.text
  ctx.font = `700 26px ${SANS}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(brand.name, pad + 54, 84)

  ctx.fillStyle = COLOR.faint
  ctx.font = `500 15px ${SANS}`
  ctx.textAlign = 'right'
  ctx.fillText(formatDate(data.date), WIDTH - pad, 82)
  ctx.textAlign = 'left'

  // 主指标
  ctx.fillStyle = COLOR.sub
  ctx.font = `500 16px ${SANS}`
  ctx.fillText('下载速度 · 本次平均', pad, 190)

  const value = formatSpeedValue(data.mbps)
  const unit = formatSpeedUnit(data.mbps)
  ctx.fillStyle = COLOR.text
  ctx.font = `800 136px ${SANS}`
  const valueWidth = ctx.measureText(value).width
  ctx.fillText(value, pad - 4, 320)

  ctx.fillStyle = COLOR.accent
  ctx.font = `600 34px ${SANS}`
  ctx.fillText(unit, pad + valueWidth + 14, 314)

  // 分隔线
  ctx.strokeStyle = COLOR.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad, 372)
  ctx.lineTo(WIDTH - pad, 372)
  ctx.stroke()

  // 四列指标
  const bloat = data.bloat
  const cells: { label: string; value: string; color?: string; sub?: string }[] = [
    {
      label: '满载延迟',
      value: bloat?.grade || '—',
      color: bloat ? gradeColor(bloat.grade) : COLOR.sub,
      sub: bloat?.increaseMs != null ? `${bloat.increaseMs > 0 ? '+' : ''}${Math.round(bloat.increaseMs)} ms` : '未测',
    },
    {
      label: '空闲延迟',
      value: bloat?.idleMs != null ? `${Math.round(bloat.idleMs)} ms` : '—',
    },
    {
      label: '传输流量',
      value: formatBytes(data.bytes),
    },
    {
      label: '测速时长',
      value: formatDuration(data.seconds),
    },
  ]

  const colWidth = (WIDTH - pad * 2) / cells.length
  cells.forEach((cell, index) => {
    const x = pad + colWidth * index
    ctx.fillStyle = COLOR.faint
    ctx.font = `500 14px ${SANS}`
    ctx.fillText(cell.label, x, 424)

    ctx.fillStyle = cell.color || COLOR.text
    ctx.font = index === 0 ? `700 46px ${MONO}` : `650 30px ${MONO}`
    // 先量宽度再改字体，否则会用下一段字体算出来的错误宽度
    const valueWidth = ctx.measureText(cell.value).width
    ctx.fillText(cell.value, x, index === 0 ? 480 : 474)

    if (cell.sub) {
      ctx.fillStyle = COLOR.sub
      ctx.font = `500 14px ${MONO}`
      // 作为评级字母的右上角注记，避免和主值挤在一条基线上
      ctx.fillText(cell.sub, x + valueWidth + 10, 452)
    }
  })

  // 底部
  ctx.fillStyle = COLOR.border
  ctx.beginPath()
  ctx.moveTo(pad, 528)
  ctx.lineTo(WIDTH - pad, 528)
  ctx.stroke()

  ctx.fillStyle = COLOR.sub
  ctx.font = `500 15px ${SANS}`
  const nodeText = data.node ? `节点 ${data.node}` : '测速节点'
  ctx.fillText(nodeText.length > 42 ? `${nodeText.slice(0, 42)}…` : nodeText, pad, 566)

  ctx.textAlign = 'right'
  ctx.fillStyle = COLOR.faint
  ctx.font = `500 14px ${SANS}`
  ctx.fillText(`${brand.name} · 纯前端测速 · 数据仅留在本机`, WIDTH - pad, 566)
  ctx.textAlign = 'left'

  // 细边框
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  roundRect(ctx, 0.5, 0.5, WIDTH - 1, HEIGHT - 1, 0)
  ctx.stroke()

  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('图片生成失败'))
    }, 'image/png')
  })
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = filename
  link.click()
}
