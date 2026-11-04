import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface BloatState {
  /** 本次测速是否仍在采样 */
  active: boolean
  /** 探测目标名称 */
  target: string
  /** 空闲基线 ms */
  idleMs: number | null
  /** 满载延迟中位数 ms */
  loadedMs: number | null
  /** 满载 - 空闲 ms */
  increaseMs: number | null
  /** A+ / A / B / C / D / F，未测出时为空串 */
  grade: string
  tone: '' | 'good' | 'ok' | 'bad'
  /** 满载样本，用于小型分布条 */
  samples: number[]
}

export interface SpeedSummary {
  ts: number
  /** 本次平均下载速度，bytes/s */
  bytesPerSecond: number
  /** 换算成 Mbps */
  mbps: number
  bytes: number
  seconds: number
  node: string
  bloat: {
    idleMs: number | null
    loadedMs: number | null
    increaseMs: number | null
    grade: string
  } | null
}

function emptyBloat(): BloatState {
  return {
    active: false,
    target: '',
    idleMs: null,
    loadedMs: null,
    increaseMs: null,
    grade: '',
    tone: '',
    samples: [],
  }
}

const LAST_RESULT_KEY = 'np:lastResult'

function loadLastResult(): SpeedSummary | null {
  try {
    const raw = localStorage.getItem(LAST_RESULT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SpeedSummary
    if (!parsed || typeof parsed.mbps !== 'number' || typeof parsed.ts !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export const usePanelStore = defineStore('panel', () => {
  const isRunning = ref(false)
  const isChecking = ref(false)
  const bytesUsed = ref(0)
  const speed = ref(0)
  const speedBit = ref(0)
  const runTimeStamp = ref(0)
  const runTimeShow = ref('00s')
  const lastError = ref('')
  const lastWarning = ref('')
  /** 最近一次探测到的实时延迟，图表用它画延迟曲线 */
  const latencyNow = ref(0)
  const bloat = ref<BloatState>(emptyBloat())
  const lastResult = ref<SpeedSummary | null>(loadLastResult())

  watch(lastResult, (value) => {
    try {
      if (value) localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(value))
      else localStorage.removeItem(LAST_RESULT_KEY)
    } catch {
      // 隐私模式下无法写入，忽略
    }
  })

  const show = ref({
    allUsed: '-',
    speed: '-',
    speedBit: '-',
  })

  const predict = ref({
    min: '-',
    hour: '-',
    day: '-',
    mon: '-',
  })

  function resetBloat(active = false) {
    bloat.value = { ...emptyBloat(), active }
    latencyNow.value = 0
  }

  function patchBloat(patch: Partial<BloatState>) {
    bloat.value = { ...bloat.value, ...patch }
  }

  function reset() {
    bytesUsed.value = 0
    speed.value = 0
    speedBit.value = 0
    runTimeStamp.value = 0
    runTimeShow.value = '00s'
    show.value = { allUsed: '-', speed: '-', speedBit: '-' }
    predict.value = { min: '-', hour: '-', day: '-', mon: '-' }
    lastError.value = ''
    lastWarning.value = ''
    latencyNow.value = 0
    resetBloat()
  }

  function resetTraffic() {
    bytesUsed.value = 0
    show.value = {
      ...show.value,
      allUsed: '-',
    }
  }

  return {
    isRunning,
    isChecking,
    bytesUsed,
    speed,
    speedBit,
    runTimeStamp,
    runTimeShow,
    show,
    predict,
    lastError,
    lastWarning,
    latencyNow,
    bloat,
    lastResult,
    resetBloat,
    patchBloat,
    resetTraffic,
    reset,
  }
})
