/**
 * IPv6 测试的编排：六项测试与四组 IPv4/IPv6 对比同时跑，结果一到位就更新页面，
 * 最后存一份可以放进链接的结果（不含地址）。
 */

import { computed, reactive, ref } from 'vue'
import { KNOWN_IDS, PAIRS, SIDE_IDS, SIDES, SIDE_TIMEOUT, TEST_IDS, TESTS, TEST_DESC, TEST_LABEL } from '@/data/ipv6Hosts'
import {
  compareOf,
  decodeShare,
  encodeShare,
  fmtMs,
  kind6,
  OK_TEXT,
  PROB_TEXT,
  stateOf,
  verdictOf,
  type Compare,
  type RowState,
  type TestResult,
} from '@/utils/ipv6'
import { lookupNetwork, runTest } from '@/utils/ipv6Probe'
import { countryName } from '@/utils/ipInfo'
import { copyText } from '@/utils/clipboard'

export interface Ipv6Row {
  id: string
  label: string
  desc: string
  state: RowState
  main: string
  sub: string
}

export function useIpv6Test() {
  const results = reactive<Record<string, TestResult>>({})
  const sides = reactive<Record<string, TestResult>>({})
  const running = ref(false)
  const done = ref(0)
  const total = ref(TESTS.length + SIDES.length)
  const elapsed = ref(0)
  const sharedCode = ref('')
  const sharedTs = ref(0)
  const sharedCc = ref('')
  const masked = ref(false)

  let controller: AbortController | null = null
  let startedAt = 0
  let lastTs = 0

  function reset() {
    for (const key of Object.keys(results)) delete results[key]
    for (const key of Object.keys(sides)) delete sides[key]
    done.value = 0
    elapsed.value = 0
    sharedCode.value = ''
    sharedTs.value = 0
    sharedCc.value = ''
    masked.value = false
    lastTs = 0
  }

  const rows = computed<Ipv6Row[]>(() => TEST_IDS.map(id => {
    const state = stateOf(id, results)
    return { id, label: TEST_LABEL[id] || id, desc: TEST_DESC[id] || '', ...state }
  }))

  const hasResults = computed(() => Object.keys(results).length > 0)
  const verdict = computed(() => (hasResults.value ? verdictOf(results) : null))

  const problemText = computed(() => {
    const current = verdict.value
    if (!current) return ''
    if (current.probs.length) return current.probs.map(key => PROB_TEXT[key]).join(' ')
    if (current.head === 'none') return OK_TEXT.v4
    if (current.head === 'offline') return OK_TEXT.offline
    return OK_TEXT.all
  })

  const answered = computed(() => TEST_IDS.filter(id => results[id]?.ok).length)

  /** 出口国家：分享链接只带国家，不带地址 */
  const cc = computed(() => sharedCc.value || results.ds?.cc || results.v4?.cc || results.v6?.cc || '')

  const compare = computed<Compare>(() => compareOf(sides))

  const pairRows = computed(() => PAIRS.map(pair => {
    const a = sides[`${pair.id}4`]
    const b = sides[`${pair.id}6`]
    const both = a?.ok && b?.ok && a.rtt != null && b.rtt != null
    return {
      ...pair,
      v4: a,
      v6: b,
      diff: both ? b!.rtt! - a!.rtt! : null,
      both,
    }
  }))

  const compareDone = computed(() => SIDE_IDS.filter(id => sides[id]).length)
  const compareTotal = computed(() => SIDE_IDS.length)

  const runDuration = computed(() => (elapsed.value ? `${elapsed.value.toFixed(1)} 秒` : ''))

  async function start() {
    if (running.value) return
    // 从分享结果重新测试时，把链接里的旧结果去掉
    if (sharedCode.value) history.replaceState(null, '', location.pathname + location.search)
    reset()
    running.value = true
    startedAt = performance.now()
    const ctl = new AbortController()
    controller = ctl

    const sideJobs = SIDES.map(async side => {
      const item = await runTest(side, { signal: ctl.signal, timeout: SIDE_TIMEOUT })
      if (ctl.signal.aborted) return
      sides[side.id] = item
      done.value += 1
    })

    const testJobs = TESTS.map(async test => {
      const item = await runTest(test, { signal: ctl.signal })
      if (ctl.signal.aborted) return
      if (test.id === 'v6') item.kind = kind6(item.ip)
      results[test.id] = item
      done.value += 1

      // DNSPod 只说地址：问一下它属于哪个网络，再补上 ASN 与国家
      if ((test.id === 'v4' || test.id === 'v6') && item.ok && item.ip && !item.asn) {
        const info = await lookupNetwork(test.fam === 6 ? 6 : 4, item.ip, ctl.signal)
        if (ctl.signal.aborted || !info) return
        results[test.id] = { ...results[test.id], asn: info.asn || 0, cc: results[test.id].cc || info.cc }
      }
    })

    await Promise.all([...sideJobs, ...testJobs])
    if (ctl.signal.aborted) return
    elapsed.value = (performance.now() - startedAt) / 1000
    lastTs = Date.now()
    running.value = false
    controller = null
  }

  function stop() {
    controller?.abort()
    controller = null
    if (startedAt) elapsed.value = (performance.now() - startedAt) / 1000
    running.value = false
  }

  function destroy() {
    controller?.abort()
    controller = null
  }

  /** 结果链接：只含每项的耗时与地址类型，不含 IP */
  function shareCodeOf(): string {
    return encodeShare({
      ts: lastTs || sharedTs.value || Date.now(),
      cc: cc.value,
      r: { ...results, ...sides },
    })
  }

  async function copyShareLink(): Promise<boolean> {
    if (!hasResults.value) return false
    const url = `${location.origin}${location.pathname}#v6=${shareCodeOf()}`
    return copyText(url)
  }

  /** 打开 #v6= 链接时还原结果，不自动重测 */
  function loadFromHash() {
    const match = /^#v6=(.+)$/.exec(location.hash || '')
    if (!match) return false
    const parsed = decodeShare(decodeURIComponent(match[1]))
    if (!parsed) return false
    for (const key of Object.keys(results)) delete results[key]
    for (const key of Object.keys(sides)) delete sides[key]
    for (const [id, item] of Object.entries(parsed.r)) {
      if (!KNOWN_IDS.has(id)) continue
      if (SIDE_IDS.includes(id)) sides[id] = item
      else results[id] = item
    }
    sharedCode.value = match[1]
    sharedTs.value = parsed.ts
    sharedCc.value = parsed.cc
    masked.value = true
    elapsed.value = 0
    return true
  }

  const addressNote = (fam: 4 | 6) => {
    const item = fam === 6 ? results.v6 : results.v4
    if (!item) return ''
    if (!item.ok) return fam === 6 ? '没有 IPv6 地址' : '没有 IPv4 地址'
    const parts: string[] = []
    if (fam === 6 && item.kind) parts.push({ native: '原生', '6to4': '6to4 隧道', teredo: 'Teredo 隧道' }[item.kind] || '')
    if (item.asn) parts.push(`AS${item.asn}`)
    if (item.cc) parts.push(countryName(item.cc, item.cc))
    if (item.rtt != null) parts.push(`${fmtMs(item.rtt)} ms`)
    return parts.filter(Boolean).join(' · ')
  }

  return {
    results,
    sides,
    rows,
    pairRows,
    running,
    done,
    total,
    elapsed,
    runDuration,
    sharedCode,
    sharedTs,
    masked,
    verdict,
    problemText,
    answered,
    cc,
    compare,
    compareDone,
    compareTotal,
    start,
    stop,
    destroy,
    copyShareLink,
    loadFromHash,
    addressNote,
    shareCodeOf,
  }
}
