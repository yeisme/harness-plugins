// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { apply } from '../src/client.ts'
import { creatorSnapshot } from './fixtures.ts'

afterEach(() => { cleanup(); vi.useRealTimers() })

describe('Creator Studio client composition', () => {
  it('publishes one shared runtime and revokes the provider on dispose', async () => {
    vi.useFakeTimers()
    const unregisterRuntime = vi.fn()
    const provide = vi.fn((name: string) => name === 'creatorStudioRuntime' ? unregisterRuntime : vi.fn())
    const remote = {
      snapshot: vi.fn(async () => ({ ok: true as const, value: creatorSnapshot() })),
      dispatch: vi.fn(async () => ({ ok: true as const, value: { status: 'accepted' as const, receiptRef: 'receipt:one' } })),
      resolveArtifact: vi.fn(async () => ({ ok: true as const, value: null })),
    }
    const slots = { inject: vi.fn((_name: string, setup: () => () => void) => setup()), register: vi.fn(() => vi.fn()) }
    const pane = { registerView: vi.fn(() => vi.fn()), registerPlugin: vi.fn(() => vi.fn()), openView: vi.fn() }
    const ctx = {
      provide,
      get: vi.fn((name: string) => name === 'slots' ? slots : name === 'paneWorkbench' ? pane : name === 'remote.creatorStudio' ? remote : undefined),
      on: vi.fn(() => vi.fn()),
    }

    const dispose = apply(ctx as never)
    await Promise.resolve()
    await Promise.resolve()
    expect(provide).toHaveBeenCalledWith('creatorStudioRuntime', expect.objectContaining({
      schemaVersion: 'creator.studio.runtime.v1alpha1',
      mode: 'shared',
      canMutate: true,
      getSnapshot: expect.any(Function),
      subscribe: expect.any(Function),
      refresh: expect.any(Function),
    }))
    dispose()
    expect(unregisterRuntime).toHaveBeenCalledOnce()
  })

  it('registers one plugin catalog and one sidebar launcher', async () => {
    vi.useFakeTimers()
    const openView = vi.fn()
    const unregisterPlugin = vi.fn()
    const registerPlugin = vi.fn(() => unregisterPlugin)
    const register = vi.fn(() => vi.fn())
    const slots = { inject: vi.fn((_name: string, setup: () => () => void) => setup()), register }
    const unregisterLocale = vi.fn()
    const locale = { register: vi.fn(() => unregisterLocale), bind: vi.fn(() => (key: string) => key) }
    const remote = {
      snapshot: vi.fn(async () => ({ ok: true as const, value: creatorSnapshot() })),
      dispatch: vi.fn(async () => ({ ok: true as const, value: { status: 'accepted' as const, receiptRef: 'receipt:one' } })),
      resolveArtifact: vi.fn(async () => ({ ok: true as const, value: null })),
    }
    const applyPreset = vi.fn()
    const applyShowControlPreset = vi.fn()
    const sessions = { list: { getSnapshot: () => ({ current: 'session:one' }), subscribe: vi.fn(() => vi.fn()) } }
    const pane = { registerView: vi.fn(() => vi.fn()), registerPlugin, openView, controller: { dispatch: vi.fn() } }
    const ctx = {
      locale,
      get: vi.fn((name: string) => name === 'slots' ? slots : name === 'paneWorkbench' ? pane : name === 'remote.creatorStudio' ? remote : name === 'sessions' ? sessions : name === 'dramaDirector' ? { applyPreset, applyShowControlPreset, probe: { showControl: { available: true } } } : undefined),
      on: vi.fn(() => vi.fn()),
    }
    const dispose = apply(ctx as never)
    await Promise.resolve()
    const runtime = registerPlugin.mock.calls[0]?.[0]
    expect(runtime.definition.views.map((view: { kind: string }) => view.kind)).toEqual(expect.arrayContaining(['creator.home', 'creator.text', 'creator.visual', 'creator.audio', 'creator.production', 'creator.context', 'creator.assets', 'creator.analysis', 'creator.generation', 'creator.approvals', 'creator.review', 'creator.jobs', 'creator.media']))
    expect(locale.register).toHaveBeenCalledWith('creatorStudio', expect.objectContaining({ zh: expect.any(Object), en: expect.any(Object), 'pseudo-long': expect.any(Object), 'pseudo-rtl': expect.any(Object) }))
    expect(slots.inject).toHaveBeenCalledWith('sidebar.footer.action', expect.any(Function))
    expect(slots.inject).not.toHaveBeenCalledWith('conversation.session.header.actions', expect.any(Function))
    const launcher = register.mock.calls.find(call => call[0].id === 'creator-studio-sidebar')?.[1] as () => ReactNode
    render(createElement('div', null, launcher()))
    const button = screen.getByRole('button', { name: '创作' })
    expect(button.querySelector('svg')).not.toBeNull()
    expect(button.textContent).toBe('')
    expect(document.querySelector('[data-creator-studio-launcher]')?.getAttribute('data-wide')).toBe('false')
    fireEvent.click(button)
    expect(openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'creator.home', preferredRegion: 'right' }))
    expect(openView).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'creator.jobs' }))
    runtime.commandHandlers['creator.open']()
    expect(openView.mock.calls.filter(call => call[0]?.kind === 'creator.home')).toHaveLength(2)
    expect(runtime.definition.commands.map((command: { id: string }) => command.id)).toEqual(expect.arrayContaining(['creator.open.assets', 'creator.open.generation', 'creator.open.approvals', 'creator.open.review', 'creator.open.jobs']))
    const creatorHome = runtime.viewFactories['creator-home']() as { props: { onOpenDrama(): void; onOpenShowControl(): void } }
    creatorHome.props.onOpenDrama()
    expect(applyPreset).toHaveBeenCalledOnce()
    creatorHome.props.onOpenShowControl()
    expect(applyShowControlPreset).toHaveBeenCalledOnce()
    dispose()
    expect(unregisterPlugin).toHaveBeenCalledOnce()
    expect(unregisterLocale).toHaveBeenCalledOnce()
  })

  it('shows a disabled capability entry instead of mounting an overlay when Pane V2 is absent', async () => {
    const register = vi.fn(() => vi.fn())
    const slots = { inject: vi.fn((_name: string, setup: () => () => void) => setup()), register }
    const ctx = { get: vi.fn((name: string) => name === 'slots' ? slots : undefined) }
    const dispose = apply(ctx as never)
    await Promise.resolve()
    const unavailable = register.mock.calls[0]?.[1] as () => ReactNode
    render(createElement('div', null, unavailable()))
    const button = screen.getByRole('button', { name: '创作' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.querySelector('svg')).not.toBeNull()
    expect(document.querySelector('[data-pane-workbench]')).toBeNull()
    dispose()
  })
})
