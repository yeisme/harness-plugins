// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  attachSharedSelectionInteraction,
  getSharedSelectionInteraction,
  resetSharedSelectionInteractionForTests,
  SelectionInteractionLayer,
  SELECTION_ACTIONS_STYLE_ID,
} from '../src/selection/layer.ts'
import { SELECTION_CAPABILITY_BATCH, SELECTION_CAPABILITY_CONVERSATION, SELECTION_CAPABILITY_EDIT } from '../src/selection/builtin-actions.ts'

const ALL_CAPS = [SELECTION_CAPABILITY_CONVERSATION, SELECTION_CAPABILITY_EDIT, SELECTION_CAPABILITY_BATCH]

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
    expect(document.getElementById(SELECTION_ACTIONS_STYLE_ID)).not.toBeNull()
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
    expect(buttons.map(b => b.dataset.actionId)).toEqual(['dsh:ask', 'dsh:comment', 'dsh:copy-quote'])
    const more = toolbar.querySelector('button[aria-controls="sa-more-panel"]')!
    expect(more.getAttribute('aria-expanded')).toBe('false')
    more.click()
    const morePanel = document.getElementById('sa-more-panel')!
    expect(morePanel.hidden).toBe(false)
    const moreButtons = [...morePanel.querySelectorAll('button[data-action-id]')]
    expect(moreButtons.map(b => b.dataset.actionId)).toEqual(['dsh:edit', 'dsh:add-to-batch', 'dsh:open-full'])
    expect(moreButtons.every(b => !b.disabled)).toBe(true)
  })

  it('capability-missing edit stays disabled in More with a reason', () => {
    layer.addCapabilityProvider(() => [SELECTION_CAPABILITY_CONVERSATION, SELECTION_CAPABILITY_BATCH])
    const para = document.createElement('p')
    selectText(para, 'plain text')
    vi.advanceTimersByTime(200)
    ;(document.querySelector('button[aria-controls="sa-more-panel"]') as HTMLButtonElement).click()
    const edit = document.querySelector('#sa-more-panel button[data-action-id="dsh:edit"]') as HTMLButtonElement
    expect(edit.disabled).toBe(true)
    expect(document.querySelector('#sa-more-panel .sa-reason')?.textContent).toContain('unavailable')
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
    ;(document.querySelector('button[data-action-id="dsh:copy-quote"]') as HTMLButtonElement).click()
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
    expect(document.activeElement?.dataset.actionId).toBe('dsh:ask')
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
  it('pin creates a recoverable entry; invalidation clears it', () => {
    layer.addCapabilityProvider(() => ALL_CAPS)
    const para = document.createElement('p')
    selectText(para, 'pin me')
    vi.advanceTimersByTime(200)
    ;(document.querySelector('button.sa-pin') as HTMLButtonElement).click()
    expect(layer.getState().phase).toBe('pinned')
    expect(layer.getPinnedContext()?.contextId).toBeDefined()
    expect(layer.restorePinned()).toBe(true)
    expect(layer.getState().phase).toBe('actions-visible')
    // 普通选区不能自动 pin：重新选择后需再显式 pin
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(layer.getState().phase).toBe('idle')
    selectText(para, 'pin me again')
    vi.advanceTimersByTime(200)
    ;(document.querySelector('button.sa-pin') as HTMLButtonElement).click()
    expect(layer.getState().phase).toBe('pinned')
  })

  it('panes publish external contexts (image-region) instead of mounting toolbars', () => {
    layer.addCapabilityProvider(() => ALL_CAPS)
    layer.publishExternalContext({ kind: 'image-region', source: 'image', text: 'image region 1', anchor: { quotePreview: 'image region 1' } })
    expect(layer.getState().phase).toBe('actions-visible')
    const toolbar = document.querySelector('.sa-toolbar')!
    // image 矩阵：primary=comment，secondary=ask + add-to-batch
    expect([...toolbar.querySelectorAll('button[data-action-id]')].map(b => b.dataset.actionId)).toEqual(['dsh:comment', 'dsh:ask', 'dsh:add-to-batch'])
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
    expect(buttons[0]?.textContent).toBe('Actions')
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
