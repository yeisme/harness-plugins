// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { installOfficialWorkbenchHost, officialWorkspaceRightSlotDeclared, OFFICIAL_WORKSPACE_RIGHT_SLOT } from '../src/client/official-host.ts'
import { createWorkbenchHostSlotRegistrar } from '../src/host-slot.ts'

afterEach(cleanup)

interface SlotsHarness {
  slots: {
    inject: ReturnType<typeof vi.fn>
    register: ReturnType<typeof vi.fn>
    spec: ReturnType<typeof vi.fn>
  }
  disposers: Array<() => void>
}

function fakeContext(withPane: boolean, withOfficialSlot: boolean, declared: Set<string> = new Set(['conversation.session.header.actions'])): { ctx: ClientContext } & SlotsHarness {
  const disposers: Array<() => void> = []
  const slots = {
    inject: vi.fn((name: string, setup: () => () => void) => {
      if (!declared.has(name)) return () => {}
      const dispose = setup()
      disposers.push(dispose)
      return dispose
    }),
    register: vi.fn(() => {
      const dispose = vi.fn()
      disposers.push(dispose)
      return dispose
    }),
    spec: vi.fn((name: string) => (declared.has(name) ? { kind: 'single', scope: 'root' } : undefined)),
  }
  const paneWorkbench = withPane ? {
    registerView: vi.fn(() => {
      const dispose = vi.fn()
      disposers.push(dispose)
      return dispose
    }),
    openView: vi.fn(),
  } : undefined
  const workspaces = { listDirectory: vi.fn(async () => ({ path: '.', entries: [] })) }
  const ctx = {
    slots,
    get: vi.fn((name: string) => name === 'slots' ? slots : name === 'paneWorkbench' ? paneWorkbench : name === 'workspaces' ? workspaces : undefined),
  } as unknown as ClientContext
  return { ctx, slots, disposers }
}

describe('official Workbench/Pane host integration (compose 6.3)', () => {
  it('degrades to a no-op without the Pane Workbench host and without the official slot', () => {
    const { ctx, slots } = fakeContext(false, false)
    const dispose = installOfficialWorkbenchHost(ctx)
    expect(typeof dispose).toBe('function')
    expect(slots.inject).not.toHaveBeenCalled()
    expect(slots.register).not.toHaveBeenCalled()
    dispose()
    expect(slots.inject).not.toHaveBeenCalled()
  })

  it('registers a picker-visible composed pane view through the Pane Workbench host and never double-claims the slot', () => {
    const { ctx, slots } = fakeContext(true, true)
    const dispose = installOfficialWorkbenchHost(ctx)
    const pane = ctx.get('paneWorkbench' as never) as unknown as { registerView: ReturnType<typeof vi.fn> }
    expect(pane.registerView).toHaveBeenCalledWith(expect.objectContaining({
      descriptor: expect.objectContaining({ kind: 'workbench.compose', preferredRegion: 'right', singleton: true }),
      showInPicker: true,
    }))
    // The Pane Workbench host owns the official single-kind regions; the
    // composed workbench must not register the slot itself.
    expect(slots.inject).not.toHaveBeenCalledWith(OFFICIAL_WORKSPACE_RIGHT_SLOT, expect.any(Function))
    expect(slots.register).not.toHaveBeenCalled()
    dispose()
    expect(pane.registerView).toHaveBeenCalledTimes(1)
  })

  it('claims the official right slot directly when the Pane Workbench host is absent', () => {
    const declared = new Set([OFFICIAL_WORKSPACE_RIGHT_SLOT])
    const { ctx, slots } = fakeContext(false, true, declared)
    const dispose = installOfficialWorkbenchHost(ctx)
    expect(officialWorkspaceRightSlotDeclared(slots as never)).toBe(true)
    expect(slots.inject).toHaveBeenCalledWith(OFFICIAL_WORKSPACE_RIGHT_SLOT, expect.any(Function))
    expect(slots.register).toHaveBeenCalledWith(
      expect.objectContaining({ name: OFFICIAL_WORKSPACE_RIGHT_SLOT }),
      expect.any(Function),
    )
    dispose()
    for (const registered of (slots.register as ReturnType<typeof vi.fn>).mock.results) {
      expect((registered.value as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
    }
  })

  it('renders the composed workbench body and stays hidden while the region is hidden', () => {
    const declared = new Set([OFFICIAL_WORKSPACE_RIGHT_SLOT])
    const { ctx, slots } = fakeContext(false, true, declared)
    installOfficialWorkbenchHost(ctx)
    const component = (slots.register as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as (props: never) => ReactNode
    expect(component).toBeTypeOf('function')

    render(createElement(component as never, { region: 'right', mode: 'dock', visible: true, maximized: false } as never))
    expect(screen.getByRole('button', { name: 'Composed workbench' })).toBeTruthy()
    cleanup()

    const { container } = render(createElement(component as never, { region: 'right', mode: 'hidden', visible: false } as never))
    expect(container.textContent).toBe('')
  })

  it('keeps the claim exclusive through the shared registrar contract', () => {
    const registrar = createWorkbenchHostSlotRegistrar()
    expect(registrar.registered).toBe(false)
    const handle = registrar.register()
    expect(registrar.registered).toBe(true)
    expect(() => registrar.register()).toThrow(TypeError)
    handle.dispose()
    expect(registrar.registered).toBe(false)
  })
})
