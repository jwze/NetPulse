import assert from 'node:assert/strict'
import test from 'node:test'
import { CHECKS } from '../data/privacySniffers.ts'
import { engineOff, engineRange, grade, langCC, macOf, nationality, offTxt, sameLanguage, spokenIn, sysLangs } from './privacyInfer.ts'
import { encodeShare, parseShare, scoreOf, verdictText } from './privacy.ts'

test('语言指向的国家', () => {
  assert.equal(langCC('zh-CN'), 'CN')
  assert.equal(langCC('zh-TW'), 'TW')
  assert.equal(langCC('zh-Hant'), 'TW')
  assert.equal(langCC('ja'), 'JP')
  assert.equal(langCC('en-US'), 'US')
  assert.equal(langCC(''), null)
})

test('语言在哪些国家通行', () => {
  assert.deepEqual(spokenIn('zh-CN').sort(), ['CN', 'MY', 'SG'])
  assert.deepEqual(spokenIn('zh-HK').sort(), ['HK', 'MO', 'TW'])
  assert.ok(sameLanguage('CN').includes('SG'))
  assert.deepEqual(sameLanguage('JP'), ['JP'])
})

test('国籍推断用语言和时区互相印证', () => {
  assert.deepEqual(nationality({ langs: ['ja-JP'], tz: 'Asia/Tokyo' }), { cc: 'JP', from: ['langs', 'tz'] })
  assert.deepEqual(nationality({ langs: ['zh-CN'], tz: 'Asia/Kuala_Lumpur' }), { cc: 'MY', from: ['langs', 'tz'] })
  assert.deepEqual(nationality({ langs: ['en-US'], tz: 'Asia/Shanghai' }), { cc: 'CN', from: ['tz'] })
  assert.deepEqual(nationality({ langs: ['en'], tz: '', ipcc: 'SG' }), { cc: 'SG', from: ['geo'] })
})

test('时区偏移显示', () => {
  assert.equal(offTxt(480), '+08:00')
  assert.equal(offTxt(-330), '−05:30')
  assert.equal(offTxt(0), '+00:00')
})

test('IPv6 地址里的网卡号', () => {
  assert.equal(macOf('2409:8a00:172:7660:9d9f:372f:d59a:d8bd'), null)
  assert.equal(macOf('fe80::21e:c2ff:fe3b:4c3e'), '00:1e:c2:3b:4c:3e')
  assert.equal(macOf('223.72.6.58'), null)
})

test('系统语言痕迹只在 Windows 上看', () => {
  assert.equal(sysLangs({ os: 'macOS', fonts: ['SimHei'] }), false)
  assert.deepEqual(sysLangs({ os: 'Windows', fonts: ['SimHei', 'DengXian'], voices: [], kbd: 'QWERTY' }), { cc: ['CN'], from: ['fonts'] })
  assert.deepEqual(sysLangs({ os: 'Windows', fonts: [], voices: ['ja-JP', 'en-US'], kbd: null }), { cc: ['JP'], from: ['voices'] })
})

test('评分：红扣 16、黄扣 7，剩下就是等级', () => {
  assert.deepEqual(grade({}, ['tz']), { score: 100, grade: 'A+' })
  assert.deepEqual(grade({ tz: 'bad' }, ['tz']), { score: 84, grade: 'B' })
  assert.deepEqual(grade({ tz: 'warn', dns: 'warn' }, ['tz', 'dns']), { score: 86, grade: 'B' })
  assert.equal(grade({ tz: 'bad', dns: 'bad', ua: 'bad', bot: 'bad', webrtc: 'bad', tamper: 'bad' }, ['tz', 'dns', 'ua', 'bot', 'webrtc', 'tamper']).grade, 'F')
})

test('指纹检测项不参与计分', () => {
  const score = scoreOf({ fp: { level: 'warn', text: '' } })
  assert.equal(score.score, 100)
  assert.ok(!score.counted.includes('fp'))
  assert.ok(score.counted.includes('tz'))
})

test('引擎版本只在一个方向上算破绽', () => {
  const range = engineRange({ findLast: true, structuredClone: true })
  assert.deepEqual(range, { lo: 98, hi: 116, n: 2, of: 11 })
  assert.equal(engineOff(98, range), false)
  assert.equal(engineOff(120, range), false)
  assert.equal(engineOff(97, range), true)
})

test('结论按红黄项数分档', () => {
  assert.equal(verdictText({ tz: { level: 'bad', text: '' } }).tone, 'bad')
  assert.equal(verdictText({ tz: { level: 'warn', text: '' } }).tone, 'warn')
  assert.equal(verdictText({ tz: { level: 'ok', text: '' } }).tone, 'ok')
})

test('分享码只带结论和画像摘要', () => {
  const code = encodeShare({
    ts: 1790000000000,
    code: '',
    checks: { tz: 'bad', dns: 'warn', lang: 'ok' },
    place: '中国 北京',
    device: '电脑 · Windows 11',
    browser: 'Chrome 156',
    fpid: '5a3a3f68',
    shield: '没有：浏览器原样报出指纹',
  })
  assert.ok(code.startsWith('#pv=1.'))
  assert.ok(!code.includes('223.72'))
  const back = parseShare(code, [])
  assert.ok(back)
  assert.equal(back.place, '中国 北京')
  assert.equal(back.fpid, '5a3a3f68')
  assert.equal(back.checks.tz, 'bad')
  assert.equal(back.checks.dns, 'warn')
  assert.equal(back.checks.lang, 'ok')
  assert.equal(back.checks.bot, undefined)
  assert.equal(parseShare('#pv=1.%%%', []), null)
  assert.equal(parseShare('#eg=1.xxx', []), null)
})

test('检测项清单没有重复', () => {
  assert.equal(new Set(CHECKS).size, CHECKS.length)
  assert.ok(CHECKS.includes('tz') && CHECKS.includes('dns') && CHECKS.includes('webrtc'))
})
