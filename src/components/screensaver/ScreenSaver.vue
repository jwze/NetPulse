<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { usePanelStore } from '@/stores/panel'
import { brand } from '@/config/brand'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const panel = usePanelStore()
const now = ref(new Date())
const battery = ref('电量未知')
const offset = ref({ x: 0, y: 0 })
const containerRef = ref<HTMLElement | null>(null)

let timer = 0
let moveTimer = 0
let wakeLock: any = null

const timeText = computed(() => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(now.value.getHours())}:${pad(now.value.getMinutes())}`
})

const dateText = computed(() => {
  const pad = (value: number) => String(value).padStart(2, '0')
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.value.getDay()]
  return `${now.value.getFullYear()}-${pad(now.value.getMonth() + 1)}-${pad(now.value.getDate())} ${weekday}`
})

function moveScreen() {
  const width = window.innerWidth || document.documentElement.clientWidth
  const height = window.innerHeight || document.documentElement.clientHeight
  const rect = containerRef.value?.getBoundingClientRect()
  const safeX = Math.max(24, Math.floor((width - (rect?.width || 620)) / 2) - 28)
  const safeY = Math.max(24, Math.floor((height - (rect?.height || 320)) / 2) - 28)

  offset.value = {
    x: Math.round((Math.random() * 2 - 1) * safeX),
    y: Math.round((Math.random() * 2 - 1) * safeY),
  }
}

async function readBattery() {
  const nav = navigator as any
  if (!nav.getBattery) return
  try {
    const info = await nav.getBattery()
    battery.value = `电量 ${Math.round(info.level * 100)}%`
  } catch {
    battery.value = '电量未知'
  }
}

async function enter() {
  document.body.style.overflow = 'hidden'
  timer = window.setInterval(() => {
    now.value = new Date()
    void readBattery()
  }, 1000)
  moveTimer = window.setInterval(moveScreen, 2 * 60 * 1000)
  now.value = new Date()
  offset.value = { x: 0, y: 0 }
  void readBattery()

  try {
    if ('wakeLock' in navigator) {
      wakeLock = await (navigator as any).wakeLock.request('screen')
    }
  } catch {
    wakeLock = null
  }

  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
  } catch {
    // 浏览器可能拒绝全屏，覆盖层仍然可用。
  }
}

async function leave() {
  document.body.style.overflow = 'auto'
  if (timer) window.clearInterval(timer)
  if (moveTimer) window.clearInterval(moveTimer)
  timer = 0
  moveTimer = 0
  try {
    await wakeLock?.release?.()
  } catch {
    // ignore
  }
  wakeLock = null
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
  } catch {
    // ignore
  }
}

watch(() => props.show, show => {
  if (show) void enter()
  else void leave()
})

onMounted(() => {
  if (props.show) void enter()
})

onUnmounted(() => {
  void leave()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="screen-fade">
      <div v-if="show" class="screen-saver" @click="emit('close')">
        <div
          ref="containerRef"
          class="screen-container"
          :style="{
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
          }"
        >
          <div class="screen-left">
            <div class="screen-head">
              <svg class="screen-mark" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M1 12h4l2.5-6 3.5 13 3-9 2 4h7" />
              </svg>
              <span class="screen-brand">{{ brand.nameZh }}</span>
              <span class="screen-brand-en">{{ brand.name }}</span>
            </div>
            <div class="screen-time">{{ timeText }}</div>
            <div class="screen-date">{{ dateText }}</div>
            <div class="screen-device">
              <span>{{ battery }}</span>
              <span>运行 {{ panel.runTimeShow || '00s' }}</span>
              <span>{{ panel.isRunning ? '测速中' : '待命' }}</span>
            </div>
          </div>

          <div class="screen-right">
            <div class="screen-stat">
              <span>总流量</span>
              <strong>{{ panel.show.allUsed || '—' }}</strong>
            </div>
            <div class="screen-stat">
              <span>{{ panel.isRunning ? '实时速度' : '平均速度' }}</span>
              <strong>{{ panel.show.speed || '—' }}</strong>
            </div>
            <div class="screen-stat">
              <span>{{ panel.isRunning ? '实时带宽' : '平均带宽' }}</span>
              <strong>{{ panel.show.speedBit || '—' }}</strong>
            </div>
          </div>
        </div>

        <p class="screen-hint">点击任意处唤醒</p>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.screen-saver {
  position: fixed;
  inset: 0;
  z-index: 120;
  overflow: hidden;
  background: #060809;
  color: #E9EFEF;
}

.screen-hint {
  position: absolute;
  right: 0;
  bottom: 28px;
  left: 0;
  color: rgba(233, 239, 239, 0.24);
  font-size: 11px;
  text-align: center;
  letter-spacing: 0.02em;
}

.screen-container {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  grid-template-columns: minmax(280px, 1fr) 200px;
  align-items: center;
  gap: clamp(28px, 4vw, 48px);
  width: min(580px, calc(100vw - 48px));
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  transition: transform 1.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.screen-left {
  min-width: 0;
}

.screen-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.screen-mark {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: rgba(233, 239, 239, 0.5);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.screen-brand {
  color: rgba(233, 239, 239, 0.72);
  font-size: 14px;
  line-height: 1;
}

.screen-brand-en {
  color: rgba(233, 239, 239, 0.3);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  line-height: 1;
}

.screen-time {
  font-family: var(--font-mono);
  margin-top: 20px;
  font-size: clamp(44px, 7vw, 72px);
  font-weight: 400;
  letter-spacing: -0.03em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.screen-date {
  margin-top: 10px;
  color: rgba(233, 239, 239, 0.5);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.02em;
}

.screen-device {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 14px;
  color: rgba(233, 239, 239, 0.4);
  font-size: 11px;
}

.screen-device span {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0;
  border-radius: 0;
  background: transparent;
}

.screen-right {
  display: grid;
  gap: 24px;
}

.screen-stat {
  display: grid;
  gap: 5px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.screen-stat span {
  color: rgba(233, 239, 239, 0.42);
  font-size: 11px;
}

.screen-stat strong {
  color: rgba(233, 239, 239, 0.88);
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}

.screen-fade-enter-active,
.screen-fade-leave-active {
  transition: opacity 0.2s ease;
}

.screen-fade-enter-from,
.screen-fade-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .screen-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    width: auto;
    min-height: auto;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
  }

  .screen-left {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .screen-brand {
    font-size: 13px;
  }

  .screen-time {
    margin-top: 18px;
    font-size: clamp(48px, 16vw, 72px);
  }

  .screen-date {
    margin-top: 8px;
    font-size: 14px;
  }

  .screen-device {
    justify-content: center;
    margin-top: 10px;
    font-size: 11px;
  }

  .screen-device span {
    padding: 0;
    border-radius: 0;
    background: transparent;
  }

  .screen-right {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    margin-top: 32px;
  }

  .screen-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  .screen-stat span {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.72);
  }

  .screen-stat strong {
    font-size: 16px;
  }
}
</style>
