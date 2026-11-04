import { computed, reactive, ref } from 'vue'
import { PROBE_IDS, PROBES } from '@/data/egressProbes'
import {
  findings,
  groupEgress,
  natOf,
  parseShare,
  verdictOf,
  encodeShare,
  type EgressExit,
  type Findings,
  type NatInfo,
  type ProbeRow,
} from '@/utils/egress'
import { runEgress, tzCountry } from '@/utils/egressProbe'
import { copyText } from '@/utils/clipboard'

export function useEgress() {
  const rows = reactive<Record<string, ProbeRow>>({})
  const exits = ref<EgressExit[]>([])
  const found = ref<Findings | null>(null)
  const running = ref(false)
  const masked = ref(false)
  const sharedCode = ref('')
  const sharedTs = ref(0)
  const progress = ref({ done: 0, total: PROBES.length })
  const elapsed = ref(0)
  const natInfo = ref<NatInfo | null>(null)

  let controller: AbortController | null = null

  const verdict = computed(() => verdictOf(found.value, exits.value))

  function reset() {
    for (const key of Object.keys(rows)) delete rows[key]
    exits.value = []
    found.value = null
    natInfo.value = null
    progress.value = { done: 0, total: PROBES.length }
    elapsed.value = 0
  }

  async function start() {
    if (running.value) return
    reset()
    running.value = true
    sharedCode.value = ''
    sharedTs.value = 0
    const ctl = new AbortController()
    controller = ctl
    const started = performance.now()

    const run = await runEgress(ctl.signal, outcome => {
      rows[outcome.id] = outcome.row
      progress.value = { ...progress.value, done: progress.value.done + 1 }
    })
    if (ctl.signal.aborted) {
      running.value = false
      return
    }
    elapsed.value = Number(((performance.now() - started) / 1000).toFixed(1))

    const warp = Object.values(run.cf).some(item => item.warp && item.warp !== 'off')
    exits.value = groupEgress(run.seen, run.geo, warp)
    natInfo.value = run.nat ? natOf(run.nat.candidates, run.nat.seen, exits.value) : null
    found.value = findings(exits.value, run.cf, tzCountry(Intl.DateTimeFormat().resolvedOptions().timeZone || ''), natInfo.value)
    running.value = false
  }

  function stop() {
    controller?.abort()
    running.value = false
  }

  function destroy() {
    controller?.abort()
  }

  function loadFromHash() {
    const parsed = parseShare(window.location.hash, PROBE_IDS)
    if (!parsed) return false
    reset()
    sharedCode.value = window.location.hash.replace(/^#eg=1\|/, '')
    sharedTs.value = parsed.ts
    exits.value = parsed.exits
    for (const [id, row] of Object.entries(parsed.rows)) rows[id] = row
    const cf = Object.fromEntries(
      Object.entries(parsed.rows)
        .filter(([, row]) => row.cf?.loc)
        .map(([id, row]) => [id, { colo: row.cf?.colo || '', loc: row.cf?.loc || '', warp: 'off' }]),
    )
    natInfo.value = parsed.nat
    found.value = findings(exits.value, cf, parsed.tz, parsed.nat)
    masked.value = true
    progress.value = { done: Object.keys(parsed.rows).length, total: PROBES.length }
    return true
  }

  async function copyShareLink() {
    if (!exits.value.length) return false
    const code = encodeShare(
      {
        ts: sharedTs.value || Date.now(),
        tz: tzCountry(Intl.DateTimeFormat().resolvedOptions().timeZone || ''),
        exits: exits.value,
        rows: rows as Record<string, ProbeRow>,
        nat: natInfo.value,
      },
      false,
    )
    const url = `${window.location.origin}/egress${code}`
    return copyText(url)
  }

  return {
    rows,
    exits,
    found,
    running,
    masked,
    sharedCode,
    sharedTs,
    progress,
    elapsed,
    natInfo,
    verdict,
    start,
    stop,
    destroy,
    loadFromHash,
    copyShareLink,
  }
}
