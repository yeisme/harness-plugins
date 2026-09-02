/**
 * 全局 singleton Selection Interaction Layer。
 *
 * 页面级唯一实例（refcount 生命周期）：监听 `selectionchange` → 120ms 稳定 →
 * normalizer → Actions(1+2+More)/Bottom Sheet；显式动作经 typed intent 交给
 * owner adapter；Esc 逐层退出并还原焦点；Pin 是唯一持久入口；dispose/HMR 对称
 * 释放 listener/timer/style/overlay。Pane 只提交 context（publishExternalContext）
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
[data-dsh-selection-actions]{position:fixed;z-index:2147483000;font-size:var(--vk-font-small)}
[data-dsh-selection-actions] .sa-toolbar{display:flex;align-items:center;gap:2px;padding:2px 4px;background:var(--vk-bg-elevated);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);box-shadow:0 4px 16px color-mix(in srgb,var(--vk-bg-base) 60%,transparent)}
[data-dsh-selection-actions] .sa-btn{min-height:26px;padding:0 8px;color:var(--vk-text-primary);font:inherit;background:transparent;border:0;border-radius:var(--vk-radius-sm);cursor:pointer}
[data-dsh-selection-actions] .sa-btn:hover:not(:disabled){background:var(--vk-fill-hover)}
[data-dsh-selection-actions] .sa-btn:focus-visible{outline:2px solid var(--vk-border-focus);outline-offset:1px}
[data-dsh-selection-actions] .sa-btn:disabled{color:var(--vk-text-tertiary);cursor:not-allowed}
[data-dsh-selection-actions] .sa-btn--primary{color:var(--vk-accent);font-weight:650}
[data-dsh-selection-actions] .sa-more{display:none;position:absolute;top:calc(100% + 4px);min-width:180px;padding:4px;background:var(--vk-bg-elevated);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}
[data-dsh-selection-actions] .sa-more:not([hidden]){display:flex;flex-direction:column}
[data-dsh-selection-actions] .sa-more .sa-btn{justify-content:flex-start;min-height:26px;text-align:left}
[data-dsh-selection-actions] .sa-reason{padding:0 8px 4px;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
[data-dsh-selection-actions] .sa-sheet-backdrop{position:fixed;inset:0;background:color-mix(in srgb,var(--vk-bg-base) 55%,transparent)}
[data-dsh-selection-actions] .sa-sheet{position:fixed;left:0;right:0;bottom:0;display:flex;flex-direction:column;gap:2px;padding:8px 12px 16px;background:var(--vk-bg-elevated);border-top:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-xl) var(--vk-radius-xl) 0 0}
[data-dsh-selection-actions] .sa-sheet .sa-btn{min-height:44px;font-size:var(--vk-font-body)}
[data-dsh-selection-actions] .sa-sheet .sa-reason{padding:0 4px}
[data-dsh-selection-actions] .sa-pin[aria-pressed='true']{border:1px solid var(--vk-accent)}
[data-dsh-selection-actions] .sa-edge{position:fixed;padding:2px 8px;color:var(--vk-text-secondary);font-size:var(--vk-font-small);background:var(--vk-bg-elevated);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md);opacity:.9}
@media (prefers-reduced-motion: reduce){[data-dsh-selection-actions] *{transition:none!important;animation:none!important}}
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
  private readonly language: string

  constructor(doc: Document, options: SelectionInteractionLayerOptions = {}) {
    this.doc = doc
    this.options = options
    this.language = doc.defaultView?.navigator.language ?? 'en'
    injectActionsStyles(doc)
    this.overlayRoot = doc.createElement('div')
    this.overlayRoot.setAttribute('data-dsh-selection-actions', '')
    this.overlayRoot.setAttribute('data-dsh-selection-surface', '')
    this.overlayRoot.style.display = 'none'
    this.toolbar = doc.createElement('div')
    this.toolbar.className = 'sa-toolbar'
    this.toolbar.setAttribute('role', 'toolbar')
    this.toolbar.setAttribute('aria-label', 'selection actions')
    this.morePanel = doc.createElement('div')
    this.morePanel.className = 'sa-more'
    this.morePanel.setAttribute('role', 'menu')
    this.morePanel.setAttribute('aria-label', 'more actions')
    this.morePanel.hidden = true
    this.sheetBackdrop = doc.createElement('div')
    this.sheetBackdrop.className = 'sa-sheet-backdrop'
    this.sheetBackdrop.style.display = 'none'
    this.sheet = doc.createElement('div')
    this.sheet.className = 'sa-sheet'
    this.sheet.setAttribute('role', 'dialog')
    this.sheet.setAttribute('aria-label', 'selection actions')
    this.sheetBackdrop.append(this.sheet)
    this.overlayRoot.append(this.toolbar, this.morePanel, this.sheetBackdrop)
    doc.body.append(this.overlayRoot)

    registerBuiltinSelectionActions(this.registry)
    this.registry.subscribe(() => this.render())

    this.doc.addEventListener('selectionchange', this.onSelectionChange)
    this.doc.addEventListener('scroll', this.onScroll, { capture: true, passive: true })
    this.doc.defaultView?.addEventListener('resize', this.onResize)
    this.doc.addEventListener('keydown', this.onKeydown, true)
    this.doc.addEventListener('pointerdown', this.onPointerDown, true)
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

  dismiss(): void {
    this.transition({ type: 'dismiss' })
    this.restoreFocus()
    this.render()
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
    this.transition({ type: 'resize' })
    this.render()
  }

  private readonly onPointerDown = (event: Event): void => {
    if (this.disposed) return
    if (!(event.target instanceof Node)) return
    if (this.overlayRoot.contains(event.target)) return
    const { phase } = this.state
    if (phase === 'actions-visible' || phase === 'dispatching' || phase === 'candidate' || phase === 'stable') {
      this.transition({ type: 'outside-pointer' })
      this.render()
    }
  }

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (this.disposed) return
    if (event.key === 'Escape') {
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
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      if (event.target instanceof Node && this.toolbar.contains(event.target)) {
        event.preventDefault()
        this.moveFocus(event.key === 'ArrowRight' ? 1 : -1)
      }
    }
  }

  // --- 内部：状态与渲染 ---------------------------------------------------

  private transition(event: SelectionInteractionEvent): void {
    let next = selectionInteractionReducer(this.state, event)
    if (next === this.state) return
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
    if (rect === null) return
    const width = this.toolbar.offsetWidth || 320
    const centerX = rect.left + rect.width / 2
    const viewWidth = this.doc.defaultView?.innerWidth ?? 1024
    this.overlayRoot.style.left = `${Math.max(8, Math.min(centerX - width / 2, viewWidth - width - 8))}px`
    this.overlayRoot.style.top = `${Math.max(8, rect.top - 40)}px`
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

  private render(): void {
    if (this.disposed) return
    const { phase } = this.state
    if (phase !== 'actions-visible') {
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
    this.renderToolbar(resolved, narrow)
    if (narrow) {
      this.toolbar.style.display = this.sheetOpen ? 'none' : 'flex'
      this.sheetBackdrop.style.display = this.sheetOpen ? 'block' : 'none'
      this.morePanel.hidden = true
      this.sheet.innerHTML = ''
      if (this.sheetOpen) this.renderActionList(this.sheet, resolved, true)
    } else {
      this.toolbar.style.display = 'flex'
      this.sheetBackdrop.style.display = 'none'
      this.sheetOpen = false
      this.morePanel.hidden = !this.moreOpen
      if (this.moreOpen) {
        this.morePanel.innerHTML = ''
        this.renderActionList(this.morePanel, resolved, false)
      }
    }
  }

  private renderToolbar(resolved: ResolvedActions, narrow: boolean): void {
    this.toolbar.innerHTML = ''
    if (narrow) {
      const entry = this.doc.createElement('button')
      entry.type = 'button'
      entry.className = 'sa-btn'
      entry.textContent = 'Actions'
      entry.setAttribute('aria-haspopup', 'dialog')
      entry.setAttribute('aria-expanded', String(this.sheetOpen))
      entry.addEventListener('click', () => {
        this.sheetOpen = true
        this.render()
      })
      this.toolbar.append(entry)
      return
    }
    if (resolved.primary !== undefined) this.toolbar.append(this.actionButton(resolved.primary))
    for (const secondary of resolved.secondary) this.toolbar.append(this.actionButton(secondary))
    if (resolved.more.length > 0) {
      const more = this.doc.createElement('button')
      more.type = 'button'
      more.className = 'sa-btn'
      more.textContent = `More (${resolved.more.length})`
      more.setAttribute('aria-expanded', String(this.moreOpen))
      more.setAttribute('aria-controls', 'sa-more-panel')
      this.morePanel.id = 'sa-more-panel'
      more.addEventListener('click', () => {
        this.moreOpen = !this.moreOpen
        this.render()
      })
      this.toolbar.append(more)
    }
    const pin = this.doc.createElement('button')
    pin.type = 'button'
    pin.className = 'sa-btn sa-pin'
    pin.textContent = '⌷'
    pin.title = 'Pin'
    pin.setAttribute('aria-label', 'Pin selection actions')
    pin.addEventListener('click', () => {
      this.transition({ type: 'pin' })
      this.render()
    })
    this.toolbar.append(pin)
  }

  private renderActionList(target: HTMLElement, resolved: ResolvedActions, sheet: boolean): void {
    // 桌面 More 面板只承载 More 子集（同一动作不得同时出现在主槽位与 More）；
    // 触控 Bottom Sheet 替换整个工具条，承载全部可用动作。
    const actions: readonly ActionViewLike[] = sheet
      ? [...(resolved.primary !== undefined ? [resolved.primary] : []), ...resolved.secondary, ...resolved.more]
      : resolved.more
    for (const view of actions) {
      target.append(this.actionButton(view))
      if (view.disabled && view.disabledReason !== undefined) {
        const reason = this.doc.createElement('span')
        reason.className = 'sa-reason'
        reason.textContent = labelFor(view.disabledReason, this.language)
        target.append(reason)
      }
    }
  }

  private actionButton(view: ActionViewLike): HTMLButtonElement {
    const button = this.doc.createElement('button')
    button.type = 'button'
    button.className = `sa-btn${view.slot === 'primary' ? ' sa-btn--primary' : ''}`
    const label = labelFor(view.descriptor.label, this.language)
    button.textContent = label
    button.setAttribute('aria-label', label)
    button.disabled = view.disabled
    const canonicalId = this.registry.resolveCanonical(view.descriptor.id)
    button.dataset.actionId = canonicalId
    button.addEventListener('click', () => {
      this.activateAction(canonicalId, view.descriptor.id, this.state.phase === 'actions-visible' ? this.state.context : undefined)
    })
    return button
  }

  /** 显式动作 → typed intent → owner dispatch（本地 copy 即时完成）。 */
  activateAction(canonicalId: string, requestedId: string, context: SelectionContextV2 | undefined): void {
    if (context === undefined) return
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
