<script setup lang="ts">
import { computed, ref } from 'vue'
import { NInput, NModal, NSelect, useMessage } from 'naive-ui'
import { useNodesStore, type CustomNode, type NodeMethod } from '@/stores/nodes'
import { useSettingsStore } from '@/stores/settings'
import { copyText } from '@/utils/clipboard'
import { checkBlockList, validateSpeedNodeUrl } from '@/utils/nodeConnectivity'
import { findCustomNodeDuplicate } from '@/utils/customNodes'
import {
  createNodeProfile,
  downloadNodeProfile,
  isNodeProfileFilename,
  parseNodeProfileFile,
} from '@/utils/nodeProfiles'

const nodesStore = useNodesStore()
const settings = useSettingsStore()
const message = useMessage()

const emit = defineEmits<{
  (e: 'back'): void
}>()

const methodOptions = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'HEAD', value: 'HEAD' },
]

const activeGroup = ref('全部')
const groupNames = computed(() => ['全部', ...nodesStore.customNodeGroups])
const activeGroupValue = computed({
  get: () => activeGroup.value,
  set: (value: string) => { activeGroup.value = value },
})

const listNodes = computed(() => {
  const all = nodesStore.customNodes
  if (activeGroup.value === '全部') return all
  return all.filter(node => (node.group || '默认') === activeGroup.value)
})

function countOfGroup(group: string) {
  if (group === '全部') return nodesStore.customNodes.length
  return nodesStore.customNodes.filter(node => (node.group || '默认') === group).length
}

/** 表单 */
const showForm = ref(false)
const editing = ref<CustomNode | null>(null)
const submitting = ref(false)
const form = ref({
  label: '',
  value: '',
  group: '默认',
  method: 'GET' as NodeMethod,
  postData: '',
  headers: '',
})

const groupOptions = computed(() => nodesStore.customNodeGroups.map(group => ({ label: group, value: group })))

function openCreate() {
  editing.value = null
  form.value = {
    label: '',
    value: '',
    group: activeGroup.value === '全部' ? '默认' : activeGroup.value,
    method: 'GET',
    postData: '',
    headers: '',
  }
  showForm.value = true
}

function openEdit(node: CustomNode) {
  editing.value = node
  form.value = {
    label: node.label,
    value: node.value,
    group: node.group || '默认',
    method: node.method || 'GET',
    postData: node.postData || '',
    headers: node.headers || '',
  }
  showForm.value = true
}

function validateForm(): string {
  const label = form.value.label.trim()
  const value = form.value.value.trim()
  if (!label) return '请填写节点名称'
  if (!value) return '请填写节点链接'
  if (!/^https?:\/\//i.test(value)) return '节点链接需以 http:// 或 https:// 开头'
  const check = checkBlockList(value)
  if (!check.status) return check.info
  if (form.value.headers.trim()) {
    try {
      const parsed = JSON.parse(form.value.headers)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return '请求头需为 JSON 对象'
    } catch {
      return '请求头不是合法 JSON'
    }
  }
  const duplicate = findCustomNodeDuplicate(
    nodesStore.customNodes.filter(node => node !== editing.value),
    label,
    value,
  )
  if (duplicate === 'label') return '已存在同名节点'
  if (duplicate === 'url') return '已存在相同链接的节点'
  return ''
}

async function submitForm() {
  const error = validateForm()
  if (error) {
    message.warning(error)
    return
  }
  submitting.value = true
  try {
    const payload = {
      label: form.value.label.trim(),
      value: form.value.value.trim(),
      group: form.value.group.trim() || '默认',
      method: form.value.method,
      postData: form.value.method === 'POST' ? form.value.postData : '',
      headers: form.value.headers.trim(),
      httpProtocol: 'AUTO' as const,
      enhanced: false,
    }
    if (editing.value) {
      nodesStore.updateCustomNode(editing.value, payload)
      message.success('节点已更新')
    } else {
      nodesStore.addCustomNode(
        payload.label,
        payload.value,
        payload.method,
        payload.postData,
        payload.group,
      )
      const created = nodesStore.customNodes[nodesStore.customNodes.length - 1]
      if (created && payload.headers) {
        nodesStore.updateCustomNode(created, { ...payload })
      }
      message.success('节点已添加')
    }
    if (!nodesStore.customNodeGroups.includes(payload.group)) nodesStore.addCustomNodeGroup(payload.group)
    if (activeGroup.value !== '全部' && activeGroup.value !== payload.group) activeGroup.value = payload.group
    showForm.value = false
  } finally {
    submitting.value = false
  }
}

const testingUrl = ref('')
const testResult = ref<Record<string, boolean>>({})

async function testNode(node: CustomNode) {
  if (testingUrl.value) return
  testingUrl.value = node.value
  const result = await validateSpeedNodeUrl(node.value)
  testResult.value = { ...testResult.value, [node.value]: result.status }
  if (result.status) message.success(`「${node.label}」连接正常`)
  else message.error(`「${node.label}」不可用：${result.info}`)
  testingUrl.value = ''
}

async function useNode(node: CustomNode) {
  settings.groupMode = false
  settings.urlValue = node.value
  message.success(`已切换到「${node.label}」`)
}

async function copyNode(node: CustomNode) {
  const ok = await copyText(node.value)
  if (ok) message.success('链接已复制')
  else message.error('复制失败，请手动选择')
}

function removeNode(node: CustomNode) {
  nodesStore.removeCustomNode(node)
  message.success('节点已删除')
}

/** 分组 */
function addGroup() {
  const name = window.prompt('新分组名称')
  if (!name) return
  const ok = nodesStore.addCustomNodeGroup(name)
  if (!ok) message.warning('该分组已存在')
  else message.success('分组已创建')
}

function removeGroup(group: string) {
  if (group === '默认') return
  if (!window.confirm(`删除分组「${group}」？组内节点会移回「默认」。`)) return
  nodesStore.removeCustomNodeGroup(group)
  if (activeGroup.value === group) activeGroup.value = '全部'
}

/** 导入导出 */
const fileInput = ref<HTMLInputElement | null>(null)

function exportProfile() {
  if (!nodesStore.customNodes.length) {
    message.warning('暂无可导出的节点')
    return
  }
  downloadNodeProfile(createNodeProfile(nodesStore.customNodes))
  message.success('配置文件已导出')
}

function pickFile() {
  fileInput.value?.click()
}

async function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!isNodeProfileFilename(file.name)) {
    message.error('请选择 .json 配置文件')
    return
  }
  try {
    const raw = await file.text()
    const { nodes, skippedCount } = parseNodeProfileFile(raw, nodesStore.customNodes)
    if (!nodes.length) {
      message.warning(skippedCount > 0 ? `没有可导入的节点（跳过 ${skippedCount} 条重复或无效数据）` : '文件中没有有效节点')
      return
    }
    nodesStore.addCustomNodes(nodes)
    message.success(`已导入 ${nodes.length} 个节点${skippedCount ? `，跳过 ${skippedCount} 条` : ''}`)
  } catch (err) {
    message.error(err instanceof Error ? err.message : '导入失败')
  }
}

function formatTime(text: string) {
  return text || ''
}
</script>

<template>
  <div class="subpanel">
    <div class="node-actions">
      <button class="np-btn-primary node-action-main" @click="openCreate">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        新增节点
      </button>
      <button class="node-action" @click="pickFile">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
        </svg>
        导入
      </button>
      <button class="node-action" @click="exportProfile">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 15V3M7 8l5-5 5 5M5 21h14" />
        </svg>
        导出
      </button>
      <input ref="fileInput" type="file" accept=".json,application/json" class="hidden-file" @change="handleFile" />
    </div>

    <div class="group-bar">
      <button
        v-for="group in groupNames"
        :key="group"
        class="group-chip"
        :class="{ active: activeGroup === group }"
        @click="activeGroup = group"
      >
        {{ group }}
        <span class="group-count">{{ countOfGroup(group) }}</span>
        <span
          v-if="group !== '全部' && group !== '默认'"
          class="group-remove"
          role="button"
          aria-label="删除分组"
          @click.stop="removeGroup(group)"
        >×</span>
      </button>
      <button class="group-chip group-add" @click="addGroup">+ 分组</button>
    </div>

    <div v-if="listNodes.length" class="node-list">
      <article v-for="node in listNodes" :key="node.time + node.label" class="node-card">
        <header class="node-head">
          <div class="node-title">
            <span class="node-label" :title="node.label">{{ node.label }}</span>
            <span class="node-tag">{{ node.method || 'GET' }}</span>
            <span class="node-tag">{{ node.group || '默认' }}</span>
          </div>
          <span class="node-time">{{ formatTime(node.time) }}</span>
        </header>
        <p class="node-url" :title="node.value">{{ node.value }}</p>
        <footer class="node-foot">
          <button class="node-btn" :disabled="!!testingUrl" @click="testNode(node)">
            <span v-if="testingUrl === node.value" class="np-spin node-dot" />
            <span v-else-if="testResult[node.value] === true" class="node-dot ok" />
            <span v-else-if="testResult[node.value] === false" class="node-dot bad" />
            {{ testingUrl === node.value ? '检测中' : '检测' }}
          </button>
          <button class="node-btn" @click="useNode(node)">使用</button>
          <button class="node-btn" @click="copyNode(node)">复制</button>
          <button class="node-btn" @click="openEdit(node)">编辑</button>
          <button class="node-btn danger" @click="removeNode(node)">删除</button>
        </footer>
      </article>
    </div>

    <div v-else class="node-empty">
      <span>{{ activeGroup === '全部' ? '还没有自定义节点' : '该分组下还没有节点' }}</span>
      <button class="node-empty-add" @click="openCreate">新增</button>
    </div>

    <NModal v-model:show="showForm" :mask-closable="!submitting">
      <div class="node-modal">
        <header>
          <h3>{{ editing ? '编辑节点' : '新增节点' }}</h3>
          <button @click="showForm = false">×</button>
        </header>
        <div class="node-form">
          <label>节点名称</label>
          <NInput v-model:value="form.label" placeholder="Cloudflare 新加坡" size="small" />

          <label>节点链接</label>
          <NInput v-model:value="form.value" placeholder="https://example.com/file" size="small" />

          <div class="node-form-row">
            <div>
              <label>请求方法</label>
              <NSelect v-model:value="form.method" :options="methodOptions" size="small" />
            </div>
            <div>
              <label>分组</label>
              <NSelect
                v-model:value="form.group"
                :options="groupOptions"
                tag
                filterable
                size="small"
                placeholder="选择或输入新分组"
              />
            </div>
          </div>

          <template v-if="form.method === 'POST'">
            <label>请求体</label>
            <NInput v-model:value="form.postData" type="textarea" :autosize="{ minRows: 2, maxRows: 5 }" />
          </template>

          <label>请求头（可选，JSON 对象）</label>
          <NInput
            v-model:value="form.headers"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder='{"User-Agent":"NetPulse"}'
          />
        </div>
        <footer>
          <button class="ghost" @click="showForm = false">取消</button>
          <button class="primary" :disabled="submitting" @click="submitForm">
            {{ submitting ? '保存中...' : '保存' }}
          </button>
        </footer>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.subpanel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.subpanel-titlebar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.subpanel-titlebar h3 {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.25;
}

.subpanel-titlebar p {
  margin-top: 3px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.node-actions {
  display: flex;
  gap: 8px;
}

.node-action-main {
  flex: 1;
  height: 36px;
  font-size: 13px;
  padding-inline: 12px;
}

.node-action-main svg,
.node-action svg {
  width: 14px;
  height: 14px;
}

.node-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.node-action:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
  border-color: var(--text-muted);
}

.hidden-file {
  display: none;
}

.group-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding-bottom: 2px;
  border-bottom: 1px solid var(--border-subtle);
}

.group-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0;
  border: 0;
  border-bottom: 1px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 400;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.group-chip:hover {
  color: var(--text-primary);
}

.group-chip.active {
  border-bottom-color: var(--text-primary);
  background: transparent;
  color: var(--text-primary);
}

.group-count {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1;
}

.group-chip.active .group-count {
  background: transparent;
  color: var(--text-secondary);
}

.group-remove {
  margin-left: 1px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1;
  opacity: 0.7;
}

.group-remove:hover {
  color: var(--tone-bad);
  opacity: 1;
}

.group-add {
  border-style: dashed;
  color: var(--text-muted);
}

.node-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 460px;
  overflow-y: auto;
  padding-right: 2px;
}

.node-card {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--bg-subtle);
}

.node-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.node-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.node-label {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-tag {
  flex: 0 0 auto;
  padding: 1px 5px;
  border-radius: var(--r-xs);
  background: var(--bg-card);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
}

.node-time {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 10px;
}

.node-url {
  margin-top: 4px;
  overflow: hidden;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-foot {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.node-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: var(--r-xs);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}

.node-btn:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--text-muted);
}

.node-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.node-btn.danger:hover {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.node-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1.5px solid var(--text-muted);
  border-top-color: transparent;
}

.node-dot.ok {
  border: none;
  background: var(--color-success);
}

.node-dot.bad {
  border: none;
  background: var(--color-danger);
}

.node-empty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 12px;
}

.node-empty-add {
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-primary);
  font-size: 12px;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.node-empty-add:hover {
  color: var(--trace);
}

.panel-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 38px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.panel-button:hover {
  color: var(--text-primary);
  border-color: var(--text-muted);
  background: var(--bg-subtle);
}

.panel-button svg {
  width: 14px;
  height: 14px;
}

.node-modal {
  width: min(420px, calc(100vw - 32px));
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  background: var(--bg-card);
  box-shadow: var(--shadow-lg);
}

.node-modal header,
.node-modal footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 13px 16px;
}

.node-modal header {
  border-bottom: 1px solid var(--border);
}

.node-modal h3 {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 500;
}

.node-modal header button {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--bg-card);
  color: var(--text-muted);
  cursor: pointer;
}

.node-form {
  display: grid;
  gap: 7px;
  padding: 16px;
}

.node-form label {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.node-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.node-form-row > div {
  display: grid;
  gap: 7px;
}

.node-modal footer {
  justify-content: flex-end;
  border-top: 1px solid var(--border-subtle);
}

.node-modal footer button {
  height: 34px;
  min-width: 76px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.node-modal footer .ghost {
  background: var(--bg-card);
  color: var(--text-secondary);
}

.node-modal footer .primary {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: var(--accent-on-primary);
}

.node-modal footer .primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 420px) {
  .node-form-row {
    grid-template-columns: 1fr;
  }
}
</style>
