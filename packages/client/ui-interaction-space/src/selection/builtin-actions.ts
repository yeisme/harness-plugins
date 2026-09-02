/**
 * V2 built-in 动作与按 context 的内置顺序（design §内置 built-in map）。
 *
 * canonical id 固定为 `dsh:<action>`；V1 toolbar id 作为 alias 挂接。顺序经
 * built-in 偏好层（BUILTIN_CONTEXT_ORDERS）实现——descriptor.priority 只作
 * 未覆盖场景的回退排序，自定义顺序不得突破 capability/danger 边界。
 *
 * @module @yeisme/dsh-client-ui-interaction-space/selection
 */

import type { SelectionActionDescriptorV2, SelectionContextKindV2 } from './contracts.ts'

/** ask/open-full 需要 Conversation Composer owner；edit 需要 preview owner；批注组需要 batch owner。 */
export const SELECTION_CAPABILITY_CONVERSATION = 'conversation.composer'
export const SELECTION_CAPABILITY_EDIT = 'selection.edit'
export const SELECTION_CAPABILITY_BATCH = 'annotation.batch'

export const BUILTIN_SELECTION_ACTIONS: readonly SelectionActionDescriptorV2[] = [
  {
    id: 'dsh:ask',
    aliases: ['ask'],
    label: { default: 'Ask Agent', zh: '问 Agent' },
    shortLabel: { default: 'Ask', zh: '问' },
    contexts: ['text', 'source', 'image-region', 'table-range', 'editable-control'],
    requires: [SELECTION_CAPABILITY_CONVERSATION],
    priority: 90,
    defaultSlot: 'primary',
    visibility: 'default',
    danger: 'safe',
    owner: 'dsh',
    presentation: 'composer',
    disabledReason: { default: 'conversation composer unavailable', zh: '会话输入区不可用' },
  },
  {
    id: 'dsh:comment',
    aliases: ['comment'],
    label: { default: 'Comment', zh: '评论' },
    shortLabel: { default: 'Comment', zh: '评论' },
    contexts: ['text', 'source', 'image-region', 'table-range', 'editable-control'],
    priority: 85,
    defaultSlot: 'secondary',
    visibility: 'default',
    danger: 'safe',
    owner: 'dsh',
    presentation: 'composer',
  },
  {
    id: 'dsh:edit',
    aliases: ['edit', 'agent-edit'],
    label: { default: 'Edit', zh: '编辑' },
    shortLabel: { default: 'Edit', zh: '编辑' },
    contexts: ['text', 'source', 'image-region', 'table-range', 'editable-control'],
    requires: [SELECTION_CAPABILITY_EDIT],
    priority: 80,
    defaultSlot: 'more',
    visibility: 'default',
    danger: 'preview-first',
    owner: 'dsh',
    presentation: 'composer',
    disabledReason: { default: 'selection edit owner unavailable', zh: '选区编辑 owner 不可用' },
  },
  {
    id: 'dsh:analyze',
    label: { default: 'Analyze', zh: '分析' },
    shortLabel: { default: 'Analyze', zh: '分析' },
    contexts: ['table-range'],
    requires: [SELECTION_CAPABILITY_CONVERSATION],
    priority: 75,
    defaultSlot: 'primary',
    visibility: 'default',
    danger: 'safe',
    owner: 'dsh',
    presentation: 'composer',
    disabledReason: { default: 'conversation composer unavailable', zh: '会话输入区不可用' },
  },
  {
    id: 'dsh:copy-quote',
    aliases: ['copy-quote'],
    label: { default: 'Copy quote', zh: '复制引用' },
    shortLabel: { default: 'Copy', zh: '复制' },
    contexts: ['text', 'source', 'table-range', 'editable-control'],
    priority: 70,
    defaultSlot: 'secondary',
    visibility: 'default',
    danger: 'safe',
    owner: 'client',
    presentation: 'local',
  },
  {
    id: 'dsh:add-to-batch',
    aliases: ['add-to-batch'],
    label: { default: 'Add to batch', zh: '加入批注组' },
    shortLabel: { default: 'Batch', zh: '批注组' },
    contexts: ['text', 'source', 'image-region', 'table-range', 'editable-control'],
    requires: [SELECTION_CAPABILITY_BATCH],
    priority: 60,
    defaultSlot: 'more',
    visibility: 'default',
    danger: 'safe',
    owner: 'dsh',
    presentation: 'local',
    disabledReason: { default: 'annotation batch unavailable', zh: '批注组不可用' },
  },
  {
    id: 'dsh:open-full',
    aliases: ['open-full'],
    label: { default: 'Open in workbench', zh: '在完整工作台打开' },
    shortLabel: { default: 'Open', zh: '打开' },
    contexts: ['text', 'source', 'image-region', 'table-range', 'editable-control'],
    requires: [SELECTION_CAPABILITY_CONVERSATION],
    priority: 50,
    defaultSlot: 'more',
    visibility: 'default',
    danger: 'safe',
    owner: 'dsh',
    presentation: 'pane',
    disabledReason: { default: 'conversation composer unavailable', zh: '会话输入区不可用' },
  },
]

/** built-in 偏好层：每 context 的确定性顺序（primary=第 1，secondary=2-3，余 More）。 */
export const BUILTIN_CONTEXT_ORDERS: Readonly<Record<SelectionContextKindV2, readonly string[]>> = Object.freeze({
  'text': ['dsh:ask', 'dsh:comment', 'dsh:copy-quote', 'dsh:edit', 'dsh:add-to-batch', 'dsh:open-full'],
  'source': ['dsh:ask', 'dsh:comment', 'dsh:copy-quote', 'dsh:edit', 'dsh:add-to-batch', 'dsh:open-full'],
  'image-region': ['dsh:comment', 'dsh:ask', 'dsh:add-to-batch', 'dsh:edit', 'dsh:open-full'],
  'table-range': ['dsh:analyze', 'dsh:comment', 'dsh:copy-quote', 'dsh:edit', 'dsh:add-to-batch', 'dsh:open-full'],
  'editable-control': ['dsh:edit', 'dsh:ask', 'dsh:comment', 'dsh:copy-quote', 'dsh:add-to-batch', 'dsh:open-full'],
})

/** 注册全部 built-in 动作；返回统一 dispose（逐个注销，供测试/HMR）。 */
export function registerBuiltinSelectionActions(registry: {
  register(input: unknown): { ok: boolean; handle?: { dispose(): void }; detail?: string }
}): () => void {
  const handles: Array<() => void> = []
  for (const descriptor of BUILTIN_SELECTION_ACTIONS) {
    const result = registry.register(descriptor)
    if (result.ok && result.handle !== undefined) handles.push(result.handle.dispose)
  }
  return () => {
    for (const dispose of handles) dispose()
  }
}
