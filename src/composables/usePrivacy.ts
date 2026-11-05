import { computed, reactive, ref } from 'vue'
import { SNIFFERS, type CheckId } from '@/data/privacySniffers'
import { readLocal, readNetwork, type LocalSide, type NetReadout } from '@/utils/privacyProbe'
import { encodeShare, labelsOf, parseShare, portraitOf, runChecks, scoreOf, verdictText, type Verdict } from '@/utils/privacy'
import { macOf, offTxt } from '@/utils/privacyInfer'
import { copyText } from '@/utils/clipboard'
import { isIp, maskIp } from '@/utils/egress'
import { countryName } from '@/utils/ipInfo'

export function usePrivacy() {
  const rows = reactive<Record<string, string>>({})
  const running = ref(false)
  const done = ref(0)
  const masked = ref(false)
  const elapsed = ref(0)
  const sharedCode = ref('')
  const sharedTs = ref(0)
  const shared = ref<ReturnType<typeof parseShare>>(null)
  const local = ref<LocalSide | null>(null)
  const net = ref<NetReadout | null>(null)

  let controller: AbortController | null = null

  const total = SNIFFERS.length
  const verdicts = computed<Partial<Record<CheckId, Verdict | null>>>(() =>
    local.value && net.value ? runChecks({ local: local.value, net: net.value }) : {},
  )
  const score = computed(() => scoreOf(verdicts.value))
  const portrait = computed(() => (local.value && net.value ? portraitOf(local.value, net.value) : null))
  const labels = computed(() => (local.value && net.value ? labelsOf(local.value, net.value, verdicts.value) : []))
  const verdict = computed(() => verdictText(verdicts.value))
  const answered = computed(() => Object.keys(rows).length)

  function clear() {
    for (const key of Object.keys(rows)) delete rows[key]
    done.value = 0
    elapsed.value = 0
    local.value = null
    net.value = null
  }

  function shown(id: string, value: string) {
    if (!masked.value) return value
    if (!SNIFFERS.find(row => row.id === id)?.s) return value
    return value ? '已隐藏' : value
  }

  function applyNet(out: NetReadout) {
    rows.ip = out.ip || ''
    rows.geo = out.city ? `${out.city}` : ''
    rows.coords = out.coords
    rows.isp = out.org ? `${out.org}${out.asn ? ' · AS' + out.asn : ''}` : ''
    rows.dns = [out.dnsIp, out.dnsCC ? countryName(out.dnsCC, out.dnsCC) : ''].filter(Boolean).join(' · ')
    rows.tzip = out.tz ? `${out.tz}${out.tzOffset != null ? '（UTC' + offTxt(out.tzOffset) + '）' : ''}` : ''
    rows.ptr = out.ptr || (out.ip.includes(':') ? 'IPv6 不做反解' : out.ip ? '没有 PTR 记录' : '')
    rows.edge = out.colo ? `Cloudflare ${out.colo}` : ''
    rows.proto = [out.http, out.tls].filter(Boolean).join(' · ')
    rows.kex = [out.kex, out.sni && `sni ${out.sni}`].filter(Boolean).join(' · ')
    rows.warp = out.warp || ''
    rows.webrtc = out.webrtc === false ? 'WebRTC 关着' : out.webrtc?.length ? out.webrtc.join(' · ') : 'STUN 没读到公网地址'
    rows.lan = out.lan || '没读到内网地址'
    const mac = macOf(out.ip)
    rows.v6mac = mac ? `网卡 ${mac}` : out.ip.includes(':') ? '没有：IPv6 用的是随机地址' : '没有 IPv6 出口'
    for (const [id, ip] of out.exits) rows[id] = ip
    if (!rows.ex_cf && out.ip) rows.ex_cf = out.ip
  }

  async function start() {
    if (running.value) return
    clear()
    sharedCode.value = ''
    shared.value = null
    running.value = true
    const ctl = new AbortController()
    controller = ctl
    const started = performance.now()

    const localRead = await readLocal()
    if (ctl.signal.aborted) {
      running.value = false
      return
    }
    Object.assign(rows, localRead.rows)
    local.value = localRead
    const time = new Date()
    rows.clock = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}（UTC${offTxt(localRead.tzOffset || 0)}）`
    const localCount = Object.keys(rows).length
    done.value = localCount

    let steps = 0
    const netRead = await readNetwork(() => {
      steps += 1
      done.value = Math.min(total, localCount + steps)
    }, ctl.signal)
    if (ctl.signal.aborted) {
      running.value = false
      return
    }
    applyNet(netRead)
    net.value = netRead
    done.value = Object.keys(rows).length
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
    const parsed = parseShare(window.location.hash, [])
    if (!parsed) return false
    shared.value = parsed
    sharedCode.value = parsed.code
    sharedTs.value = parsed.ts
    return true
  }

  async function copyShareLink() {
    if (!local.value || !net.value) return false
    const levels: Partial<Record<CheckId, 'ok' | 'warn' | 'bad' | 'info'>> = {}
    for (const [id, item] of Object.entries(verdicts.value)) {
      if (item) levels[id as CheckId] = item.level
    }
    const code = encodeShare({
      ts: Date.now(),
      code: '',
      checks: levels,
      place: portrait.value?.place || '',
      device: portrait.value?.device || '',
      browser: portrait.value?.browser || '',
      fpid: local.value.fpid,
      shield: local.value.rows.shield || '',
    })
    return copyText(`${window.location.origin}/check/privacy/portrait${code}`)
  }

  return {
    rows,
    running,
    done,
    total,
    masked,
    elapsed,
    sharedCode,
    shared,
    local,
    net,
    verdicts,
    score,
    portrait,
    labels,
    verdict,
    answered,
    shown,
    start,
    stop,
    destroy,
    loadFromHash,
    copyShareLink,
    maskOf: (value: string) => (isIp(value) ? maskIp(value) : value),
  }
}
