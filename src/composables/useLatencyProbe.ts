/**
 * 全球延迟探测的控制器：出口识别 → 服务测速 → 综合判定 → 存历史 / 分享。
 * 与测速内核分开，避免下载测速时抢占连接。
 */

import { computed, ref, watch } from 'vue'
import { PACKS, PACK_IDS, PACK_OF, WALLED, serviceById, servicesOf } from '@/data/latencyServices'
import {
  addHistory,
  diagnose,
  diffRuns,
  encodeShare,
  parseHistory,
  parseShare,
  segmentOf,
  useVerdicts,
  type ExitGroup,
  type SharedResult,
  type Verdict,
} from '@/utils/latency'
import {
  CONCURRENCY,
  checkExits,
  emptyResult,
  runService,
  type ServiceResult,
} from '@/utils/latencyProbe'

const HIST_KEY = 'np:latency:hist'
const MASK_KEY = 'np:latency:mask'
const PACK_KEY = 'np:latency:pack'

function readLocal(key: string): string {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 隐私模式写不进去时忽略
  }
}

export interface LatencyRow {
  id: string
  name: string
  short: string
  cat: string
  via: string
  pop: string | null
  cold: number | null
  median: number | null
  jitter: number | null
  state: ServiceResult['state']
  samples: (number | null)[]
}

export function useLatencyProbe() {
  const running = ref(false)
  const results = ref<Record<string, ServiceResult>>({})
  const progress = ref({ done: 0, total: 0 })
  const pack = ref(PACK_IDS.includes(readLocal(PACK_KEY)) ? readLocal(PACK_KEY) : 'cn')
  const packLocked = ref(!!readLocal(PACK_KEY))
  const exits = ref<ExitGroup[]>([])
  const exitState = ref<'idle' | 'checking' | 'done'>('idle')
  const exitUnknown = ref(0)
  const warp = ref(false)
  const hiddenNote = ref('')
  const error = ref('')
  const samples = ref(3)
  const shared = ref<SharedResult | null>(null)
  const sharedCode = ref('')
  const previous = ref<SharedResult | null>(null)
  const history = ref<string[]>(parseHistory(readLocal(HIST_KEY)))
  const mask = ref(readLocal(MASK_KEY) === '1')

  let controller: AbortController | null = null

  const services = computed(() => servicesOf(pack.value))

  /** 分享结果优先展示；自己跑完则用实时结果 */
  const resMap = computed<Record<string, number | null>>(() => {
    if (shared.value) return shared.value.res
    const map: Record<string, number | null> = {}
    for (const [id, result] of Object.entries(results.value)) {
      if (result.state === 'done' || result.state === 'stop') map[id] = result.median
    }
    return map
  })

  const rows = computed<LatencyRow[]>(() => services.value.map(service => {
    const live = results.value[service.id]
    const sharedMs = shared.value?.res?.[service.id] ?? null
    return {
      id: service.id,
      name: service.name,
      short: service.short || service.name,
      cat: service.cat,
      via: service.via || '',
      pop: live?.pop || null,
      cold: live?.cold ?? null,
      median: live ? live.median : sharedMs,
      jitter: live?.jitter ?? null,
      state: live?.state || (shared.value ? 'done' : 'idle'),
      samples: live?.samples || [],
    }
  }))

  const localSegment = computed(() => {
    const list = servicesOf(pack.value).filter(s => s.cat === 'local')
    return segmentOf(list.map(s => resMap.value[s.id] ?? null), list.map(s => s.name))
  })

  const globalSegment = computed(() => {
    const list = servicesOf(pack.value).filter(s => s.cat !== 'local')
    return segmentOf(list.map(s => resMap.value[s.id] ?? null), list.map(s => s.name))
  })

  const verdictReady = ref(false)
  const frozenVerdict = ref<Verdict | null>(null)

  const verdict = computed<Verdict | null>(() => {
    if (frozenVerdict.value) return frozenVerdict.value
    if (!verdictReady.value) return null
    if (!Object.keys(resMap.value).length) return null
    return diagnose(localSegment.value, globalSegment.value)
  })

  const uses = computed(() => (
    Object.keys(resMap.value).length ? useVerdicts(resMap.value, services.value) : []
  ))

  const compare = computed(() => {
    if (!shared.value || !previous.value) return null
    const before = previous.value
    const after = shared.value
    return {
      ts: before.ts,
      ...diffRuns(before.res, after.res, services.value),
    }
  })

  const answered = computed(() => {
    const values = Object.values(resMap.value)
    return { ok: values.filter(v => v != null).length, n: values.length }
  })

  const shareCode = computed(() => {
    if (!Object.keys(resMap.value).length) return ''
    return encodeShare({
      ts: shared.value?.ts ?? Date.now(),
      pack: shared.value?.pack ?? pack.value,
      exits: shared.value?.exits ?? exits.value,
      res: resMap.value,
    })
  })

  const shareLink = computed(() => {
    if (!shareCode.value) return ''
    const base = `${location.origin}${location.pathname}`
    return `${base}#lat=${shareCode.value}`
  })

  watch(mask, value => writeLocal(MASK_KEY, value ? '1' : '0'))

  async function setPack(next: string) {
    if (!PACK_IDS.includes(next) || next === pack.value) return
    // 先冻结当前判定，补测新包期间结论不跳变
    frozenVerdict.value = running.value ? null : verdict.value
    pack.value = next
    packLocked.value = true
    writeLocal(PACK_KEY, next)
    // 已有结果时只补测新包，海外与出口沿用上一次，不让人再等一整轮
    if (running.value || !shared.value) return
    const scoped = new AbortController()
    controller = scoped
    running.value = true
    const list = PACKS[next]
    progress.value = { done: 0, total: list.length }
    const merged = { ...shared.value.res }
    // 旧包的本地服务不再属于当前视图，先从结果里去掉
    for (const packId of PACK_IDS) {
      for (const service of PACKS[packId]) delete merged[service.id]
    }
    await Promise.all(list.map(async service => {
      results.value[service.id] = emptyResult()
      try {
        await runService(service, samples.value, scoped.signal, result => {
          results.value[service.id] = result
        })
        merged[service.id] = results.value[service.id]?.median ?? null
      } catch {
        merged[service.id] = null
      } finally {
        progress.value = { ...progress.value, done: progress.value.done + 1 }
      }
    }))
    frozenVerdict.value = null
    verdictReady.value = true
    if (scoped.signal.aborted) {
      running.value = false
      controller = null
      return
    }
    shared.value = { ...shared.value, pack: next, res: merged, ts: Date.now() }
    const code = encodeShare(shared.value)
    history.value = addHistory(history.value, code)
    writeLocal(HIST_KEY, JSON.stringify(history.value))
    running.value = false
    controller = null
  }

  function applyPackFromExits() {
    if (packLocked.value) return
    const cc = exits.value[0]?.cc
    const guessed = cc ? PACK_OF[cc] : ''
    if (guessed && PACK_IDS.includes(guessed)) pack.value = guessed
  }

  function hiddenExitNote() {
    const main = exits.value[0]
    if (!main?.cc || !WALLED[main.cc]) return ''
    if (exits.value.some(e => e.proxy)) return ''
    const answeredWalled = WALLED[main.cc]
      .filter(id => resMap.value[id] != null)
      .map(id => serviceById(id)?.name || id)
    if (answeredWalled.length < 2) return ''
    return `${answeredWalled.slice(0, 4).join('、')} 在该出口下通常不可直连，却都有响应：可能只对部分域名走了另一条代理线路。`
  }

  async function start() {
    if (running.value) return
    running.value = true
    error.value = ''
    shared.value = null
    sharedCode.value = ''
    hiddenNote.value = ''
    results.value = {}
    exits.value = []
    exitState.value = 'checking'
    verdictReady.value = false
    frozenVerdict.value = null
    controller = new AbortController()
    const signal = controller.signal

    try {
      const report = await checkExits(signal).catch(() => ({ groups: [], unknown: 0, warp: false }))
      if (signal.aborted) return
      exits.value = report.groups
      exitUnknown.value = report.unknown
      warp.value = report.warp
      exitState.value = 'done'
      applyPackFromExits()

      const list = services.value
      progress.value = { done: 0, total: list.length }
      for (const service of list) results.value[service.id] = emptyResult()

      const queue = list.slice()
      const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        while (queue.length && !signal.aborted) {
          const service = queue.shift()!
          try {
            await runService(service, samples.value, signal, result => {
              results.value[service.id] = result
            })
          } catch {
            results.value[service.id] = { ...emptyResult(), state: 'done' }
          } finally {
            progress.value = { ...progress.value, done: progress.value.done + 1 }
          }
        }
      })
      await Promise.all(workers)
      if (signal.aborted) return

      hiddenNote.value = hiddenExitNote()
      finishRun()
    } catch (err) {
      if (!signal.aborted) error.value = '探测中断，请重试'
      void err
    } finally {
      if (!signal.aborted) {
        running.value = false
        exitState.value = 'done'
      }
      controller = null
    }
  }

  function finishRun() {
    if (!Object.keys(resMap.value).length) return
    const result = {
      ts: Date.now(),
      pack: pack.value,
      exits: exits.value,
      res: { ...resMap.value },
    }
    const code = encodeShare(result)
    const oldCode = history.value[0]
    previous.value = oldCode ? parseShare(oldCode) : null
    shared.value = result
    history.value = addHistory(history.value, code)
    writeLocal(HIST_KEY, JSON.stringify(history.value))
    sharedCode.value = ''
    verdictReady.value = true
  }

  function stop() {
    controller?.abort()
    running.value = false
    frozenVerdict.value = null
    if (Object.keys(resMap.value).length) verdictReady.value = true
    exitState.value = exits.value.length ? 'done' : 'idle'
  }

  function loadShared(code: string) {
    const parsed = parseShare(code)
    if (!parsed) {
      error.value = '分享链接无法解析'
      return false
    }
    shared.value = parsed
    sharedCode.value = code
    pack.value = parsed.pack
    exits.value = parsed.exits.map((exit, index) => ({
      ...exit,
      key: `shared-${index}`,
      ips: [],
      sources: [],
    }))
    exitState.value = 'done'
    results.value = {}
    previous.value = history.value[0] && history.value[0] !== code ? parseShare(history.value[0]) : null
    verdictReady.value = true
    return true
  }

  function loadFromHash() {
    const match = /#lat=([^&]+)/.exec(location.hash)
    if (!match) return false
    return loadShared(decodeURIComponent(match[1]))
  }

  function clearShared() {
    shared.value = null
    sharedCode.value = ''
    previous.value = null
    verdictReady.value = false
  }

  async function copyShareLink() {
    if (!shareLink.value) return false
    try {
      await navigator.clipboard.writeText(shareLink.value)
      return true
    } catch {
      return false
    }
  }

  function destroy() {
    controller?.abort()
    controller = null
  }

  return {
    running,
    results,
    progress,
    pack,
    packLocked,
    exits,
    exitState,
    exitUnknown,
    warp,
    hiddenNote,
    error,
    samples,
    shared,
    previous,
    sharedCode,
    history,
    mask,
    services,
    rows,
    resMap,
    localSegment,
    globalSegment,
    verdict,
    uses,
    compare,
    answered,
    shareLink,
    setPack,
    start,
    stop,
    loadShared,
    loadFromHash,
    clearShared,
    copyShareLink,
    destroy,
  }
}
