// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  attachSharedSelectionInteraction,
  getSharedSelectionInteraction,
  resetSharedSelectionInteractionForTests,
  SelectionInteractionLayer,
  SELECTION_ACTIONS_STYLE_ID,
} from '../src/selection/layer.ts'
import { SELECTION_CAPABILITY_BATCH, SELECTION_CAPABILITY_CONVERSATION, SELECTION_CAPABILITY_EDIT, SELECTION_CAPABILITY_REFERENCE, SELECTION_CAPABILITY_REFERENCE_ACTIVATE, SELECTION_CAPABILITY_TARGET_CHOOSE, SELECTION_CAPABILITY_TEXT_QUOTE } from '../src/selection/builtin-actions.ts'
import type { SelectionInteractionEvent } from '../src/selection/reducer.ts'

const ALL_CAPS = [SELECTION_CAPABILITY_CONVERSATION, SELECTION_CAPABILITY_REFERENCE, SELECTION_CAPABILITY_REFERENCE_ACTIVATE, SELECTION_CAPABILITY_TEXT_QUOTE, SELECTION_CAPABILITY_TARGET_CHOOSE, SELECTION_CAPABILITY_EDIT, SELECTION_CAPABILITY_BATCH]

let layer: SelectionInteractionLayer
let detach: () => void

function overlay(): HTMLElement {
  return document.querySelector('[data-dsh-selection-actions]') as HTMLElement
}

function visible(): boolean {
  return overlay()?.style.display !== 'none' && overlay() !== null
}

beforeEach(() => {
  vi.useFakeTimers()
  resetSharedSelectionInteractionForTests()
  document.body.innerHTML = ''
  detach = attachSharedSelectionInteraction(document, { viewportWidth: () => 1280 })
  layer = getSharedSelectionInteraction()!
})

afterEach(() => {
  resetSharedSelectionInteractionForTests()
  vi.useRealTimers()
})

function selectText(container: HTMLElement, text: string): void {
  container.textContent = text
  document.body.append(container)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  const range = document.createRange()
  range.selectNodeContents(container)
  selection?.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
}

describe('singleton lifecycle (2.1/2.6)', () => {
  it('two attaches share one layer; last detach releases DOM, style and listeners', () => {
    expect(getSharedSelectionInteraction()).toBe(layer)
    const detach2 = attachSharedSelectionInteraction(document)
    expect(getSharedSelectionInteraction()).toBe(layer)
    expect(document.querySelectorAll('[data-dsh-selection-actions]').length).toBe(1)
    const styles = document.getElementById(SELECTION_ACTIONS_STYLE_ID)
    expect(styles).not.toBeNull()
    expect(styles?.textContent).toContain('[data-dsh-selection-actions],[data-dsh-selection-actions] *{transition:none!important;animation:none!important}')
    detach2()
    // 仍有一个引用：层存活
    expect(getSharedSelectionInteraction()).toBe(layer)
    detach()
    expect(getSharedSelectionInteraction()).toBeUndefined()
    expect(document.querySelector('[data-dsh-selection-actions]')).toBeNull()
    expect(document.getElementById(SELECTION_ACTIONS_STYLE_ID)).toBeNull()
    // dispose 后 selectionchange 不再产生任何 DOM
    selectText(document.createElement('p'), 'ghost selection')
    vi.advanceTimersByTime(300)
    expect(document.querySelector('[data-dsh-selection-actions]')).toBeNull()
  })

  it('HMR-style dispose + re-attach leaves exactly one overlay and one style', () => {
    detach()
    const detach2 = attachSharedSelectionInteraction(document)
    expect(document.querySelectorAll('[data-dsh-selection-actions]').length).toBe(1)
    expect(document.querySelectorAll(`#${SELECTION_ACTIONS_STYLE_ID}`).length).toBe(1)
    detach2()
  })
})

describe('selection → stable → actions surface', () => {
  it('does not render before stability (candidate is headless)', () => {
    const para = document.createElement('p')
    selectText(para, 'some interesting text')
    expect(layer.getState().phase).toBe('candidate')
    expect(visible()).toBe(false)
    vi.advanceTimersByTime(200)
    expect(layer.getState().phase).toBe('actions-visible')
    expect(visible()).toBe(true)
  })

  it('renders 1 primary + 2 secondary + More with disabled reasons in More', () => {
    layer.addCapabilityProvider(() => ALL_CAPS)
    const para = document.createElement('p')
    selectText(para, 'some interesting text')
    vi.advanceTimersByTime(200)
    const toolbar = document.querySelector('.sa-toolbar')!
    const buttons = [...toolbar.querySelectorAll('button[data-action-id]')]
    expect(buttons.map(b => b.dataset.actionId)).toEqual(['dsh:reference', 'dsh:ask-with-reference', 'dsh:ask'])
    const more = toolbar.querySelector('button[aria-controls="sa-more-panel"]')!
    expect(more.getAttribute('aria-expanded')).toBe('false')
    more.click()
    const morePanel = document.getElementById('sa-more-panel')!
    expect(morePanel.hidden).toBe(false)
    const moreButtons = [...morePanel.querySelectorAll('button[data-action-id]')]
    expect(moreButtons.map(b => b.dataset.actionId)).toEqual(['dsh:comment', 'dsh:copy-quote', 'dsh:reference-details', 'dsh:edit', 'dsh:add-to-batch', 'dsh:add-text-quote', 'dsh:choose-conversation', 'dsh:open-full'])
    expect(moreButtons.every(b => !b.disabled)).toBe(true)
  })

  it('presents error selections as a diagnostic workflow with visible context', () => {
    layer.addCapabilityProvider(() => ALL_CAPS)
    const para = document.createElement('p')
    selectText(para, "Cannot read properties of undefined (reading 'prepare')")
    vi.advanceTimersByTime(200)
    const toolbar = document.querySelector('.sa-toolbar')!
    expect(toolbar.querySelector('.sa-context')?.textContent).toBe('Error output')
    expect(toolbar.querySelector('button[data-action-id="dsh:reference"]')?.textContent).toBe('Add to chat')
    expect(toolbar.querySelector('button[data-action-id="dsh:ask"]')?.textContent).toBe('Diagnose')
    ;(toolbar.querySelector('button[aria-controls="sa-more-panel"]') as HTMLButtonElement).click()
    expect(document.querySelector('.sa-selection span')?.textContent).toContain('Cannot read properties')
    expect(document.querySelector('#sa-more-panel button[data-action-id="dsh:edit"]')?.textContent).toBe('Draft fix')
  })

  it('capability-missing edit stays disabled in More with a reason', () => {
    layer.addCapabilityProvider(() => [SELECTION_CAPABILITY_CONVERSATION, SELECTION_CAPABILITY_BATCH])
    const para = document.createElement('p')
    selectText(para, 'plain text')
    vi.advanceTimersByTime(200)
    ;(document.querySelector('button[aria-controls="sa-more-panel"]') as HTMLButtonElement).click()
    const edit = document.querySelector('#sa-more-panel button[data-action-id="dsh:edit"]') as HTMLButtonElement
    expect(edit.disabled).toBe(true)
    expect(document.querySelector('#sa-more-panel .sa-reason')?.textContent).toContain('reference source or target unavailable')
  })

  it('never surfaces Actions for password fields or host opt-out areas', () => {
    layer.addCapabilityProvider(() => ALL_CAPS)
    const password = document.createElement('input')
    password.type = 'password'
    document.body.append(password)
    password.select()
    document.dispatchEvent(new Event('selectionchange'))
    vi.advanceTimersByTime(300)
    expect(layer.getState().phase).toBe('idle')
    expect(visible()).toBe(false)

    const optout = document.createElement('div')
    optout.setAttribute('data-dsh-selection-optout', '')
    selectText(optout, 'private editor content')
    vi.advanceTimersByTime(300)
    expect(layer.getState().phase).toBe('idle')
    expect(visible()).toBe(false)
  })
})

describe('action dispatch bridge (2.4) and surfaces', () => {
  it('explicit ask opens the composer surface via typed intent; closeSurface returns', () => {
    layer.addCapabilityProvider(() => ALL_CAPS)
    const intents: string[] = []
    layer.onIntent(intent => {
      intents.push(`${intent.actionId}:${intent.approvalPolicy}`)
      return { surface: 'composer' }
    })
    const para = document.createElement('p')
    selectText(para, 'ask about this')
    vi.advanceTimersByTime(200)
    ;(document.querySelector('button[data-action-id="dsh:ask"]') as HTMLButtonElement).click()
    expect(intents).toEqual(['dsh:ask:auto-apply'])
    expect(layer.getState().phase).toBe('surface')
    layer.closeSurface()
    expect(layer.getState().phase).toBe('actions-visible')
  })

  it('edit dispatches preview-first and marks the V1 alias source', () => {
    layer.addCapabilityProvider(() => ALL_CAPS)
    const intents: string[] = []
    layer.onIntent(intent => {
      intents.push(`${intent.actionId}:${intent.approvalPolicy}:${intent.aliasOf ?? '-'}`)
      return { surface: 'owner' }
    })
    const para = document.createElement('p')
    selectText(para, 'edit this')
    vi.advanceTimersByTime(200)
    ;(document.querySelector('button[aria-controls="sa-more-panel"]') as HTMLButtonElement).click()
    ;(document.querySelector('#sa-more-panel button[data-action-id="dsh:edit"]') as HTMLButtonElement).click()
    expect(intents).toEqual(['dsh:edit:preview-first:-'])
    expect(layer.getState().phase).toBe('surface')
  })

  it('local copy-quote completes immediately and dismisses (built-in clipboard)', () => {
    layer.addCapabilityProvider(() => ALL_CAPS)
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const para = document.createElement('p')
    selectText(para, 'copy me please')
    vi.advanceTimersByTime(200)
    ;(document.querySelector('button[aria-controls="sa-more-panel"]') as HTMLButtonElement).click()
    ;(document.querySelector('#sa-more-panel button[data-action-id="dsh:copy-quote"]') as HTMLButtonElement).click()
    expect(writeText).toHaveBeenCalledWith('copy me please')
    expect(layer.getState().phase).toBe('idle')
  })

  it('actions without an owner handler fail closed (dismiss, no fake success)', () => {
    layer.addCapabilityProvider(() => ALL_CAPS)
    const para = document.createElement('p')
    selectText(para, 'no handler for ask')
    vi.advanceTimersByTime(200)
    ;(document.querySelector('button[data-action-id="dsh:ask"]') as HTMLButtonElement).click()
    expect(layer.getState().phase).toBe('idle')
  })
})

describe('dismissal, focus and keyboard (2.2/4.3)', () => {
  it('Esc closes More first, then Actions, then restores focus to the original node', () => {
    layer.addCapabilityProvider(() => ALL_CAPS)
    const editor = document.createElement('button')
    editor.textContent = 'origin'
    document.body.append(editor)
    editor.focus()
    const para = document.createElement('p')
    selectText(para, 'focus target')
    vi.advanceTimersByTime(200)
    ;(document.querySelector('button[aria-controls="sa-more-panel"]') as HTMLButtonElement).click()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(layer.getState().phase).toBe('actions-visible')
    expect(document.getElementById('sa-more-panel')?.hidden).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(layer.getState().phase).toBe('idle')
    expect(document.activeElement).toBe(editor)
  })

  it('outside pointerdown dismisses; scroll dismisses when out of viewport', () => {
    layer.addCapabilityProvider(() => ALL_CAPS)
    const para = document.createElement('p')
    selectText(para, 'dismissal target')
    vi.advanceTimersByTime(200)
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(layer.getState().phase).toBe('idle')

    selectText(para, 'again')
    vi.advanceTimersByTime(200)
    expect(layer.getState().phase).toBe('actions-visible')
    // jsdom selection rect 为 0×0：视为在视口内 → 滚动只重摆不关闭
    document.dispatchEvent(new Event('scroll', { bubbles: true }))
    expect(layer.getState().phase).toBe('actions-visible')
  })

  it('Alt+Enter re-opens Actions for the current selection and focuses the primary', () => {
    layer.addCapabilityProvider(() => ALL_CAPS)
    const para = document.createElement('p')
    selectText(para, 'keyboard recovery')
    vi.advanceTimersByTime(200)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(layer.getState().phase).toBe('idle')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true }))
    expect(layer.getState().phase).toBe('actions-visible')
    expect(document.activeElement?.dataset.actionId).toBe('dsh:reference')
  })

  it('reserved shortcuts are not hijacked (host editor wins)', () => {
    resetSharedSelectionInteractionForTests()
    const reservedDetach = attachSharedSelectionInteraction(document, {
      isShortcutReserved: key => key === 'Alt+Enter',
      viewportWidth: () => 1280,
    })
    const reservedLayer = getSharedSelectionInteraction()!
    const para = document.createElement('p')
    selectText(para, 'reserved key')
    vi.advanceTimersByTime(200)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(reservedLayer.getState().phase).toBe('idle')
    const event = new KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true, cancelable: true })
    document.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(reservedLayer.getState().phase).toBe('idle')
    reservedDetach()
  })
})

describe('pin and external publishers (2.5/3.3)', () => {
  it('legacy pin reducer path still feeds getPinnedContext/restorePinned', () => {
    layer.addCapabilityProvider(() => ALL_CAPS)
    const para = document.createElement('p')
    selectText(para, 'pin me')
    vi.advanceTimersByTime(200)
    // 手柄按钮已改为位置固定；旧选区收藏/恢复合同保留在 reducer/API 层，直接驱动。
    ;(layer as unknown as { transition(event: SelectionInteractionEvent): void }).transition({ type: 'pin' })
    expect(layer.getState().phase).toBe('pinned')
    expect(layer.getPinnedContext()?.contextId).toBeDefined()
    expect(layer.restorePinned()).toBe(true)
    expect(layer.getState().phase).toBe('actions-visible')
    expect(visible()).toBe(true)
  })

  it('panes publish external contexts (image-region) instead of mounting toolbars', () => {
    layer.addCapabilityProvider(() => ALL_CAPS)
    layer.publishExternalContext({ kind: 'image-region', source: 'image', text: 'image region 1', anchor: { quotePreview: 'image region 1' } })
    expect(layer.getState().phase).toBe('actions-visible')
    const toolbar = document.querySelector('.sa-toolbar')!
    // 引用在所有上下文均为 primary；引用并询问紧随其后，评论/询问保留为次级。
    expect([...toolbar.querySelectorAll('button[data-action-id]')].map(b => b.dataset.actionId)).toEqual(['dsh:reference', 'dsh:ask-with-reference', 'dsh:comment'])
  })
})

describe('responsive surface (4.2)', () => {
  it('narrow viewport shows a single Actions entry opening a bottom sheet with 44px targets', () => {
    resetSharedSelectionInteractionForTests()
    detach = attachSharedSelectionInteraction(document, { viewportWidth: () => 380 })
    layer = getSharedSelectionInteraction()!
    layer.addCapabilityProvider(() => ALL_CAPS)
    const para = document.createElement('p')
    selectText(para, 'narrow mode text')
    vi.advanceTimersByTime(200)
    const toolbar = document.querySelector('.sa-toolbar')!
    const buttons = [...toolbar.querySelectorAll('button')]
    expect(buttons.length).toBe(1)
    expect(buttons[0]?.textContent).toBe('Selection actions')
    expect(buttons[0]?.getAttribute('aria-haspopup')).toBe('dialog')
    buttons[0]!.click()
    const sheet = document.querySelector('.sa-sheet') as HTMLElement
    expect(sheet.getAttribute('role')).toBe('dialog')
    const sheetButtons = [...sheet.querySelectorAll('button[data-action-id]')]
    expect(sheetButtons.length).toBeGreaterThan(3)
    // Esc 关 sheet 后回到入口（逐层退出）
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(layer.getState().phase).toBe('actions-visible')
  })
})


describe('position pin and drag (3.1-3.4)', () => {
  function pinButton(): HTMLButtonElement {
    return document.querySelector('button.sa-pin') as HTMLButtonElement
  }

  function feedbackText(): string {
    return document.querySelector('.sa-feedback')?.textContent ?? ''
  }

  function showToolbar(text = 'position pin target'): HTMLElement {
    layer.addCapabilityProvider(() => ALL_CAPS)
    const para = document.createElement('p')
    selectText(para, text)
    vi.advanceTimersByTime(200)
    expect(layer.getState().phase).toBe('actions-visible')
    return para
  }

  function handlePointerDown(x: number, y: number, pointerId = 1): void {
    pinButton().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: y, pointerId }))
  }

  function windowPointer(type: string, x: number, y: number, pointerId = 1): void {
    window.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId }))
  }

  it('click toggles the position pin: aria-pressed flips, toolbar stays visible and operable', () => {
    showToolbar()
    const intents: string[] = []
    layer.onIntent(intent => {
      intents.push(intent.actionId)
      return { surface: 'composer' }
    })
    expect(pinButton().getAttribute('aria-pressed')).toBe('false')
    expect(pinButton().getAttribute('aria-label')).toBe('Pin position (click to pin, drag to move)')
    pinButton().click()
    // 位置固定是展示状态：不进 reducer pinned，工具条保持可见可操作
    expect(layer.getState().phase).toBe('actions-visible')
    expect(visible()).toBe(true)
    expect(pinButton().getAttribute('aria-pressed')).toBe('true')
    expect(pinButton().getAttribute('aria-label')).toBe('Unpin position')
    expect(feedbackText()).toBe('Toolbar position pinned')
    ;(document.querySelector('button[data-action-id="dsh:ask"]') as HTMLButtonElement).click()
    expect(intents).toEqual(['dsh:ask'])
    layer.closeSurface()
    pinButton().click()
    expect(pinButton().getAttribute('aria-pressed')).toBe('false')
    expect(feedbackText()).toBe('Toolbar position unpinned')
    expect(visible()).toBe(true)
  })

  it('sub-threshold press-release is a click: no geometry change, no pin until click', () => {
    showToolbar()
    const left = overlay().style.left
    const top = overlay().style.top
    handlePointerDown(700, 720)
    windowPointer('pointermove', 703, 722)
    windowPointer('pointerup', 703, 722)
    expect(overlay().style.left).toBe(left)
    expect(overlay().style.top).toBe(top)
    expect(pinButton().getAttribute('aria-pressed')).toBe('false')
    pinButton().click()
    expect(pinButton().getAttribute('aria-pressed')).toBe('true')
  })

  it('drag beyond 6px moves the overlay, pins the drop point and swallows the trailing click', () => {
    showToolbar()
    const startLeft = parseFloat(overlay().style.left)
    const startTop = parseFloat(overlay().style.top)
    handlePointerDown(700, 720)
    windowPointer('pointermove', 600, 620)
    expect(overlay().style.left).toBe(`${startLeft - 100}px`)
    expect(overlay().style.top).toBe(`${startTop - 100}px`)
    windowPointer('pointerup', 600, 620)
    expect(pinButton().getAttribute('aria-pressed')).toBe('true')
    expect(feedbackText()).toBe('Toolbar moved and pinned')
    expect(layer.getState().phase).toBe('actions-visible')
    // 尾随 click 不再次翻转固定状态
    pinButton().click()
    expect(pinButton().getAttribute('aria-pressed')).toBe('true')
    // 之后真正的单击仍可取消固定
    pinButton().click()
    expect(pinButton().getAttribute('aria-pressed')).toBe('false')
  })

  it('Escape mid-drag restores geometry and pinned state; trailing click is swallowed', () => {
    showToolbar()
    const left = overlay().style.left
    const top = overlay().style.top
    handlePointerDown(700, 720)
    windowPointer('pointermove', 600, 620)
    expect(overlay().style.left).not.toBe(left)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(overlay().style.left).toBe(left)
    expect(overlay().style.top).toBe(top)
    expect(pinButton().getAttribute('aria-pressed')).toBe('false')
    expect(feedbackText()).toBe('Move cancelled; position restored')
    // Escape 取消手势而非关闭工具条
    expect(layer.getState().phase).toBe('actions-visible')
    expect(visible()).toBe(true)
    pinButton().click()
    expect(pinButton().getAttribute('aria-pressed')).toBe('false')
  })

  it('pointercancel mid-drag restores geometry and pinned state; trailing click is swallowed', () => {
    showToolbar()
    const left = overlay().style.left
    const top = overlay().style.top
    handlePointerDown(700, 720)
    windowPointer('pointermove', 600, 620)
    expect(overlay().style.left).not.toBe(left)
    windowPointer('pointercancel', 600, 620)
    expect(overlay().style.left).toBe(left)
    expect(overlay().style.top).toBe(top)
    expect(pinButton().getAttribute('aria-pressed')).toBe('false')
    expect(feedbackText()).toBe('Move cancelled; position restored')
    pinButton().click()
    expect(pinButton().getAttribute('aria-pressed')).toBe('false')
  })

  it('window blur mid-drag cancels the gesture and restores geometry', () => {
    showToolbar()
    const left = overlay().style.left
    const top = overlay().style.top
    handlePointerDown(700, 720)
    windowPointer('pointermove', 600, 620)
    expect(overlay().style.top).not.toBe(top)
    window.dispatchEvent(new Event('blur'))
    expect(overlay().style.left).toBe(left)
    expect(overlay().style.top).toBe(top)
    expect(pinButton().getAttribute('aria-pressed')).toBe('false')
    // 手势已结束：随后的 pointerup 不产生固定动作
    windowPointer('pointerup', 600, 620)
    expect(pinButton().getAttribute('aria-pressed')).toBe('false')
  })

  it('keyboard pin keeps handle focus so arrows chain without re-tabbing', () => {
    showToolbar()
    pinButton().focus()
    pinButton().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    pinButton().click()
    expect(pinButton().getAttribute('aria-pressed')).toBe('true')
    expect(document.activeElement).toBe(pinButton())
    const pinnedLeft = parseFloat(overlay().style.left)
    pinButton().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(overlay().style.left).toBe(`${pinnedLeft + 8}px`)
    expect(document.activeElement).toBe(pinButton())
  })

  it('pinned toolbar neither repositions nor dismisses on scroll', () => {
    showToolbar()
    pinButton().click()
    const left = overlay().style.left
    const top = overlay().style.top
    document.dispatchEvent(new Event('scroll', { bubbles: true }))
    expect(layer.getState().phase).toBe('actions-visible')
    expect(visible()).toBe(true)
    expect(overlay().style.left).toBe(left)
    expect(overlay().style.top).toBe(top)
  })

  it('resize re-clamps the pinned position into the viewport instead of dismissing', () => {
    showToolbar()
    pinButton().click()
    const originalHeight = window.innerHeight
    Object.defineProperty(window, 'innerHeight', { value: 300, configurable: true })
    try {
      window.dispatchEvent(new Event('resize'))
      expect(layer.getState().phase).toBe('actions-visible')
      expect(visible()).toBe(true)
      expect(overlay().style.top).toBe('254px')
    } finally {
      Object.defineProperty(window, 'innerHeight', { value: originalHeight, configurable: true })
    }
  })

  it('keyboard arrows move the toolbar and pin the position; Shift enlarges the step', () => {
    showToolbar()
    const startLeft = parseFloat(overlay().style.left)
    const startTop = parseFloat(overlay().style.top)
    pinButton().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(overlay().style.left).toBe(`${startLeft - 8}px`)
    expect(pinButton().getAttribute('aria-pressed')).toBe('true')
    expect(feedbackText()).toBe('Toolbar position pinned')
    pinButton().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }))
    expect(overlay().style.top).toBe(`${Math.min(startTop + 32, 768 - 38 - 8)}px`)
    expect(layer.getState().phase).toBe('actions-visible')
  })

  it('invalid source while pinned keeps the overlay with disabled actions and a reason', () => {
    showToolbar()
    const intents: string[] = []
    layer.onIntent(intent => {
      intents.push(intent.actionId)
      return { surface: 'composer' }
    })
    const visibleState = layer.getState()
    const staleContext = visibleState.phase === 'actions-visible' ? visibleState.context : undefined
    expect(staleContext).toBeDefined()
    pinButton().click()
    window.getSelection()?.removeAllRanges()
    document.dispatchEvent(new Event('selectionchange'))
    expect(layer.getState().phase).toBe('idle')
    // 浮层保留：内容动作禁用、原因可见、手柄仍可操作
    expect(visible()).toBe(true)
    expect(feedbackText()).toBe('Source is no longer valid; close or select again')
    const contentButtons = [...document.querySelectorAll<HTMLButtonElement>('.sa-toolbar button[data-action-id]')]
    expect(contentButtons.length).toBeGreaterThan(0)
    expect(contentButtons.every(button => button.disabled)).toBe(true)
    expect(pinButton().disabled).toBe(false)
    expect(pinButton().getAttribute('aria-pressed')).toBe('true')
    // 陈旧 context 不再 dispatch
    layer.activateAction('dsh:ask', 'dsh:ask', staleContext)
    expect(intents).toEqual([])
    // Escape 关闭失效展示
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(visible()).toBe(false)
  })

  it('a new selection resets the position pin', () => {
    const para = showToolbar()
    pinButton().click()
    expect(pinButton().getAttribute('aria-pressed')).toBe('true')
    selectText(para, 'a fresh selection')
    vi.advanceTimersByTime(200)
    expect(layer.getState().phase).toBe('actions-visible')
    expect(pinButton().getAttribute('aria-pressed')).toBe('false')
  })
})
