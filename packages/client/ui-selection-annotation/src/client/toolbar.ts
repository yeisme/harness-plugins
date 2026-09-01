/**
 * 浮动选区操作条：选区上方 8px、空间不足自动翻转、不遮挡选区、键盘可
 * 导航、Esc 关闭、窄面板降级为图标、选区滚出视口收缩为边缘锚点。
 *
 * @module @yeisme/dsh-client-ui-selection-annotation/client
 */

import type { SelectionAnnotationLabels } from './locales.ts'

export const TOOLBAR_GAP_PX = 8
export const TOOLBAR_EDGE_OFFSET_PX = 12

export type ToolbarAction = 'ask' | 'comment' | 'edit' | 'agent-edit' | 'copy-quote' | 'add-to-batch' | 'open-full'

export interface ViewportSize {
  readonly width: number
  readonly height: number
}

export interface PlacementInput {
  readonly selection: { readonly top: number; readonly left: number; readonly width: number; readonly height: number }
  readonly viewport: ViewportSize
  readonly toolbar: { readonly width: number; readonly height: number }
}

export interface ToolbarPlacement {
  readonly x: number
  readonly y: number
  readonly flipped: boolean
}

/**
 * Pure placement: above the selection with an 8px gap, flipping below when
 * there is not enough room, clamped horizontally so the bar stays visible.
 */
export function placeToolbar(input: PlacementInput): ToolbarPlacement {
  const { selection, viewport, toolbar } = input
  const centerX = selection.left + selection.width / 2
  const aboveY = selection.top - toolbar.height - TOOLBAR_GAP_PX
  const flipped = aboveY < 0
  const y = flipped ? selection.top + selection.height + TOOLBAR_GAP_PX : aboveY
  const x = Math.min(
    Math.max(centerX - toolbar.width / 2, TOOLBAR_EDGE_OFFSET_PX),
    Math.max(viewport.width - toolbar.width - TOOLBAR_EDGE_OFFSET_PX, TOOLBAR_EDGE_OFFSET_PX),
  )
  return { x, y: Math.max(y, 0), flipped }
}

/** When a selection scrolls out of the viewport the bar collapses to an edge anchor. */
export function edgeAnchorSide(selection: { top: number; height: number }, viewport: ViewportSize): 'top' | 'bottom' | null {
  const above = selection.top + selection.height
  const below = selection.top
  if (above < 0) return 'top'
  if (below > viewport.height) return 'bottom'
  return null
}

export interface SelectionToolbarOptions {
  readonly labels: SelectionAnnotationLabels
  readonly onAction: (action: ToolbarAction) => void
  readonly root?: Document
  /** Narrow panes degrade text buttons to icon buttons. */
  readonly narrow?: boolean
  readonly container?: HTMLElement
}

const TOOLBAR_CLASS = 'dsh-selection-toolbar'
const TOOLBAR_NARROW_CLASS = 'dsh-selection-toolbar--narrow'
const TOOLBAR_EDGE_CLASS = 'dsh-selection-toolbar--edge'

interface ToolbarButton {
  readonly element: HTMLButtonElement
  readonly onClick: () => void
}

/**
 * DOM controller for the floating toolbar. Renders buttons, tracks focus for
 * keyboard navigation and repositions on demand.
 */
export class SelectionToolbarController {
  private readonly element: HTMLElement
  private readonly buttons: ToolbarButton[] = []
  private readonly options: SelectionToolbarOptions
  private readonly labels: SelectionAnnotationLabels
  private readonly keydownHandler: (event: KeyboardEvent) => void
  private disposed = false
  private focusIndex = -1

  constructor(options: SelectionToolbarOptions) {
    this.options = options
    this.labels = options.labels
    const doc = options.root ?? document
    this.element = doc.createElement('div')
    this.element.className = TOOLBAR_CLASS
    this.element.setAttribute('role', 'toolbar')
    this.element.setAttribute('aria-label', this.labels['toolbar.ask'])
    this.element.style.position = 'fixed'
    this.element.style.zIndex = '2147483000'
    this.element.style.display = 'none'

    const actions: { action: ToolbarAction; label: string; icon: string }[] = [
      { action: 'ask', label: this.labels['toolbar.ask'], icon: '?' },
      { action: 'comment', label: this.labels['toolbar.comment'], icon: 'C' },
      { action: 'edit', label: this.labels['toolbar.edit'], icon: 'E' },
      { action: 'agent-edit', label: this.labels['toolbar.agentEdit'], icon: 'A' },
      { action: 'copy-quote', label: this.labels['toolbar.copyQuote'], icon: '"' },
      { action: 'add-to-batch', label: this.labels['toolbar.addToBatch'], icon: '+' },
      { action: 'open-full', label: this.labels['toolbar.openFull'], icon: '↗' },
    ]
    for (const entry of actions) {
      const button = doc.createElement('button')
      button.type = 'button'
      button.dataset.action = entry.action
      button.dataset.icon = entry.icon
      button.dataset.label = entry.label
      button.title = entry.label
      button.setAttribute('aria-label', entry.label)
      button.textContent = options.narrow === true ? entry.icon : entry.label
      // G21 dispose 收口：click 监听具名收纳，dispose 时显式摘除。
      const onClick = (): void => { this.options.onAction(entry.action) }
      button.addEventListener('click', onClick)
      this.element.append(button)
      this.buttons.push({ element: button, onClick })
    }

    this.keydownHandler = event => this.handleKeydown(event)
    doc.addEventListener('keydown', this.keydownHandler, true)
    ;(options.container ?? doc.body).append(this.element)
    if (options.narrow === true) this.setNarrow(true)
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (this.disposed || this.element.style.display === 'none') return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      this.hide()
      return
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const target = event.target
      if (this.focusIndex < 0 && !(target instanceof Node && this.element.contains(target))) return
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      this.moveFocus(delta)
      return
    }
    if (event.target instanceof Node && this.element.contains(event.target) && event.key === 'Tab') {
      event.preventDefault()
      this.moveFocus(event.shiftKey ? -1 : 1)
    }
  }

  moveFocus(delta: number): HTMLButtonElement | undefined {
    if (this.buttons.length === 0) return undefined
    this.focusIndex = (this.focusIndex + delta + this.buttons.length) % this.buttons.length
    const button = this.buttons[this.focusIndex]?.element
    button?.focus()
    return button
  }

  /** Show at a selection rect; flips automatically when the top has no room. */
  show(selectionRect: { top: number; left: number; width: number; height: number }, viewport: ViewportSize): ToolbarPlacement {
    if (this.disposed) return { x: 0, y: 0, flipped: false }
    this.element.classList.remove(TOOLBAR_EDGE_CLASS)
    const size = {
      width: this.element.offsetWidth || 320,
      height: this.element.offsetHeight || 36,
    }
    const placement = placeToolbar({ selection: selectionRect, viewport, toolbar: size })
    this.element.style.display = 'flex'
    this.element.style.left = `${placement.x}px`
    this.element.style.top = `${placement.y}px`
    return placement
  }

  /** Collapse to a viewport edge anchor instead of disappearing. */
  collapseToEdge(side: 'top' | 'bottom'): void {
    if (this.disposed) return
    this.element.classList.add(TOOLBAR_EDGE_CLASS)
    this.element.style.display = 'flex'
    this.element.style.left = `${TOOLBAR_EDGE_OFFSET_PX}px`
    this.element.style.top = side === 'top' ? `${TOOLBAR_EDGE_OFFSET_PX}px` : ''
    if (side === 'bottom') this.element.style.bottom = `${TOOLBAR_EDGE_OFFSET_PX}px`
    else this.element.style.bottom = ''
  }

  /** Narrow panes degrade text buttons to icon buttons; aria-labels stay. */
  setNarrow(narrow: boolean): void {
    this.element.classList.toggle(TOOLBAR_NARROW_CLASS, narrow)
    for (const { element } of this.buttons) {
      element.textContent = narrow ? element.dataset.icon ?? element.textContent : element.dataset.label ?? element.textContent
    }
  }

  hide(): void {
    this.element.style.display = 'none'
    this.focusIndex = -1
  }

  isHidden(): boolean {
    return this.element.style.display === 'none'
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const doc = this.options.root ?? document
    for (const { element, onClick } of this.buttons) element.removeEventListener('click', onClick)
    doc.removeEventListener('keydown', this.keydownHandler, true)
    this.element.remove()
  }
}
