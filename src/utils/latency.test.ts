import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addHistory,
  diagnose,
  diffRuns,
  encodeShare,
  gradeSegment,
  groupExits,
  jitter,
  median,
  parseHistory,
  parseShare,
  posOf,
  segmentOf,
  tierOf,
  useStatus,
  TOL,
} from './latency.ts'
import { SERVICES, serviceById } from '../data/latencyServices.ts'

test('median handles gaps and even counts', () => {
  assert.equal(median([30, 10, 20]), 20)
  assert.equal(median([10, 20, 30, 40]), 25)
  assert.equal(median([null, 12, null]), 12)
  assert.equal(median([]), null)
})

test('jitter averages neighbouring differences', () => {
  assert.equal(jitter([10, 20, 15]), 7.5)
  assert.equal(jitter([42]), null)
})

test('tiers follow the round-trip scale', () => {
  assert.equal(tierOf(1).key, 'instant')
  assert.equal(tierOf(30).key, 'great')
  assert.equal(tierOf(80).key, 'good')
  assert.equal(tierOf(151).key, 'slow')
  assert.equal(tierOf(900).key, 'bad')
  assert.equal(tierOf(null).key, 'lost')
})

test('lane positions are clamped between 5 and 1000 ms', () => {
  assert.equal(posOf(5), 0)
  assert.equal(posOf(1000), 1)
  assert.equal(posOf(1), 0)
  assert.equal(posOf(5000), 1)
  assert.ok(posOf(100) > 0.5 && posOf(100) < 0.7)
})

test('segment and grade split answered from lost', () => {
  const seg = segmentOf([30, 40, null, 50], ['a', 'b', 'c', 'd'])
  assert.equal(seg.n, 4)
  assert.equal(seg.ok, 3)
  assert.equal(seg.med, 40)
  assert.deepEqual(seg.lost, ['c'])
  assert.equal(gradeSegment(seg), 'good')
  assert.equal(gradeSegment(segmentOf([null, null, null, 100], ['a', 'b', 'c', 'd'])), 'blocked')
})

test('diagnose tells which side is slow', () => {
  const seg = (values: (number | null)[]) => segmentOf(values, values.map((_, i) => `s${i}`))
  const allGood = diagnose(seg([30, 40, 50, 60]), seg([70, 80, 60, 50]))
  assert.equal(allGood.key, 'allgood')

  const far = diagnose(seg([20, 25, 30, 35]), seg([300, 320, 280, 310]))
  assert.equal(far.key, 'far')

  const odd = diagnose(seg([200, 220, 210, 230]), seg([60, 70, 65, 55]))
  assert.equal(odd.key, 'odd')

  const nearSlow = diagnose(seg([200, 210, 220, 230]), seg([200, 210, 220, 230]))
  assert.equal(nearSlow.key, 'near_slow')

  const down = diagnose(seg([null, null, null, 10]), seg([null, null, null, null]))
  assert.equal(down.key, 'down')
})

test('use status respects smooth and fine limits', () => {
  assert.equal(useStatus(segmentOf([40, 50], ['a', 'b']), 80, 150), 'great')
  assert.equal(useStatus(segmentOf([100, 120], ['a', 'b']), 80, 150), 'ok')
  assert.equal(useStatus(segmentOf([200, 220], ['a', 'b']), 80, 150), 'slow')
  assert.equal(useStatus(segmentOf([null, null], ['a', 'b']), 80, 150), 'blocked')
})

test('share code round-trips without any address', () => {
  const code = encodeShare({
    ts: 1_700_000_000_000,
    pack: 'cn',
    exits: [
      { cc: 'JP', city: 'Tokyo', org: 'Example ISP', asn: 2497, proxy: false },
      { cc: 'US', city: 'Los Angeles', org: 'Cloud Host', asn: 13335, proxy: true },
    ],
    res: { google: 42.3, netflix: null, 'google-cdn': 12 },
  })
  assert.ok(code.startsWith('1.'))
  const parsed = parseShare(code)
  assert.ok(parsed)
  assert.equal(parsed!.ts, 1_700_000_000_000)
  assert.equal(parsed!.pack, 'cn')
  assert.equal(parsed!.exits.length, 2)
  assert.equal(parsed!.exits[0].org, 'Example ISP')
  assert.equal(parsed!.exits[1].proxy, true)
  assert.equal(parsed!.res['google-cdn'], 12)
  assert.equal(parsed!.res.netflix, null)
})

test('bad share codes are rejected', () => {
  assert.equal(parseShare(''), null)
  assert.equal(parseShare('2.abc.cn....'), null)
  assert.equal(parseShare('1.abc.z9..'), null)
})

test('diff only reports moves beyond the noise tolerance', () => {
  const before = { google: 100, netflix: 50, github: 30, x: null }
  const after = { google: 105, netflix: 120, github: 31, x: 40 }
  const { changed } = diffRuns(before, after, SERVICES)
  const ids = changed.map(row => row.id)
  assert.deepEqual(ids.sort(), ['netflix', 'x'])
  assert.equal(TOL.abs, 20)
  assert.equal(serviceById('netflix')!.name, 'Netflix')
})

test('exit groups merge one network and put local first', () => {
  const geo = {
    '203.0.113.5': { cc: 'JP', city: 'Tokyo', asn: 2497, org: 'NTT' },
    '2001:db8::1': { cc: 'JP', city: 'Tokyo', asn: 2497, org: 'NTT' },
    '198.51.100.9': { cc: 'US', city: 'LA', asn: 13335, org: 'Cloudflare' },
  }
  const groups = groupExits([
    { ip: '2001:db8::1', by: 'IPv6' },
    { ip: '203.0.113.5', by: 'ip.sb' },
    { ip: '198.51.100.9', by: 'Cloudflare' },
  ], geo)
  assert.equal(groups.length, 2)
  assert.equal(groups[0].proxy, false)
  assert.equal(groups[0].ips.length, 2)
  assert.equal(groups[1].proxy, true)
})

test('history keeps valid codes, newest first', () => {
  const code = encodeShare({ ts: Date.now(), pack: 'jp', exits: [], res: { google: 10 } })
  assert.deepEqual(parseHistory(JSON.stringify([code, 'garbage'])), [code])
  assert.deepEqual(addHistory([code], code), [code])
  assert.equal(parseHistory('not json').length, 0)
})
