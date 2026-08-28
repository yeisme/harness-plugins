/**
 * DSH Web 选区批注浏览器入口。
 *
 * 不注册 slot、不 shadowing 宿主渲染：以 selectionchange 观察器把文本
 * 选区接到浮动操作条与紧凑 Composer overlay。发送动作经 CustomEvent
 * 交给宿主/工作台桥接（conversation runtime 由 DSH 拥有）；无桥接时评论
 * 本地保存、询问诚实降级。kill-switch：
 * `localStorage['dsh-selection-annotation'] === 'off'`。
 *
 * @module @yeisme/dsh-client-ui-selection-annotation/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
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

export const SELECTION_ANNOTATION_SUBMIT_EVENT = 'dsh-selection-annotation:submit'
export const SELECTION_ANNOTATION_KILL_SWITCH = 'dsh-selection-annotation'

export interface SelectionAnnotationSubmitDetail {
  readonly intent: 'ask' | 'comment' | 'edit'
  readonly text: string
  readonly anchor: AnchorDraft | undefined
  readonly approvalPolicy: 'preview-first'
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

/** Mount the client face and return an exact disposer. */
export async function apply(ctx: ClientContext, runtimeOptions: RuntimeOptions = {}): Promise<() => void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  const labels = labelsFor(window.navigator.language)

  let disabled = false
  try {
    disabled = window.localStorage?.getItem(SELECTION_ANNOTATION_KILL_SWITCH) === 'off'
  } catch {
    disabled = false
  }
  if (disabled) return () => {}

  injectSelectionAnnotationStyles(document)

  const artifactRef = runtimeOptions.artifactRef ?? 'conversation:rendered'
  const artifactVersion = runtimeOptions.artifactVersion ?? '0'
  let pendingAnchor: AnchorDraft | undefined

  const composer = new CompactComposerController(
    runtimeOptions.composerAdapter === undefined ? {} : { adapter: runtimeOptions.composerAdapter },
  )
  const overlay = document.createElement('div')
  overlay.className = 'dsh-selection-composer'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-label', labels['composer.title'])
  overlay.style.display = 'none'
  document.body.append(overlay)

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
      <textarea rows="${state.rows}" aria-label="${labels['composer.title']}">${state.text.replace(/</g, '&lt;')}</textarea>
      <div class="dsh-selection-composer__footer">
        <span class="dsh-selection-composer__cards">${cards}</span>
        <span>${labels['composer.reviewOnly']}</span>
        <button type="button" data-action="expand">${labels['composer.expand']}</button>
        <button type="button" data-action="send">${labels['composer.send']}</button>
      </div>
    `
    const textarea = overlay.querySelector('textarea')
    if (textarea !== null) {
      textarea.addEventListener('input', event => {
        composer.update((event.target as HTMLTextAreaElement).value)
      })
      textarea.focus()
    }
    for (const button of Array.from(overlay.querySelectorAll('button'))) {
      button.addEventListener('click', () => {
        const intent = button.dataset.intent as 'ask' | 'comment' | 'edit' | undefined
        if (intent !== undefined) {
          composer.setIntent(intent)
          renderOverlay()
          return
        }
        if (button.dataset.action === 'close') {
          overlay.style.display = 'none'
          return
        }
        if (button.dataset.action === 'expand') {
          // Draft, attachments and anchor context survive the round trip.
          composer.expand()
          window.dispatchEvent(new CustomEvent(SELECTION_ANNOTATION_SUBMIT_EVENT, {
            detail: { intent: composer.getState().intent, text: composer.getState().text, anchor: pendingAnchor, approvalPolicy: 'preview-first' } satisfies SelectionAnnotationSubmitDetail,
          }))
          renderOverlay()
          return
        }
        if (button.dataset.action === 'send') {
          void (async () => {
            const before = composer.getState()
            const result = await composer.submit()
            // 评论默认不调模型：本地保存后仍通知宿主桥接（如批注面板）。
            if (result.status === 'local' || result.status === 'sent') {
              window.dispatchEvent(new CustomEvent(SELECTION_ANNOTATION_SUBMIT_EVENT, {
                detail: {
                  intent: before.intent,
                  text: before.text,
                  anchor: pendingAnchor,
                  approvalPolicy: 'preview-first',
                } satisfies SelectionAnnotationSubmitDetail,
              }))
            }
            renderOverlay()
          })()
        }
      })
    }
  }

  const openComposer = (intent: 'ask' | 'comment' | 'edit'): void => {
    composer.setIntent(intent)
    composer.collapse()
    renderOverlay()
  }

  const onAction = (action: ToolbarAction): void => {
    if (action === 'ask') openComposer('ask')
    else if (action === 'comment') openComposer('comment')
    else if (action === 'agent-edit') openComposer('edit')
    else if (action === 'edit') openComposer('edit')
    else if (action === 'copy-quote') {
      const capture = captureFromSelection(window.getSelection())
      if (capture !== null && navigator.clipboard !== undefined) void navigator.clipboard.writeText(capture.text)
    } else if (action === 'add-to-batch') {
      window.dispatchEvent(new CustomEvent('dsh-selection-annotation:add-to-batch', { detail: { anchor: pendingAnchor } }))
    } else if (action === 'open-full') {
      composer.expand()
      window.dispatchEvent(new CustomEvent(SELECTION_ANNOTATION_SUBMIT_EVENT, {
        detail: { intent: composer.getState().intent, text: composer.getState().text, anchor: pendingAnchor, approvalPolicy: 'preview-first' } satisfies SelectionAnnotationSubmitDetail,
      }))
    }
  }

  // Esc 依次关闭 Composer 与操作条：overlay 先于 toolbar 注册捕获监听，
  // Composer 打开时 Esc 只关 Composer，再按一次才收起操作条。
  const overlayKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    if (overlay.style.display === 'none') return
    event.preventDefault()
    // 同为 document 捕获监听：必须 immediate-stop 才轮不到 toolbar 的 Esc。
    event.stopImmediatePropagation()
    overlay.style.display = 'none'
  }
  document.addEventListener('keydown', overlayKeydown, true)

  const toolbar = new SelectionToolbarController({ labels, onAction, narrow: runtimeOptions.narrow === true })

  let repositionTimer: ReturnType<typeof setTimeout> | undefined
  const handleSelectionChange = (): void => {
    if (repositionTimer !== undefined) clearTimeout(repositionTimer)
    repositionTimer = setTimeout(() => {
      const capture = captureFromSelection(window.getSelection())
      if (capture === null) {
        toolbar.hide()
        return
      }
      const range = window.getSelection()?.getRangeAt(0)
      if (range === undefined) return
      const rect = safeSelectionRect(range)
      void selectionToAnchorDraft(capture, {
        artifactRef,
        artifactVersion,
        ...(runtimeOptions.sourceArtifactRef === undefined ? {} : { sourceArtifactRef: runtimeOptions.sourceArtifactRef }),
      }).then(anchor => {
        pendingAnchor = anchor
        composer.addContextCard({ id: 'selection', label: anchor.kind === 'markdown-range' ? `L${anchor.sourceStartLine}–${anchor.sourceEndLine}` : anchor.quotePreview.slice(0, 24) })
      })
      const viewport = { width: window.innerWidth, height: window.innerHeight }
      const side = edgeAnchorSide({ top: rect.top, height: rect.height }, viewport)
      if (side !== null) {
        toolbar.collapseToEdge(side)
        return
      }
      toolbar.show({ top: rect.top, left: rect.left, width: rect.width, height: rect.height }, viewport)
    }, 120)
  }

  document.addEventListener('selectionchange', handleSelectionChange)

  const dispose = (): void => {
    if (repositionTimer !== undefined) clearTimeout(repositionTimer)
    document.removeEventListener('selectionchange', handleSelectionChange)
    document.removeEventListener('keydown', overlayKeydown, true)
    toolbar.dispose()
    overlay.remove()
  }
  ctx.effect(() => dispose, 'dsh-selection-annotation: selection lifecycle')
  return dispose
}
