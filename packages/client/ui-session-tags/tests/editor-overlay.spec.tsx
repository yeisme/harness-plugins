// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { createSessionTagsController } from '../src/client/controller.ts'
import { createTagEditorController } from '../src/client/editor.ts'
import { TagEditorOverlay, createTagEditorOverlayEntry } from '../src/client/TagEditorOverlay.tsx'
import { overlayLabelsFrom, zh } from '../src/client/locales.ts'
import type { SessionTagsRemoteFace } from '../src/client/wire.ts'

afterEach(cleanup)

class StubRemote implements SessionTagsRemoteFace {
  public setCalls: unknown[] = []
  async list() { return { ok: true as const, specVersion: '1.0' as const, entries: [] } }
  async set(input: unknown) { this.setCalls.push(input); return { ok: true as const, sessionId: 's1', tags: [], row: null } }
}

async function harness(entries: Array<[string, string[]]> = []) {
  const remote = new StubRemote()
  remote.list = async () => ({
    ok: true as const,
    specVersion: '1.0' as const,
    entries: entries.map(([sessionId, tags]) => ({
      sessionId,
      row: { session: { createdAt: 'x' }, tags, version: `v-${sessionId}`, updatedAt: 1 },
    })),
  })
  const controller = createSessionTagsController({ remote })
  await controller.refresh()
  const editor = createTagEditorController({ remote, controller })
  return { remote, controller, editor }
}

const labels = overlayLabelsFrom(zh)

function renderOverlay(deps: Awaited<ReturnType<typeof harness>>) {
  const props = () => ({
    state: deps.editor.getSnapshot(),
    suggestions: deps.editor.suggestions(),
    labels,
    onToggleTag: (tag: string) => { deps.editor.toggleTag(tag) },
    onSetInput: (v: string) => { deps.editor.setInput(v) },
    onAddInput: () => { deps.editor.addFreeInput() },
    onSave: () => { void deps.editor.save() },
    onCancel: () => { deps.editor.cancel() },
  })
  const view = render(<TagEditorOverlay {...props()} />)
  const unsubscribe = deps.editor.subscribe(() => { view.rerender(<TagEditorOverlay {...props()} />) })
  return {
    ...view,
    unmount() {
      unsubscribe()
      view.unmount()
    },
  }
}

describe('tag editor overlay a11y and interaction', () => {
  it('renders an accessible modal dialog with labelled controls', async () => {
    const deps = await harness([['s1', ['工作']]])
    deps.editor.open('s1')
    renderOverlay(deps)
    const dialog = screen.getByRole('dialog', { name: zh['editor-title'] })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByLabelText(zh['editor-input-label'])).toBeDefined()
    expect(screen.getByRole('button', { name: zh['editor-save'] })).toBeDefined()
    expect(screen.getByRole('button', { name: zh['editor-cancel'] })).toBeDefined()
    expect(screen.getByRole('button', { name: `${zh['editor-remove']} 工作` })).toBeDefined()
  })

  it('focuses the input on open and restores focus to the trigger on close', async () => {
    const deps = await harness([['s1', ['a']]])
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    deps.editor.open('s1', { trigger })
    const { unmount } = renderOverlay(deps)
    expect(document.activeElement).toBe(screen.getByLabelText(zh['editor-input-label']))
    deps.editor.close()
    unmount()
    expect(document.activeElement).toBe(trigger)
    document.body.removeChild(trigger)
  })

  it('Escape cancels with zero writes', async () => {
    const deps = await harness([['s1', ['a']]])
    deps.editor.open('s1')
    renderOverlay(deps)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(deps.remote.setCalls).toEqual([])
    expect(deps.editor.getSnapshot().open).toBe(false)
  })

  it('free input adds a tag via Enter and suggestion chips toggle membership', async () => {
    const deps = await harness([['s1', ['a']]])
    deps.editor.open('s1')
    renderOverlay(deps)
    const input = screen.getByLabelText(zh['editor-input-label'])
    fireEvent.change(input, { target: { value: ' research ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(deps.editor.getSnapshot().draft).toEqual(['a', 'research'])
    expect((input as HTMLInputElement).value).toBe('')
    const chip = screen.getByRole('button', { name: `${zh['editor-remove']} a` })
    fireEvent.click(chip)
    expect(deps.editor.getSnapshot().draft).toEqual(['research'])
  })

  it('save invokes set with the full target and closes', async () => {
    const deps = await harness([['s1', ['a']]])
    deps.editor.open('s1')
    renderOverlay(deps)
    fireEvent.click(screen.getByRole('button', { name: zh['editor-save'] }))
    await vi.waitFor(() => {
      expect(deps.editor.getSnapshot().open).toBe(false)
    })
    expect(deps.remote.setCalls).toEqual([{ sessionId: 's1', tags: ['a'], ifVersion: 'v-s1' }])
  })

  it('announces conflict through an aria-live status region', async () => {
    const deps = await harness([['s1', ['a']]])
    deps.remote.set = async () => ({
      ok: false as const,
      code: 'version-conflict' as const,
      message: 'conflict',
      row: { session: { createdAt: 'x' }, tags: ['x', 'y'], version: 'v2', updatedAt: 2 },
    })
    deps.editor.open('s1')
    renderOverlay(deps)
    fireEvent.click(screen.getByRole('button', { name: zh['editor-save'] }))
    await vi.waitFor(() => {
      expect(deps.editor.getSnapshot().phase).toBe('conflict')
    })
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toContain('x, y')
  })

  it('disables mutation entry points while saving', async () => {
    const deps = await harness([['s1', ['a']]])
    let release!: () => void
    deps.remote.set = () => new Promise(resolve => {
      release = () => { resolve({ ok: true, sessionId: 's1', tags: ['a'], row: null }) }
    })
    deps.editor.open('s1')
    renderOverlay(deps)
    const saving = deps.editor.save()
    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: zh['editor-save'] })).toHaveProperty('disabled', true)
    })
    release()
    await saving
  })

  it('renders nothing when closed (idle shell.overlay seat)', async () => {
    const deps = await harness()
    const Entry = createTagEditorOverlayEntry(deps.editor, labels)
    const { container } = render(<Entry />)
    expect(container.innerHTML).toBe('')
  })

  it('entry component renders the live editor state', async () => {
    const deps = await harness([['s1', ['工作']]])
    const Entry = createTagEditorOverlayEntry(deps.editor, labels)
    render(<Entry />)
    deps.editor.open('s1')
    expect(await screen.findByRole('dialog')).toBeDefined()
    expect(screen.getByText('工作')).toBeDefined()
  })
})
