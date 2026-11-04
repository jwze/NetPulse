<script setup lang="ts">
import { ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { usePanelStore } from '@/stores/panel'
import { buildShareCard } from '@/utils/shareCard'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const panel = usePanelStore()
const message = useMessage()
const preview = ref('')
const blob = ref<Blob | null>(null)
const generating = ref(false)

function stamp() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

function render() {
  const result = panel.lastResult
  blob.value = null
  preview.value = ''
  if (!result) return

  generating.value = true
  try {
    const canvas = buildShareCard({
      mbps: result.mbps,
      bytesPerSecond: result.bytesPerSecond,
      bytes: result.bytes,
      seconds: result.seconds,
      node: result.node,
      date: new Date(result.ts),
      bloat: result.bloat,
    })
    preview.value = canvas.toDataURL('image/png')
    canvas.toBlob((value) => {
      blob.value = value
      generating.value = false
    }, 'image/png')
  } catch {
    generating.value = false
    message.error('成绩卡生成失败，请重试')
  }
}

function handleDownload() {
  if (!blob.value) return
  const url = URL.createObjectURL(blob.value)
  const link = document.createElement('a')
  link.href = url
  link.download = `netpulse-${stamp()}.png`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 3000)
  message.success('成绩卡已保存')
}

async function handleCopy() {
  if (!blob.value) return
  try {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('unsupported')
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob.value })])
    message.success('已复制到剪贴板')
  } catch {
    message.warning('当前浏览器不支持复制图片，请改用下载')
  }
}

watch(() => props.show, (visible) => {
  if (visible) render()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="show" class="share-backdrop" @click.self="emit('close')">
        <section class="share-modal">
          <header>
            <div class="share-head-text">
              <h3>成绩卡</h3>
              <p>本地绘制，分享图里不含 IP 与任何身份信息</p>
            </div>
            <button type="button" aria-label="关闭" @click="emit('close')">×</button>
          </header>

          <div class="share-body">
            <img v-if="preview" :src="preview" alt="测速成绩卡预览" />
            <p v-else-if="generating" class="share-empty">正在绘制…</p>
            <p v-else class="share-empty">还没有测速记录，先跑一次再生成成绩卡。</p>
          </div>

          <footer>
            <button class="ghost" type="button" @click="emit('close')">关闭</button>
            <button class="ghost" type="button" :disabled="!blob" @click="handleCopy">复制图片</button>
            <button class="primary" type="button" :disabled="!blob" @click="handleDownload">下载 PNG</button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.share-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(2px);
}

.share-modal {
  display: flex;
  flex-direction: column;
  width: min(920px, 100%);
  max-height: calc(100vh - 40px);
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-card);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
}

.share-head-text h3 {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.share-head-text p {
  margin-top: 3px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

header button {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

header button:hover {
  color: var(--text-primary);
}

.share-body {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 18px;
  overflow: auto;
  background: var(--bg-subtle);
}

.share-body img {
  display: block;
  width: 100%;
  max-width: 860px;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
}

.share-empty {
  padding: 56px 16px;
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
}

footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 18px;
  border-top: 1px solid var(--border-subtle);
}

footer button {
  height: 34px;
  min-width: 78px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}

footer .ghost {
  background: var(--bg-card);
  color: var(--text-secondary);
}

footer .ghost:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--bg-subtle);
}

footer .primary {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: var(--accent-on-primary);
}

footer button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.16s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .share-backdrop {
    padding: 12px;
    align-items: flex-start;
    padding-top: 40px;
  }

  .share-modal {
    max-height: calc(100vh - 60px);
  }

  footer {
    flex-wrap: wrap;
  }

  footer button {
    flex: 1;
  }
}
</style>
