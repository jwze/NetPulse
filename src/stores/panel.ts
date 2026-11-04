import { defineStore } from 'pinia'
import { ref } from 'vue'

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
    resetTraffic,
    reset,
  }
})
