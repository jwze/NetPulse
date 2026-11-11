/**
 * 出口地址的纯逻辑：把四条读数拼成国内 / 海外两块，配中文归属与运营商。
 * 不访问网络，便于单元测试；发请求在 exitStackProbe.ts。
 */
import { CARRIER_CN } from '../data/carrierNames.ts'
import { FAMILIES, REGIONS, type ExitRegion } from '../data/exitStacks.ts'
import { ipFamily, netOf } from './latency.ts'
import { countryName, shortenIsp, type IpInfo } from './ipInfo.ts'

export interface ExitReading {
  region: ExitRegion
  family: 4 | 6
  ip: string
  ms: number | null
}

export interface ExitLine {
  family: 4 | 6
  ip: string
  ms: number | null
  area: string
  carrier: string
  asn: string
  /** 和上一条同归属、同运营商，界面只写「同上」 */
  sameAsPrev: boolean
}

export interface ExitBlock {
  region: ExitRegion
  label: string
  lines: ExitLine[]
  ok: boolean
}

/** 省名去掉行政后缀：「江苏省」→「江苏」，海外地名原样返回 */
export function trimArea(text: string): string {
  return (text || '')
    .trim()
    .replace(/(壮族|维吾尔|回族)?自治区$/, '')
    .replace(/特别行政区$/, '')
    .replace(/[省市]$/, '')
    .trim()
}

/** 归属地：国家 省 市，重复的段只留一个 */
export function areaText(info: IpInfo | null): string {
  if (!info) return ''
  const parts: string[] = []
  const push = (value: string) => {
    const text = value.trim()
    if (!text) return
    if (parts.some(item => item.toLowerCase() === text.toLowerCase())) return
    if (parts.length && parts.join('').includes(text)) return
    parts.push(text)
  }
  push(info.country || countryName(info.countryCode, ''))
  push(trimArea(info.region))
  push(trimArea(info.city))
  return parts.join(' ')
}

/** 运营商：先翻常见的那几家，其余去掉通用后缀后截断 */
export function carrierName(raw: string): string {
  const text = (raw || '').trim()
  if (!text) return ''
  const hit = CARRIER_CN.find(item => item.match.test(text))
  if (hit) return hit.name
  // shortenIsp 去掉「Ltd.」时会剩下句点
  return shortenIsp(text).replace(/[\s,.;:·-]+$/, '')
}

export function asnText(info: IpInfo | null): string {
  return info?.asn ? `AS${info.asn}` : ''
}

/** 没有该地址的归属数据时，退到同网段已知的那条，省一次查询 */
export function nearGeo(geo: Record<string, IpInfo | null>, ip: string): IpInfo | null {
  if (!ip) return null
  if (geo[ip]) return geo[ip]
  const family = ipFamily(ip)
  const net = netOf(ip)
  const near = Object.keys(geo).find(other => {
    if (!geo[other]) return false
    return ipFamily(other) === family && netOf(other) === net
  })
  return near ? geo[near] : null
}

/** 四条读数 → 国内 / 海外两块，每块固定 IPv4、IPv6 两行，缺的不隐藏 */
export function buildBlocks(readings: ExitReading[], geo: Record<string, IpInfo | null>): ExitBlock[] {
  return REGIONS.map(({ id, label }) => {
    const lines = FAMILIES.map((family): ExitLine => {
      const reading = readings.find(item => item.region === id && item.family === family)
      const ip = reading?.ip || ''
      const info = ip ? nearGeo(geo, ip) : null
      return {
        family,
        ip,
        ms: ip ? reading?.ms ?? null : null,
        area: areaText(info),
        carrier: carrierName(info?.isp || info?.asnOrg || ''),
        asn: asnText(info),
        sameAsPrev: false,
      }
    })
    lines.forEach((line, index) => {
      const prev = lines[index - 1]
      line.sameAsPrev = !!prev?.ip && !!line.ip && !!line.area &&
        prev.area === line.area && prev.carrier === line.carrier && prev.asn === line.asn
    })
    return { region: id, label, lines, ok: lines.some(line => !!line.ip) }
  })
}

/**
 * 延迟判色按区域给阈值：国内 40ms 内算正常，出海 150ms 内算正常。
 * 用同一把尺子会把所有海外读数都标成黄色。
 */
export function latencyTone(ms: number | null, region: ExitRegion): 'good' | 'warn' | 'bad' | 'none' {
  if (ms == null || !Number.isFinite(ms)) return 'none'
  const [good, warn] = region === 'cn' ? [40, 90] : [150, 300]
  if (ms <= good) return 'good'
  if (ms <= warn) return 'warn'
  return 'bad'
}
