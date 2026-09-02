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
import { captureFromSelection, selectionToAnchorDraft } from './dom-anchors.ts'
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
}

interface RuntimeOptions {
  /** Rendered surface descriptor; defaults treat the conversation DOM as source-less. */
  readonly artifactRef?: string
  readonly artifactVersion?: string
  readonly sourceArtifactRef?: string
  readonly narrow?: boolean
  /** Host-injected conversation composer/runtime seam; absent means honest degradation. */
  readonly composerAdapter?: ComposerAdapter
}

function emitEvidence(detail: SelectionInteractionEvidence, target: Window | undefined): void {
  target?.dispatchEvent(new CustomEvent(SELECTION_INTERACTION_EVIDENCE_EVENT, { detail }))
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

interface ComposerOverlay {
  readonly overlay: HTMLElement
  readonly openComposer: (intent: 'ask' | 'comment' | 'edit') => void
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
  readonly onEsc?: () => void
  readonly onExpanded?: () => void
  /** V2 additive 字段注入（policyVersion/canonicalActionId/contextKind）；V1 adapter 不传。 */
  readonly enrichDetail?: (intent: 'ask' | 'comment' | 'edit') => { policyVersion?: 'v1' | 'v2'; canonicalActionId?: string; contextKind?: NonNullable<SelectionAnnotationSubmitDetail['contextKind']> }
}): ComposerOverlay {
  const { doc, labels, composer } = input
  const overlay = doc.createElement('div')
  overlay.className = 'dsh-selection-composer'
  overlay.dataset.yeismeSurface = 'true'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-label', labels['composer.title'])
  overlay.style.display = 'none'
  doc.body.append(overlay)

  const renderOverlay = (): void => {
    const state = composer.getState()
    overlay.style.display = state.expanded ? 'none' : 'block'
    if (state.expanded) return
    const intentButtons = (['ask', 'comment', 'edit'] as const)
      .map(intent => `<button type="button" data-intent="${intent}" aria-pressed="${state.intent === intent}">${labels[`composer.${intent}`]}</button>`)
      .join('')
    const cards = state.cards
      .map(card => `<span class="dsh-selection-composer__card">${card.label}</span>`)
      .join('')
    overlay.innerHTML = `
      <div class="dsh-selection-composer__header">
        <span>${state.anchorTitle ?? labels['composer.title']}</span>
        <button type="button" data-action="close" aria-label="close">×</button>
      </div>
      <div class="dsh-selection-composer__intents" role="tablist">${intentButtons}</div>
      <label class="ys-field dsh-selection-composer__field">
        <span class="sr-only">${labels['composer.title']}</span>
        <textarea rows="${state.rows}" aria-label="${labels['composer.title']}">${composer.getState().text.replace(/</g, '&lt;')}</textarea>
      </label>
      <div class="dsh-selection-composer__footer">
        <span class="dsh-selection-composer__cards">${cards}</span>
        <span>${labels['composer.reviewOnly']}</span>
        <button type="button" data-action="expand">${labels['composer.expand']}</button>
        <button type="button" data-action="send">${labels['composer.send']}</button>
      </div>
    `
    overlay.querySelector('textarea')?.focus()
  }

  // G21 dispose 收口：Composer 交互监听以事件委托挂在常驻 overlay 上。
  const onOverlayInput = (event: Event): void => {
    if (event.target instanceof HTMLTextAreaElement) composer.update(event.target.value)
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
      composer.setIntent(intent)
      renderOverlay()
      return
    }
    if (button.dataset.action === 'close') {
      overlay.style.display = 'none'
      input.onEsc?.()
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
        renderOverlay()
      })()
    }
  }
  overlay.addEventListener('input', onOverlayInput)
  overlay.addEventListener('click', onOverlayClick)

  // Esc 关 Composer；V2 下同时回传交互层（Composer → Actions 逐层退出）。
  const overlayKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    if (overlay.style.display === 'none') return
    event.preventDefault()
    event.stopImmediatePropagation()
    overlay.style.display = 'none'
    input.onEsc?.()
  }
  doc.addEventListener('keydown', overlayKeydown, true)

  return {
    overlay,
    openComposer: intent => {
      composer.setIntent(intent)
      composer.collapse()
      renderOverlay()
    },
    hide: () => { overlay.style.display = 'none' },
    dispose: () => {
      overlay.removeEventListener('input', onOverlayInput)
      overlay.removeEventListener('click', onOverlayClick)
      doc.removeEventListener('keydown', overlayKeydown, true)
      overlay.remove()
    },
  }
}

/** Anchor 草稿计算（V1/V2 共用）：选区 → quote digest + 源码行映射。 */
function startAnchorTracker(input: {
  readonly doc: Document
  readonly runtimeOptions: RuntimeOptions
  readonly onAnchor: (anchor: AnchorDraft | undefined, quotePreview: string) => void
}): () => void {
  const { doc } = input
  const artifactRef = input.runtimeOptions.artifactRef ?? 'conversation:rendered'
  const artifactVersion = input.runtimeOptions.artifactVersion ?? '0'
  let anchorTimer: ReturnType<typeof setTimeout> | undefined
  const handleSelectionChange = (): void => {
    if (anchorTimer !== undefined) clearTimeout(anchorTimer)
    anchorTimer = setTimeout(() => {
      const capture = captureFromSelection(doc.defaultView?.getSelection() ?? null)
      if (capture === null) {
        input.onAnchor(undefined, '')
        return
      }
      void selectionToAnchorDraft(capture, {
        artifactRef,
        artifactVersion,
        ...(input.runtimeOptions.sourceArtifactRef === undefined ? {} : { sourceArtifactRef: input.runtimeOptions.sourceArtifactRef }),
      }).then(anchor => {
        input.onAnchor(anchor, capture.text)
      })
    }, 120)
  }
  doc.addEventListener('selectionchange', handleSelectionChange)
  return () => {
    if (anchorTimer !== undefined) clearTimeout(anchorTimer)
    doc.removeEventListener('selectionchange', handleSelectionChange)
  }
}

/** Mount the client face and return an exact disposer. */
export async function apply(ctx: ClientContext, runtimeOptions: RuntimeOptions = {}): Promise<() => void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  const labels = labelsFor(window.navigator.language)

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

  const dispose = mountV2({ doc: document, labels, runtimeOptions, view: window })
  ctx.effect(() => dispose, 'dsh-selection-annotation: selection interaction v2 lifecycle')
  return dispose
}

// ---------------------------------------------------------------------------
// V2 主路径：提交 context，承接显式动作
// ---------------------------------------------------------------------------

function mountV2(input: {
  readonly doc: Document
  readonly labels: ReturnType<typeof labelsFor>
  readonly runtimeOptions: RuntimeOptions
  readonly view: Window
}): () => void {
  const { doc, runtimeOptions, view } = input
  const disposers: Array<() => void> = []

  let pendingAnchor: AnchorDraft | undefined
  let lastContext: SelectionContextV2 | undefined

  const composer = new CompactComposerController(
    runtimeOptions.composerAdapter === undefined ? {} : { adapter: runtimeOptions.composerAdapter },
  )
  const enrichDetail = (intent: 'ask' | 'comment' | 'edit'): { policyVersion: 'v2'; canonicalActionId?: string; contextKind?: NonNullable<SelectionAnnotationSubmitDetail['contextKind']> } => ({
    policyVersion: 'v2',
    ...(lastContext === undefined ? {} : {
      canonicalActionId: intent === 'ask' ? 'dsh:ask' : intent === 'comment' ? 'dsh:comment' : 'dsh:edit',
      contextKind: lastContext.kind,
    }),
  })
  const overlay = mountComposerOverlay({
    doc,
    labels: input.labels,
    composer,
    anchorProvider: () => pendingAnchor,
    onEsc: () => getSharedSelectionInteraction()?.closeSurface(),
    enrichDetail,
  })
  disposers.push(overlay.dispose)

  // 全局 singleton 交互层：本插件只 attach + 提供 capability + 承接 intent。
  const detachLayer = attachSharedSelectionInteraction(doc, {
    viewportWidth: () => view.innerWidth,
    isCoarsePointer: () => view.matchMedia?.('(pointer: coarse)').matches ?? false,
  })
  disposers.push(detachLayer)
  const layer = getSharedSelectionInteraction()
  if (layer === undefined) return () => { for (const dispose of disposers) dispose() }

  // capability：Composer owner 在位才开放 ask/edit/open-full；批注组按 V1
  // 语义（事件接收方可选）恒可用；copy-quote 本地。
  const capabilities = runtimeOptions.composerAdapter === undefined
    ? ['annotation.batch']
    : ['annotation.batch', 'conversation.composer', 'selection.edit']
  disposers.push(layer.addCapabilityProvider(() => capabilities))
  disposers.push(layer.registerContextPublisher({ id: 'selection-annotation', capabilities }))

  // anchor 草稿：与交互层并行的 selectionchange 监听（只算 anchor，不渲染）。
  disposers.push(startAnchorTracker({
    doc,
    runtimeOptions,
    onAnchor: (anchor, quotePreview) => {
      pendingAnchor = anchor
      if (anchor !== undefined && quotePreview !== '') {
        composer.addContextCard({
          id: 'selection',
          label: anchor.kind === 'markdown-range' ? `L${anchor.sourceStartLine}–${anchor.sourceEndLine}` : quotePreview.slice(0, 24),
        })
      }
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
  const detachIntent = layer.onIntent((intent: SelectionActionIntentV2, context) => {
    lastContext = context
    switch (intent.actionId) {
      case 'dsh:ask':
      case 'dsh:analyze':
        overlay.openComposer('ask')
        return { surface: 'composer' }
      case 'dsh:comment':
        overlay.openComposer('comment')
        return { surface: 'composer' }
      case 'dsh:edit':
        overlay.openComposer('edit')
        return { surface: 'composer' }
      case 'dsh:add-to-batch':
        view.dispatchEvent(new CustomEvent(SELECTION_ANNOTATION_BATCH_EVENT, { detail: { anchor: pendingAnchor } }))
        return { surface: 'local' }
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
  const composer = new CompactComposerController(
    runtimeOptions.composerAdapter === undefined ? {} : { adapter: runtimeOptions.composerAdapter },
  )
  const overlay = mountComposerOverlay({
    doc,
    labels: input.labels,
    composer,
    anchorProvider: () => pendingAnchor,
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

