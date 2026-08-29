import { describe, expect, it } from 'vitest'
import { DEFAULT_COMMAND_KEYMAP } from '@yeisme/dsh-client-ui-command-experience-core'
import {
  createDramaKeymap,
  detectDramaKeymapConflicts,
  dramaKeyEventForAction,
  toCommandKeyEvent,
  DRAMA_KEYMAP_OVERRIDES,
} from '../src/client/keymap.js'

describe('createDramaKeymap', () => {
  it('declares alt+d through the shared keymap face without dropping defaults', () => {
    const keymap = createDramaKeymap()
    expect(keymap.config.toggle).toEqual([...DEFAULT_COMMAND_KEYMAP.toggle, 'alt+d'])
    expect(keymap.config.execute).toEqual(DEFAULT_COMMAND_KEYMAP.execute)
    expect(keymap.config.tabComplete).toEqual(DEFAULT_COMMAND_KEYMAP.tabComplete)
    expect(keymap.conflicts).toEqual([])
  })

  it('resolves drama view keys through the resolved shared config', () => {
    const keymap = createDramaKeymap()
    expect(keymap.resolveViewKey({ key: 'd', ctrl: false, meta: false, alt: true, shift: false })).toEqual({ type: 'toggle-palette' })
    expect(keymap.resolveViewKey({ key: 'tab', ctrl: false, meta: false, alt: false, shift: false })).toEqual({ type: 'cycle-zone', reverse: false })
    expect(keymap.resolveViewKey({ key: 'tab', ctrl: false, meta: false, alt: false, shift: true })).toEqual({ type: 'cycle-zone', reverse: true })
    expect(keymap.resolveViewKey({ key: 'escape', ctrl: false, meta: false, alt: false, shift: false })).toEqual({ type: 'focus-command-zone' })
    expect(keymap.resolveViewKey({ key: 'arrowdown', ctrl: false, meta: false, alt: false, shift: false })).toEqual({ type: 'move', slot: 'navigateDown' })
    expect(keymap.resolveViewKey({ key: 'arrowup', ctrl: false, meta: false, alt: false, shift: false })).toEqual({ type: 'move', slot: 'navigateUp' })
    expect(keymap.resolveViewKey({ key: 'enter', ctrl: false, meta: false, alt: false, shift: false })).toEqual({ type: 'execute-focused' })
    expect(keymap.resolveViewKey({ key: 'x', ctrl: false, meta: false, alt: false, shift: false })).toEqual({ type: 'unhandled' })
  })

  it('degrades conflicting bindings by slot priority and keeps the conflict visible', () => {
    const keymap = createDramaKeymap({ cancel: ['alt+d', 'escape'] })
    const conflict = keymap.conflicts.find(item => item.binding === 'alt+d')
    expect(conflict).toBeDefined()
    expect(conflict?.slots).toEqual(expect.arrayContaining(['toggle', 'cancel']))
    expect(conflict?.winner).toBe('toggle')
    expect(conflict?.reason).toContain('alt+d')

    // The losing slot never fires: alt+d stays toggle, escape stays cancel.
    expect(keymap.resolveViewKey({ key: 'd', ctrl: false, meta: false, alt: true, shift: false })).toEqual({ type: 'toggle-palette' })
    expect(keymap.resolveViewKey({ key: 'escape', ctrl: false, meta: false, alt: false, shift: false })).toEqual({ type: 'focus-command-zone' })
  })

  it('honors host overrides for drama bindings', () => {
    const keymap = createDramaKeymap({ toggle: ['f6'] })
    expect(keymap.config.toggle).toEqual(['f6'])
    expect(keymap.resolveViewKey({ key: 'f6', ctrl: false, meta: false, alt: false, shift: false })).toEqual({ type: 'toggle-palette' })
    expect(keymap.resolveViewKey({ key: 'd', ctrl: false, meta: false, alt: true, shift: false })).toEqual({ type: 'unhandled' })
  })
})

describe('detectDramaKeymapConflicts', () => {
  it('detects no conflicts in the default shared keymap plus drama additions', () => {
    expect(detectDramaKeymapConflicts({ ...DEFAULT_COMMAND_KEYMAP, ...DRAMA_KEYMAP_OVERRIDES })).toEqual([])
  })
})

describe('toCommandKeyEvent', () => {
  it('normalizes KeyboardEvent-like input', () => {
    expect(toCommandKeyEvent({ key: 'D', altKey: true })).toEqual({ key: 'd', ctrl: false, meta: false, alt: true, shift: false })
    expect(toCommandKeyEvent({ key: 'Tab', shiftKey: true })).toEqual({ key: 'tab', ctrl: false, meta: false, alt: false, shift: true })
  })
})

describe('dramaKeyEventForAction', () => {
  it('maps resolved actions onto the host interaction model key events', () => {
    expect(dramaKeyEventForAction({ type: 'cycle-zone', reverse: true })).toEqual({ key: 'Tab', shiftKey: true })
    expect(dramaKeyEventForAction({ type: 'cycle-zone', reverse: false })).toEqual({ key: 'Tab', shiftKey: false })
    expect(dramaKeyEventForAction({ type: 'focus-command-zone' })).toEqual({ key: 'Escape' })
    expect(dramaKeyEventForAction({ type: 'execute-focused' })).toEqual({ key: 'Enter' })
    expect(dramaKeyEventForAction({ type: 'move', slot: 'navigateUp' })).toEqual({ key: 'ArrowUp' })
    expect(dramaKeyEventForAction({ type: 'toggle-palette' })).toBeUndefined()
    expect(dramaKeyEventForAction({ type: 'unhandled' })).toBeUndefined()
  })
})
