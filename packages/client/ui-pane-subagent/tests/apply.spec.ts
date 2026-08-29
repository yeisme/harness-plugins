// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { apply, inject } from '../src/index.js'

afterEach(cleanup)

function fakeCtx(options: { pane?: { registerView: ReturnType<typeof vi.fn>; openView: ReturnType<typeof vi.fn> } } = {}) {
  const registered: Array<{ name: string; component?: () => unknown }> = []
  const serviceListeners = new Set<(name: string, value: unknown) => void>()
  const slots = {
    inject: (_name: string, setup: () => () => void) => setup(),
    register: (input: { name: string }, component?: () => unknown) => {
      const entry = { name: input.name, component }
      registered.push(entry)
      return () => {
        const index = registered.indexOf(entry)
        if (index >= 0) registered.splice(index, 1)
      }
    },
  }
  const sessions = {
    list: {
      getSnapshot: () => ({ current: 's-1', byId: {}, subagentsByParent: {} }),
      subscribe: () => () => {},
    },
    openSubagent: vi.fn(),
    refreshSubagents: vi.fn(),
  }
  const connection = {
    api: {
      subagents: {
        history: vi.fn(),
        prompt: vi.fn(),
        interrupt: vi.fn(),
      },
    },
  }
  const services = new Map<string, unknown>([
    ['slots', slots],
    ['sessions', sessions],
    ['connection', connection],
  ])
  if (options.pane !== undefined) services.set('paneWorkbench', options.pane)
  return {
    registered,
    pane: options.pane,
    ctx: {
      get: (name: string) => {
        return services.get(name)
      },
      on: (name: string, listener: (serviceName: string, value: unknown) => void) => {
        if (name !== 'internal/service') return () => {}
        serviceListeners.add(listener)
        return () => { serviceListeners.delete(listener) }
      },
      provide: (name: string, value: unknown) => { services.set(name, value) },
    },
    laterProvidePane(pane: { registerView: ReturnType<typeof vi.fn>; openView: ReturnType<typeof vi.fn> }) {
      services.set('paneWorkbench', pane)
      for (const listener of serviceListeners) listener('paneWorkbench', pane)
    },
  }
}

describe('Subagent Monitor apply', () => {
  it('does not make the optional Pane Workbench capability a loader dependency', () => {
    expect(inject).toEqual(['sessions', 'connection', 'slots'])
  })

  it('registers one icon-backed Agents sidebar launcher and opens the pane', () => {
    const pane = { registerView: vi.fn(() => vi.fn()), openView: vi.fn() }
    const { ctx, registered } = fakeCtx({ pane })
    apply(ctx as never)
    expect(registered).toHaveLength(1)
    render(registered[0]!.component?.({ wide: true }) as never)
    const button = screen.getByRole('button', { name: 'Agents' })
    expect(button.querySelector('svg')).not.toBeNull()
    expect(button.textContent).toBe('')
    expect(document.querySelector('[data-subagent-monitor-sidebar]')?.getAttribute('data-wide')).toBe('false')
    fireEvent.click(button)
    expect(pane.registerView).toHaveBeenCalledOnce()
    expect(pane.openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'subagent.monitor', preferredRegion: 'right' }))
  })

  it('activates without paneWorkbench and renders an actionable disabled launcher', () => {
    const { ctx, registered } = fakeCtx()
    const dispose = apply(ctx as never)

    expect(registered).toHaveLength(1)
    render(registered[0]!.component?.({ wide: true }) as never)
    const button = screen.getByRole('button', { name: /Pane Workbench is unavailable/iu })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.getAttribute('title')).toMatch(/Pane Workbench is unavailable/iu)

    fireEvent.click(button)
    expect(() => dispose()).not.toThrow()
  })

  it('hot-plugs paneWorkbench after activation and enables the launcher', () => {
    const host = fakeCtx()
    const dispose = apply(host.ctx as never)
    const pane = { registerView: vi.fn(() => vi.fn()), openView: vi.fn() }

    host.laterProvidePane(pane)
    expect(pane.registerView).toHaveBeenCalledOnce()
    expect(host.registered).toHaveLength(1)
    render(host.registered[0]!.component?.({ wide: true }) as never)
    const button = screen.getByRole('button', { name: 'Agents' })
    expect(button.hasAttribute('disabled')).toBe(false)
    fireEvent.click(button)
    expect(pane.openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'subagent.monitor' }))

    dispose()
  })
})
