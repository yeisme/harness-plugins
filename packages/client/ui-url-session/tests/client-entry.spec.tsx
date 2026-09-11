// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { applyClient } from '../src/client-entry.ts'
import type { SessionsServiceLike } from '../src/sessions-adapter.ts'

afterEach(() => {
  cleanup()
  window.history.replaceState({}, '', '/')
  vi.restoreAllMocks()
})

interface SlotRegistration {
  readonly input: { readonly name: string; readonly id: string; readonly order: number }
  readonly component: () => unknown
}

function harness(service: SessionsServiceLike | undefined, currentUrl: string) {
  window.history.replaceState({}, '', currentUrl)
  const registrations: SlotRegistration[] = []
  const slots = {
    inject: vi.fn((_name: string, setup: () => () => void) => setup()),
    register: vi.fn((input: { name: string; id: string; order: number }, component: () => unknown) => {
      registrations.push({ input, component })
      return () => {}
    }),
  }
  const ctx = { get: (key: string) => (key === 'sessions' ? service : key === 'slots' ? slots : undefined) }
  const dispose = applyClient(ctx as never)
  return { dispose, registrations }
}

function serviceOf(rows: readonly string[], current?: string): SessionsServiceLike {
  const listeners = new Set<() => void>()
  const snapshot = { current, ids: [...rows], byId: Object.fromEntries(rows.map(id => [id, {}])) }
  return {
    list: {
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    },
    open: vi.fn((id: string) => { (snapshot as { current?: string }).current = id; for (const l of [...listeners]) l() }),
  } as SessionsServiceLike
}

function renderAll(registrations: readonly SlotRegistration[]): void {
  render(createElement('div', null, ...registrations.map(registration => registration.component())))
}

describe('applyClient (§3 wiring)', () => {
  it('registers nothing when the sessions seams are missing', () => {
    const { dispose, registrations } = harness(undefined, '/?s=sess-a')
    expect(registrations).toHaveLength(0)
    dispose()
  })

  it('deep link selects the session and shows no empty state', async () => {
    const service = serviceOf(['sess-a'])
    const { dispose, registrations } = harness(service, '/?s=sess-a')
    renderAll(registrations)
    await waitFor(() => expect(service.open).toHaveBeenCalledWith('sess-a'))
    expect(screen.queryByText('会话不存在或已被清理')).toBeNull()
    dispose()
  })

  it('missing session renders the in-conversation empty state; 返回列表 clears the URL claim', async () => {
    const service = serviceOf(['sess-a'])
    const { dispose, registrations } = harness(service, '/?s=sess-gone')
    renderAll(registrations)
    const back = await screen.findByRole('button', { name: '返回列表' })
    expect(window.location.search).toBe('?s=sess-gone')
    fireEvent.click(back)
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe('/'))
    expect(screen.queryByRole('region', { name: '会话不存在或已被清理' })).toBeNull()
    dispose()
  })

  it('sidebar selection pushes the session URL (query alias, token-free)', async () => {
    const service = serviceOf(['sess-a', 'sess-b'], 'sess-a')
    const { dispose, registrations } = harness(service, '/')
    renderAll(registrations)
    await waitFor(() => expect(window.location.search).toBe('?s=sess-a'))
    dispose()
  })

  it('popstate reverse-selects the claimed session', async () => {
    const service = serviceOf(['sess-a', 'sess-b'])
    const { dispose, registrations } = harness(service, '/?s=sess-a')
    renderAll(registrations)
    await waitFor(() => expect(service.open).toHaveBeenCalledWith('sess-a'))
    window.history.replaceState({}, '', '/?s=sess-b')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await waitFor(() => expect(service.open).toHaveBeenCalledWith('sess-b'))
    dispose()
  })

  it('dispose removes listeners and further selections do not reopen sessions', async () => {
    const service = serviceOf(['sess-a'])
    const { dispose, registrations } = harness(service, '/?s=sess-a')
    renderAll(registrations)
    await waitFor(() => expect(service.open).toHaveBeenCalledWith('sess-a'))
    dispose()
    const calls = (service.open as ReturnType<typeof vi.fn>).mock.calls.length
    window.history.replaceState({}, '', '/?s=sess-b')
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect((service.open as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls)
  })
})
