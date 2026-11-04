/**
 * 延迟结果分享图：把一次全球延迟探测画成 1200×630 的 PNG。
 * 与测速成绩卡同一套视觉，全程本地绘制。
 */

import { brand } from '@/config/brand'
import {
  fmtMs,
  tierOf,
  type Segment,
  type Tone,
  type Verdict,
  USE_TEXT,
  type UseStatus,
} from '@/utils/latency'
import type { LatencyRow } from '@/composables/useLatencyProbe'

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
  great: '#4ADE9B',
  good: '#60A5FA',
  ok: '#A78BFA',
  warn: '#F5A623',
  bad: '#FF5C4E',
  muted: '#8B9099',
}

const TONE: Record<Tone, string> = {
  great: COLOR.great,
  good: COLOR.good,
  ok: COLOR.ok,
  warn: COLOR.warn,
  bad: COLOR.bad,
  muted: COLOR.muted,
}

const USE_TONE: Record<UseStatus, Tone> = {
  great: 'great',
  ok: 'good',
  slow: 'warn',
  blocked: 'bad',
}

function formatDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

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

function clip(ctx: CanvasRenderingContext2D, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text
  let out = text
  while (out.length > 1 && ctx.measureText(`${out}…`).width > width) out = out.slice(0, -1)
  return `${out}…`
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number) {
  const lines: string[] = []
  let line = ''
  for (const char of text) {
    if (ctx.measureText(line + char).width > width && line) {
      lines.push(line)
      line = char
      if (lines.length === maxLines - 1) break
    } else {
      line += char
    }
  }
  const used = lines.join('').length
  if (lines.length < maxLines) {
    lines.push(used < text.length ? `${line.slice(0, Math.max(0, line.length - 1))}…` : line)
  }
  return lines.slice(0, maxLines)
}

export interface LatencyCardData {
  verdict: Verdict
  uses: { id: string; label: string; status: UseStatus }[]
  rows: LatencyRow[]
  answered: { ok: number; n: number }
  exitText: string
  date: Date
}

export function buildLatencyCard(data: LatencyCardData): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * SCALE
  canvas.height = HEIGHT * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.scale(SCALE, SCALE)

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

  // 判定
  const tone = TONE[data.verdict.tone]
  ctx.fillStyle = tone
  ctx.beginPath()
  ctx.arc(pad + 5, 150, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = COLOR.text
  ctx.font = `700 34px ${SANS}`
  ctx.fillText(data.verdict.title, pad + 22, 162)

  ctx.fillStyle = COLOR.sub
  ctx.font = `400 15px ${SANS}`
  const detailLines = wrap(ctx, data.verdict.detail.split('未响应：')[0], WIDTH - pad * 2, 2)
  detailLines.forEach((line, index) => ctx.fillText(line, pad, 198 + index * 23))

  // 三段中位数
  const segments: { label: string; seg: Segment }[] = [
    { label: '本地常用', seg: data.verdict.local },
    { label: '海外服务', seg: data.verdict.global },
  ]
  const cells = [
    ...segments.map(item => ({ label: item.label, value: item.seg.med, sub: `${item.seg.ok}/${item.seg.n}` })),
    { label: '整体', value: data.verdict.med, sub: `${data.answered.ok}/${data.answered.n}` },
  ]
  cells.forEach((cell, index) => {
    const x = pad + index * 260
    ctx.fillStyle = COLOR.sub
    ctx.font = `500 14px ${SANS}`
    ctx.fillText(cell.label, x, 286)

    ctx.fillStyle = cell.value == null ? COLOR.sub : COLOR.text
    ctx.font = `700 48px ${SANS}`
    const text = fmtMs(cell.value)
    ctx.fillText(text, x, 340)
    const width = ctx.measureText(text).width
    if (cell.value != null) {
      ctx.fillStyle = COLOR.accent
      ctx.font = `600 18px ${SANS}`
      ctx.fillText('ms', x + width + 6, 338)
    }
    ctx.fillStyle = COLOR.faint
    ctx.font = `500 12px ${MONO}`
    ctx.fillText(cell.sub, x + (cell.value == null ? 34 : width + 44), 338)
  })

  // 用途
  let ux = pad
  const uy = 396
  ctx.font = `600 15px ${SANS}`
  for (const use of data.uses) {
    const label = `${use.label} ${USE_TEXT[use.status]}`
    const width = ctx.measureText(label).width
    if (ux + width > WIDTH - pad) break
    ctx.fillStyle = TONE[USE_TONE[use.status]]
    ctx.fillText(label, ux, uy)
    ux += width + 26
  }

  // 分隔线
  ctx.strokeStyle = COLOR.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad, 430)
  ctx.lineTo(WIDTH - pad, 430)
  ctx.stroke()

  // 最快 / 最慢（含未响应）
  const measured = data.rows.filter(row => row.median != null)
    .slice()
    .sort((a, b) => (a.median ?? 0) - (b.median ?? 0))
  const fastest = measured.slice(0, 3)
  const slowest = measured.slice(-3).reverse()
  const lost = data.rows.filter(row => row.state === 'done' && row.median == null)

  const drawList = (x: number, title: string, items: { name: string; value: string; tone: Tone }[]) => {
    ctx.fillStyle = COLOR.faint
    ctx.font = `600 12px ${SANS}`
    ctx.fillText(title, x, 462)
    items.forEach((item, index) => {
      const y = 492 + index * 34
      ctx.fillStyle = COLOR.sub
      ctx.font = `500 14px ${SANS}`
      const label = clip(ctx, item.name, 150)
      ctx.fillText(label, x, y)
      ctx.fillStyle = TONE[item.tone]
      ctx.font = `600 15px ${MONO}`
      ctx.textAlign = 'right'
      ctx.fillText(item.value, x + 220, y)
      ctx.textAlign = 'left'
    })
  }

  drawList(pad, '最快', fastest.map(row => ({
    name: row.name,
    value: `${fmtMs(row.median)} ms`,
    tone: tierOf(row.median).tone,
  })))
  drawList(pad + 300, '最慢', slowest.map(row => ({
    name: row.name,
    value: `${fmtMs(row.median)} ms`,
    tone: tierOf(row.median).tone,
  })))
  drawList(pad + 600, '未响应', lost.slice(0, 3).map(row => ({
    name: row.name,
    value: '✕',
    tone: 'muted',
  })))

  // 底部
  ctx.strokeStyle = COLOR.border
  ctx.beginPath()
  ctx.moveTo(pad, 556)
  ctx.lineTo(WIDTH - pad, 556)
  ctx.stroke()

  ctx.fillStyle = COLOR.sub
  ctx.font = `500 14px ${SANS}`
  ctx.fillText(clip(ctx, data.exitText || '出口未知', 640), pad, 592)

  ctx.textAlign = 'right'
  ctx.fillStyle = COLOR.faint
  ctx.font = `500 13px ${SANS}`
  ctx.fillText(`${brand.name} · 全球延迟`, WIDTH - pad, 592)
  ctx.textAlign = 'left'

  return canvas
}
