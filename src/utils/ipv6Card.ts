/**
 * IPv6 测试结果分享图：1200×630，本地绘制，卡片里不含任何 IP 地址。
 */

import { brand } from '@/config/brand'
import { TEST_LABEL, TESTS } from '@/data/ipv6Hosts'
import { cmpText, HEAD_TEXT, toneOfScore, type Compare, type TestResult, type Tone, type Verdict } from '@/utils/ipv6'

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
}

const TONE: Record<Tone, string> = {
  great: COLOR.great,
  good: COLOR.good,
  ok: COLOR.ok,
  warn: COLOR.warn,
  bad: COLOR.bad,
}

function formatDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
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
  if (lines.length < maxLines) lines.push(line)
  return lines.slice(0, maxLines)
}

export interface Ipv6CardData {
  verdict: Verdict
  results: Record<string, TestResult>
  compare: Compare
  cc: string
  country: string
  date: Date
  elapsed: number
}

export function buildIpv6Card(data: Ipv6CardData): HTMLCanvasElement {
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

  const glow = ctx.createRadialGradient(180, 300, 20, 180, 300, 520)
  glow.addColorStop(0, 'rgba(59, 130, 246, 0.18)')
  glow.addColorStop(1, 'rgba(59, 130, 246, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const pad = 64
  drawMark(ctx, pad, 54, 40)
  ctx.fillStyle = COLOR.text
  ctx.font = `700 26px ${SANS}`
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillText(brand.name, pad + 54, 84)

  ctx.fillStyle = COLOR.faint
  ctx.font = `500 15px ${SANS}`
  ctx.textAlign = 'right'
  ctx.fillText(formatDate(data.date), WIDTH - pad, 82)

  // 得分环
  const tone = toneOfScore(data.verdict.score)
  const color = TONE[tone]
  const cx = pad + 108
  const cy = 320
  const radius = 92
  ctx.lineWidth = 15
  ctx.lineCap = 'round'
  ctx.strokeStyle = COLOR.border
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.stroke()
  if (data.verdict.score > 0) {
    ctx.strokeStyle = color
    ctx.beginPath()
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * data.verdict.score / 10)
    ctx.stroke()
  }
  ctx.textAlign = 'center'
  ctx.fillStyle = color
  ctx.font = `700 82px ${SANS}`
  ctx.fillText(String(data.verdict.score), cx, cy + 26)
  ctx.fillStyle = COLOR.sub
  ctx.font = `500 22px ${MONO}`
  ctx.fillText('/ 10', cx, cy + 58)
  ctx.textAlign = 'left'

  // 结论
  const tx = pad + 250
  const tw = WIDTH - pad - tx
  ctx.fillStyle = COLOR.sub
  ctx.font = `600 14px ${SANS}`
  ctx.fillText('IPv6 得分', tx, 210)

  ctx.fillStyle = COLOR.text
  let headSize = 32
  ctx.font = `700 ${headSize}px ${SANS}`
  while (headSize > 22 && ctx.measureText(HEAD_TEXT[data.verdict.head]).width > tw) {
    headSize -= 1
    ctx.font = `700 ${headSize}px ${SANS}`
  }
  const headLines = wrap(ctx, HEAD_TEXT[data.verdict.head], tw, 2)
  headLines.forEach((line, index) => ctx.fillText(line, tx, 250 + index * (headSize + 8)))

  const ok = TESTS.filter(test => data.results[test.id]?.ok).length
  ctx.fillStyle = color
  ctx.font = `600 15px ${SANS}`
  ctx.fillText(`${ok}/${TESTS.length} 项通过`, tx, 300 + (headLines.length - 1) * 8)

  // 六项测试，两列
  const top = 352
  TESTS.forEach((test, index) => {
    const col = index % 2
    const row = Math.floor(index / 2)
    const x = tx + col * (tw / 2)
    const y = top + row * 42
    const item = data.results[test.id]
    const warn = !!item?.ok && (item.ms ?? 0) > 3000
    ctx.font = `700 20px ${SANS}`
    ctx.fillStyle = item?.ok ? (warn ? COLOR.warn : COLOR.great) : COLOR.bad
    ctx.fillText(item?.ok ? (warn ? '!' : '✓') : '✕', x, y)
    ctx.fillStyle = item?.ok ? COLOR.text : COLOR.sub
    ctx.font = `500 20px ${SANS}`
    const label = TEST_LABEL[test.id] + (test.id === 'ds' && item?.ok ? ` · IPv${item.fam === 6 ? 6 : 4}` : '')
    ctx.fillText(clip(ctx, label, tw / 2 - 44), x + 26, y)
  })

  // 对比结论
  const cmpY = top + 2 * 42 + 46
  ctx.fillStyle = COLOR.faint
  ctx.font = `600 13px ${SANS}`
  ctx.fillText('IPv4 与 IPv6', tx, cmpY)

  const cmpTone = data.compare.key === '6much' ? COLOR.bad
    : data.compare.key === '6slow' ? COLOR.warn
      : data.compare.key === 'same' || data.compare.key === '6fast' ? COLOR.great
        : COLOR.sub
  ctx.fillStyle = cmpTone
  ctx.font = `600 20px ${SANS}`
  ctx.fillText(clip(ctx, cmpText(data.compare), tw), tx, cmpY + 30)

  // 底部
  ctx.strokeStyle = COLOR.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad, 556)
  ctx.lineTo(WIDTH - pad, 556)
  ctx.stroke()

  const foot = [data.cc ? data.country : '', data.elapsed ? `用时 ${data.elapsed.toFixed(1)} 秒` : ''].filter(Boolean).join(' · ')
  ctx.fillStyle = COLOR.sub
  ctx.font = `500 14px ${SANS}`
  ctx.fillText(clip(ctx, foot, 640), pad, 592)

  ctx.textAlign = 'right'
  ctx.fillStyle = COLOR.faint
  ctx.font = `500 13px ${SANS}`
  ctx.fillText(`${brand.name} · IPv6 测试`, WIDTH - pad, 592)
  ctx.textAlign = 'left'

  return canvas
}
