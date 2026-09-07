// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToolsPane } from '../src/client/pane.tsx'
import { SessionToolsWorkspace } from '../src/client/workspace-state.ts'
import { en } from '../src/client/locales.ts'

afterEach(() => { cleanup(); vi.useRealTimers() })
function observable<T>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()
  return { getSnapshot: () => state, subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }, set: (next: T) => { state = next; for (const fn of listeners) fn() }, listeners }
}
function snapshot(tool: string) { return { legacy: { nodes: [{ kind: 'tool-result', seq: 1, time: 2000, callTime: 1000, call: { name: tool }, isError: true }], runningCalls: [] } } }
const t = (key: keyof typeof en) => en[key]
const catalog = { ok: true, specVersion: '1.0', complete: true, generation: 1, skillsAvailable: true, toolsAvailable: true, mcpInventoryAvailable: true, items: [] }
function harness() {
  const a = observable(snapshot('read_a')), b = observable(snapshot('read_b'))
  const list = observable({ current: 'a', ids: ['a','b'], byId: { a: { id: 'a', displayTitle: 'A' }, b: { id: 'b', displayTitle: 'B' } } })
  const sessions = { list, binding: (id: string) => ({ session: id === 'a' ? a : b }) }
  const toolList = vi.fn(async ({ sessionId }: { sessionId: string }) => ({ ok: true, value: { tools: [{ name: `read_${sessionId}` }] } }))
  const root: Record<string, unknown> = { referenceTools: { list: toolList }, skills: { list: async () => ({ ok: true, value: { skills: [] } }) } }
  const ctx = { get: (key: string) => key === 'remote' ? root : undefined }
  const workspace = new SessionToolsWorkspace(ctx as never)
  const props = { ctx: ctx as never, sessions: sessions as never, workspace, t }
  return { a, b, list, root, toolList, props, workspace }
}
describe('explicit Session Tools affinity', () => {
  it('keeps A bound when global current becomes B and reads only A catalog', async () => {
    const h = harness(); const view = render(<ToolsPane {...h.props} sessionId="a" />)
    expect(screen.getByText('read_a', { selector: '.tools-record-name' })).toBeTruthy()
    act(() => h.list.set({ ...h.list.getSnapshot(), current: 'b' }))
    expect(screen.queryByText('read_b')).toBeNull()
    await waitFor(() => expect(h.toolList).toHaveBeenCalledWith({ sessionId: 'a' }, expect.anything()))
    expect(h.b.listeners.size).toBe(0)
    view.unmount(); expect(h.a.listeners.size).toBe(0)
  })
  it('requires explicit selection for legacy panes and never adopts global current', () => {
    const h = harness(), onSessionSelected = vi.fn()
    render(<ToolsPane {...h.props} onSessionSelected={onSessionSelected} />)
    expect(screen.getByRole('combobox')).toBeTruthy()
    expect(screen.queryByText('read_a')).toBeNull()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } })
    expect(onSessionSelected).toHaveBeenCalledWith('b')
    expect(h.toolList).not.toHaveBeenCalled()
  })
  it('shares filters and call selection between A tab and fixed A pane, without affecting B', async () => {
    const h = harness()
    const first = render(<ToolsPane {...h.props} sessionId="a" />)
    const second = render(<ToolsPane {...h.props} sessionId="a" />)
    const third = render(<ToolsPane {...h.props} sessionId="b" />)
    fireEvent.click(first.container.querySelector('.tools-record-name')!)
    expect(second.container.querySelector('.tools-call-details')).toBeTruthy()
    expect(third.container.querySelector('.tools-call-details')).toBeNull()
    fireEvent.click(first.container.querySelector('.tools-activity-filter button:nth-child(2)')!)
    expect(second.container.querySelector('.tools-activity-filter button:nth-child(2)')?.getAttribute('aria-pressed')).toBe('true')
    first.unmount()
    act(() => h.a.set(snapshot('next_a')))
    expect(second.container.textContent).toContain('next_a')
    expect(h.a.listeners.size).toBe(1)
    second.unmount(); expect(h.a.listeners.size).toBe(0)
    third.unmount()
  })
  it('keeps a deleted A visible as unavailable rather than showing B', () => {
    const h = harness(); render(<ToolsPane {...h.props} sessionId="a" />)
    act(() => h.list.set({ current: 'b', ids: ['b'], byId: { b: h.list.getSnapshot().byId.b } } as never))
    expect(screen.getByText(en['session.missing'])).toBeTruthy()
    expect(screen.queryByText('read_b')).toBeNull()
    expect(h.a.listeners.size).toBe(0)
  })
  it('recovers global catalog after the namespace becomes available without remount', async () => {
    const h = harness(); render(<ToolsPane {...h.props} manager />)
    await screen.findByRole('alert')
    h.root.toolHub = { list: async () => ({ ok: true, value: catalog }), setEnabled: vi.fn() }
    fireEvent.click(screen.getAllByRole('button', { name: 'Recheck' })[0]!)
    await screen.findByText('Catalog complete')
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('passes a selected call to the explicit session navigation callback without executing it', () => {
    const h = harness(), reveal = vi.fn(); const view = render(<ToolsPane {...h.props} sessionId="a" onRevealCall={reveal} />)
    fireEvent.click(view.container.querySelector('.tools-record-name')!)
    fireEvent.click(screen.getByRole('button', { name: en['activity.reveal'] }))
    expect(reveal).toHaveBeenCalledWith(expect.objectContaining({ tool: 'read_a', sequence: 1 }))
  })
})

it('releases polling only after the final view and survives a StrictMode retain cycle', async () => {
  vi.useFakeTimers({toFake:['setInterval','clearInterval']})
  const h=harness(),resource=h.workspace.get('a')
  const dispose=vi.spyOn(resource.controller,'dispose')
  const one=h.workspace.retain('a'),two=h.workspace.retain('a')
  expect(vi.getTimerCount()).toBe(1)
  one(); await Promise.resolve();expect(dispose).not.toHaveBeenCalled()
  two();const again=h.workspace.retain('a');await Promise.resolve()
  expect(h.workspace.get('a')).toBe(resource);expect(dispose).not.toHaveBeenCalled()
  again();await Promise.resolve();expect(dispose).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0)
  h.workspace.dispose()
})
