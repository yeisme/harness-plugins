// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  COMPOSER_REFERENCE_REMOVE_FROM_MAIN_EVENT,
  ComposerReferenceDraftControllerV2,
  ComposerReferenceDraftDockV2,
  type ComposerReferenceTargetV2,
  type ComposerReferenceV2,
} from '../src/explorer/references-v2.ts'

afterEach(() => { document.body.innerHTML = '' })

const target = (conversationId: string): ComposerReferenceTargetV2 => ({ workspaceId: 'workspace-a', conversationId })
const reference = (id: string, overrides: Partial<ComposerReferenceV2> = {}): ComposerReferenceV2 => ({
  id,
  kind: 'selection',
  intent: 'content',
  owner: 'dsh.selection',
  ref: `selection:${id}`,
  version: 'v1',
  label: `Selection ${id}`,
  scope: 'selection',
  digest: `digest-${id}`,
  freshness: 'fresh',
  ...overrides,
})

describe('ComposerReferenceDraftControllerV2', () => {
  it('keeps drafts isolated by explicit workspace and conversation targets', () => {
    const controller = new ComposerReferenceDraftControllerV2()
    controller.setHostAvailability(true)
    expect(controller.insert(target('conversation-a'), reference('a'))).toEqual({ ok: true })
    expect(controller.insert(target('conversation-b'), reference('b'))).toEqual({ ok: true })
    expect(controller.draftFor(target('conversation-a'))?.references.map(item => item.id)).toEqual(['a'])
    expect(controller.draftFor(target('conversation-b'))?.references.map(item => item.id)).toEqual(['b'])
  })

  it('requires an available host and leaves unavailable or stale references out of drafts', () => {
    const controller = new ComposerReferenceDraftControllerV2()
    expect(controller.insert(target('conversation-a'), reference('a'))).toMatchObject({ ok: false, reason: expect.stringContaining('unavailable') })
    controller.setHostAvailability(true)
    expect(controller.insert(target('conversation-a'), reference('a', { freshness: 'stale', unavailableReason: 'version changed' }))).toEqual({ ok: false, reason: 'version changed' })
    expect(controller.draftFor(target('conversation-a'))).toBeUndefined()
  })

  it.each(['no current target', 'target closed', 'workspace is no longer owned'])(
    'clears the visible target on %s while retaining its scoped draft',
    reason => {
      const controller = new ComposerReferenceDraftControllerV2()
      const selected = { ...target('conversation-a'), title: 'Former target' }
      controller.setHostAvailability(true)
      controller.insert(selected, reference('kept'))
      controller.setHostAvailability(false, reason)
      expect(controller.snapshot()).toMatchObject({ hostAvailable: false, hostReason: reason, drafts: [expect.objectContaining({ target: selected })] })
      expect(controller.snapshot()).not.toHaveProperty('activeTarget')
      const view = render(<ComposerReferenceDraftDockV2 controller={controller} />)
      expect(view.container.innerHTML).toBe('')
      expect(controller.draftFor(selected)?.references.map(item => item.id)).toEqual(['kept'])
    },
  )

  it('keeps two exact ranges from the same owner file as separate rows', () => {
    const controller = new ComposerReferenceDraftControllerV2()
    controller.setHostAvailability(true)
    const selected = target('conversation-a')
    controller.insert(selected, reference('range-a', { owner: 'dsh.local', ref: 'file-1', scope: 'file/raw', window: { start: 0, end: 4 } }))
    controller.insert(selected, reference('range-b', { owner: 'dsh.local', ref: 'file-1', scope: 'file/raw', window: { start: 8, end: 12 } }))
    expect(controller.draftFor(selected)?.references.map(item => item.id)).toEqual(['range-a', 'range-b'])
    controller.remove(selected, 'range-a')
    expect(controller.draftFor(selected)?.references.map(item => item.id)).toEqual(['range-b'])
  })

  it('replaces mirrored rows from authoritative Host occurrences and deduplicates exact repeats', () => {
    const controller = new ComposerReferenceDraftControllerV2()
    const selected = target('conversation-a')
    controller.replace(selected, [reference('same'), reference('same')])
    expect(controller.draftFor(selected)?.references.map(item => item.id)).toEqual(['same'])
    controller.replace({ ...selected, draftRevision: 2 }, [])
    expect(controller.draftFor(selected)?.references).toEqual([])
  })

  it('freezes submitted references and acknowledgement removes only that prepared snapshot', () => {
    const controller = new ComposerReferenceDraftControllerV2()
    controller.setHostAvailability(true)
    const selected = target('conversation-a')
    controller.insert(selected, reference('submitted'))
    expect(controller.prepare(selected, 'submission-1')).toMatchObject({ ok: true })
    controller.insert(selected, reference('next'))
    controller.acknowledge(selected, 'submission-1')
    expect(controller.draftFor(selected)?.references.map(item => item.id)).toEqual(['next'])
  })

  it('rejects a prepared snapshot without discarding the original reference', () => {
    const controller = new ComposerReferenceDraftControllerV2()
    controller.setHostAvailability(true)
    const selected = target('conversation-a')
    controller.insert(selected, reference('retry'))
    controller.prepare(selected, 'submission-1')
    controller.reject(selected, 'submission-1')
    expect(controller.draftFor(selected)?.references).toMatchObject([{ id: 'retry', freshness: 'fresh' }])
  })

  it('shows the real target title and requests Host-backed row removal before changing local state', () => {
    const controller = new ComposerReferenceDraftControllerV2()
    controller.setHostAvailability(true)
    const selected = { ...target('conversation-a'), title: 'Main conversation' }
    controller.insert(selected, reference('shared'))
    const received = vi.fn()
    window.addEventListener(COMPOSER_REFERENCE_REMOVE_FROM_MAIN_EVENT, received)
    render(<ComposerReferenceDraftDockV2 controller={controller} />)
    fireEvent.click(screen.getByText('引用 1 · 目标：Main conversation'))
    fireEvent.click(screen.getByRole('button', { name: '从对话移除 Selection shared' }))
    expect(received).toHaveBeenCalledOnce()
    expect((received.mock.calls[0]?.[0] as CustomEvent).detail).toMatchObject({ referenceId: 'shared', target: selected })
    expect(controller.draftFor(selected)?.references).toHaveLength(1)
    window.removeEventListener(COMPOSER_REFERENCE_REMOVE_FROM_MAIN_EVENT, received)
  })
})
