import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compareOf,
  decodeShare,
  encodeShare,
  famOf,
  HEAD_TEXT,
  kind6,
  readAnswer,
  sameIp,
  scoreOf,
  stateOf,
  verdictOf,
  type TestResult,
} from './ipv6.ts'

function ok(ms: number, extra: Partial<TestResult> = {}): TestResult {
  return { ok: true, ms, rtt: ms, fam: 6, ...extra }
}

function allPass(ms = 80): Record<string, TestResult> {
  return {
    v4: ok(ms, { fam: 4, ip: '223.72.6.58' }),
    v6: ok(ms, { fam: 6, ip: '2409:8a00:172:7660::1' }),
    ds: ok(ms, { fam: 6, ip: '2409:8a00:172:7660::1' }),
    big: ok(ms),
    lit6: ok(ms),
    lit4: ok(ms, { fam: 4 }),
    cf4: ok(ms, { fam: 4, ip: '' }),
    cf6: ok(ms, { fam: 6, ip: '' }),
  }
}

test('地址族与写法归一', () => {
  assert.equal(famOf('223.72.6.58'), 4)
  assert.equal(famOf('2409:8A00:172::1'), 6)
  assert.equal(famOf('not-an-ip'), 0)
  assert.equal(famOf(''), 0)
  assert.ok(sameIp('2409:8a00:0172::1', '2409:8a00:172:0:0:0:0:1'))
  assert.ok(!sameIp('2409:8a00:172::1', '2409:8a00:172::2'))
})

test('kind6 区分原生与隧道', () => {
  assert.equal(kind6('2409:8a00:172::1'), 'native')
  assert.equal(kind6('2002:c000:204::1'), '6to4')
  assert.equal(kind6('2001:0:53aa:64c::1'), 'teredo')
  assert.equal(kind6('223.72.6.58'), '')
})

test('readAnswer 解析三种响应', () => {
  assert.deepEqual(readAnswer('text', ' 223.72.6.58\n'), { ip: '223.72.6.58' })
  assert.equal(readAnswer('text', 'not an ip'), null)
  const trace = readAnswer('trace', 'fl=123\nip=2409:8a00::1\nloc=CN\ncolo=NRT\n')
  assert.deepEqual(trace, { ip: '2409:8a00::1', cc: 'CN', colo: 'NRT' })
  const radar = readAnswer('radar', JSON.stringify({ ip_address: '223.72.6.58', asn: 56048, country: 'CN' }))
  assert.deepEqual(radar, { ip: '223.72.6.58', asn: 56048, cc: 'CN' })
  assert.equal(readAnswer('radar', '{oops'), null)
  assert.deepEqual(readAnswer('any', 'whatever'), {})
})

test('满分是 10，没有 IPv6 是 0', () => {
  assert.equal(scoreOf(allPass()), 10)
  assert.equal(scoreOf({ ...allPass(), v6: { ok: false }, lit6: { ok: false } }), 0)
})

test('评分按项计分并扣慢速', () => {
  const base = { v4: ok(50, { fam: 4 }), ds: ok(50), lit4: ok(50, { fam: 4 }) }
  assert.equal(scoreOf({ ...base, v6: ok(50), lit6: ok(50), big: ok(50) }), 10)
  // 缺大数据包：-2
  assert.equal(scoreOf({ ...base, v6: ok(50), lit6: ok(50), big: { ok: false } }), 8)
  // IPv6 首次响应超过 3 秒：-1
  assert.equal(scoreOf({ ...base, v6: ok(4000), lit6: ok(50), big: ok(50) }), 9)
  // 双栈网站走 IPv4、且超过 3 秒：不给 ds 与 prefer 的 3 分
  assert.equal(scoreOf({ ...base, v6: ok(50), lit6: ok(50), big: ok(50), ds: ok(4000, { fam: 4 }) }), 7)
})

test('结论覆盖五种网络形态', () => {
  const full = allPass()
  assert.equal(verdictOf(full).head, 'ready')
  assert.equal(verdictOf(full).score, 10)

  const none = { ...allPass(), v6: { ok: false }, lit6: { ok: false }, big: { ok: false }, ds: ok(50, { fam: 4 }) }
  assert.equal(verdictOf(none).head, 'none')
  assert.equal(verdictOf(none).score, 0)

  const nodns = { ...allPass(), v6: { ok: false }, big: { ok: false } }
  assert.equal(verdictOf(nodns).head, 'nodns')
  assert.ok(verdictOf(nodns).probs.includes('nodns'))

  const only6 = { ...allPass(), v4: { ok: false }, lit4: { ok: false } }
  assert.equal(verdictOf(only6).head, 'only6')

  const nat64 = { ...allPass(), lit4: { ok: false } }
  assert.equal(verdictOf(nat64).head, 'nat64')

  const offline = { v4: { ok: false }, v6: { ok: false }, ds: { ok: false }, lit4: { ok: false }, lit6: { ok: false } }
  assert.equal(verdictOf(offline).head, 'offline')
  assert.ok(HEAD_TEXT[verdictOf(offline).head])
})

test('问题列表按重要性排列', () => {
  const slow = { ...allPass(), big: { ok: false }, v6: ok(3200), ds: ok(3200, { fam: 4 }), lit6: { ok: false } }
  const probs = verdictOf(slow).probs
  assert.deepEqual(probs.slice(0, 3), ['mtu', 'slowds', 'prefer4'])
  assert.ok(probs.includes('slow6'))
  assert.ok(probs.includes('lit6'))
})

test('隧道地址会被点出来', () => {
  const r = { ...allPass(), v6: ok(80, { ip: '2002:c000:204::1' }), big: { ok: false }, lit6: ok(80) }
  assert.ok(verdictOf(r).probs.includes('tunnel'))
})

test('IPv4 与 IPv6 对比：一样快、更快、稍慢、慢很多', () => {
  const sides = (a: number, b: number) => ({
    cf4: ok(a, { fam: 4 }), cf6: ok(b, { fam: 6 }),
    gg4: ok(a, { fam: 4 }), gg6: ok(b, { fam: 6 }),
  })
  assert.equal(compareOf(sides(100, 104)).key, 'same')
  assert.equal(compareOf(sides(100, 70)).key, '6fast')
  assert.equal(compareOf(sides(100, 130)).key, '6slow')
  assert.equal(compareOf(sides(100, 400)).key, '6much')
  assert.equal(compareOf(sides(100, 104)).n, 2)
})

test('没有 IPv6 或没有一对齐时给出不同结论', () => {
  assert.equal(compareOf({ cf4: ok(50, { fam: 4 }), cf6: { ok: false } }).key, 'no6')
  // IPv6 有响应，但没有一次两种协议都拿到往返：无法对比
  assert.equal(compareOf({ cf4: ok(50, { fam: 4 }), cf6: { ok: true, ms: 60, fam: 6 } }).key, 'none')
})

test('行状态：慢、失败、没有 IPv6', () => {
  assert.equal(stateOf('v6', {}).state, 'wait')
  assert.equal(stateOf('v6', { v6: ok(50) }).state, 'ok')
  assert.equal(stateOf('v6', { v6: ok(4000) }).main.startsWith('慢'), true)
  assert.equal(stateOf('v6', { v6: { ok: false, err: 'timeout' } }).main, '超时')
  const no6 = { v6: { ok: false }, lit6: { ok: false } }
  assert.equal(stateOf('v6', no6).state, 'warn')
  assert.equal(stateOf('ds', { ds: ok(50, { fam: 6 }) }).sub, '浏览器选了 IPv6')
})

test('分享码往返，且不含地址', () => {
  const r = { ...allPass(), v6: ok(83.4, { ip: '2409:8a00:172::1', kind: 'native' as const }) }
  const code = encodeShare({ ts: 1_700_000_000_000, cc: 'CN', r })
  assert.ok(!code.includes('2409'))
  assert.ok(!code.includes('223.72'))
  const back = decodeShare(code)
  assert.ok(back)
  assert.equal(back!.cc, 'CN')
  assert.equal(back!.ts, 1_700_000_000_000)
  assert.equal(back!.r.v6.ok, true)
  assert.equal(back!.r.v6.ms, 83.4)
  assert.equal(back!.r.v6.kind, 'native')
  assert.equal(back!.r.v6.ip, '')
  assert.equal(back!.r.v4.fam, 4)
})

test('坏码与未知项被拒绝', () => {
  assert.equal(decodeShare(''), null)
  assert.equal(decodeShare('2~abc~CN~v6_6_1_1_n'), null)
  assert.equal(decodeShare('1~abc~CN~v6_9_1_1_n'), null)
  const code = encodeShare({ ts: Date.now(), cc: '', r: allPass() })
  const back = decodeShare(code)
  assert.ok(back)
  assert.equal(back!.cc, '')
  assert.equal(back!.r.lit4.ok, true)
})
