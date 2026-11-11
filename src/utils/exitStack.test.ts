import assert from 'node:assert/strict'
import test from 'node:test'
import {
  areaText,
  asnText,
  buildBlocks,
  carrierName,
  latencyTone,
  nearGeo,
  trimArea,
  type ExitReading,
} from './exitStack.ts'
import type { IpInfo } from './ipInfo.ts'

function info(patch: Partial<IpInfo> = {}): IpInfo {
  return {
    ip: '1.2.3.4',
    version: 'IPv4',
    country: '中国',
    countryCode: 'CN',
    region: '江苏省',
    city: '南京',
    timezone: 'Asia/Shanghai',
    utcOffset: '+08:00',
    asn: 4134,
    asnOrg: 'Chinanet',
    isp: 'China Telecom',
    domain: 'chinatelecom.com.cn',
    isHosting: false,
    isProxy: false,
    isVpn: false,
    isTor: false,
    displayAddress: '中国 江苏 南京 · 中国电信',
    source: 'ipwho.is',
    ...patch,
  }
}

function reading(region: ExitReading['region'], family: 4 | 6, ip: string, ms: number | null = 20): ExitReading {
  return { region, family, ip, ms }
}

test('trims administrative suffixes without touching foreign names', () => {
  assert.equal(trimArea('江苏省'), '江苏')
  assert.equal(trimArea('北京市'), '北京')
  assert.equal(trimArea('内蒙古自治区'), '内蒙古')
  assert.equal(trimArea('广西壮族自治区'), '广西')
  assert.equal(trimArea('香港特别行政区'), '香港')
  assert.equal(trimArea('California'), 'California')
})

test('area text keeps one copy of repeated segments', () => {
  assert.equal(areaText(info()), '中国 江苏 南京')
  assert.equal(areaText(info({ region: '北京市', city: '北京市' })), '中国 北京')
  assert.equal(areaText(info({ country: '美国', countryCode: 'US', region: '加利福尼亚州', city: '山景城' })), '美国 加利福尼亚州 山景城')
  assert.equal(areaText(null), '')
})

test('carrier names fall back to the trimmed original', () => {
  assert.equal(carrierName('China Telecom'), '中国电信')
  assert.equal(carrierName('CHINANET-BACKBONE'), '中国电信')
  assert.equal(carrierName('China Unicom Beijing Province Network'), '中国联通')
  assert.equal(carrierName('Cloudflare, Inc.'), 'Cloudflare')
  assert.equal(carrierName('Some Regional Broadband Ltd.'), 'Some Regional Broadband')
  assert.equal(carrierName(''), '')
})

test('asn text is empty when the interface gave no number', () => {
  assert.equal(asnText(info()), 'AS4134')
  assert.equal(asnText(info({ asn: null })), '')
  assert.equal(asnText(null), '')
})

test('falls back to a neighbour in the same subnet', () => {
  const geo = { '1.2.3.4': info() }
  assert.equal(nearGeo(geo, '1.2.3.4')?.asn, 4134)
  assert.equal(nearGeo(geo, '1.2.9.9')?.asn, 4134)
  assert.equal(nearGeo(geo, '9.9.9.9'), null)
})

test('builds two blocks with IPv4 then IPv6, keeping empty rows', () => {
  const geo = {
    '1.2.3.4': info(),
    '104.28.1.1': info({ country: '美国', countryCode: 'US', region: '加利福尼亚州', city: '洛杉矶', asn: 13335, isp: 'Cloudflare, Inc.' }),
  }
  const blocks = buildBlocks([
    reading('cn', 4, '1.2.3.4', 12),
    reading('global', 4, '104.28.1.1', 152),
    reading('global', 6, '', null),
  ], geo)

  assert.equal(blocks.length, 2)
  assert.equal(blocks[0].label, '国内')
  assert.equal(blocks[0].lines[0].ip, '1.2.3.4')
  assert.equal(blocks[0].lines[0].ms, 12)
  assert.equal(blocks[0].lines[0].area, '中国 江苏 南京')
  assert.equal(blocks[0].lines[0].carrier, '中国电信')
  assert.equal(blocks[0].lines[0].asn, 'AS4134')

  assert.equal(blocks[0].lines[1].ip, '')
  assert.equal(blocks[0].lines[1].ms, null)
  assert.equal(blocks[0].lines[1].area, '')
  assert.equal(blocks[0].ok, true)

  assert.equal(blocks[1].lines[0].carrier, 'Cloudflare')
  assert.equal(blocks[1].lines[0].area, '美国 加利福尼亚州 洛杉矶')
  assert.equal(blocks[1].lines[1].ip, '')
})

test('marks the IPv6 row as a repeat of IPv4 when both look the same', () => {
  const geo = { '1.2.3.4': info(), '2408:8000::1': info({ ip: '2408:8000::1', version: 'IPv6' }) }
  const blocks = buildBlocks([
    reading('cn', 4, '1.2.3.4', 12),
    reading('cn', 6, '2408:8000::1', 9),
  ], geo)

  assert.equal(blocks[0].lines[0].sameAsPrev, false)
  assert.equal(blocks[0].lines[1].sameAsPrev, true)
})

test('latency thresholds are wider for overseas probes', () => {
  assert.equal(latencyTone(30, 'cn'), 'good')
  assert.equal(latencyTone(60, 'cn'), 'warn')
  assert.equal(latencyTone(120, 'cn'), 'bad')
  assert.equal(latencyTone(120, 'global'), 'good')
  assert.equal(latencyTone(220, 'global'), 'warn')
  assert.equal(latencyTone(420, 'global'), 'bad')
  assert.equal(latencyTone(null, 'cn'), 'none')
})

