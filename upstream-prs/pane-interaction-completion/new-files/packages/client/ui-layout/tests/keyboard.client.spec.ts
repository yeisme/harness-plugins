// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { workbenchShortcut } from '../src/client/keyboard.ts'

describe('workbench keyboard actions', () => {
  it('recognizes navigation and layout without changing bare editing keys', () => {
    expect(workbenchShortcut(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }))).toBe('navigation')
    expect(workbenchShortcut(new KeyboardEvent('keydown', { key: 'b', metaKey: true }))).toBe('navigation')
    for (const [key, expected] of [['1', 'single'], ['2', 'columns'], ['3', 'rows'], ['l', 'menu']] as const) {
      expect(workbenchShortcut(new KeyboardEvent('keydown', { key, ctrlKey: true, altKey: true }))).toBe(expected)
    }
    expect(workbenchShortcut(new KeyboardEvent('keydown', { key: 'b' }))).toBeNull()
    expect(workbenchShortcut(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, isComposing: true }))).toBeNull()
  })
  it('leaves editor, form, terminal, and already handled events untouched', () => {
    for (const element of [document.createElement('input'), document.createElement('textarea'), document.createElement('div')]) {
      if (element.tagName === 'DIV') element.setAttribute('contenteditable', 'true')
      const event = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true })
      Object.defineProperty(event, 'target', { value: element })
      expect(workbenchShortcut(event)).toBeNull()
    }
    const event = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, cancelable: true })
    event.preventDefault()
    expect(workbenchShortcut(event)).toBeNull()
  })
})
