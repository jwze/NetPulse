import { computed, reactive, ref } from 'vue'
import { assess, type Assessment, type DnsblResult, type SourceData, type SourceResult } from '@/utils/ipQuality'
import { SOURCES, checkDnsbl, fetchOwnIp, isPrivateIp, runSource, validIp } from '@/utils/ipQualityProbe'
import { copyText } from '@/utils/clipboard'

export function useIpQuality() {
  const own = ref<{ ip: string; data: SourceData } | null>(null)
  const ip = ref('')
  const input = ref('')
  const results = reactive<SourceResult[]>([])
  const dnsbl = reactive<DnsblResult[]>([])
  const running = ref(false)
  const error = ref('')
  const done = ref(0)
  const total = SOURCES.length + 1
  const startedAt = ref(0)
  const elapsed = ref(0)
  const assessment = ref<Assessment | null>(null)

  let seq = 0

  const answered = computed(() => results.filter(item => item.data).length)
  const listed = computed(() => dnsbl.filter(item => item.listed === true))
  const isOwn = computed(() => !!own.value && ip.value === own.value.ip)

  function recompute() {
    if (!results.some(item => item.data)) return
    assessment.value = assess([...results], [...dnsbl])
  }

  async function ensureOwn() {
    if (own.value) return own.value
    own.value = await fetchOwnIp()
    return own.value
  }

  async function query(target?: string) {
    const run = ++seq
    error.value = ''
    running.value = true
    startedAt.value = performance.now()
    elapsed.value = 0
    results.splice(0, results.length)
    dnsbl.splice(0, dnsbl.length)
    assessment.value = null
    done.value = 0

    let self: { ip: string; data: SourceData }
    try {
      self = await ensureOwn()
    } catch (err) {
      error.value = (err as Error).message || '取不到本机出口地址'
      running.value = false
      return
    }

    const wanted = (target || input.value || self.ip).trim()
    if (!validIp(wanted)) {
      error.value = isPrivateIp(wanted) ? '这是内网地址，只支持公网 IP' : '请输入合法的公网 IPv4 或 IPv6 地址'
      running.value = false
      return
    }
    ip.value = wanted
    input.value = wanted
    done.value = 0

    const jobs = SOURCES.map(async source => {
      const result = await runSource(source, wanted, self)
      if (run !== seq) return
      if (result.error !== 'skip') {
        results.push(result)
        done.value += 1
        recompute()
      }
    })
    const blJob = checkDnsbl(wanted).then(list => {
      if (run !== seq) return
      dnsbl.push(...list)
      done.value += 1
      recompute()
    })

    await Promise.all([...jobs, blJob])
    if (run !== seq) return
    elapsed.value = Number(((performance.now() - startedAt.value) / 1000).toFixed(1))
    running.value = false
    recompute()
  }

  async function init() {
    const param = new URLSearchParams(window.location.search).get('ip') || ''
    await query(param || undefined)
  }

  async function copyLink() {
    if (!ip.value) return false
    const url = isOwn.value
      ? `${window.location.origin}/ip-quality`
      : `${window.location.origin}/ip-quality?ip=${encodeURIComponent(ip.value)}`
    return copyText(url)
  }

  return {
    own,
    ip,
    input,
    results,
    dnsbl,
    running,
    error,
    done,
    total,
    elapsed,
    assessment,
    answered,
    listed,
    isOwn,
    query,
    init,
    copyLink,
    sources: SOURCES,
  }
}
