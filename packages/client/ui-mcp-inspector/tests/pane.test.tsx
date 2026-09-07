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
    expect(screen.getByText('read_a', { selector: '.tools-record-label' })).toBeTruthy()
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

describe('execution summary and reveal lifecycle', () => {
  it('renders the owner command summary in a code area with a bounded missing state', () => {
    const h = harness()
    act(() => h.a.set(snapshot('read_a', { card: 'terminal', title: 'npm run check', description: 'Run gates' })))
    const view = render(<ToolsPane {...h.props} sessionId="a" />)
    fireEvent.click(view.container.querySelector('.tools-record-name')!)
    expect(view.container.querySelector('.tools-call-command')?.textContent).toBe('npm run check')
    expect(view.container.textContent).toContain('Run gates')
    expect(view.container.textContent).not.toContain('argsRaw')
    view.unmount()
    const plain = harness()
    const view2 = render(<ToolsPane {...plain.props} sessionId="a" />)
    fireEvent.click(view2.container.querySelector('.tools-record-name')!)
    expect(view2.container.textContent).toContain(en['activity.summaryUnavailable'])
    view2.unmount()
  })

  it('marks a located row after a successful reveal and replaces the previous marker', () => {
    const h = harness()
    act(() => h.a.set({ legacy: { nodes: [
      { kind: 'tool-result', seq: 1, time: 2000, callTime: 1000, call: { name: 'read_a' }, isError: true },
      { kind: 'tool-result', seq: 2, time: 3000, callTime: 2500, call: { name: 'read_b' }, isError: true },
    ], runningCalls: [] } }))
    const reveal = vi.fn(() => true)
    const view = render(<ToolsPane {...h.props} sessionId="a" onRevealCall={reveal} />)
    // Rows are newest-first: the read_a row (seq 1) sits below read_b (seq 2).
    const rowFor = (tool: string) => view.container.querySelector(`.tools-activity-row:nth-child(${tool === 'read_a' ? 2 : 1})`)!
    fireEvent.click(rowFor('read_a').querySelector('.tools-record-name')!)
    fireEvent.click(screen.getByRole('button', { name: en['activity.reveal'] }))
    expect(reveal).toHaveBeenCalledWith(expect.objectContaining({ tool: 'read_a', sequence: 1 }))
    expect(rowFor('read_a').getAttribute('data-located')).toBe('true')
    expect(view.container.textContent).toContain(en['activity.located'])
    fireEvent.click(rowFor('read_b').querySelector('.tools-record-name')!)
    fireEvent.click(screen.getByRole('button', { name: en['activity.reveal'] }))
    expect(reveal).toHaveBeenLastCalledWith(expect.objectContaining({ tool: 'read_b', sequence: 2 }))
    expect(rowFor('read_a').getAttribute('data-located')).toBe(null)
    expect(rowFor('read_b').getAttribute('data-located')).toBe('true')
    expect(view.container.textContent).not.toContain(en['activity.revealFailed'])
    view.unmount()
  })

  it('locates by call reference, not by tool name: same-named rows stay distinct', () => {
    const h = harness()
    act(() => h.a.set({ legacy: { nodes: [
      { kind: 'tool-result', seq: 11, time: 2000, callTime: 1000, call: { name: 'bash' }, isError: false },
      { kind: 'tool-result', seq: 12, time: 3000, callTime: 2500, call: { name: 'bash' }, isError: false },
    ], runningCalls: [] } }))
    const reveal = vi.fn(() => true)
    const view = render(<ToolsPane {...h.props} sessionId="a" onRevealCall={reveal} />)
    const rows = view.container.querySelectorAll('.tools-activity-row')
    fireEvent.click(rows[1].querySelector('.tools-record-name')!)
    fireEvent.click(screen.getByRole('button', { name: en['activity.reveal'] }))
    expect(reveal).toHaveBeenCalledWith(expect.objectContaining({ tool: 'bash', sequence: 11 }))
    expect(rows[0].getAttribute('data-located')).toBe(null)
    expect(rows[1].getAttribute('data-located')).toBe('true')
    view.unmount()
  })

  it('keeps the details and explains when reveal fails, without marking any row', () => {
    const h = harness()
    const reveal = vi.fn(() => false)
    const view = render(<ToolsPane {...h.props} sessionId="a" onRevealCall={reveal} />)
    fireEvent.click(view.container.querySelector('.tools-record-name')!)
    fireEvent.click(screen.getByRole('button', { name: en['activity.reveal'] }))
    expect(reveal).toHaveBeenCalled()
    expect(view.container.querySelector('.tools-call-details')).toBeTruthy()
    expect(view.container.textContent).toContain(en['activity.revealFailed'])
    expect(view.container.querySelector('.tools-activity-row')?.getAttribute('data-located')).toBe(null)
    view.unmount()
  })

  it('exposes reveal as a focusable native button and marks the target on activation', async () => {
    const h = harness(), reveal = vi.fn(() => true)
    const view = render(<ToolsPane {...h.props} sessionId="a" onRevealCall={reveal} />)
    const row = view.container.querySelector('.tools-record-name') as HTMLButtonElement
    row.focus()
    expect(document.activeElement).toBe(row)
    fireEvent.click(row)
    const button = screen.getByRole('button', { name: en['activity.reveal'] }) as HTMLButtonElement
    expect(button.tagName).toBe('BUTTON')
    expect(button.disabled).toBe(false)
    button.focus()
    expect(document.activeElement).toBe(button)
    fireEvent.click(button)
    expect(reveal).toHaveBeenCalledWith(expect.objectContaining({ tool: 'read_a', sequence: 1 }))
    expect(view.container.querySelector('.tools-activity-row')?.getAttribute('data-located')).toBe('true')
    // Escape returns to the initiating row without losing the details state.
    fireEvent.keyDown(view.container.querySelector('.tools-call-details')!, { key: 'Escape' })
    await waitFor(() => expect(document.activeElement).toBe(view.container.querySelector('.tools-activity-row .tools-record-name')))
    view.unmount()
  })
})
