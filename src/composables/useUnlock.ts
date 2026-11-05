import { computed, reactive, ref } from 'vue'
import { SERVICES, SERVICE_IDS } from '@/data/unlockServices'
import {
  encodeShare,
  exitsByCountry,
  guessCountry,
  judge,
  parseShare,
  routeAdvice,
  scoreCard,
  tally,
  type ProbeReply,
  type Verdict,
} from '@/utils/unlock'
import { runUnlock } from '@/utils/unlockProbe'
import { tzCountry } from '@/utils/egressProbe'
import { copyText } from '@/utils/clipboard'

export function useUnlock() {
  const verdicts = reactive<Record<string, Verdict>>({})
  const running = ref(false)
  const done = ref(0)
  const elapsed = ref(0)
  const sharedCode = ref('')
  const sharedTs = ref(0)
  const filter = ref('all')

  let controller: AbortController | null = null

  const total = SERVICES.length
  const counts = computed(() => tally(verdicts))
  const card = computed(() => scoreCard(verdicts, SERVICES))
  const exits = computed(() => exitsByCountry(verdicts))
  const advice = computed(() => routeAdvice(verdicts, SERVICES, exits.value))
  const answered = computed(() => Object.keys(verdicts).length)

  function reset() {
    for (const key of Object.keys(verdicts)) delete verdicts[key]
    done.value = 0
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
    const replies: Record<string, ProbeReply> = {}

    await runUnlock(ctl.signal, (id, reply, count) => {
      replies[id] = reply
      const service = SERVICES.find(item => item.id === id)
      if (service) verdicts[id] = judge(service, reply, null)
      done.value = count
    })
    if (ctl.signal.aborted) {
      running.value = false
      return
    }

    const guess = guessCountry(Object.values(replies).map(reply => reply.answer?.cc))
    for (const service of SERVICES) {
      const reply = replies[service.id]
      if (reply) verdicts[service.id] = judge(service, reply, guess)
    }
    elapsed.value = Number(((performance.now() - started) / 1000).toFixed(1))
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
    const parsed = parseShare(window.location.hash, SERVICE_IDS)
    if (!parsed) return false
    reset()
    sharedCode.value = window.location.hash.replace(/^#un=1\./, '')
    sharedTs.value = parsed.ts
    for (const [id, verdict] of Object.entries(parsed.verdicts)) verdicts[id] = verdict
    done.value = Object.keys(parsed.verdicts).length
    return true
  }

  async function copyShareLink() {
    if (!answered.value) return false
    const code = encodeShare(sharedTs.value || Date.now(), tzCountry(Intl.DateTimeFormat().resolvedOptions().timeZone || ''), verdicts)
    return copyText(`${window.location.origin}/check/privacy/unlock${code}`)
  }

  return {
    verdicts,
    running,
    done,
    total,
    elapsed,
    sharedCode,
    sharedTs,
    filter,
    counts,
    card,
    exits,
    advice,
    answered,
    start,
    stop,
    destroy,
    loadFromHash,
    copyShareLink,
  }
}
