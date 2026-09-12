// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToolsPane } from '../src/client/pane.tsx'
import { SessionToolsWorkspace } from '../src/client/workspace-state.ts'
import { en } from '../src/client/locales.ts'

const menuFixture = vi.hoisted(() => ({ measuring: false }))

// The official Menu barrel imports renderer CSS; interaction semantics are tested
// here through its public props, with the real primitive covered by browser gates.
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ Menu: ({ open, anchor, items, onSelect }: { open: boolean; anchor: import('react').ReactNode; items: { id: string; label: import('react').ReactNode; disabled?: boolean }[]; onSelect: (id: string) => void }) => <>{anchor}{open && <div role="menu" style={{ visibility: menuFixture.measuring ? 'hidden' : 'visible' }}>{items.map(item => <button role="menuitem" key={item.id} disabled={item.disabled} onClick={() => onSelect(item.id)}>{item.label}</button>)}</div>}</> }))

afterEach(() => { menuFixture.measuring = false; cleanup(); vi.useRealTimers() })
function observable<T>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()
  return { getSnapshot: () => state, subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }, set: (next: T) => { state = next; for (const fn of listeners) fn() }, listeners }
}
function snapshot(tool: string, callView?: unknown) { return { legacy: { nodes: [{ kind: 'tool-result', seq: 1, time: 2000, callTime: 1000, call: { name: tool }, isError: true, ...(callView !== undefined ? { callView } : {}) }], runningCalls: [] } } }
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
    await screen.findByText('read_a', { selector: '.tools-row-title strong' })
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
  it('shares filters and selection between A tab and fixed A pane, without affecting B', async () => {
    const h = harness()
    const first = render(<ToolsPane {...h.props} sessionId="a" />)
    const second = render(<ToolsPane {...h.props} sessionId="a" />)
    const third = render(<ToolsPane {...h.props} sessionId="b" />)
    await screen.findAllByText('read_b', { selector: '.tools-row-title strong' })
    fireEvent.click(first.container.querySelector('.tools-row-main')!)
    expect(second.container.querySelector('.tools-details-pane')).toBeTruthy()
    expect(third.container.querySelector('.tools-details-pane')).toBeNull()
    fireEvent.click(first.container.querySelector('.tools-family-tabs button:nth-child(2)')!)
    expect(second.container.querySelector('.tools-family-tabs button:nth-child(2)')?.getAttribute('aria-pressed')).toBe('true')
    first.unmount(); second.unmount(); third.unmount()
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

it('keeps auxiliary actions in More and restores its trigger after choosing', () => {
  const h = harness(), onPin = vi.fn()
  render(<ToolsPane {...h.props} sessionId="a" onPin={onPin} />)
  expect(screen.queryByRole('menuitem')).toBeNull()
  const trigger = screen.getByRole('button', { name: 'More' })
  fireEvent.click(trigger)
  fireEvent.click(screen.getByRole('menuitem', { name: 'Pin to side pane' }))
  expect(onPin).toHaveBeenCalledOnce()
  expect(screen.queryByRole('menuitem')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

it('owns More keyboard navigation, skipping disabled entries and returning focus', () => {
  const h = harness(), hostKey = vi.fn()
  const view = render(<div onKeyDown={hostKey}><ToolsPane {...h.props} manager onPin={vi.fn()} onOpenSession={vi.fn()} onManage={vi.fn()} /></div>)
  const trigger = screen.getByRole('button', { name: 'More' })
  fireEvent.click(trigger)
  const first = screen.getByRole('menuitem', { name: 'Pin to side pane' })
  const middle = screen.getByRole('menuitem', { name: 'Open conversation' })
  const last = screen.getByRole('menuitem', { name: 'Manage global tools' })
  expect(document.activeElement).toBe(first)
  fireEvent.keyDown(first, { key: 'ArrowDown' }); expect(document.activeElement).toBe(middle)
  fireEvent.keyDown(middle, { key: 'End' }); expect(document.activeElement).toBe(last)
  fireEvent.keyDown(last, { key: 'ArrowDown' }); expect(document.activeElement).toBe(first)
  fireEvent.keyDown(first, { key: 'ArrowUp' }); expect(document.activeElement).toBe(last)
  fireEvent.keyDown(last, { key: 'Home' }); expect(document.activeElement).toBe(first)
  fireEvent.keyDown(first, { key: 'Escape' })
  expect(document.activeElement).toBe(trigger)
  expect(screen.queryByRole('menu')).toBeNull()
  fireEvent.click(trigger)
  expect(fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Pin to side pane' }), { key: 'Tab' })).toBe(true)
  expect(screen.queryByRole('menu')).toBeNull()
  expect(document.activeElement).toBe(trigger)
  expect(hostKey).not.toHaveBeenCalled()
  view.unmount()
})

it('focuses the first item after the portal measurement pass becomes visible', async () => {
  menuFixture.measuring = true
  const h = harness()
  const view = render(<ToolsPane {...h.props} sessionId="a" onPin={vi.fn()} />)
  const trigger = screen.getByRole('button', { name: 'More' })
  trigger.focus()
  fireEvent.click(trigger)
  expect(document.activeElement).toBe(trigger)
  const menu = screen.getByRole('menu', { hidden: true })
  menu.style.visibility = 'visible'
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('menuitem')))
  view.unmount()
})
