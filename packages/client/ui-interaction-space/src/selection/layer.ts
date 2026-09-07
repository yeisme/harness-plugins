/**
 * 全局 singleton Selection Interaction Layer。
 *
 * 页面级唯一实例（refcount 生命周期）：监听 `selectionchange` → 120ms 稳定 →
 * normalizer → Actions(1+2+More)/Bottom Sheet；显式动作经 typed intent 交给
 * owner adapter；Esc 逐层退出并还原焦点；旧 pin 事件的选区收藏/恢复仍是唯一
 * 持久入口；手柄的位置固定与拖动仅为 layer 内部短生命周期展示状态（几何 +
 * 布尔位，不进 reducer、不持久化）；dispose/HMR 对称释放
 * listener/timer/style/overlay。Pane 只提交 context（publishExternalContext）
 * 或让自身 DOM 承载可分类选区，不得自建 toolbar。
 *
 * @module @yeisme/dsh-client-ui-interaction-space/selection
 */

import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'
import {
  SELECTION_STABLE_DEBOUNCE_MS,
  validateSelectionContextV2,
  type SelectionActionDescriptorV2,
  type SelectionActionIntentV2,
  type SelectionContextKindV2,
  type SelectionContextSourceV2,
  type SelectionContextV2,
} from './contracts.ts'
import { BUILTIN_CONTEXT_ORDERS, registerBuiltinSelectionActions } from './builtin-actions.ts'
import { normalizeSelection, type SelectionObservation } from './normalizer.ts'
import { SelectionActionRegistryV2, type ResolvedActions } from './registry.ts'
import { selectionInteractionReducer, type SelectionInteractionEvent, type SelectionInteractionState } from './reducer.ts'

export type IntentSurface = 'local' | 'composer' | 'owner'

export interface IntentHandlerResult {
  readonly surface: IntentSurface
}

export interface ExternalContextFacts {
  readonly kind: SelectionContextKindV2
  readonly source: SelectionContextSourceV2
  readonly text: string
  readonly anchor?: SelectionContextV2['anchor']
}

export interface SelectionInteractionLayerOptions {
  /** 宿主/编辑器保留的快捷键（如宿主已绑定 Alt+Enter）；命中即不接管。 */
  readonly isShortcutReserved?: (key: string, target: Node | null) => boolean
  /** coarse pointer 探测（触控端只显示单一入口 + Bottom Sheet）。 */
  readonly isCoarsePointer?: () => boolean
  readonly viewportWidth?: () => number
  /** 当前 DSH locale；缺席时才回退 navigator.language。 */
  readonly language?: () => string
}

export const SELECTION_ACTIONS_STYLE_ID = 'dsh-selection-actions-styles'
/** 触控/窄屏切换阈值（px）。 */
export const SELECTION_NARROW_VIEWPORT_PX = 560

const styleRefCounts = new WeakMap<Document, number>()

function injectActionsStyles(doc: Document): void {
  const refs = styleRefCounts.get(doc) ?? 0
  styleRefCounts.set(doc, refs + 1)
  if (doc.getElementById(SELECTION_ACTIONS_STYLE_ID) !== null) return
  const style = doc.createElement('style')
  style.id = SELECTION_ACTIONS_STYLE_ID
  style.textContent = buildPanelStyles({
    scope: 'dsh-selection-actions',
    extra: `
[data-dsh-selection-actions]{position:fixed;z-index:2147483000;font-size:var(--vk-font-small);background:transparent}
[data-dsh-selection-actions] .sa-toolbar{display:flex;align-items:center;gap:var(--vk-gap-xs);width:max-content;max-width:calc(100vw - 16px);padding:var(--vk-gap-xs);background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-sm);box-shadow:0 4px 12px color-mix(in srgb,var(--vk-bg-base) 60%,transparent);animation:sa-enter 140ms cubic-bezier(.16,1,.3,1)}
[data-dsh-selection-actions] .sa-context{display:inline-flex;align-items:center;gap:6px;max-width:92px;min-height:30px;padding:0 8px;color:var(--vk-text-tertiary);border-right:1px solid var(--vk-border-l1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-dsh-selection-actions] .sa-context::before{width:7px;height:7px;flex:0 0 auto;border-radius:50%;background:var(--vk-accent);content:''}
[data-dsh-selection-actions] .sa-btn{min-height:30px;padding:0 9px;color:var(--vk-text-secondary);font:inherit;background:transparent;border:1px solid transparent;border-radius:var(--vk-radius-md);cursor:pointer}
[data-dsh-selection-actions] .sa-btn:hover:not(:disabled){background:var(--vk-fill-hover)}
[data-dsh-selection-actions] .sa-btn:focus-visible{outline:2px solid var(--vk-border-focus);outline-offset:1px}
[data-dsh-selection-actions] .sa-btn:disabled{color:var(--vk-text-tertiary);opacity:.55;cursor:not-allowed}
[data-dsh-selection-actions] .sa-btn--primary{color:var(--vk-text-primary);font-weight:650;background:color-mix(in srgb,var(--vk-accent) 15%,transparent);border-color:color-mix(in srgb,var(--vk-accent) 34%,transparent)}
[data-dsh-selection-actions] .sa-more{display:none;position:absolute;right:0;top:calc(100% + 6px);min-width:240px;max-width:min(320px,calc(100vw - 24px));padding:6px;background:var(--vk-bg-elevated);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-lg);box-shadow:0 12px 36px color-mix(in srgb,var(--vk-bg-base) 72%,transparent)}
[data-dsh-selection-actions] .sa-more:not([hidden]){display:flex;flex-direction:column}
[data-dsh-selection-actions] .sa-more .sa-btn{justify-content:flex-start;min-height:34px;text-align:left}
[data-dsh-selection-actions] .sa-selection{display:grid;gap:4px;margin-bottom:5px;padding:7px 8px;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md)}
[data-dsh-selection-actions] .sa-selection strong{color:var(--vk-text-secondary);font-size:var(--vk-font-small);font-weight:650}
[data-dsh-selection-actions] .sa-selection span{display:-webkit-box;overflow:hidden;color:var(--vk-text-tertiary);font-size:var(--vk-font-small);line-height:1.45;-webkit-box-orient:vertical;-webkit-line-clamp:2;word-break:break-word}
[data-dsh-selection-actions] .sa-reason{padding:0 8px 4px;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
[data-dsh-selection-actions] .sa-feedback{position:absolute;right:0;top:calc(100% + 5px);max-width:min(320px,calc(100vw - 24px));padding:var(--vk-gap-xs) var(--vk-gap-md);color:var(--vk-text-secondary);font-size:var(--vk-font-small);line-height:1.4;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-sm);box-shadow:none}
[data-dsh-selection-actions] .sa-sheet-backdrop{position:fixed;inset:0;background:color-mix(in srgb,var(--vk-bg-base) 55%,transparent)}
[data-dsh-selection-actions] .sa-sheet{position:fixed;left:8px;right:8px;bottom:8px;display:flex;flex-direction:column;gap:3px;max-height:72vh;overflow:auto;padding:10px 12px 14px;background:var(--vk-bg-elevated);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-lg);box-shadow:0 16px 44px color-mix(in srgb,var(--vk-bg-base) 72%,transparent);animation:sa-enter 140ms cubic-bezier(.16,1,.3,1)}
[data-dsh-selection-actions] .sa-sheet .sa-btn{min-height:44px;font-size:var(--vk-font-body)}
[data-dsh-selection-actions] .sa-sheet .sa-reason{padding:0 4px}
[data-dsh-selection-actions] .sa-pin{display:inline-flex;align-items:center;justify-content:center;min-width:30px;cursor:grab}
[data-dsh-selection-actions] .sa-pin:active{cursor:grabbing}
[data-dsh-selection-actions] .sa-pin[aria-pressed='true']{border:1px solid var(--vk-accent)}
[data-dsh-selection-actions] .sa-edge{position:fixed;padding:2px 8px;color:var(--vk-text-secondary);font-size:var(--vk-font-small);background:var(--vk-bg-elevated);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);opacity:.9}
@keyframes sa-enter{from{opacity:0;transform:translateY(4px) scale(.98)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){[data-dsh-selection-actions],[data-dsh-selection-actions] *{transition:none!important;animation:none!important}}
`,
  })
  doc.head.append(style)
}

function releaseActionsStyles(doc: Document): void {
  const refs = styleRefCounts.get(doc) ?? 0
  const next = Math.max(0, refs - 1)
  styleRefCounts.set(doc, next)
  if (next === 0) doc.getElementById(SELECTION_ACTIONS_STYLE_ID)?.remove()
}

/** label 解析（navigator.language 粗匹配 zh）。 */
export function labelFor(label: { readonly default: string; readonly zh?: string; readonly 'zh-CN'?: string }, language: string): string {
  if (language.toLowerCase().startsWith('zh')) return label['zh-CN'] ?? label.zh ?? label.default
  return label.default
}

type SelectionFlavor = 'text' | 'source' | 'error' | 'image' | 'table' | 'editable'

const ERROR_LIKE_SELECTION = /(?:error|exception|failed|failure|cannot|undefined|null pointer|traceback|报错|错误|失败|异常|无法)/i

function selectionFlavor(context: SelectionContextV2): SelectionFlavor {
  if (ERROR_LIKE_SELECTION.test(context.anchor?.quotePreview ?? '')) return 'error'
  if (context.kind === 'source') return 'source'
  if (context.kind === 'image-region') return 'image'
  if (context.kind === 'table-range') return 'table'
  if (context.kind === 'editable-control') return 'editable'
  return 'text'
}

function selectionUiText(language: string): {
  readonly context: Readonly<Record<SelectionFlavor, string>>
  readonly selected: string
  readonly actions: string
  readonly more: string
  readonly pinPosition: string
  readonly unpinPosition: string
  readonly positionPinned: string
  readonly positionUnpinned: string
  readonly dragMoved: string
  readonly dragCancelled: string
  readonly sourceInvalid: string
} {
  const zh = language.toLowerCase().startsWith('zh')
  return zh
    ? {
        context: { text: '文本', source: '代码', error: '错误信息', image: '图像', table: '表格', editable: '输入' },
        selected: '当前选区',
        actions: '选区操作',
        more: '更多',
        pinPosition: '固定位置（单击固定，拖动移动）',
        unpinPosition: '取消固定位置',
        positionPinned: '已固定工具条位置',
        positionUnpinned: '已取消固定位置',
        dragMoved: '已移动并固定工具条位置',
        dragCancelled: '已取消移动，位置已还原',
        sourceInvalid: '来源已失效，可关闭或重新选择',
      }
    : {
        context: { text: 'Text', source: 'Code', error: 'Error output', image: 'Image', table: 'Table', editable: 'Input' },
        selected: 'Current selection',
        actions: 'Selection actions',
        more: 'More',
        pinPosition: 'Pin position (click to pin, drag to move)',
        unpinPosition: 'Unpin position',
        positionPinned: 'Toolbar position pinned',
        positionUnpinned: 'Toolbar position unpinned',
        dragMoved: 'Toolbar moved and pinned',
        dragCancelled: 'Move cancelled; position restored',
        sourceInvalid: 'Source is no longer valid; close or select again',
      }
}

function actionLabel(view: ActionViewLike, context: SelectionContextV2, language: string): string {
  const zh = language.toLowerCase().startsWith('zh')
  const flavor = selectionFlavor(context)
  const id = view.descriptor.id
  if (id === 'dsh:ask' && flavor === 'error') return zh ? '诊断' : 'Diagnose'
  if (id === 'dsh:ask' && flavor === 'source') return zh ? '解释' : 'Explain'
  if (id === 'dsh:comment' && flavor === 'image') return zh ? '批注' : 'Annotate'
  if (id === 'dsh:edit' && flavor === 'error') return zh ? '生成修复' : 'Draft fix'
  if (id === 'dsh:edit' && flavor === 'source') return zh ? '修改代码' : 'Edit code'
  if (id === 'dsh:edit' && flavor === 'text') return zh ? '改写' : 'Rewrite'
  if (id === 'dsh:edit' && flavor === 'editable') return zh ? '替换' : 'Replace'
  return labelFor(view.descriptor.label, language)
}

export interface LayerContextPublisher {
  readonly id: string
  readonly capabilities?: readonly string[]
}

interface ActionViewLike {
  readonly descriptor: SelectionActionDescriptorV2
  readonly slot: 'primary' | 'secondary' | 'more'
  readonly disabled: boolean
  readonly disabledReason?: { readonly default: string; readonly zh?: string }
}

/** 手柄拖动手势（pending = 按下未超阈值；dragging = 超阈值移动中）。 */
interface HandleGesture {
  readonly pointerId: number
  readonly startClientX: number
  readonly startClientY: number
  readonly origLeft: number
  readonly origTop: number
  readonly origPinned: boolean
  phase: 'pending' | 'dragging'
}

/** 点击/拖动判定阈值（CSS px）。 */
const HANDLE_DRAG_THRESHOLD_PX = 6
/** 手柄键盘/拖动步进（px；Shift 加速）。 */
const HANDLE_MOVE_STEP_PX = 8
const HANDLE_MOVE_STEP_SHIFT_PX = 32

/**
 * The page-level interaction layer. Headless 状态机 + DOM 表面渲染同一实例；
 * 所有 listener/timer/style/overlay 在 dispose 一次性对称释放。
 */
export class SelectionInteractionLayer {
  readonly registry = new SelectionActionRegistryV2()

  private state: SelectionInteractionState = { phase: 'idle' }
  private readonly listeners = new Set<() => void>()
  private readonly intentHandlers = new Set<(intent: SelectionActionIntentV2, context: SelectionContextV2) => IntentHandlerResult | undefined>()
  private readonly capabilityProviders = new Set<() => readonly string[]>()
  private readonly contextPublishers = new Map<string, LayerContextPublisher>()
  private readonly doc: Document
  private readonly options: SelectionInteractionLayerOptions
  private readonly overlayRoot: HTMLElement
  private readonly toolbar: HTMLElement
  private readonly morePanel: HTMLElement
  private readonly feedbackElement: HTMLElement
  private readonly sheetBackdrop: HTMLElement
  private readonly sheet: HTMLElement
  private stableTimer: ReturnType<typeof setTimeout> | undefined
  private candidateAt = 0
  private contextSeq = 0
  private currentContextId: string | undefined
  private pinnedContext: SelectionContextV2 | undefined
  private restoreFocusTo: HTMLElement | undefined
  private disposed = false
  private moreOpen = false
  private sheetOpen = false
  private edgeTimer: ReturnType<typeof setTimeout> | undefined
  private feedback: string | undefined
  // 位置固定/拖动：内部展示状态，与 reducer `pinned`（选区收藏/恢复）无关。
  private positionPinned = false
  private pinnedLeft: number | undefined
  private pinnedTop: number | undefined
  private invalidPinnedContext: SelectionContextV2 | undefined
  private handleGesture: HandleGesture | undefined
  private gestureHandle: HTMLButtonElement | undefined
  private suppressNextHandleClick = false

  constructor(doc: Document, options: SelectionInteractionLayerOptions = {}) {
    this.doc = doc
    this.options = options
    injectActionsStyles(doc)
    this.overlayRoot = doc.createElement('div')
    this.overlayRoot.setAttribute('data-dsh-selection-actions', '')
    this.overlayRoot.setAttribute('data-dsh-selection-surface', '')
    this.overlayRoot.style.display = 'none'
    this.toolbar = doc.createElement('div')
    this.toolbar.className = 'sa-toolbar'
    this.toolbar.setAttribute('role', 'toolbar')
    this.toolbar.setAttribute('aria-label', selectionUiText(this.language()).actions)
    this.morePanel = doc.createElement('div')
    this.morePanel.className = 'sa-more'
    this.morePanel.setAttribute('role', 'menu')
    this.morePanel.setAttribute('aria-label', selectionUiText(this.language()).more)
    this.morePanel.hidden = true
    this.feedbackElement = doc.createElement('div')
    this.feedbackElement.className = 'sa-feedback'
    this.feedbackElement.setAttribute('role', 'status')
    this.feedbackElement.setAttribute('aria-live', 'polite')
    this.feedbackElement.hidden = true
    this.sheetBackdrop = doc.createElement('div')
    this.sheetBackdrop.className = 'sa-sheet-backdrop'
    this.sheetBackdrop.style.display = 'none'
    this.sheet = doc.createElement('div')
    this.sheet.className = 'sa-sheet'
    this.sheet.setAttribute('role', 'dialog')
    this.sheet.setAttribute('aria-label', selectionUiText(this.language()).actions)
    this.sheetBackdrop.append(this.sheet)
    this.overlayRoot.append(this.toolbar, this.feedbackElement, this.morePanel, this.sheetBackdrop)
    doc.body.append(this.overlayRoot)

    registerBuiltinSelectionActions(this.registry)
    this.registry.subscribe(() => this.render())

    this.doc.addEventListener('selectionchange', this.onSelectionChange)
    this.doc.addEventListener('scroll', this.onScroll, { capture: true, passive: true })
    this.doc.defaultView?.addEventListener('resize', this.onResize)
    this.doc.addEventListener('keydown', this.onKeydown, true)
    this.doc.addEventListener('pointerdown', this.onPointerDown, true)
    this.toolbar.addEventListener('pointerdown', this.onHandlePointerDown)
    this.toolbar.addEventListener('lostpointercapture', this.onHandleLostCapture)
    this.doc.defaultView?.addEventListener('pointermove', this.onWindowPointerMove)
    this.doc.defaultView?.addEventListener('pointerup', this.onWindowPointerUp)
    this.doc.defaultView?.addEventListener('pointercancel', this.onWindowPointerCancel)
    this.doc.defaultView?.addEventListener('blur', this.onWindowBlur)
    // G21 dispose 收口：按钮交互以事件委托挂在常驻 overlay 上（一次挂载、
    // dispose 显式摘除）；innerHTML 重渲染不再累积元素监听。
    this.overlayRoot.addEventListener('click', this.onOverlayClick)
  }

  /** 事件委托：按 data-action-id 激活动作，More/入口/Pin 走专用 data-role。 */
  private readonly onOverlayClick = (event: MouseEvent): void => {
    if (this.disposed) return
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest('button')
    if (button === null) return
    const context = this.state.phase === 'actions-visible' ? this.state.context : undefined
    if (button.dataset.actionId !== undefined && context !== undefined) {
      this.activateAction(button.dataset.actionId, button.dataset.actionId, context)
      return
    }
    if (button.dataset.role === 'more-toggle') {
      this.moreOpen = !this.moreOpen
      this.render()
      return
    }
    if (button.dataset.role === 'sheet-entry') {
      this.sheetOpen = true
      this.render()
      return
    }
    if (button.dataset.role === 'pin') {
      // 手柄 click = 位置固定切换；拖动手势/取消后的尾随 click 吞掉一次。
      if (this.suppressNextHandleClick) {
        this.suppressNextHandleClick = false
        return
      }
      this.togglePositionPin()
    }
  }

  // --- 生命周期 -----------------------------------------------------------

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.stableTimer !== undefined) clearTimeout(this.stableTimer)
    if (this.edgeTimer !== undefined) clearTimeout(this.edgeTimer)
    this.doc.removeEventListener('selectionchange', this.onSelectionChange)
    this.doc.removeEventListener('scroll', this.onScroll, { capture: true } as EventListenerOptions)
    this.doc.defaultView?.removeEventListener('resize', this.onResize)
    this.doc.removeEventListener('keydown', this.onKeydown, true)
    this.doc.removeEventListener('pointerdown', this.onPointerDown, true)
    this.toolbar.removeEventListener('pointerdown', this.onHandlePointerDown)
    this.toolbar.removeEventListener('lostpointercapture', this.onHandleLostCapture)
    this.doc.defaultView?.removeEventListener('pointermove', this.onWindowPointerMove)
    this.doc.defaultView?.removeEventListener('pointerup', this.onWindowPointerUp)
    this.doc.defaultView?.removeEventListener('pointercancel', this.onWindowPointerCancel)
    this.doc.defaultView?.removeEventListener('blur', this.onWindowBlur)
    this.overlayRoot.removeEventListener('click', this.onOverlayClick)
    this.registry.dispose()
    this.intentHandlers.clear()
    this.capabilityProviders.clear()
    this.contextPublishers.clear()
    this.listeners.clear()
    this.overlayRoot.remove()
    releaseActionsStyles(this.doc)
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getState(): SelectionInteractionState {
    return this.state
  }

  getPinnedContext(): SelectionContextV2 | undefined {
    return this.pinnedContext
  }

  /** 扩展/宿主注册 typed intent handler（owner dispatch bridge）。 */
  onIntent(handler: (intent: SelectionActionIntentV2, context: SelectionContextV2) => IntentHandlerResult | undefined): () => void {
    this.intentHandlers.add(handler)
    return () => { this.intentHandlers.delete(handler) }
  }

  /** capability 提供者（聚合去重后进入 context.capabilities）。 */
  addCapabilityProvider(provider: () => readonly string[]): () => void {
    this.capabilityProviders.add(provider)
    return () => { this.capabilityProviders.delete(provider) }
  }

  /** Pane 登记为 context publisher（capability 透传 + 存在性可见）。 */
  registerContextPublisher(publisher: LayerContextPublisher): () => void {
    this.contextPublishers.set(publisher.id, publisher)
    return () => { this.contextPublishers.delete(publisher.id) }
  }

  /** 非 DOM 选区来源（图片区域/表格范围控件）提交 context。 */
  publishExternalContext(facts: ExternalContextFacts): void {
    if (this.disposed) return
    this.contextSeq += 1
    const contextId = `sel-v2-${this.contextSeq}`
    if (facts.text.trim() === '') return
    const candidate = {
      contextId,
      kind: facts.kind,
      source: facts.source,
      stableForMs: SELECTION_STABLE_DEBOUNCE_MS,
      capabilities: this.currentCapabilities(),
      sensitive: false,
      ...(facts.anchor === undefined ? {} : { anchor: facts.anchor }),
    }
    const validated = validateSelectionContextV2(candidate)
    if (!validated.ok) return
    this.currentContextId = contextId
    this.transition({ type: 'selection-candidate', contextId })
    this.transition({ type: 'selection-stable', context: validated.context })
    this.transition({ type: 'show-actions' })
    this.rememberFocus()
    this.render()
  }

  /** 恢复 pinned entry（Workbench 调用；context 已失效则不执行）。 */
  restorePinned(): boolean {
    if (this.pinnedContext === undefined) return false
    const context = this.pinnedContext
    this.currentContextId = context.contextId
    this.transition({ type: 'selection-candidate', contextId: context.contextId })
    this.transition({ type: 'selection-stable', context })
    this.transition({ type: 'show-actions' })
    this.rememberFocus()
    this.render()
    return true
  }

  /** owner surface（Composer 等）关闭后回传：回到 Actions 或彻底退出。 */
  closeSurface(): void {
    this.transition({ type: 'surface-close' })
    this.render()
  }

  /** Owner receipts can report an explicit action outcome without fabricating a new surface. */
  setActionFeedback(message: string | undefined): void {
    this.feedback = message === undefined || message.trim() === '' ? undefined : message
    this.render()
  }

  dismiss(): void {
    this.clearPositionPin()
    this.transition({ type: 'dismiss' })
    this.restoreFocus()
    this.render()
  }

  /** Return focus to the original selection surface while a receipt remains visible. */
  restoreSourceFocus(): void {
    this.restoreFocus()
  }

  // --- 内部：事件 --------------------------------------------------------

  private currentCapabilities(): readonly string[] {
    const all = new Set<string>()
    for (const provider of this.capabilityProviders) {
      for (const capability of provider()) all.add(capability)
    }
    for (const publisher of this.contextPublishers.values()) {
      for (const capability of publisher.capabilities ?? []) all.add(capability)
    }
    return [...all]
  }

  private readonly onSelectionChange = (): void => {
    if (this.disposed) return
    if (this.stableTimer !== undefined) clearTimeout(this.stableTimer)
    const selection = this.doc.defaultView?.getSelection() ?? null
    const text = selection?.toString() ?? ''
    if (text.trim() === '') {
      this.transition({ type: 'selection-excluded' })
      this.render()
      return
    }
    this.contextSeq += 1
    this.feedback = undefined
    const contextId = `sel-v2-${this.contextSeq}`
    this.candidateAt = Date.now()
    this.currentContextId = contextId
    this.transition({ type: 'selection-candidate', contextId })
    this.render()
    this.stableTimer = setTimeout(() => {
      this.stableTimer = undefined
      this.settleStableSelection(contextId)
    }, SELECTION_STABLE_DEBOUNCE_MS)
  }

  private settleStableSelection(contextId: string): void {
    if (this.disposed || this.currentContextId !== contextId) return
    const selection = this.doc.defaultView?.getSelection() ?? null
    const startNode = selection !== null && selection.rangeCount > 0 ? selection.getRangeAt(0).startContainer : null
    const text = selection?.toString() ?? ''
    const rect = selectionRect(selection)
    const observation: SelectionObservation = {
      text,
      startNode,
      stableForMs: Date.now() - this.candidateAt,
      // rect 缺失（jsdom/旧引擎无 Range 布局）时不以视口为由排除；有 rect 才判定。
      inViewport: rect === null || (rect.top >= 0 && rect.top + rect.height <= (this.doc.defaultView?.innerHeight ?? 0)),
      capabilities: this.currentCapabilities(),
      contextId,
    }
    const normalized = normalizeSelection(observation)
    if (normalized.status === 'context') {
      this.transition({ type: 'selection-stable', context: normalized.context })
      this.transition({ type: 'show-actions' })
      this.rememberFocus()
      this.positionToolbar(rect)
    } else if (normalized.status === 'excluded') {
      this.transition({ type: 'selection-excluded' })
    }
    this.render()
  }

  private readonly onScroll = (): void => {
    if (this.disposed) return
    // 位置固定期间滚动不再追随选区也不关闭。
    if (this.positionPinned) return
    if (this.state.phase === 'actions-visible' || this.state.phase === 'dispatching') {
      // 滚出视口：短暂边缘 affordance 后关闭；仍在视口则随动重摆。
      // rect 缺失（jsdom/旧引擎无 Range 布局）视为仍在视口，不以猜测关闭。
      const rect = selectionRect(this.doc.defaultView?.getSelection() ?? null)
      if (rect === null || (rect.top >= 0 && rect.top + rect.height <= (this.doc.defaultView?.innerHeight ?? 0))) {
        this.positionToolbar(rect)
        return
      }
      this.showEdgeAffordance()
      this.transition({ type: 'scroll' })
      this.render()
    }
  }

  private readonly onResize = (): void => {
    if (this.disposed) return
    // 固定位置在视口变化时重新约束进视口，而不是关闭。
    if (this.positionPinned) {
      this.applyPinnedPosition()
      return
    }
    this.transition({ type: 'resize' })
    this.render()
  }

  private readonly onPointerDown = (event: Event): void => {
    if (this.disposed) return
    if (!(event.target instanceof Node)) return
    if (this.overlayRoot.contains(event.target)) return
    if (this.invalidPinnedContext !== undefined) {
      this.clearPositionPin()
      this.render()
      return
    }
    const { phase } = this.state
    if (phase === 'actions-visible' || phase === 'dispatching' || phase === 'candidate' || phase === 'stable') {
      this.transition({ type: 'outside-pointer' })
      this.render()
    }
  }

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (this.disposed) return
    if (event.key === 'Escape') {
      // 手势进行中：Escape 只取消手势（还原几何/固定状态），不关闭工具条。
      if (this.handleGesture !== undefined) {
        event.preventDefault()
        this.cancelHandleGesture()
        return
      }
      if (this.invalidPinnedContext !== undefined) {
        event.preventDefault()
        this.clearPositionPin()
        this.render()
        return
      }
      const { phase } = this.state
      if (phase === 'surface' || phase === 'actions-visible' || phase === 'dispatching' || phase === 'candidate' || phase === 'stable') {
        event.preventDefault()
        if (this.moreOpen || this.sheetOpen) {
          this.closeNested()
          return
        }
        if (phase === 'surface') {
          this.transition({ type: 'esc' })
          this.render()
          return
        }
        this.transition({ type: 'esc' })
        this.restoreFocus()
        this.render()
      }
      return
    }
    // 默认 Alt+Enter：聚焦/恢复 Actions（宿主/编辑器保留键优先，fail-safe）。
    if (event.altKey && event.key === 'Enter') {
      if (this.options.isShortcutReserved?.('Alt+Enter', event.target instanceof Node ? event.target : null) === true) return
      const { phase } = this.state
      if (phase === 'actions-visible') {
        event.preventDefault()
        this.focusFirstAction()
        return
      }
      if (phase === 'idle') {
        const selection = this.doc.defaultView?.getSelection() ?? null
        if ((selection?.toString() ?? '').trim() !== '') {
          event.preventDefault()
          this.rememberFocus()
          this.settleStableSelection(this.currentContextId ?? `sel-v2-${this.contextSeq}`)
          this.focusFirstAction()
        }
      }
      return
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (event.target instanceof Node && this.toolbar.contains(event.target)) {
        // 聚焦手柄时方向键 = 移动工具条（Shift 加大步长）；其余按钮保持焦点移动。
        if (event.target instanceof Element && event.target.closest('button.sa-pin') !== null) {
          if (this.overlayRoot.style.display === 'none') return
          event.preventDefault()
          const step = event.shiftKey ? HANDLE_MOVE_STEP_SHIFT_PX : HANDLE_MOVE_STEP_PX
          const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
          const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
          this.moveHandleBy(dx, dy)
          return
        }
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault()
          this.moveFocus(event.key === 'ArrowRight' ? 1 : -1)
        }
      }
    }
  }

  // --- 内部：状态与渲染 ---------------------------------------------------

  private transition(event: SelectionInteractionEvent): void {
    // 新选区/外部 context 接管：位置固定展示状态随之重置。
    if (event.type === 'selection-candidate') this.clearPositionPin()
    const visibleContext = this.state.phase === 'actions-visible' || this.state.phase === 'dispatching'
      ? this.state.context
      : undefined
    let next = selectionInteractionReducer(this.state, event)
    if (next === this.state) return
    // 位置固定期间来源失效：保留浮层（禁用内容动作），不执行陈旧 context。
    if (this.positionPinned
      && visibleContext !== undefined
      && (event.type === 'context-invalid' || event.type === 'selection-excluded')) {
      this.invalidPinnedContext = visibleContext
    }
    if (next.phase === 'pinned') this.pinnedContext = next.context
    // dismissed 是瞬态：立即回落 idle，避免陈旧 context 残留。
    if (next.phase === 'dismissed') {
      this.moreOpen = false
      this.sheetOpen = false
      next = selectionInteractionReducer(next, { type: 'reset' })
    }
    this.state = next
    for (const listener of [...this.listeners]) listener()
  }

  private rememberFocus(): void {
    const active = this.doc.activeElement
    // 不依赖 HTMLElement 全局：可聚焦（focus 函数在位）即可记录还原目标。
    if (active !== null
      && typeof (active as { focus?: unknown }).focus === 'function'
      && !this.overlayRoot.contains(active)) {
      this.restoreFocusTo = active as HTMLElement
    }
  }

  private restoreFocus(): void {
    const target = this.restoreFocusTo
    this.restoreFocusTo = undefined
    if (target !== undefined && target.isConnected) target.focus()
  }

  private focusFirstAction(): void {
    this.toolbar.querySelector<HTMLButtonElement>('button[data-action-id]')?.focus()
  }

  private moveFocus(delta: number): void {
    const buttons = [...this.toolbar.querySelectorAll<HTMLButtonElement>('button[data-action-id]')]
    if (buttons.length === 0) return
    const currentIndex = buttons.findIndex(button => button === this.doc.activeElement)
    const next = (currentIndex + delta + buttons.length) % buttons.length
    buttons[next]?.focus()
  }

  private positionToolbar(rect: { top: number; left: number; width: number; height: number } | null): void {
    const width = this.toolbar.offsetWidth || 320
    const height = this.toolbar.offsetHeight || 38
    const viewWidth = this.doc.defaultView?.innerWidth ?? 1024
    const viewHeight = this.doc.defaultView?.innerHeight ?? 768
    if (rect === null) {
      this.overlayRoot.style.left = `${Math.max(8, viewWidth - width - 16)}px`
      this.overlayRoot.style.top = `${Math.max(8, viewHeight - height - 16)}px`
      return
    }
    const centerX = rect.left + rect.width / 2
    const gap = 10
    const above = rect.top - height - gap
    const top = above >= 8 ? above : Math.min(viewHeight - height - 8, rect.top + rect.height + gap)
    this.overlayRoot.style.left = `${Math.max(8, Math.min(centerX - width / 2, viewWidth - width - 8))}px`
    this.overlayRoot.style.top = `${Math.max(8, top)}px`
  }

  // --- 内部：位置固定与手柄拖动 -------------------------------------------

  private clampOverlayPosition(left: number, top: number): { left: number; top: number } {
    const width = this.toolbar.offsetWidth || 320
    const height = this.toolbar.offsetHeight || 38
    const viewWidth = this.doc.defaultView?.innerWidth ?? 1024
    const viewHeight = this.doc.defaultView?.innerHeight ?? 768
    return {
      left: Math.max(8, Math.min(left, viewWidth - width - 8)),
      top: Math.max(8, Math.min(top, viewHeight - height - 8)),
    }
  }

  private applyPinnedPosition(): void {
    if (this.pinnedLeft === undefined || this.pinnedTop === undefined) return
    const clamped = this.clampOverlayPosition(this.pinnedLeft, this.pinnedTop)
    this.pinnedLeft = clamped.left
    this.pinnedTop = clamped.top
    this.overlayRoot.style.left = `${clamped.left}px`
    this.overlayRoot.style.top = `${clamped.top}px`
  }

  private overlayPosition(): { left: number; top: number } {
    const left = parseFloat(this.overlayRoot.style.left)
    const top = parseFloat(this.overlayRoot.style.top)
    return { left: Number.isFinite(left) ? left : 8, top: Number.isFinite(top) ? top : 8 }
  }

  private clearPositionPin(): void {
    this.positionPinned = false
    this.pinnedLeft = undefined
    this.pinnedTop = undefined
    this.invalidPinnedContext = undefined
    this.suppressNextHandleClick = false
  }

  private showFeedback(message: string | undefined): void {
    this.feedback = message
    this.feedbackElement.hidden = message === undefined
    this.feedbackElement.textContent = message ?? ''
  }

  private togglePositionPin(): void {
    // 失效展示中的手柄点击 = 取消固定并关闭该展示。
    if (this.invalidPinnedContext !== undefined) {
      this.clearPositionPin()
      this.render()
      return
    }
    if (this.state.phase !== 'actions-visible') return
    const handleHadFocus = this.doc.activeElement instanceof Element
      && this.doc.activeElement.closest('button.sa-pin') !== null
      && this.toolbar.contains(this.doc.activeElement)
    const text = selectionUiText(this.language())
    if (this.positionPinned) {
      this.positionPinned = false
      this.pinnedLeft = undefined
      this.pinnedTop = undefined
      this.feedback = text.positionUnpinned
    } else {
      const { left, top } = this.overlayPosition()
      this.pinnedLeft = left
      this.pinnedTop = top
      this.positionPinned = true
      this.feedback = text.positionPinned
    }
    this.render()
    // render 重建工具条 innerHTML；键盘路径下手柄焦点原地恢复，方向键可直接续移。
    if (handleHadFocus) this.toolbar.querySelector<HTMLButtonElement>('button.sa-pin')?.focus()
  }

  /** 键盘移动：聚焦手柄时方向键步进（Shift 加速），落点即固定。 */
  private moveHandleBy(dx: number, dy: number): void {
    const current = this.positionPinned && this.pinnedLeft !== undefined && this.pinnedTop !== undefined
      ? { left: this.pinnedLeft, top: this.pinnedTop }
      : this.overlayPosition()
    const clamped = this.clampOverlayPosition(current.left + dx, current.top + dy)
    const becamePinned = !this.positionPinned
    this.positionPinned = true
    this.pinnedLeft = clamped.left
    this.pinnedTop = clamped.top
    this.overlayRoot.style.left = `${clamped.left}px`
    this.overlayRoot.style.top = `${clamped.top}px`
    // 不整树 render：保持手柄焦点，原地同步 pressed/label。
    const handle = this.toolbar.querySelector('button.sa-pin')
    if (handle !== null) {
      const text = selectionUiText(this.language())
      handle.setAttribute('aria-pressed', 'true')
      handle.setAttribute('aria-label', text.unpinPosition)
      handle.setAttribute('title', text.unpinPosition)
    }
    if (becamePinned) this.showFeedback(selectionUiText(this.language()).positionPinned)
  }

  private readonly onHandlePointerDown = (event: Event): void => {
    if (this.disposed) return
    const pointer = event as PointerEvent
    if (pointer.button !== 0) return
    if (!(pointer.target instanceof Element)) return
    const handle = pointer.target.closest('button.sa-pin')
    if (handle === null || !this.toolbar.contains(handle)) return
    // 窄屏/coarse sheet 打开时手柄让位给 sheet，不启动拖动。
    if (this.isNarrowOrCoarse() && this.sheetOpen) return
    if (this.overlayRoot.style.display === 'none') return
    this.suppressNextHandleClick = false
    const { left, top } = this.overlayPosition()
    this.handleGesture = {
      pointerId: pointer.pointerId,
      startClientX: pointer.clientX,
      startClientY: pointer.clientY,
      origLeft: left,
      origTop: top,
      origPinned: this.positionPinned,
      phase: 'pending',
    }
    this.gestureHandle = handle as HTMLButtonElement
  }

  private readonly onWindowPointerMove = (event: Event): void => {
    const gesture = this.handleGesture
    if (gesture === undefined) return
    const pointer = event as PointerEvent
    if (pointer.pointerId !== gesture.pointerId) return
    const dx = pointer.clientX - gesture.startClientX
    const dy = pointer.clientY - gesture.startClientY
    if (gesture.phase === 'pending') {
      if (Math.hypot(dx, dy) <= HANDLE_DRAG_THRESHOLD_PX) return
      gesture.phase = 'dragging'
      // jsdom/旧引擎可能无 pointer capture；有则在超阈值后接管后续指针事件。
      try {
        this.gestureHandle?.setPointerCapture?.(gesture.pointerId)
      } catch {
        // 合成指针不在活动指针表中：忽略，window 级监听已足够。
      }
    }
    const clamped = this.clampOverlayPosition(gesture.origLeft + dx, gesture.origTop + dy)
    this.overlayRoot.style.left = `${clamped.left}px`
    this.overlayRoot.style.top = `${clamped.top}px`
    if (event.cancelable) event.preventDefault()
  }

  private readonly onWindowPointerUp = (event: Event): void => {
    const gesture = this.handleGesture
    if (gesture === undefined) return
    const pointer = event as PointerEvent
    if (pointer.pointerId !== gesture.pointerId) return
    if (gesture.phase !== 'dragging') {
      // 阈值内释放 = 单击：交给随后的 click 走 togglePositionPin。
      this.handleGesture = undefined
      this.gestureHandle = undefined
      return
    }
    this.handleGesture = undefined
    this.releaseHandleCapture(gesture.pointerId)
    const { left, top } = this.overlayPosition()
    this.pinnedLeft = left
    this.pinnedTop = top
    this.positionPinned = true
    this.suppressNextHandleClick = true
    this.syncHandlePressed()
    this.showFeedback(selectionUiText(this.language()).dragMoved)
  }

  private readonly onWindowPointerCancel = (event: Event): void => {
    const gesture = this.handleGesture
    if (gesture === undefined) return
    if ((event as PointerEvent).pointerId !== gesture.pointerId) return
    this.cancelHandleGesture()
  }

  private readonly onHandleLostCapture = (event: Event): void => {
    if (this.handleGesture === undefined) return
    if ((event as PointerEvent).pointerId !== this.handleGesture.pointerId) return
    this.cancelHandleGesture()
  }

  private readonly onWindowBlur = (): void => {
    if (this.handleGesture !== undefined) this.cancelHandleGesture()
  }

  private cancelHandleGesture(): void {
    const gesture = this.handleGesture
    if (gesture === undefined) return
    this.handleGesture = undefined
    this.releaseHandleCapture(gesture.pointerId)
    this.overlayRoot.style.left = `${gesture.origLeft}px`
    this.overlayRoot.style.top = `${gesture.origTop}px`
    this.positionPinned = gesture.origPinned
    if (gesture.origPinned) {
      this.pinnedLeft = gesture.origLeft
      this.pinnedTop = gesture.origTop
    }
    this.suppressNextHandleClick = true
    this.showFeedback(selectionUiText(this.language()).dragCancelled)
  }

  private releaseHandleCapture(pointerId: number): void {
    const handle = this.gestureHandle
    this.gestureHandle = undefined
    if (handle === undefined) return
    try {
      if (typeof handle.releasePointerCapture === 'function' && handle.hasPointerCapture?.(pointerId) === true) {
        handle.releasePointerCapture(pointerId)
      }
    } catch {
      // jsdom 无真实捕获状态。
    }
  }

  /** 拖放/键盘移动后原地同步手柄 pressed 状态与文案（不打断焦点）。 */
  private syncHandlePressed(): void {
    const handle = this.toolbar.querySelector('button.sa-pin')
    if (handle === null) return
    const text = selectionUiText(this.language())
    const label = this.positionPinned ? text.unpinPosition : text.pinPosition
    handle.setAttribute('aria-pressed', String(this.positionPinned))
    handle.setAttribute('aria-label', label)
    handle.setAttribute('title', label)
  }

  private showEdgeAffordance(): void {
    const rect = selectionRect(this.doc.defaultView?.getSelection() ?? null)
    const side = rect !== null && rect.top < 0 ? 'top' : 'bottom'
    const edge = this.doc.createElement('div')
    edge.className = 'sa-edge'
    edge.textContent = '⌖'
    edge.setAttribute('aria-hidden', 'true')
    edge.style.left = '12px'
    if (side === 'top') edge.style.top = '12px'
    else edge.style.bottom = '12px'
    this.overlayRoot.append(edge)
    if (this.edgeTimer !== undefined) clearTimeout(this.edgeTimer)
    this.edgeTimer = setTimeout(() => edge.remove(), 900)
  }

  private isNarrowOrCoarse(): boolean {
    if (this.options.isCoarsePointer?.() === true) return true
    const width = this.options.viewportWidth?.() ?? this.doc.defaultView?.innerWidth ?? 1024
    return width < SELECTION_NARROW_VIEWPORT_PX
  }

  private language(): string {
    return this.options.language?.() ?? this.doc.defaultView?.navigator.language ?? 'en'
  }

  private render(): void {
    if (this.disposed) return
    const { phase } = this.state
    if (phase !== 'actions-visible') {
      // 固定期间来源失效：浮层保留为禁用展示，由用户关闭/取消固定/重选清除。
      if (this.invalidPinnedContext !== undefined && this.positionPinned) {
        this.renderPinnedInvalid(this.invalidPinnedContext)
        return
      }
      // surface 阶段由 owner surface（Composer/批注/审批）接管屏幕。
      this.overlayRoot.style.display = 'none'
      this.moreOpen = false
      this.sheetOpen = false
      return
    }
    const { context } = this.state
    const resolved = this.registry.resolve(context, { customOrder: BUILTIN_CONTEXT_ORDERS[context.kind] })
    const narrow = this.isNarrowOrCoarse()
    this.overlayRoot.style.display = 'block'
    this.renderToolbar(resolved, narrow, context)
    this.feedbackElement.hidden = this.feedback === undefined
    this.feedbackElement.textContent = this.feedback ?? ''
    if (this.positionPinned && this.pinnedLeft !== undefined && this.pinnedTop !== undefined) {
      this.applyPinnedPosition()
    } else {
      this.positionToolbar(selectionRect(this.doc.defaultView?.getSelection() ?? null))
    }
    if (narrow) {
      this.toolbar.style.display = this.sheetOpen ? 'none' : 'flex'
      this.sheetBackdrop.style.display = this.sheetOpen ? 'block' : 'none'
      this.morePanel.hidden = true
      this.sheet.innerHTML = ''
      if (this.sheetOpen) this.renderActionList(this.sheet, resolved, true, context)
    } else {
      this.toolbar.style.display = 'flex'
      this.sheetBackdrop.style.display = 'none'
      this.sheetOpen = false
      this.morePanel.hidden = !this.moreOpen
      if (this.moreOpen) {
        this.morePanel.innerHTML = ''
        this.renderActionList(this.morePanel, resolved, false, context)
      }
    }
  }

  private renderToolbar(resolved: ResolvedActions, narrow: boolean, context: SelectionContextV2): void {
    this.toolbar.innerHTML = ''
    const language = this.language()
    const text = selectionUiText(language)
    if (narrow) {
      const entry = this.doc.createElement('button')
      entry.type = 'button'
      entry.className = 'sa-btn'
      entry.dataset.role = 'sheet-entry'
      entry.textContent = text.actions
      entry.setAttribute('aria-haspopup', 'dialog')
      entry.setAttribute('aria-expanded', String(this.sheetOpen))
      this.toolbar.append(entry)
      return
    }
    const flavor = selectionFlavor(context)
    const contextBadge = this.doc.createElement('span')
    contextBadge.className = 'sa-context'
    contextBadge.textContent = text.context[flavor]
    contextBadge.title = context.anchor?.quotePreview ?? text.selected
    this.toolbar.append(contextBadge)
    if (resolved.primary !== undefined) this.toolbar.append(this.actionButton(resolved.primary, context, language))
    for (const secondary of resolved.secondary) this.toolbar.append(this.actionButton(secondary, context, language))
    if (resolved.more.length > 0) {
      const more = this.doc.createElement('button')
      more.type = 'button'
      more.className = 'sa-btn'
      more.textContent = `${text.more} (${resolved.more.length})`
      more.setAttribute('aria-expanded', String(this.moreOpen))
      more.setAttribute('aria-controls', 'sa-more-panel')
      this.morePanel.id = 'sa-more-panel'
      more.dataset.role = 'more-toggle'
      this.toolbar.append(more)
    }
    const pin = this.pinHandleButton()
    this.toolbar.append(pin)
  }

  /** 手柄：位置固定切换 + 拖动起点；语义 SVG 图标 + aria-pressed。 */
  private pinHandleButton(): HTMLButtonElement {
    const text = selectionUiText(this.language())
    const pin = this.doc.createElement('button')
    pin.type = 'button'
    pin.className = 'sa-btn sa-pin'
    pin.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/></svg>'
    const label = this.positionPinned ? text.unpinPosition : text.pinPosition
    pin.title = label
    pin.setAttribute('aria-label', label)
    pin.setAttribute('aria-pressed', String(this.positionPinned))
    pin.dataset.role = 'pin'
    return pin
  }

  /** 固定期间来源失效的展示：内容动作禁用、原因可见、手柄仍可取消固定/关闭。 */
  private renderPinnedInvalid(context: SelectionContextV2): void {
    const resolved = this.registry.resolve(context, { customOrder: BUILTIN_CONTEXT_ORDERS[context.kind] })
    const narrow = this.isNarrowOrCoarse()
    this.overlayRoot.style.display = 'block'
    this.moreOpen = false
    this.sheetOpen = false
    this.renderToolbar(resolved, narrow, context)
    if (narrow && this.toolbar.querySelector('button.sa-pin') === null) this.toolbar.append(this.pinHandleButton())
    for (const button of this.toolbar.querySelectorAll<HTMLButtonElement>('button')) {
      if (button.dataset.role !== 'pin') button.disabled = true
    }
    this.toolbar.style.display = 'flex'
    this.sheetBackdrop.style.display = 'none'
    this.morePanel.hidden = true
    this.feedbackElement.hidden = false
    this.feedbackElement.textContent = selectionUiText(this.language()).sourceInvalid
    this.applyPinnedPosition()
  }

  private renderActionList(target: HTMLElement, resolved: ResolvedActions, sheet: boolean, context: SelectionContextV2): void {
    // 桌面 More 面板只承载 More 子集（同一动作不得同时出现在主槽位与 More）；
    // 触控 Bottom Sheet 替换整个工具条，承载全部可用动作。
    const actions: readonly ActionViewLike[] = sheet
      ? [...(resolved.primary !== undefined ? [resolved.primary] : []), ...resolved.secondary, ...resolved.more]
      : resolved.more
    const language = this.language()
    const quote = context.anchor?.quotePreview
    if (quote !== undefined && quote !== '') {
      const text = selectionUiText(language)
      const selection = this.doc.createElement('div')
      selection.className = 'sa-selection'
      const title = this.doc.createElement('strong')
      title.textContent = `${text.selected} · ${text.context[selectionFlavor(context)]}`
      const preview = this.doc.createElement('span')
      preview.textContent = quote
      selection.append(title, preview)
      target.append(selection)
    }
    for (const view of actions) {
      target.append(this.actionButton(view, context, language))
      if (view.disabled && view.disabledReason !== undefined) {
        const reason = this.doc.createElement('span')
        reason.className = 'sa-reason'
        reason.textContent = labelFor(view.disabledReason, language)
        target.append(reason)
      }
    }
  }

  private actionButton(view: ActionViewLike, context: SelectionContextV2, language: string): HTMLButtonElement {
    const button = this.doc.createElement('button')
    button.type = 'button'
    button.className = `sa-btn${view.slot === 'primary' ? ' sa-btn--primary' : ''}`
    const label = actionLabel(view, context, language)
    button.textContent = label
    button.setAttribute('aria-label', label)
    button.disabled = view.disabled
    if (view.disabled && view.disabledReason !== undefined) button.title = labelFor(view.disabledReason, language)
    button.dataset.actionId = this.registry.resolveCanonical(view.descriptor.id)
    return button
  }

  /** 显式动作 → typed intent → owner dispatch（本地 copy 即时完成）。 */
  activateAction(canonicalId: string, requestedId: string, context: SelectionContextV2 | undefined): void {
    if (context === undefined) return
    // 固定展示中的失效来源不得再 dispatch 陈旧 context。
    if (this.invalidPinnedContext !== undefined) return
    const descriptor = this.registry.lookup(canonicalId)
    if (descriptor === undefined) return
    const intent: SelectionActionIntentV2 = {
      contextId: context.contextId,
      actionId: canonicalId,
      ...(requestedId !== canonicalId ? { aliasOf: requestedId } : {}),
      owner: descriptor.owner,
      approvalPolicy: descriptor.danger === 'preview-first' ? 'preview-first' : descriptor.owner === 'client' ? 'local' : 'auto-apply',
      ...(context.anchor === undefined ? {} : { anchor: context.anchor }),
    }
    this.transition({ type: 'action-dispatch', actionId: canonicalId })
    let surface: IntentSurface | undefined
    for (const handler of [...this.intentHandlers]) {
      const result = handler(intent, context)
      if (result !== undefined) {
        surface = result.surface
        break
      }
    }
    if (surface === undefined && descriptor.presentation === 'local') surface = 'local'
    // 内建本地动作：copy-quote 直接写剪贴板（owner=client，无需外部 handler）。
    if (surface === 'local' && canonicalId === 'dsh:copy-quote' && context.anchor?.quotePreview !== undefined) {
      void this.doc.defaultView?.navigator.clipboard?.writeText(context.anchor.quotePreview)
    }
    if (surface === undefined) {
      // 无 owner handler：动作本不应可用；fail-closed 直接 dismiss。
      this.transition({ type: 'dispatch-settled' })
    } else if (surface === 'local') {
      this.transition({ type: 'dispatch-settled', local: true })
    } else {
      this.transition({ type: 'dispatch-settled', surface })
    }
    this.render()
  }

  private closeNested(): void {
    if (this.sheetOpen) {
      this.sheetOpen = false
      this.render()
      return
    }
    if (this.moreOpen) {
      this.moreOpen = false
      this.render()
      return
    }
    this.transition({ type: 'esc' })
    this.restoreFocus()
    this.render()
  }
}

function selectionRect(selection: Selection | null): { top: number; left: number; width: number; height: number } | null {
  if (selection === null || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (typeof range.getBoundingClientRect !== 'function') return null
  const rect = range.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return null
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
}

// ---------------------------------------------------------------------------
// 页面级 singleton（refcount）
// ---------------------------------------------------------------------------

interface SharedLayer {
  readonly layer: SelectionInteractionLayer
  refs: number
}

let shared: SharedLayer | undefined

/** 挂载共享交互层；首个调用创建，最后一个 detach 释放（HMR 对称）。 */
export function attachSharedSelectionInteraction(doc: Document, options: SelectionInteractionLayerOptions = {}): () => void {
  if (shared === undefined) {
    shared = { layer: new SelectionInteractionLayer(doc, options), refs: 0 }
  }
  shared.refs += 1
  const current = shared
  return () => {
    if (current.refs <= 0) return
    current.refs -= 1
    if (current.refs === 0 && current === shared) {
      current.layer.dispose()
      shared = undefined
    }
  }
}

/** 获取当前共享层（未挂载返回 undefined；扩展注册动作用）。 */
export function getSharedSelectionInteraction(): SelectionInteractionLayer | undefined {
  return shared?.layer
}

/** 测试专用：强制丢弃共享层（忽略 refcount），保证用例间零残留。 */
export function resetSharedSelectionInteractionForTests(): void {
  shared?.layer.dispose()
  shared = undefined
}
