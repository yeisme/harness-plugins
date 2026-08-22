// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { apply } from '../src/client.ts'
import { creatorSnapshot } from './fixtures.ts'

afterEach(() => { cleanup(); vi.useRealTimers() })

describe('Creator Studio client composition', () => {
  it('registers one plugin catalog and one additive launcher in each reviewed slot', () => {
    vi.useFakeTimers()
    const openView = vi.fn()
    const registerPlugin = vi.fn(() => vi.fn())
    const register = vi.fn(() => vi.fn())
    const slots = { inject: vi.fn((_name: string, setup: () => () => void) => setup()), register }
    const remote = {
      snapshot: vi.fn(async () => ({ ok: true as const, value: creatorSnapshot() })),
      dispatch: vi.fn(async () => ({ ok: true as const, value: { status: 'accepted' as const, receiptRef: 'receipt:one' } })),
      resolveArtifact: vi.fn(async () => ({ ok: true as const, value: null })),
    }
    const sessions = { list: { getSnapshot: () => ({ current: 'session:one' }), subscribe: vi.fn(() => vi.fn()) } }
    const pane = { registerView: vi.fn(() => vi.fn()), registerPlugin, openView, controller: { dispatch: vi.fn() } }
    const ctx = {
      get: vi.fn((name: string) => name === 'slots' ? slots : name === 'paneWorkbench' ? pane : name === 'remote.creatorStudio' ? remote : name === 'sessions' ? sessions : undefined),
      on: vi.fn(() => vi.fn()),
    }
    const dispose = apply(ctx as never)
    const runtime = registerPlugin.mock.calls[0]?.[0]
    expect(runtime.definition.views.map((view: { kind: string }) => view.kind)).toEqual(expect.arrayContaining(['creator.home', 'creator.text', 'creator.visual', 'creator.audio', 'creator.production', 'creator.context', 'creator.analysis', 'creator.review', 'creator.jobs', 'creator.media']))
    expect(slots.inject).toHaveBeenCalledWith('conversation.session.header.actions', expect.any(Function))
    expect(slots.inject).toHaveBeenCalledWith('sidebar.footer.action', expect.any(Function))
    const launcher = register.mock.calls.find(call => call[0].id === 'creator-studio-open')?.[1] as () => ReactNode
    render(createElement('div', null, launcher()))
    fireEvent.click(screen.getByRole('button', { name: '创作' }))
    expect(openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'creator.home', preferredRegion: 'right' }))
    expect(openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'creator.jobs', preferredRegion: 'bottom' }))
    dispose()
  })

  it('shows a disabled capability entry instead of mounting an overlay when Pane V2 is absent', () => {
    const register = vi.fn(() => vi.fn())
    const slots = { inject: vi.fn((_name: string, setup: () => () => void) => setup()), register }
    const ctx = { get: vi.fn((name: string) => name === 'slots' ? slots : undefined) }
    const dispose = apply(ctx as never)
    const unavailable = register.mock.calls[0]?.[1] as () => ReactNode
    render(createElement('div', null, unavailable()))
    expect((screen.getByRole('button', { name: '创作' }) as HTMLButtonElement).disabled).toBe(true)
    expect(document.querySelector('[data-pane-workbench]')).toBeNull()
    dispose()
  })
})
