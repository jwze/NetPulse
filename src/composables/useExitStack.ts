/**
 * 出口地址卡的流程：四象限探测 → 查归属 → 交给纯逻辑拼成两块。
 * 出口地址变化不快，20 秒问一次足够；归属走 30 分钟缓存，换出口才会重新查。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useNetworkStore } from '@/stores/network'
import { fetchIpInfoOf, type IpInfo } from '@/utils/ipInfo'
import { buildBlocks, type ExitReading } from '@/utils/exitStack'
import { probeExits } from '@/utils/exitStackProbe'

const REFRESH_MS = 20000

export function useExitStack() {
  const networkStore = useNetworkStore()

  const readings = ref<ExitReading[]>([])
  const geo = ref<Record<string, IpInfo | null>>({})
  const loading = ref(true)

  const blocks = computed(() => buildBlocks(readings.value, geo.value))

  let timer = 0
  let disposed = false
  let running = false
  let warmed = false
  let visible = typeof document === 'undefined' || document.visibilityState === 'visible'

  function publish(list: ExitReading[]) {
    const best = (region: ExitReading['region']) => {
      const values = list.filter(item => item.region === region && item.ms != null).map(item => item.ms as number)
      return values.length ? Math.min(...values) : 0
    }
    networkStore.setLocalLatency(best('cn'))
    networkStore.setCloudflareLatency(best('global'))
  }

  async function loadGeo(ips: string[]) {
    const next = { ...geo.value }
    // 串行：ipwho 的免费额度按域名计，别一次并发好几个
    for (const ip of ips) {
      const info = await fetchIpInfoOf(ip)
      if (disposed) return
      if (info) next[ip] = info
    }
    geo.value = next
  }

  async function run() {
    if (disposed || running) return
    running = true
    try {
      // 首轮要握手，DNS 与 TLS 都算进了往返，所以先热身一次再读
      const list = await probeExits({ warm: !warmed })
      if (disposed) return
      warmed = true
      readings.value = list
      publish(list)
      loading.value = false
      await loadGeo([...new Set(list.map(item => item.ip).filter(Boolean))])
    } finally {
      running = false
    }
  }

  function schedule() {
    window.clearTimeout(timer)
    if (disposed || !visible) return
    timer = window.setTimeout(() => { void run().finally(schedule) }, REFRESH_MS)
  }

  async function refresh() {
    if (!visible) return
    await run()
    schedule()
  }

  function onVisibilityChange() {
    const next = document.visibilityState === 'visible'
    if (next === visible) return
    visible = next
    if (visible) void run().finally(schedule)
    else window.clearTimeout(timer)
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange)
    void run().finally(schedule)
  })

  onUnmounted(() => {
    disposed = true
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.clearTimeout(timer)
  })

  return { blocks, loading, refresh }
}

