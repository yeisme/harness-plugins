/**
 * DSH Web 选区批注浏览器入口（Selection Interaction V2 主路径 + V1 adapter）。
 *
 * V2（默认）：`selectionchange` 由全局 singleton 交互层（ui-interaction-space）
 * 归一化为 `SelectionContextV2` 并渲染 Actions(1+2+More)/Bottom Sheet；本插件
 * 只提交 context、计算 anchor 草稿并承接显式动作（Composer/批注组/复制）。
 * 选中不再自动打开 Composer——只有显式 ask/comment/edit 才打开。
 *
 * V1 adapter（`policyVersion=v1` 或 kill-switch 层外的显式回退）：旧浮动
 * 工具条路径保留一个 release，运行时发出 deprecated 脱敏 evidence 标记。
 *
 * kill-switch：浏览器偏好存储中 `'dsh-selection-annotation' === 'off'`
 * （经 sdk 契约 seam 读取）；策略键 `'dsh-selection-annotation-policy'`。
 * 发送动作经 CustomEvent 交给宿主/工作台桥接（conversation runtime 由 DSH
 * 拥有）；无桥接时评论本地保存、询问诚实降级。
 *
 * @module @yeisme/dsh-client-ui-selection-annotation/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { browserPreferenceStorage, probeCapability } from '@yeisme/dsh-plugin-contracts'
import {
  attachSharedSelectionInteraction,
  getSharedSelectionInteraction,
  type SelectionActionIntentV2,
  type SelectionContextV2,
} from '@yeisme/dsh-client-ui-interaction-space'
import type { AnchorDraft } from '@yeisme/dsh-selection-host'
import { captureFromSelection, selectionToAnchorDraft, type SelectionCapture } from './dom-anchors.ts'
import { CompactComposerController, type ComposerAdapter } from './composer.ts'
import { labelsFor } from './locales.ts'
import { edgeAnchorSide, SelectionToolbarController, type ToolbarAction } from './toolbar.ts'
import { injectSelectionAnnotationStyles } from './styles.ts'

export { AnnotationCanvas, type AnnotationCanvasProps, type CanvasMarker } from './AnnotationCanvas.tsx'
export { CompactComposerController } from './composer.ts'
export { SelectionToolbarController, placeToolbar, edgeAnchorSide } from './toolbar.ts'
export { ApprovalPanelController } from './approval.ts'
export { labelsFor } from './locales.ts'
export {
  captureFromSelection,
  resolveSelectionSourceRange,
  resolveSourceRange,
  selectionToAnchorDraft,
} from './dom-anchors.ts'
export {
  clampRegion,
  fromNormalized,
  pixelOffsetToNormalized,
  pointInRegion,
  roundTripRegion,
  toNormalized,
} from './image-region.ts'

export const name = 'client-ui-selection-annotation'
export const inject = [] as const

export const SELECTION_ANNOTATION_SUBMIT_EVENT = 'dsh-selection-annotation:submit'
export const SELECTION_ANNOTATION_BATCH_EVENT = 'dsh-selection-annotation:add-to-batch'
/** Additive bridge to the host-owned main conversation reference controller. */
export const COMPOSER_REFERENCE_ADD_EVENT = 'dsh-composer-reference:add-to-main'
/** Host receipt for an explicit reference insertion request. */
export const COMPOSER_REFERENCE_ADD_RESULT_EVENT = 'dsh-composer-reference:add-to-main-result'
/** Cordis context key for the host-owned current-target and source resolver bridge. */
export const SELECTION_REFERENCE_BRIDGE_CONTEXT_KEY = 'composerReferenceBridge'
let selectionReferenceMountSequence = 0
/** 引用插入回执等待上限：超时按 unknown 处理，保留原请求，绝不自动重发。 */
const REFERENCE_RECEIPT_TIMEOUT_MS = 5_000
/** Target picker may return before the owner projection has changed. */
const CHOOSE_TARGET_SNAPSHOT_TIMEOUT_MS = 5_000
export const SELECTION_ANNOTATION_KILL_SWITCH = 'dsh-selection-annotation'
/** 策略键：`v1` 强制 V1 adapter（兼容窗口内回退通道）。 */
export const SELECTION_ANNOTATION_POLICY_KEY = 'dsh-selection-annotation-policy'
/** V2 交互层协商/证据事件（脱敏：只含版本、capability 与结果）。 */
export const SELECTION_INTERACTION_EVIDENCE_EVENT = 'dsh-selection-interaction:evidence'

export interface SelectionInteractionEvidence {
  readonly policyVersion: 'v1' | 'v2'
  readonly capability: 'selection.interaction.v2'
  readonly result: 'v2-layer-attached' | 'v1-adapter-active'
  readonly deprecated: boolean
}

export interface SelectionAnnotationSubmitDetail {
  readonly intent: 'ask' | 'comment' | 'edit'
  readonly text: string
  readonly anchor: AnchorDraft | undefined
  readonly approvalPolicy: 'preview-first'
  /** V2 additive：canonical action id 与上下文类别（旧消费者可忽略）。 */
  readonly policyVersion?: 'v1' | 'v2'
  readonly canonicalActionId?: string
  readonly contextKind?: 'text' | 'source' | 'image-region' | 'table-range' | 'editable-control'
  /** 显式未关联来源的文字引用标记；缺席表示常规 intent 语义。 */
  readonly kind?: 'text-quote'
  readonly attribution?: 'none'
}

export interface ConversationReferenceTarget {
  readonly workspaceId: string
  readonly conversationId: string
  readonly draftRevision?: number
  readonly title?: string
}

/** Additive seam probes mirrored from the host bridge snapshot. */
export interface ComposerReferenceBridgeFeatures {
  readonly activation?: boolean
  readonly chooseTarget?: boolean
}

export interface ComposerReferenceBridgeSnapshot {
  readonly available: boolean
  readonly reason?: string
  /** Captured by the actual Conversation/Workspace owner, never by DOM focus. */
  readonly target?: ConversationReferenceTarget
  readonly features?: ComposerReferenceBridgeFeatures
}

/** Bounded source proof emitted by an owner renderer, never inferred from visible text. */
export interface SelectionReferenceSourceDescriptor {
  readonly owner: string
  readonly ref: string
  readonly version: string
  readonly scope: string
  readonly window: Readonly<{ readonly start: number; readonly end: number }>
}

export type SelectionReferenceResolution =
  | { readonly status: 'available'; readonly reference: ComposerReferenceRecord }
  | { readonly status: 'unavailable'; readonly reason: string }

/** Host-owned target pick outcome; cancelled creates no conversation. */
export type SelectionReferenceChooseTargetResult =
  | { readonly status: 'selected'; readonly target: ConversationReferenceTarget }
  | { readonly status: 'cancelled' }
  | { readonly status: 'unavailable'; readonly reason: string }

export interface SelectionReferenceBridge {
  /** A live projection of host capability and explicit main-conversation target. */
  snapshot(): ComposerReferenceBridgeSnapshot
  subscribe(listener: () => void): () => void
  /** Owner-safe resolver; generic DOM selections must return unavailable. */
  resolveSelection(input: {
    readonly anchor: AnchorDraft
    readonly context: SelectionContextV2
    readonly quote: string
    readonly source: SelectionReferenceSourceDescriptor
  }): Promise<SelectionReferenceResolution>
  /** Host-owned picker / conversation creation; the plugin never builds a session list. */
  chooseTarget?(signal?: AbortSignal): Promise<SelectionReferenceChooseTargetResult>
}

export interface ComposerReferenceRecord {
  readonly id: string
  readonly kind: 'file' | 'directory' | 'selection' | 'message' | 'terminal' | 'image-region' | 'agent' | 'skill' | 'tool'
  readonly intent: 'content' | 'collaborator' | 'guidance' | 'capability'
  readonly owner: string
  readonly ref: string
  readonly version: string
  readonly label: string
  readonly scope: string
  readonly digest: string
  readonly freshness: string
  readonly preview?: string
  readonly window?: Readonly<{ readonly start: number; readonly end: number }>
}

export interface ComposerReferenceAddDetail {
  readonly version: 1
  readonly requestId: string
  readonly target: ConversationReferenceTarget
  readonly reference: ComposerReferenceRecord
  /** 引用并询问：请求宿主插入后激活目标并聚焦官方输入框。 */
  readonly activation?: { readonly focus: 'composer' }
}

export interface ComposerReferenceAddResultDetail {
  readonly version: 1
  readonly requestId?: string
  readonly ok: boolean
  readonly reason?: string
  readonly target: ConversationReferenceTarget
  /** 仅当宿主明确回执激活结果时存在；缺席按未确认处理。 */
  readonly activated?: boolean
}

export interface RuntimeOptions {
  /** Rendered surface descriptor; defaults treat the conversation DOM as source-less. */
  readonly artifactRef?: string
  readonly artifactVersion?: string
  readonly sourceArtifactRef?: string
  readonly narrow?: boolean
  /** Host-injected conversation composer/runtime seam; absent means honest degradation. */
  readonly composerAdapter?: ComposerAdapter
  /** Test/embedded override. Ordinary production boot resolves the Cordis bridge context. */
  readonly referenceBridge?: SelectionReferenceBridge
}

function emitEvidence(detail: SelectionInteractionEvidence, target: Window | undefined): void {
  target?.dispatchEvent(new CustomEvent(SELECTION_INTERACTION_EVIDENCE_EVENT, { detail }))
}

function hasReferenceTarget(target: ConversationReferenceTarget | undefined): target is ConversationReferenceTarget {
  return target !== undefined && target.workspaceId.trim() !== '' && target.conversationId.trim() !== ''
}

function referenceTargetKey(target: ConversationReferenceTarget): string {
  return `${target.workspaceId}\u0000${target.conversationId}`
}

function sameReferenceTarget(left: ConversationReferenceTarget, right: ConversationReferenceTarget): boolean {
  return left.workspaceId === right.workspaceId && left.conversationId === right.conversationId
    && left.draftRevision === right.draftRevision
}

function referenceRequestIdentity(target: ConversationReferenceTarget, reference: ComposerReferenceRecord): string {
  const window = reference.window === undefined ? '' : `${String(reference.window.start)}:${String(reference.window.end)}`
  return `${referenceTargetKey(target)}\u0000${reference.id}\u0000${reference.version}\u0000${reference.digest}\u0000${reference.scope}\u0000${window}`
}

function isSelectionReferenceBridge(value: unknown): value is SelectionReferenceBridge {
  if (value === null || typeof value !== 'object') return false
  const bridge = value as Partial<SelectionReferenceBridge>
  return typeof bridge.snapshot === 'function' && typeof bridge.subscribe === 'function' && typeof bridge.resolveSelection === 'function'
}

function resolveSelectionReferenceBridge(ctx: ClientContext, override: SelectionReferenceBridge | undefined): SelectionReferenceBridge | undefined {
  if (override !== undefined) return override
  try {
    const candidate = ctx.get(SELECTION_REFERENCE_BRIDGE_CONTEXT_KEY as never)
    return isSelectionReferenceBridge(candidate) ? candidate : undefined
  } catch {
    return undefined
  }
}

function bridgeSnapshot(bridge: SelectionReferenceBridge | undefined): ComposerReferenceBridgeSnapshot {
  if (bridge === undefined) return { available: false, reason: 'structured conversation reference bridge is unavailable' }
  try {
    const snapshot = bridge.snapshot()
    if (typeof snapshot?.available !== 'boolean') return { available: false, reason: 'structured conversation reference bridge returned an invalid capability projection' }
    return snapshot
  } catch {
    return { available: false, reason: 'structured conversation reference bridge is unavailable' }
  }
}

const REFERENCE_SOURCE_PART = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,511}$/
const REFERENCE_SOURCE_SCOPE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const REFERENCE_SOURCE_DECIMAL = /^(?:0|[1-9][0-9]*)$/
const REFERENCE_SOURCE_WINDOW_MAX = 10_000_000

interface ReferenceSourceElement {
  readonly element: Element
  readonly descriptor: SelectionReferenceSourceDescriptor
}

function readReferenceSource(node: Node | null): ReferenceSourceElement | undefined {
  let current = node
  while (current !== null) {
    if (current instanceof Element && current.hasAttribute('data-dsh-reference-source')) {
      const owner = current.getAttribute('data-dsh-reference-source-owner') ?? ''
      const ref = current.getAttribute('data-dsh-reference-source-ref') ?? ''
      const version = current.getAttribute('data-dsh-reference-source-version') ?? ''
      const scope = current.getAttribute('data-dsh-reference-source-scope') ?? ''
      const rawStart = current.getAttribute('data-dsh-reference-source-range-start') ?? ''
      const rawEnd = current.getAttribute('data-dsh-reference-source-range-end') ?? ''
      const start = REFERENCE_SOURCE_DECIMAL.test(rawStart) ? Number(rawStart) : Number.NaN
      const end = REFERENCE_SOURCE_DECIMAL.test(rawEnd) ? Number(rawEnd) : Number.NaN
      const rawTextBytes = new TextEncoder().encode(current.textContent ?? '').byteLength
      if (REFERENCE_SOURCE_PART.test(owner) && REFERENCE_SOURCE_PART.test(ref) && REFERENCE_SOURCE_PART.test(version)
        && REFERENCE_SOURCE_SCOPE.test(scope) && Number.isInteger(start) && Number.isInteger(end)
        && start >= 0 && end > start && end <= REFERENCE_SOURCE_WINDOW_MAX && rawTextBytes === end - start) {
        return { element: current, descriptor: { owner, ref, version, scope, window: { start, end } } }
      }
      return undefined
    }
    current = current.parentNode
  }
  return undefined
}

function utf8PrefixBytes(source: ReferenceSourceElement, node: Node, offset: number): number | undefined {
  if (!source.element.contains(node) && source.element !== node) return undefined
  try {
    const range = source.element.ownerDocument.createRange()
    range.selectNodeContents(source.element)
    range.setEnd(node, offset)
    return new TextEncoder().encode(range.toString()).byteLength
  } catch {
    return undefined
  }
}

function sourceDescriptorForCapture(capture: SelectionCapture): SelectionReferenceSourceDescriptor | undefined {
  const start = readReferenceSource(capture.startNode)
  const end = readReferenceSource(capture.endNode)
  if (start === undefined || end === undefined) return undefined
  const startDescriptor = start.descriptor
  const endDescriptor = end.descriptor
  if (startDescriptor.owner !== endDescriptor.owner || startDescriptor.ref !== endDescriptor.ref
    || startDescriptor.version !== endDescriptor.version || startDescriptor.scope !== endDescriptor.scope) return undefined
  const startPrefix = utf8PrefixBytes(start, capture.range.startContainer, capture.range.startOffset)
  const endPrefix = utf8PrefixBytes(end, capture.range.endContainer, capture.range.endOffset)
  if (startPrefix === undefined || endPrefix === undefined) return undefined
  const window = { start: startDescriptor.window.start + startPrefix, end: endDescriptor.window.start + endPrefix }
  if (window.start < startDescriptor.window.start || window.start > startDescriptor.window.end
    || window.end < endDescriptor.window.start || window.end > endDescriptor.window.end || window.end <= window.start) return undefined
  return { owner: startDescriptor.owner, ref: startDescriptor.ref, version: startDescriptor.version, scope: startDescriptor.scope, window }
}

function referenceReceiptMessage(labels: ReturnType<typeof labelsFor>, receipt: ComposerReferenceAddResultDetail, activation: boolean): string {
  const title = receipt.target.title ?? receipt.target.conversationId
  if (receipt.ok) {
    if (activation) {
      return receipt.activated === true
        ? labels['reference.askReady'].replace('{title}', title)
        : labels['reference.addedNoFocus'].replace('{title}', title)
    }
    return labels['reference.addedTo'].replace('{title}', title)
  }
  const knownReasons: Record<string, string> = {
    'target-unavailable': labels['reference.targetUnavailable'],
    'reference-stale': labels['reference.stale'],
    'host-seam-unavailable': labels['reference.hostUnavailable'],
    'invalid-reference': labels['reference.invalid'],
  }
  return knownReasons[receipt.reason ?? ''] ?? labels['reference.unavailable']
}

/** jsdom 与旧引擎没有 Range 布局：回落到祖先元素矩形。 */
function safeSelectionRect(range: Range): { top: number; left: number; width: number; height: number } {
  if (typeof range.getBoundingClientRect === 'function') {
    return range.getBoundingClientRect()
  }
  const container = range.startContainer instanceof Element
    ? range.startContainer
    : range.startContainer.parentElement
  if (container !== null) {
    const rect = container.getBoundingClientRect()
    if (rect.width > 0 || rect.height > 0) return rect
  }
  return { top: 96, left: 48, width: 160, height: 24 }
}

type ComposerIntent = 'ask' | 'comment' | 'edit'
type ComposerFlavor = 'text' | 'source' | 'error' | 'image' | 'table' | 'editable'

interface ComposerPreset {
  readonly id: string
  readonly label: string
  readonly prompt: string
  readonly intent: ComposerIntent
}

function escapeMarkup(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const ERROR_LIKE_SELECTION = /(?:error|exception|failed|failure|cannot|undefined|null pointer|traceback|报错|错误|失败|异常|无法)/i

function composerFlavor(context: SelectionContextV2 | undefined, quote: string): ComposerFlavor {
  if (ERROR_LIKE_SELECTION.test(quote)) return 'error'
  if (context?.kind === 'source') return 'source'
  if (context?.kind === 'image-region') return 'image'
  if (context?.kind === 'table-range') return 'table'
  if (context?.kind === 'editable-control') return 'editable'
  return 'text'
}

function contextLabel(labels: ReturnType<typeof labelsFor>, flavor: ComposerFlavor): string {
  if (flavor === 'source') return labels['composer.context.source']
  if (flavor === 'error') return labels['composer.context.error']
  if (flavor === 'image') return labels['composer.context.image']
  if (flavor === 'table') return labels['composer.context.table']
  if (flavor === 'editable') return labels['composer.context.editable']
  return labels['composer.context.text']
}

function composerPresets(labels: ReturnType<typeof labelsFor>, flavor: ComposerFlavor): readonly ComposerPreset[] {
  if (flavor === 'error') return [
    { id: 'diagnose', label: labels['composer.preset.diagnose'], prompt: labels['composer.preset.diagnosePrompt'], intent: 'ask' },
    { id: 'fix', label: labels['composer.preset.fix'], prompt: labels['composer.preset.fixPrompt'], intent: 'edit' },
    { id: 'explain', label: labels['composer.preset.explain'], prompt: labels['composer.preset.explainPrompt'], intent: 'ask' },
  ]
  if (flavor === 'source') return [
    { id: 'explain', label: labels['composer.preset.explain'], prompt: labels['composer.preset.explainPrompt'], intent: 'ask' },
    { id: 'review', label: labels['composer.preset.review'], prompt: labels['composer.preset.reviewPrompt'], intent: 'ask' },
    { id: 'fix', label: labels['composer.preset.fix'], prompt: labels['composer.preset.fixPrompt'], intent: 'edit' },
  ]
  if (flavor === 'image') return [
    { id: 'annotate', label: labels['composer.preset.annotate'], prompt: labels['composer.preset.annotatePrompt'], intent: 'comment' },
    { id: 'review', label: labels['composer.preset.review'], prompt: labels['composer.preset.reviewPrompt'], intent: 'ask' },
  ]
  if (flavor === 'table') return [
    { id: 'analyze', label: labels['composer.preset.analyze'], prompt: labels['composer.preset.analyzePrompt'], intent: 'ask' },
    { id: 'summarize', label: labels['composer.preset.summarize'], prompt: labels['composer.preset.summarizePrompt'], intent: 'ask' },
  ]
  return [
    { id: 'explain', label: labels['composer.preset.explain'], prompt: labels['composer.preset.explainPrompt'], intent: 'ask' },
    { id: 'summarize', label: labels['composer.preset.summarize'], prompt: labels['composer.preset.summarizePrompt'], intent: 'ask' },
    { id: 'rewrite', label: labels['composer.preset.rewrite'], prompt: labels['composer.preset.rewritePrompt'], intent: 'edit' },
  ]
}

function composerHeading(labels: ReturnType<typeof labelsFor>, intent: ComposerIntent, flavor: ComposerFlavor): string {
  if (intent === 'comment') return labels['composer.heading.comment']
  if (intent === 'edit') return flavor === 'error' ? labels['composer.heading.fix'] : labels['composer.heading.edit']
  if (flavor === 'error') return labels['composer.heading.diagnose']
  if (flavor === 'source') return labels['composer.heading.source']
  return labels['composer.heading.ask']
}

type SelectionRect = Readonly<{ top: number; left: number; width: number; height: number }>

function currentSelectionRect(doc: Document): SelectionRect | undefined {
  const selection = doc.defaultView?.getSelection()
  if (selection === null || selection === undefined || selection.rangeCount === 0 || selection.isCollapsed) return undefined
  return safeSelectionRect(selection.getRangeAt(0))
}

function positionComposerOverlay(overlay: HTMLElement, doc: Document, anchorRect?: SelectionRect): void {
  const view = doc.defaultView
  if (view === null) return
  if (view.innerWidth < 560) {
    overlay.style.removeProperty('left')
    overlay.style.removeProperty('right')
    overlay.style.removeProperty('top')
    overlay.style.removeProperty('bottom')
    overlay.style.removeProperty('max-height')
    return
  }
  const rect = anchorRect ?? { top: view.innerHeight - 96, left: view.innerWidth - 220, width: 200, height: 24 }
  const margin = 12
  const gap = 10
  const width = Math.min(420, view.innerWidth - margin * 2)
  const height = overlay.offsetHeight || 320
  const left = Math.max(margin, Math.min(rect.left + rect.width / 2 - width / 2, view.innerWidth - width - margin))
  const below = rect.top + rect.height + gap
  const belowSpace = view.innerHeight - margin - below
  const aboveSpace = rect.top - gap - margin
  const useBelow = belowSpace >= Math.min(height, 280) || belowSpace >= aboveSpace
  const available = Math.max(160, useBelow ? belowSpace : aboveSpace)
  const top = useBelow ? below : Math.max(margin, rect.top - Math.min(height, available) - gap)
  overlay.style.left = `${Math.round(left)}px`
  overlay.style.top = `${Math.round(top)}px`
  overlay.style.maxHeight = `${Math.floor(available)}px`
  overlay.style.removeProperty('right')
  overlay.style.removeProperty('bottom')
}

function blockedMessage(labels: ReturnType<typeof labelsFor>, reason: string | undefined): string | undefined {
  if (reason === 'empty-draft') return labels['composer.emptyDraft']
  if (reason === 'composer-adapter-unavailable') return labels['composer.modelUnavailable']
  if (reason === 'preview-first-required') return labels['composer.previewRequired']
  if (reason === 'send-failed' || reason !== undefined) return labels['composer.sendFailed']
  return undefined
}

interface ComposerOverlay {
  readonly overlay: HTMLElement
  readonly openComposer: (intent: ComposerIntent, focusActionId?: string) => void
  readonly hide: () => void
  readonly dispose: () => void
}

/**
 * 挂载紧凑 Composer overlay（V1/V2 共用）。draft、anchor、preview-first 与
 * Esc 语义不变；`onEsc` 让 V2 把关闭回传给交互层。
 */
function mountComposerOverlay(input: {
  readonly doc: Document
  readonly labels: ReturnType<typeof labelsFor>
  readonly composer: CompactComposerController
  readonly anchorProvider: () => AnchorDraft | undefined
  readonly contextProvider?: () => SelectionContextV2 | undefined
  readonly quoteProvider?: () => string
  readonly composerAvailable: boolean
  readonly onEsc?: () => void
  readonly onExpanded?: () => void
  /** V2 additive 字段注入（policyVersion/canonicalActionId/contextKind）；V1 adapter 不传。 */
  readonly enrichDetail?: (intent: ComposerIntent) => { policyVersion?: 'v1' | 'v2'; canonicalActionId?: string; contextKind?: NonNullable<SelectionAnnotationSubmitDetail['contextKind']> }
}): ComposerOverlay {
  const { doc, labels, composer } = input
  const overlay = doc.createElement('div')
  overlay.className = 'dsh-selection-composer'
  overlay.setAttribute('data-dsh-selection-composer', '')
  overlay.setAttribute('data-dsh-selection-surface', '')
  overlay.dataset.yeismeSurface = 'true'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-label', labels['composer.title'])
  overlay.style.display = 'none'
  doc.body.append(overlay)
  let feedback: { readonly text: string; readonly tone: 'success' | 'error' } | undefined
  let anchorRect: SelectionRect | undefined
  let returnFocusTo: HTMLElement | undefined
  let returnFocusActionId: string | undefined

  const closeComposer = (): void => {
    overlay.style.display = 'none'
    input.onEsc?.()
    const actionTarget = returnFocusActionId === undefined
      ? undefined
      : [...doc.querySelectorAll<HTMLButtonElement>('button[data-action-id]')]
          .find(button => button.dataset.actionId === returnFocusActionId)
    const actionsEntry = doc.querySelector<HTMLButtonElement>('[data-dsh-selection-actions] button:not([disabled])')
    if (actionTarget !== undefined) actionTarget.focus()
    else if (actionsEntry !== null) actionsEntry.focus()
    else if (returnFocusTo?.isConnected === true) returnFocusTo.focus()
  }

  const renderOverlay = (): void => {
    const state = composer.getState()
    overlay.style.display = state.expanded ? 'none' : 'block'
    if (state.expanded) return
    const context = input.contextProvider?.()
    const quote = context?.anchor?.quotePreview ?? input.quoteProvider?.() ?? ''
    const flavor = composerFlavor(context, quote)
    const intentButtons = (['ask', 'comment', 'edit'] as const)
      .map(intent => `<button class="vk-btn" type="button" role="tab" data-intent="${intent}" aria-pressed="${state.intent === intent}" aria-selected="${state.intent === intent}">${labels[`composer.${intent}`]}</button>`)
      .join('')
    const presets = composerPresets(labels, flavor)
      .map(preset => `<button class="dsh-selection-composer__preset" type="button" data-preset="${preset.id}" data-preset-intent="${preset.intent}" data-preset-prompt="${escapeMarkup(preset.prompt)}">${escapeMarkup(preset.label)}</button>`)
      .join('')
    const cards = state.cards
      .filter(card => card.id !== 'selection')
      .map(card => `<span class="dsh-selection-composer__card">${escapeMarkup(card.label)}</span>`)
      .join('')
    const adapterBlocked = !input.composerAvailable && (state.intent !== 'comment' || state.modelResponseForComment)
    const stateBlocked = blockedMessage(labels, state.blockedReason)
    const hint = state.intent === 'comment'
      ? labels['composer.commentHint']
      : state.intent === 'edit'
        ? labels['composer.editHint']
        : labels['composer.askHint']
    const status = feedback?.text ?? stateBlocked ?? (adapterBlocked ? labels['composer.modelUnavailable'] : hint)
    const tone = feedback?.tone ?? (stateBlocked !== undefined || adapterBlocked ? 'error' : 'neutral')
    const placeholder = state.intent === 'comment'
      ? labels['composer.placeholder.comment']
      : state.intent === 'edit'
        ? labels['composer.placeholder.edit']
        : labels['composer.placeholder.ask']
    const submitLabel = state.status === 'sending'
      ? labels['composer.sending']
      : state.intent === 'comment' && !state.modelResponseForComment
        ? labels['composer.saveComment']
        : state.intent === 'edit'
          ? labels['composer.previewEdit']
          : labels['composer.sendAsk']
    const submitDisabled = state.status === 'sending' || state.text.trim() === '' || adapterBlocked
    const commentOption = state.intent === 'comment'
      ? `<label class="dsh-selection-composer__option"><input type="checkbox" data-action="model-response"${state.modelResponseForComment ? ' checked' : ''}${input.composerAvailable ? '' : ' disabled'}><span>${labels['composer.modelResponse']}</span></label>`
      : ''
    overlay.innerHTML = `
      <div class="dsh-selection-composer__header">
        <div class="dsh-selection-composer__heading">
          <span class="dsh-selection-composer__eyebrow">${labels['composer.selection']} · ${contextLabel(labels, flavor)}</span>
          <span class="dsh-selection-composer__title">${escapeMarkup(composerHeading(labels, state.intent, flavor))}</span>
        </div>
        <button class="vk-icon-btn" type="button" data-action="close" aria-label="${labels['composer.close']}" title="${labels['composer.close']}">×</button>
      </div>
      ${quote === '' ? '' : `<div class="dsh-selection-composer__context"><div class="dsh-selection-composer__context-head"><span>${contextLabel(labels, flavor)}</span><span>${quote.length} ${labels['composer.characters']}</span></div><blockquote class="dsh-selection-composer__quote">${escapeMarkup(quote)}</blockquote></div>`}
      <div class="dsh-selection-composer__intents" role="tablist">${intentButtons}</div>
      <div class="dsh-selection-composer__presets" aria-label="suggested actions">${presets}</div>
      <label class="ys-field vk-field dsh-selection-composer__field">
        <span>${labels['composer.fieldLabel']}</span>
        <textarea rows="${state.rows}" aria-label="${labels['composer.title']}" placeholder="${escapeMarkup(placeholder)}">${escapeMarkup(state.text)}</textarea>
      </label>
      ${commentOption}
      <div class="dsh-selection-composer__status" data-tone="${tone}" role="status" aria-live="polite">${escapeMarkup(status)}</div>
      <div class="dsh-selection-composer__footer">
        <span class="dsh-selection-composer__cards">${cards}</span>
        <button class="vk-btn" type="button" data-action="expand">${labels['composer.expand']}</button>
        <button class="vk-btn dsh-selection-composer__primary" data-primary="true" type="button" data-action="send"${submitDisabled ? ' disabled' : ''}>${submitLabel}</button>
      </div>
    `
    positionComposerOverlay(overlay, doc, anchorRect)
    overlay.querySelector('textarea')?.focus()
  }

  // G21 dispose 收口：Composer 交互监听以事件委托挂在常驻 overlay 上。
  const onOverlayInput = (event: Event): void => {
    if (event.target instanceof HTMLTextAreaElement) {
      feedback = undefined
      composer.update(event.target.value)
      const state = composer.getState()
      event.target.rows = state.rows
      const adapterBlocked = !input.composerAvailable && (state.intent !== 'comment' || state.modelResponseForComment)
      const send = overlay.querySelector<HTMLButtonElement>('button[data-action="send"]')
      if (send !== null) send.disabled = state.text.trim() === '' || adapterBlocked
      const status = overlay.querySelector<HTMLElement>('.dsh-selection-composer__status')
      if (status !== null) {
        status.dataset.tone = adapterBlocked ? 'error' : 'neutral'
        status.textContent = adapterBlocked
          ? labels['composer.modelUnavailable']
          : state.intent === 'comment'
            ? labels['composer.commentHint']
            : state.intent === 'edit'
              ? labels['composer.editHint']
              : labels['composer.askHint']
      }
    }
  }
  const onOverlayChange = (event: Event): void => {
    const target = event.target
    if (!(target instanceof HTMLInputElement) || target.dataset.action !== 'model-response') return
    feedback = undefined
    composer.setModelResponseForComment(target.checked)
    renderOverlay()
  }
  const dispatchSubmit = (): void => {
    const state = composer.getState()
    doc.defaultView?.dispatchEvent(new CustomEvent(SELECTION_ANNOTATION_SUBMIT_EVENT, {
      detail: {
        intent: state.intent,
        text: state.text,
        anchor: input.anchorProvider(),
        approvalPolicy: 'preview-first',
        ...(input.enrichDetail?.(state.intent) ?? {}),
      } satisfies SelectionAnnotationSubmitDetail,
    }))
  }
  const onOverlayClick = (event: MouseEvent): void => {
    const button = event.target instanceof Element ? event.target.closest('button') : null
    if (button === null) return
    const intent = button.dataset.intent as 'ask' | 'comment' | 'edit' | undefined
    if (intent !== undefined) {
      feedback = undefined
      composer.setIntent(intent)
      renderOverlay()
      return
    }
    const presetPrompt = button.dataset.presetPrompt
    const presetIntent = button.dataset.presetIntent as ComposerIntent | undefined
    if (presetPrompt !== undefined && presetIntent !== undefined) {
      feedback = undefined
      composer.setIntent(presetIntent)
      composer.update(presetPrompt)
      renderOverlay()
      return
    }
    if (button.dataset.action === 'close') {
      closeComposer()
      return
    }
    if (button.dataset.action === 'expand') {
      // Draft, attachments and anchor context survive the round trip.
      composer.expand()
      dispatchSubmit()
      renderOverlay()
      input.onExpanded?.()
      return
    }
    if (button.dataset.action === 'send') {
      void (async () => {
        const before = composer.getState()
        const result = await composer.submit()
        // 评论默认不调模型：本地保存后仍通知宿主桥接（如批注面板）。
        if (result.status === 'local' || result.status === 'sent') {
          doc.defaultView?.dispatchEvent(new CustomEvent(SELECTION_ANNOTATION_SUBMIT_EVENT, {
            detail: {
              intent: before.intent,
              text: before.text,
              anchor: input.anchorProvider(),
              approvalPolicy: 'preview-first',
              ...(input.enrichDetail?.(before.intent) ?? {}),
            } satisfies SelectionAnnotationSubmitDetail,
          }))
        }
        feedback = result.status === 'local'
          ? { text: labels['composer.savedLocal'], tone: 'success' }
          : result.status === 'blocked'
            ? { text: blockedMessage(labels, result.reason) ?? labels['composer.sendFailed'], tone: 'error' }
            : { text: labels['composer.sent'], tone: 'success' }
        renderOverlay()
      })()
    }
  }
  overlay.addEventListener('input', onOverlayInput)
  overlay.addEventListener('change', onOverlayChange)
  overlay.addEventListener('click', onOverlayClick)

  // Esc 关 Composer；V2 下同时回传交互层（Composer → Actions 逐层退出）。
  const overlayKeydown = (event: KeyboardEvent): void => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && overlay.style.display !== 'none') {
      event.preventDefault()
      const send = overlay.querySelector<HTMLButtonElement>('button[data-action="send"]')
      if (send?.disabled === false) send.click()
      return
    }
    if (event.key !== 'Escape') return
    if (overlay.style.display === 'none') return
    event.preventDefault()
    event.stopImmediatePropagation()
    closeComposer()
  }
  doc.addEventListener('keydown', overlayKeydown, true)
  const onViewportResize = (): void => {
    if (overlay.style.display !== 'none' && !composer.getState().expanded) {
      positionComposerOverlay(overlay, doc, anchorRect)
    }
  }
  doc.defaultView?.addEventListener('resize', onViewportResize)

  return {
    overlay,
    openComposer: (intent, focusActionId) => {
      anchorRect = currentSelectionRect(doc) ?? anchorRect
      returnFocusActionId = focusActionId
      const active = doc.activeElement
      if (active !== null && typeof (active as { focus?: unknown }).focus === 'function' && !overlay.contains(active)) {
        returnFocusTo = active as HTMLElement
        returnFocusActionId ??= active instanceof Element
          ? active.closest<HTMLButtonElement>('button[data-action-id]')?.dataset.actionId
          : undefined
      }
      composer.setIntent(intent)
      composer.collapse()
      feedback = undefined
      renderOverlay()
    },
    hide: () => { overlay.style.display = 'none' },
    dispose: () => {
      overlay.removeEventListener('input', onOverlayInput)
      overlay.removeEventListener('change', onOverlayChange)
      overlay.removeEventListener('click', onOverlayClick)
      doc.removeEventListener('keydown', overlayKeydown, true)
      doc.defaultView?.removeEventListener('resize', onViewportResize)
      overlay.remove()
    },
  }
}

/** 来源详情 popover 的展示数据（纯展示，不写草稿）。 */
interface ReferenceDetailsData {
  readonly reference: ComposerReferenceRecord
  readonly source: SelectionReferenceSourceDescriptor
  readonly quote: string
  readonly target: ConversationReferenceTarget | undefined
  readonly quoteDigest?: string
}

interface ReferenceDetailsPopover {
  readonly open: (triggerActionId: string, data: ReferenceDetailsData) => void
  readonly close: () => void
  /** 选区内容真正变化（或清空）时关闭；同一选区的重复 selectionchange 不关。 */
  readonly closeIfSelectionChanged: (quoteDigest: string | undefined) => void
  readonly dispose: () => void
}

/**
 * 来源详情 popover：owner/ref/version/scope/字节范围/可用状态与有界摘要。
 * 定位入口在真实 locate 能力缺席时禁用并说明原因；Escape 关闭并把焦点还给
 * 触发按钮。内部诊断串只放在显式展开的技术细节里，不作主标题或来源摘要。
 */
function mountReferenceDetailsPopover(input: {
  readonly doc: Document
  readonly labels: ReturnType<typeof labelsFor>
  readonly onClose: () => void
}): ReferenceDetailsPopover {
  const { doc, labels } = input
  const popover = doc.createElement('div')
  popover.className = 'dsh-selection-reference-details'
  popover.setAttribute('data-dsh-selection-composer', '')
  popover.setAttribute('data-dsh-selection-surface', '')
  popover.dataset.yeismeSurface = 'true'
  popover.setAttribute('role', 'dialog')
  popover.setAttribute('aria-label', labels['reference.details.title'])
  popover.style.display = 'none'
  doc.body.append(popover)
  let open = false
  let triggerActionId: string | undefined
  let openedDigest: string | undefined
  let closeTimer: number | undefined

  const close = (): void => {
    if (!open) return
    open = false
    popover.style.display = 'none'
    // 点击关闭会先折叠选区，trailing selectionchange 在 click 后才到达；
    // 层回传与焦点回归延后一个宏任务，避免 surface-close 被紧随的
    // selection-excluded 立刻顶掉。
    const finalize = (): void => {
      closeTimer = undefined
      input.onClose()
      const trigger = triggerActionId === undefined
        ? undefined
        : [...doc.querySelectorAll<HTMLButtonElement>('button[data-action-id]')]
            .find(button => button.dataset.actionId === triggerActionId)
      const actionsEntry = doc.querySelector<HTMLButtonElement>('[data-dsh-selection-actions] button:not([disabled])')
      if (trigger?.isConnected === true) trigger.focus()
      else actionsEntry?.focus()
    }
    const view = doc.defaultView
    if (view === null) finalize()
    else closeTimer = view.setTimeout(finalize, 0)
  }

  // `render` replaces the dialog contents. Keep one delegated listener on the
  // stable popover root so re-renders neither accumulate close handlers nor
  // rely on removing a DOM node to release them.
  const onPopoverClick = (event: Event): void => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest<HTMLButtonElement>('button[data-action="close"]') !== null) close()
  }
  popover.addEventListener('click', onPopoverClick)

  const render = (data: ReferenceDetailsData): void => {
    const { reference, source, quote, target } = data
    const rows: ReadonlyArray<readonly [string, string]> = [
      [labels['reference.details.owner'], reference.owner],
      [labels['reference.details.ref'], reference.ref],
      [labels['reference.details.version'], reference.version],
      [labels['reference.details.scope'], reference.scope],
      [labels['reference.details.window'], `${source.window.start}–${source.window.end}`],
      [labels['reference.details.freshness'], reference.freshness],
      ...(target === undefined ? [] : [[labels['reference.details.target'], target.title ?? target.conversationId] as const]),
    ]
    const preview = (reference.preview ?? quote).replace(/\s+/gu, ' ').trim().slice(0, 240)
    popover.innerHTML = `
      <div class="dsh-selection-reference-details__header">
        <span class="dsh-selection-reference-details__title">${labels['reference.details.title']}</span>
        <button class="vk-icon-btn" type="button" data-action="close" aria-label="${labels['reference.details.close']}" title="${labels['reference.details.close']}">×</button>
      </div>
      <dl class="dsh-selection-reference-details__rows">${rows.map(([name, value]) => `<div class="dsh-selection-reference-details__row"><dt>${name}</dt><dd>${escapeMarkup(value)}</dd></div>`).join('')}</dl>
      ${preview === '' ? '' : `<blockquote class="dsh-selection-reference-details__quote">${escapeMarkup(preview)}</blockquote>`}
      <details class="dsh-selection-reference-details__technical"><summary>${labels['reference.details.technical']}</summary><code>${escapeMarkup(reference.digest)}</code></details>
      <div class="dsh-selection-reference-details__footer">
        <button class="vk-btn" type="button" data-action="locate" disabled title="${labels['reference.details.locateUnavailable']}">${labels['reference.details.locate']}</button>
        <span class="dsh-selection-reference-details__reason">${labels['reference.details.locateUnavailable']}</span>
      </div>
    `
  }

  const position = (): void => {
    const view = doc.defaultView
    if (view === null) return
    const anchor = doc.querySelector('[data-dsh-selection-actions]')?.getBoundingClientRect()
      ?? currentSelectionRect(doc)
      ?? { top: 96, left: 48, width: 160, height: 24 }
    const margin = 12
    const width = Math.min(380, view.innerWidth - margin * 2)
    const left = Math.max(margin, Math.min(anchor.left + anchor.width / 2 - width / 2, view.innerWidth - width - margin))
    const top = Math.min(Math.max(margin, anchor.top + anchor.height + 8), Math.max(margin, view.innerHeight - 160))
    popover.style.left = `${Math.round(left)}px`
    popover.style.top = `${Math.round(top)}px`
  }

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !open) return
    event.preventDefault()
    event.stopImmediatePropagation()
    close()
  }
  const onPointerDown = (event: Event): void => {
    if (!open) return
    if (event.target instanceof Node && popover.contains(event.target)) return
    close()
  }
  doc.addEventListener('keydown', onKeydown, true)
  doc.addEventListener('pointerdown', onPointerDown, true)

  return {
    open: (actionId, data) => {
      triggerActionId = actionId
      openedDigest = data.quoteDigest ?? data.reference.digest
      render(data)
      open = true
      popover.style.display = 'block'
      position()
      popover.querySelector<HTMLElement>('button[data-action="close"]')?.focus()
    },
    close,
    closeIfSelectionChanged: quoteDigest => {
      if (open && openedDigest !== quoteDigest) close()
    },
    dispose: () => {
      if (closeTimer !== undefined) {
        doc.defaultView?.clearTimeout(closeTimer)
        closeTimer = undefined
      }
      popover.removeEventListener('click', onPopoverClick)
      doc.removeEventListener('keydown', onKeydown, true)
      doc.removeEventListener('pointerdown', onPointerDown, true)
      popover.remove()
    },
  }
}

/** Anchor 草稿计算（V1/V2 共用）：选区 → quote digest + 源码行映射。 */
function startAnchorTracker(input: {
  readonly doc: Document
  readonly runtimeOptions: RuntimeOptions
  readonly onSelectionPending?: () => void
  readonly onAnchor: (anchor: AnchorDraft | undefined, quotePreview: string, source: SelectionReferenceSourceDescriptor | undefined) => void
}): () => void {
  const { doc } = input
  const artifactRef = input.runtimeOptions.artifactRef ?? 'conversation:rendered'
  const artifactVersion = input.runtimeOptions.artifactVersion ?? '0'
  let anchorTimer: ReturnType<typeof setTimeout> | undefined
  let captureGeneration = 0
  const handleSelectionChange = (): void => {
    if (anchorTimer !== undefined) clearTimeout(anchorTimer)
    const generation = ++captureGeneration
    input.onSelectionPending?.()
    anchorTimer = setTimeout(() => {
      if (generation !== captureGeneration) return
      const capture = captureFromSelection(doc.defaultView?.getSelection() ?? null)
      if (capture === null) {
        if (generation === captureGeneration) input.onAnchor(undefined, '', undefined)
        return
      }
      const source = sourceDescriptorForCapture(capture)
      void selectionToAnchorDraft(capture, {
        artifactRef,
        artifactVersion,
        ...(input.runtimeOptions.sourceArtifactRef === undefined ? {} : { sourceArtifactRef: input.runtimeOptions.sourceArtifactRef }),
      }).then(anchor => {
        if (generation === captureGeneration) input.onAnchor(anchor, capture.text, source)
      })
    }, 120)
  }
  doc.addEventListener('selectionchange', handleSelectionChange)
  return () => {
    if (anchorTimer !== undefined) clearTimeout(anchorTimer)
    captureGeneration += 1
    doc.removeEventListener('selectionchange', handleSelectionChange)
  }
}

interface LocaleRuntimeFace {
  getLocale?(): { readonly active?: string }
  getSnapshot?(): { readonly active?: string }
}

function activeLanguage(ctx: ClientContext, fallback: string): string {
  try {
    const direct = (ctx as ClientContext & { readonly locale?: LocaleRuntimeFace }).locale
    const locale = direct ?? ctx.get('locale' as never) as LocaleRuntimeFace | undefined
    return locale?.getLocale?.().active ?? locale?.getSnapshot?.().active ?? fallback
  } catch {
    return fallback
  }
}

/** Mount the client face and return an exact disposer. */
export async function apply(ctx: ClientContext, runtimeOptions: RuntimeOptions = {}): Promise<() => void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  const language = activeLanguage(ctx, window.navigator.language)
  const labels = labelsFor(language)

  // G21 safe-projection 收口：client 代码不直接触碰浏览器 storage 全局。
  const preferences = probeCapability(browserPreferenceStorage)
  const disabled = preferences.status === 'available'
    && preferences.capability.getItem(SELECTION_ANNOTATION_KILL_SWITCH) === 'off'
  if (disabled) return () => {}

  // 兼容窗口策略：显式 `policyVersion=v1` 走 V1 adapter（deprecated 标记）。
  const policyRaw = preferences.status === 'available'
    ? preferences.capability.getItem(SELECTION_ANNOTATION_POLICY_KEY)
    : undefined
  const policyVersion: 'v1' | 'v2' = policyRaw === 'v1' ? 'v1' : 'v2'

  injectSelectionAnnotationStyles(document)

  if (policyVersion === 'v1') {
    const dispose = mountV1Adapter({ doc: document, labels, runtimeOptions, view: window })
    ctx.effect(() => dispose, 'dsh-selection-annotation: v1 adapter selection lifecycle')
    return dispose
  }

  let bridgeContext = ctx
  let reprobeReferenceBridge = (): void => {}
  const resolveReferenceBridge = (): SelectionReferenceBridge | undefined => resolveSelectionReferenceBridge(bridgeContext, runtimeOptions.referenceBridge)
  const dispose = mountV2({
    doc: document,
    labels,
    language,
    runtimeOptions,
    resolveReferenceBridge,
    onReferenceBridgeLateBound: reprobe => { reprobeReferenceBridge = reprobe },
    view: window,
  })
  // The upstream bridge is optional. Dynamic Cordis injection lets a later host
  // service upgrade the current selection without polling or a reselection.
  if (runtimeOptions.referenceBridge === undefined) {
    let dynamicInject: ((services: readonly string[], body: (sub: ClientContext) => unknown) => unknown) | undefined
    try {
      const candidate = (ctx as { inject?: unknown }).inject
      if (typeof candidate === 'function') dynamicInject = candidate as typeof dynamicInject
    } catch {
      dynamicInject = undefined
    }
    dynamicInject?.([SELECTION_REFERENCE_BRIDGE_CONTEXT_KEY], sub => {
      bridgeContext = sub
      reprobeReferenceBridge()
      return () => {
        if (bridgeContext !== sub) return
        bridgeContext = ctx
        reprobeReferenceBridge()
      }
    })
  }
  ctx.effect(() => dispose, 'dsh-selection-annotation: selection interaction v2 lifecycle')
  return dispose
}

// ---------------------------------------------------------------------------
// V2 主路径：提交 context，承接显式动作
// ---------------------------------------------------------------------------

function mountV2(input: {
  readonly doc: Document
  readonly labels: ReturnType<typeof labelsFor>
  readonly language: string
  readonly runtimeOptions: RuntimeOptions
  readonly resolveReferenceBridge: () => SelectionReferenceBridge | undefined
  readonly onReferenceBridgeLateBound?: (reprobe: () => void) => void
  readonly view: Window
}): () => void {
  const { doc, runtimeOptions, view } = input
  const disposers: Array<() => void> = []

  let pendingAnchor: AnchorDraft | undefined
  let pendingQuote = ''
  let pendingSource: SelectionReferenceSourceDescriptor | undefined
  let lastContext: SelectionContextV2 | undefined
  const referenceMountId = ++selectionReferenceMountSequence
  let referenceRequestSequence = 0
  interface PendingReferenceRequest {
    readonly id: string
    readonly identity: string
    readonly target: ConversationReferenceTarget
    readonly activation: boolean
    status: 'pending' | 'unknown'
    timer: number | undefined
  }
  // Requests stay addressable after timeout. A late receipt settles its
  // original request; a new request may proceed only for another identity.
  const pendingReferenceRequests = new Map<string, PendingReferenceRequest>()
  const pendingReferenceIdentities = new Map<string, string>()
  let activeReferenceRequestId: string | undefined
  let chooseTargetGeneration = 0
  let chooseTargetAbort: AbortController | undefined
  let observedBridge: SelectionReferenceBridge | undefined
  let unsubscribeBridge: (() => void) | undefined
  let liveBridgeSnapshot = bridgeSnapshot(undefined)
  let selectionReference: { readonly anchor: AnchorDraft; readonly source: SelectionReferenceSourceDescriptor; readonly targetKey: string; readonly reference: ComposerReferenceRecord } | undefined
  let selectionUnavailableReason: string | undefined
  let resolutionGeneration = 0

  const composer = new CompactComposerController(
    runtimeOptions.composerAdapter === undefined ? {} : { adapter: runtimeOptions.composerAdapter },
  )
  const enrichDetail = (intent: 'ask' | 'comment' | 'edit'): { policyVersion: 'v2'; canonicalActionId?: string; contextKind?: NonNullable<SelectionAnnotationSubmitDetail['contextKind']>; kind?: 'text-quote'; attribution?: 'none' } => {
    const isTextQuote = composer.getState().cards.some(card => card.id === 'text-quote')
    return {
      policyVersion: 'v2',
      ...(lastContext === undefined ? {} : {
        canonicalActionId: isTextQuote ? 'dsh:add-text-quote' : intent === 'ask' ? 'dsh:ask' : intent === 'comment' ? 'dsh:comment' : 'dsh:edit',
        contextKind: lastContext.kind,
      }),
      ...(isTextQuote ? { kind: 'text-quote' as const, attribution: 'none' as const } : {}),
    }
  }
  const overlay = mountComposerOverlay({
    doc,
    labels: input.labels,
    composer,
    anchorProvider: () => pendingAnchor,
    contextProvider: () => lastContext,
    quoteProvider: () => pendingQuote,
    composerAvailable: runtimeOptions.composerAdapter !== undefined,
    onEsc: () => getSharedSelectionInteraction()?.closeSurface(),
    enrichDetail,
  })
  disposers.push(overlay.dispose)

  // 全局 singleton 交互层：本插件只 attach + 提供 capability + 承接 intent。
  const detachLayer = attachSharedSelectionInteraction(doc, {
    viewportWidth: () => view.innerWidth,
    isCoarsePointer: () => view.matchMedia?.('(pointer: coarse)').matches ?? false,
    language: () => input.language,
  })
  disposers.push(detachLayer)
  const layer = getSharedSelectionInteraction()
  if (layer === undefined) return () => { for (const dispose of disposers) dispose() }

  // capability：Composer owner 在位才开放 ask/edit/open-full；批注组按 V1
  // 语义（事件接收方可选）恒可用；copy-quote 本地。
  const baseCapabilities = [
    'annotation.batch',
    ...(runtimeOptions.composerAdapter === undefined ? [] : ['conversation.composer', 'selection.edit']),
  ]
  const referenceReady = (): boolean => liveBridgeSnapshot.available
    && hasReferenceTarget(liveBridgeSnapshot.target)
    && selectionReference !== undefined
    && selectionReference.targetKey === referenceTargetKey(liveBridgeSnapshot.target)
    && selectionReference.anchor === pendingAnchor
    && selectionReference.source === pendingSource
  // Probe-gated additive seams：缺席 → 对应入口只以 disabled+原因呈现，不伪造能力。
  const activationReady = (): boolean => liveBridgeSnapshot.available && liveBridgeSnapshot.features?.activation === true
  const textQuoteReady = (): boolean => liveBridgeSnapshot.available
    && hasReferenceTarget(liveBridgeSnapshot.target)
    && pendingAnchor !== undefined
    && pendingQuote !== ''
    && pendingSource === undefined
  const chooseTargetReady = (): boolean => liveBridgeSnapshot.available
    && liveBridgeSnapshot.features?.chooseTarget === true
    && typeof observedBridge?.chooseTarget === 'function'

  // A target alone cannot authorize a reference: the selected source must also
  // have completed its owner-safe anchor projection. Recompute this capability
  // for each context instead of borrowing the generic composer capability.
  disposers.push(layer.addCapabilityProvider(() => [
    ...baseCapabilities,
    ...(referenceReady() ? ['conversation.reference.add'] : []),
    ...(activationReady() ? ['conversation.reference.activate'] : []),
    ...(textQuoteReady() ? ['conversation.text-quote.add'] : []),
    ...(chooseTargetReady() ? ['conversation.target.choose'] : []),
  ]))
  disposers.push(layer.registerContextPublisher({ id: 'selection-annotation', capabilities: baseCapabilities }))

  const detailsPopover = mountReferenceDetailsPopover({
    doc,
    labels: input.labels,
    onClose: () => layer.closeSurface(),
  })
  disposers.push(detailsPopover.dispose)

  const showReferenceReceipt = (receipt: ComposerReferenceAddResultDetail, activation: boolean): void => {
    layer.closeSurface()
    // 宿主确认激活并聚焦官方输入框时不抢回焦点；其余回执保留来源焦点。
    if (!(receipt.ok && activation && receipt.activated === true)) layer.restoreSourceFocus()
    layer.setActionFeedback(referenceReceiptMessage(input.labels, receipt, activation))
  }
  const onReferenceResult = (event: Event): void => {
    if (!(event instanceof CustomEvent)) return
    const receipt = event.detail as Partial<ComposerReferenceAddResultDetail>
    const pending = receipt.requestId === undefined ? undefined : pendingReferenceRequests.get(receipt.requestId)
    if (receipt.version !== 1 || receipt.requestId === undefined || pending === undefined
      || typeof receipt.ok !== 'boolean' || receipt.target === undefined || !sameReferenceTarget(receipt.target, pending.target)) return
    const typedReceipt = receipt as ComposerReferenceAddResultDetail
    if (pending.timer !== undefined) view.clearTimeout(pending.timer)
    pendingReferenceRequests.delete(pending.id)
    pendingReferenceIdentities.delete(pending.identity)
    if (activeReferenceRequestId !== pending.id) return
    activeReferenceRequestId = undefined
    queueMicrotask(() => showReferenceReceipt(typedReceipt, pending.activation))
  }
  view.addEventListener(COMPOSER_REFERENCE_ADD_RESULT_EVENT, onReferenceResult)
  disposers.push(() => view.removeEventListener(COMPOSER_REFERENCE_ADD_RESULT_EVENT, onReferenceResult))

  const refreshReferenceCapability = (): void => {
    const state = layer.getState()
    if (state.phase !== 'actions-visible') return
    const text = state.context.anchor?.quotePreview ?? pendingQuote
    if (text === '') return
    layer.publishExternalContext({
      kind: state.context.kind,
      source: state.context.source,
      text,
      ...(state.context.anchor === undefined ? {} : { anchor: state.context.anchor }),
    })
  }
  const invalidateSelectionReference = (): void => {
    resolutionGeneration += 1
    selectionReference = undefined
    selectionUnavailableReason = undefined
  }
  const resolveCurrentSelectionReference = (anchor: AnchorDraft, quote: string, source: SelectionReferenceSourceDescriptor | undefined): void => {
    const bridge = ensureReferenceBridge()
    const target = liveBridgeSnapshot.target
    if (source === undefined) {
      selectionUnavailableReason = 'selected source has no owner-safe reference proof; select a mapped source range and try again'
      refreshReferenceCapability()
      return
    }
    if (bridge === undefined || !liveBridgeSnapshot.available || !hasReferenceTarget(target)) {
      selectionUnavailableReason = liveBridgeSnapshot.reason ?? 'reference target unavailable'
      refreshReferenceCapability()
      return
    }
    const state = layer.getState()
    if (state.phase !== 'actions-visible') return
    const generation = ++resolutionGeneration
    void bridge.resolveSelection({ anchor, context: state.context, quote, source }).then(result => {
      if (generation !== resolutionGeneration || pendingAnchor !== anchor) return
      if (result.status === 'available') {
        selectionReference = { anchor, source, targetKey: referenceTargetKey(target), reference: result.reference }
        selectionUnavailableReason = undefined
      } else {
        selectionReference = undefined
        selectionUnavailableReason = result.reason
      }
      refreshReferenceCapability()
    }).catch(() => {
      if (generation !== resolutionGeneration || pendingAnchor !== anchor) return
      selectionReference = undefined
      selectionUnavailableReason = 'selected source is unavailable; select an owner-backed file range and try again'
      refreshReferenceCapability()
    })
  }
  const ensureReferenceBridge = (): SelectionReferenceBridge | undefined => {
    const bridge = input.resolveReferenceBridge()
    if (bridge === observedBridge) return observedBridge
    unsubscribeBridge?.()
    observedBridge = bridge
    unsubscribeBridge = undefined
    liveBridgeSnapshot = bridgeSnapshot(bridge)
    if (bridge !== undefined) {
      unsubscribeBridge = bridge.subscribe(() => {
        if (observedBridge !== bridge) return
        liveBridgeSnapshot = bridgeSnapshot(bridge)
        invalidateSelectionReference()
        if (pendingAnchor !== undefined && pendingQuote !== '') resolveCurrentSelectionReference(pendingAnchor, pendingQuote, pendingSource)
        else refreshReferenceCapability()
      })
    }
    return observedBridge
  }
  disposers.push(() => unsubscribeBridge?.())
  // A bridge can be injected after this plugin applies. The next owner-backed
  // selection re-probes it; once found, subscription keeps target changes live.
  ensureReferenceBridge()
  input.onReferenceBridgeLateBound?.(() => {
    ensureReferenceBridge()
    liveBridgeSnapshot = bridgeSnapshot(observedBridge)
    invalidateSelectionReference()
    if (pendingAnchor !== undefined && pendingQuote !== '') resolveCurrentSelectionReference(pendingAnchor, pendingQuote, pendingSource)
    else refreshReferenceCapability()
  })

  // anchor 草稿：与交互层并行的 selectionchange 监听（只算 anchor，不渲染）。
  disposers.push(startAnchorTracker({
    doc,
    runtimeOptions,
    onSelectionPending: () => {
      pendingSource = undefined
      invalidateSelectionReference()
    },
    onAnchor: (anchor, quotePreview, source) => {
      detailsPopover.closeIfSelectionChanged(anchor?.quoteDigest)
      pendingAnchor = anchor
      pendingQuote = quotePreview
      pendingSource = source
      composer.removeContextCard('selection')
      if (anchor !== undefined && quotePreview !== '') {
        composer.addContextCard({
          id: 'selection',
          label: anchor.kind === 'markdown-range' ? `L${anchor.sourceStartLine}–${anchor.sourceEndLine}` : quotePreview.slice(0, 24),
        })
      }
      if (anchor !== undefined && quotePreview !== '') resolveCurrentSelectionReference(anchor, quotePreview, source)
      else refreshReferenceCapability()
    },
  }))

  // 显式动作 → V1 canonical 行为映射（owner 语义不变）。
  const dispatchSubmit = (intent: 'ask' | 'comment' | 'edit'): void => {
    view.dispatchEvent(new CustomEvent(SELECTION_ANNOTATION_SUBMIT_EVENT, {
      detail: {
        intent,
        text: composer.getState().text,
        anchor: pendingAnchor,
        approvalPolicy: 'preview-first',
        ...enrichDetail(intent),
      } satisfies SelectionAnnotationSubmitDetail,
    }))
  }
  // 添加到对话 / 引用并询问共用的插入通道；activation 仅后者携带。
  const dispatchReferenceAdd = (activation: boolean): { readonly surface: 'owner' } => {
    const target = liveBridgeSnapshot.target
    const resolved = selectionReference
    if (!referenceReady() || !hasReferenceTarget(target) || resolved === undefined
      || (activation && !activationReady())) {
      const reason = activation && !activationReady() && referenceReady()
        ? input.labels['reference.activationUnavailable']
        : selectionUnavailableReason ?? liveBridgeSnapshot.reason ?? input.labels['reference.unavailable']
      queueMicrotask(() => {
        layer.closeSurface()
        layer.restoreSourceFocus()
        layer.setActionFeedback(reason)
      })
      return { surface: 'owner' }
    }
    const identity = referenceRequestIdentity(target, resolved.reference)
    const existingId = pendingReferenceIdentities.get(identity)
    const existing = existingId === undefined ? undefined : pendingReferenceRequests.get(existingId)
    // Do not mint a replacement for an unacknowledged request. Re-probe the
    // owner projection so the user can inspect the original target instead.
    if (existing !== undefined) {
      ensureReferenceBridge()
      liveBridgeSnapshot = bridgeSnapshot(observedBridge)
      queueMicrotask(() => {
        layer.closeSurface()
        layer.restoreSourceFocus()
        layer.setActionFeedback(existing.status === 'unknown'
          ? input.labels['reference.unconfirmed']
          : input.labels['reference.adding'])
      })
      return { surface: 'owner' }
    }
    referenceRequestSequence += 1
    const requestId = `selection-reference-${referenceMountId}-${referenceRequestSequence}`
    const pending: PendingReferenceRequest = {
      id: requestId,
      identity,
      target,
      activation,
      status: 'pending',
      timer: undefined,
    }
    pendingReferenceRequests.set(requestId, pending)
    pendingReferenceIdentities.set(identity, requestId)
    activeReferenceRequestId = requestId
    view.dispatchEvent(new CustomEvent(COMPOSER_REFERENCE_ADD_EVENT, {
      detail: {
        version: 1,
        requestId,
        target,
        reference: resolved.reference,
        ...(activation ? { activation: { focus: 'composer' as const } } : {}),
      } satisfies ComposerReferenceAddDetail,
    }))
    pending.timer = view.setTimeout(() => {
      const current = pendingReferenceRequests.get(requestId)
      if (current === undefined) return
      current.timer = undefined
      current.status = 'unknown'
      if (activeReferenceRequestId !== requestId) return
      queueMicrotask(() => {
        layer.closeSurface()
        layer.restoreSourceFocus()
        layer.setActionFeedback(input.labels['reference.unconfirmed'])
      })
    }, REFERENCE_RECEIPT_TIMEOUT_MS)
    queueMicrotask(() => {
      if (pendingReferenceRequests.get(requestId)?.status !== 'pending') return
      layer.closeSurface()
      layer.restoreSourceFocus()
      layer.setActionFeedback(input.labels['reference.adding'])
    })
    return { surface: 'owner' }
  }
  const awaitChosenTargetSnapshot = (
    bridge: SelectionReferenceBridge,
    target: ConversationReferenceTarget,
    signal: AbortSignal,
  ): Promise<boolean> => new Promise(resolve => {
    let complete = false
    let timer: number | undefined
    let unsubscribe: (() => void) | undefined
    const finish = (matched: boolean): void => {
      if (complete) return
      complete = true
      if (timer !== undefined) view.clearTimeout(timer)
      unsubscribe?.()
      signal.removeEventListener('abort', onAbort)
      resolve(matched)
    }
    const snapshotMatches = (): boolean => {
      liveBridgeSnapshot = bridgeSnapshot(bridge)
      return hasReferenceTarget(liveBridgeSnapshot.target) && sameReferenceTarget(liveBridgeSnapshot.target, target)
    }
    const onAbort = (): void => finish(false)
    if (signal.aborted) {
      finish(false)
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
    try {
      // Owners may publish loading or an older target before the selected
      // tuple arrives. Those intermediate snapshots are not a rejection.
      unsubscribe = bridge.subscribe(() => {
        if (snapshotMatches()) finish(true)
      })
    } catch {
      finish(false)
      return
    }
    if (snapshotMatches()) {
      finish(true)
      return
    }
    timer = view.setTimeout(() => finish(false), CHOOSE_TARGET_SNAPSHOT_TIMEOUT_MS)
  })
  const detachIntent = layer.onIntent((intent: SelectionActionIntentV2, context) => {
    lastContext = context
    switch (intent.actionId) {
      case 'dsh:ask':
      case 'dsh:analyze':
        overlay.openComposer('ask', intent.actionId)
        return { surface: 'composer' }
      case 'dsh:comment':
        overlay.openComposer('comment', intent.actionId)
        return { surface: 'composer' }
      case 'dsh:edit':
        overlay.openComposer('edit', intent.actionId)
        return { surface: 'composer' }
      case 'dsh:add-to-batch':
        view.dispatchEvent(new CustomEvent(SELECTION_ANNOTATION_BATCH_EVENT, { detail: { anchor: pendingAnchor } }))
        return { surface: 'local' }
      case 'dsh:reference':
        return dispatchReferenceAdd(false)
      case 'dsh:ask-with-reference':
        return dispatchReferenceAdd(true)
      case 'dsh:reference-details': {
        if (selectionReference === undefined) {
          queueMicrotask(() => {
            layer.closeSurface()
            layer.restoreSourceFocus()
            layer.setActionFeedback(selectionUnavailableReason ?? input.labels['reference.unavailable'])
          })
          return { surface: 'owner' }
        }
        // Capture the owner-resolved proof before the click moves focus. The
        // ensuing selectionchange may invalidate the live selection, but must
        // not make an explicitly requested read-only details popover vanish.
        const details: ReferenceDetailsData = {
          reference: selectionReference.reference,
          source: selectionReference.source,
          quote: pendingQuote,
          target: liveBridgeSnapshot.target,
          quoteDigest: selectionReference.reference.digest,
        }
        queueMicrotask(() => detailsPopover.open(intent.actionId, details))
        return { surface: 'owner' }
      }
      case 'dsh:add-text-quote': {
        // 未关联来源的文字只能作为用户可见、可编辑的 Composer 草稿。它不
        // 伪造 owner/ref、不写主草稿，也绝不因点击而派发 submit 或宣称已发送。
        const target = liveBridgeSnapshot.target
        if (!textQuoteReady() || !hasReferenceTarget(target)) {
          queueMicrotask(() => {
            layer.closeSurface()
            layer.restoreSourceFocus()
            layer.setActionFeedback(liveBridgeSnapshot.reason ?? input.labels['reference.unavailable'])
          })
          return { surface: 'owner' }
        }
        composer.update(pendingQuote)
        composer.removeContextCard('text-quote')
        composer.addContextCard({ id: 'text-quote', label: input.labels['reference.textQuote.draft'] })
        overlay.openComposer('ask', intent.actionId)
        return { surface: 'composer' }
      }
      case 'dsh:choose-conversation': {
        const bridge = ensureReferenceBridge()
        if (bridge === undefined || !chooseTargetReady()) {
          queueMicrotask(() => {
            layer.closeSurface()
            layer.restoreSourceFocus()
            layer.setActionFeedback(input.labels['reference.choose.unavailable'])
          })
          return { surface: 'owner' }
        }
        chooseTargetAbort?.abort()
        const generation = ++chooseTargetGeneration
        const controller = new AbortController()
        chooseTargetAbort = controller
        void bridge.chooseTarget!(controller.signal).then(async result => {
          if (controller.signal.aborted || generation !== chooseTargetGeneration) return
          if (result.status === 'selected') {
            const matched = await awaitChosenTargetSnapshot(bridge, result.target, controller.signal)
            if (controller.signal.aborted || generation !== chooseTargetGeneration) return
            chooseTargetAbort = undefined
            layer.closeSurface()
            layer.restoreSourceFocus()
            if (!matched) {
              layer.setActionFeedback(input.labels['reference.choose.unconfirmed'])
              return
            }
            // Only the owner snapshot can confirm that the picker result is
            // current. The plugin keeps no target ledger of its own.
            invalidateSelectionReference()
            if (pendingAnchor !== undefined && pendingQuote !== '') resolveCurrentSelectionReference(pendingAnchor, pendingQuote, pendingSource)
            layer.setActionFeedback(input.labels['reference.choose.selected'].replace('{title}', result.target.title ?? result.target.conversationId))
            return
          }
          // A picker cancellation is terminal for this generation. Mark its
          // signal aborted so any host-side continuation cannot publish later.
          controller.abort()
          chooseTargetAbort = undefined
          layer.closeSurface()
          layer.restoreSourceFocus()
          // cancelled：目标、选区与草稿保持不变；unavailable：如实展示原因。
          if (result.status === 'unavailable') layer.setActionFeedback(result.reason)
        }).catch(() => {
          if (controller.signal.aborted || generation !== chooseTargetGeneration) return
          chooseTargetAbort = undefined
          layer.closeSurface()
          layer.restoreSourceFocus()
          layer.setActionFeedback(input.labels['reference.choose.unavailable'])
        })
        return { surface: 'owner' }
      }
      case 'dsh:open-full':
        composer.expand()
        dispatchSubmit(composer.getState().intent)
        return { surface: 'local' }
      default:
        // copy-quote 由交互层内建剪贴板完成；未知动作 fail-closed。
        return undefined
    }
  })
  disposers.push(detachIntent)

  emitEvidence({ policyVersion: 'v2', capability: 'selection.interaction.v2', result: 'v2-layer-attached', deprecated: false }, view)

  return () => {
    chooseTargetGeneration += 1
    chooseTargetAbort?.abort()
    chooseTargetAbort = undefined
    for (const pending of pendingReferenceRequests.values()) {
      if (pending.timer !== undefined) view.clearTimeout(pending.timer)
    }
    pendingReferenceRequests.clear()
    pendingReferenceIdentities.clear()
    activeReferenceRequestId = undefined
    for (const dispose of disposers) dispose()
  }
}

// ---------------------------------------------------------------------------
// V1 adapter（兼容窗口：policyVersion=v1）
// ---------------------------------------------------------------------------

function mountV1Adapter(input: {
  readonly doc: Document
  readonly labels: ReturnType<typeof labelsFor>
  readonly runtimeOptions: RuntimeOptions
  readonly view: Window
}): () => void {
  const { doc, runtimeOptions, view } = input
  const disposers: Array<() => void> = []

  let pendingAnchor: AnchorDraft | undefined
  let pendingQuote = ''
  const composer = new CompactComposerController(
    runtimeOptions.composerAdapter === undefined ? {} : { adapter: runtimeOptions.composerAdapter },
  )
  const overlay = mountComposerOverlay({
    doc,
    labels: input.labels,
    composer,
    anchorProvider: () => pendingAnchor,
    quoteProvider: () => pendingQuote,
    composerAvailable: runtimeOptions.composerAdapter !== undefined,
  })
  disposers.push(overlay.dispose)

  const onAction = (action: ToolbarAction): void => {
    if (action === 'ask') overlay.openComposer('ask')
    else if (action === 'comment') overlay.openComposer('comment')
    else if (action === 'agent-edit') overlay.openComposer('edit')
    else if (action === 'edit') overlay.openComposer('edit')
    else if (action === 'copy-quote') {
      const capture = captureFromSelection(view.getSelection())
      if (capture !== null && navigator.clipboard !== undefined) void navigator.clipboard.writeText(capture.text)
    } else if (action === 'add-to-batch') {
      view.dispatchEvent(new CustomEvent(SELECTION_ANNOTATION_BATCH_EVENT, { detail: { anchor: pendingAnchor } }))
    } else if (action === 'open-full') {
      composer.expand()
      view.dispatchEvent(new CustomEvent(SELECTION_ANNOTATION_SUBMIT_EVENT, {
        detail: { intent: composer.getState().intent, text: composer.getState().text, anchor: pendingAnchor, approvalPolicy: 'preview-first' } satisfies SelectionAnnotationSubmitDetail,
      }))
    }
  }
  const toolbar = new SelectionToolbarController({ labels: input.labels, onAction, narrow: runtimeOptions.narrow === true })

  let repositionTimer: ReturnType<typeof setTimeout> | undefined
  const handleSelectionChange = (): void => {
    if (repositionTimer !== undefined) clearTimeout(repositionTimer)
    repositionTimer = setTimeout(() => {
      const capture = captureFromSelection(view.getSelection())
      if (capture === null) {
        pendingAnchor = undefined
        pendingQuote = ''
        composer.removeContextCard('selection')
        toolbar.hide()
        return
      }
      const range = view.getSelection()?.getRangeAt(0)
      if (range === undefined) return
      const rect = safeSelectionRect(range)
      void selectionToAnchorDraft(capture, {
        artifactRef: runtimeOptions.artifactRef ?? 'conversation:rendered',
        artifactVersion: runtimeOptions.artifactVersion ?? '0',
        ...(runtimeOptions.sourceArtifactRef === undefined ? {} : { sourceArtifactRef: runtimeOptions.sourceArtifactRef }),
      }).then(anchor => {
        pendingAnchor = anchor
        pendingQuote = capture.text
        composer.removeContextCard('selection')
        composer.addContextCard({ id: 'selection', label: anchor.kind === 'markdown-range' ? `L${anchor.sourceStartLine}–${anchor.sourceEndLine}` : anchor.quotePreview.slice(0, 24) })
      })
      const viewport = { width: view.innerWidth, height: view.innerHeight }
      const side = edgeAnchorSide({ top: rect.top, height: rect.height }, viewport)
      if (side !== null) {
        toolbar.collapseToEdge(side)
        return
      }
      toolbar.show({ top: rect.top, left: rect.left, width: rect.width, height: rect.height }, viewport)
    }, 120)
  }
  doc.addEventListener('selectionchange', handleSelectionChange)
  disposers.push(() => {
    if (repositionTimer !== undefined) clearTimeout(repositionTimer)
    doc.removeEventListener('selectionchange', handleSelectionChange)
  })
  disposers.push(() => toolbar.dispose())

  // 兼容窗口 deprecated evidence 标记（脱敏：无选区原文/prompt/payload）。
  emitEvidence({ policyVersion: 'v1', capability: 'selection.interaction.v2', result: 'v1-adapter-active', deprecated: true }, view)

  return () => {
    for (const dispose of disposers) dispose()
  }
}
