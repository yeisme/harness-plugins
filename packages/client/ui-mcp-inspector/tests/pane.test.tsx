// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToolsPane } from '../src/client/pane.tsx'
import { en } from '../src/client/locales.ts'
import { resolveToolHubRemote } from '../src/client/remote.ts'

vi.mock('../src/client/remote.ts', async importOriginal => ({
  ...await importOriginal<typeof import('../src/client/remote.ts')>(),
  resolveToolHubRemote: vi.fn(),
}))
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers() })

function observable<T>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    set: (next: T) => { state = next; for (const fn of listeners) fn() },
    listeners,
  }
}
function snapshot(tool: string, running = false) {
  return {
    nodes: running ? [] : [{ kind: 'tool-result', seq: 1, time: 2000, callTime: 1000, call: { name: tool }, isError: false }],
    runningCalls: running ? [{ name: tool, time: 1000 }] : [],
  }
}
const catalog = {
  ok: true, specVersion: '1.0', complete: true, generation: 1,
  skillsAvailable: true, toolsAvailable: true, mcpInventoryAvailable: true,
  items: [
    { id: 'mcp:alpha', family: 'mcp', origin: 'mcp', name: 'alpha', label: 'alpha', source: 'mcp-client', availability: 'available', enabled: true, canToggle: true },
    { id: 'skill:writer', family: 'skill', origin: 'skill', name: 'writer', label: 'writer', source: 'user', availability: 'available', enabled: true, canToggle: true },
  ],
}
const t = (key: keyof typeof en) => en[key]

describe('session-following Tools pane', () => {
  it('defaults to MCP, streams activity and drops the previous session selection and subscriptions', async () => {
    const first = observable(snapshot('mcp__alpha__first', true))
    const second = observable(snapshot('mcp__beta__second'))
    const list = observable({ current: 'a' as string | undefined })
    const sessions = { list, binding: (id: string) => ({ session: id === 'a' ? first : second }) }
    const remote = { list: vi.fn(async () => catalog), setEnabled: vi.fn(async () => ({ ok: true })) }
    vi.mocked(resolveToolHubRemote).mockResolvedValue(remote as never)
    const ctx = {} as never
    const pane = render(<ToolsPane ctx={ctx} sessions={sessions as never} t={t} />)
    await screen.findByRole('button', { name: 'View details for alpha' })
    expect(screen.queryByRole('button', { name: 'View details for writer' })).toBeNull()
    expect(first.listeners.size).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'View details for alpha' }))
    expect(pane.container.querySelector('.tools-workspace')?.getAttribute('data-active-section')).toBe('details')
    act(() => first.set(snapshot('mcp__alpha__first')))
    act(() => list.set({ current: 'b' }))
    await waitFor(() => expect(first.listeners.size).toBe(0))
    expect(second.listeners.size).toBe(1)
    expect(pane.container.querySelector('.tools-workspace')?.getAttribute('data-active-section')).toBe('catalog')
    expect(screen.queryByText('mcp__alpha / first')).toBeNull()
    expect(screen.getByText('mcp__beta / second')).toBeTruthy()
    pane.unmount()
    expect(list.listeners.size).toBe(0)
    expect(second.listeners.size).toBe(0)
  })

  it('keeps activity usable without the host catalog and labels absent sessions', async () => {
    vi.mocked(resolveToolHubRemote).mockResolvedValue(undefined)
    const list = observable({ current: 'a' as string | undefined })
    const session = observable(snapshot('mcp__alpha__read'))
    const sessions = { list, binding: () => ({ session }) }
    render(<ToolsPane ctx={{} as never} sessions={sessions as never} t={t} />)
    expect(screen.getByText('mcp__alpha / read')).toBeTruthy()
    expect(screen.getByText('Tool catalog is unavailable')).toBeTruthy()
    act(() => list.set({ current: undefined }))
    expect(screen.getByText(en['session.none'])).toBeTruthy()
    expect(screen.queryByText('mcp__alpha / read')).toBeNull()
    expect(session.listeners.size).toBe(0)
  })

  it('does not attach a late catalog probe after close and starts fresh on reopen', async () => {
    let resolve!: (value: never) => void
    vi.mocked(resolveToolHubRemote).mockReturnValueOnce(new Promise(done => { resolve = done }))
    const remote = { list: vi.fn(async () => catalog), setEnabled: vi.fn() }
    const sessions = { list: observable({ current: undefined }), binding: () => undefined }
    const ctx = {} as never
    const first = render(<ToolsPane ctx={ctx} sessions={sessions as never} t={t} />)
    first.unmount()
    await act(async () => resolve(remote as never))
    expect(remote.list).not.toHaveBeenCalled()
    vi.mocked(resolveToolHubRemote).mockResolvedValue(remote as never)
    const reopened = render(<ToolsPane ctx={ctx} sessions={sessions as never} t={t} />)
    await screen.findByRole('button', { name: 'View details for alpha' })
    expect(remote.list).toHaveBeenCalledOnce()
    reopened.unmount()
  })
})

// Real pane registry/reducer integration: the provider does not own layout state.
import { PaneViewRegistry } from '../../ui-pane-workbench/src/view-registry.ts'
import { createPaneWorkspace, reducePaneWorkspace, type PaneViewSpecV1 } from '../../ui-pane-workbench/src/workspace.ts'
import { apply as applyTools } from '../src/client/index.ts'
import { bindSlashRuntime } from '../../../bundle/dsh-command-experience/src/slash-bind.ts'

it('admits the production provider, reuses /mcp after moving, and closes/reopens it', () => {
  const registry = new PaneViewRegistry({ capabilities: new Set() })
  let state = createPaneWorkspace()
  const pane = {
    registerView: registry.registerView.bind(registry),
    openView: (request: PaneViewSpecV1) => {
      // The runtime and reducer expose different structural request interfaces.
      const result = reducePaneWorkspace(state, { type: 'open_view', request })
      expect(result.accepted).toBe(true)
      state = result.state
    },
    views: registry,
    commands: { snapshot: () => [], subscribe: () => () => {}, execute: () => {} },
  }
  const ctx = {
    get: (name: string) => name === 'paneWorkbench' ? pane : {},
    locale: { register: () => () => {}, bind: () => t },
    on: () => () => {},
  }
  const dispose = applyTools(ctx as never)
  expect(registry.snapshot()).toHaveLength(1)
  expect(registry.snapshot()[0]?.showInPicker).not.toBe(false)
  const binding = bindSlashRuntime(ctx)
  const runtime = binding.runtime
  const mcp = runtime.snapshot().commands.find(row => row.canonicalName === 'mcp')!
  runtime.execute(mcp)
  const id = Object.keys(state.views)[0]!
  expect(state.views[id]?.region).toBe('right')
  const moved = reducePaneWorkspace(state, { type: 'move_view', viewId: id, targetGroupId: 'group:bottom:utility' })
  expect(moved.accepted).toBe(true)
  state = moved.state
  runtime.execute(mcp)
  expect(Object.keys(state.views)).toEqual([id])
  expect(state.views[id]?.region).toBe('bottom')
  const closed = reducePaneWorkspace(state, { type: 'close_view', viewId: id })
  expect(closed.accepted).toBe(true)
  state = closed.state
  expect(Object.keys(state.views)).toHaveLength(0)
  runtime.execute(mcp)
  expect(Object.keys(state.views)).toHaveLength(1)
  dispose()
  expect(registry.snapshot()).toHaveLength(0)
  expect(runtime.surfaces().mcpInspector).toBe(false)
  binding.dispose()
})

it('keeps enablement with the host across success, generation conflicts and transport failure', async () => {
  const list = vi.fn(async () => catalog)
  const setEnabled = vi.fn()
    .mockResolvedValueOnce({ ok: true, id: 'mcp:alpha', enabled: false, generation: 2 })
    .mockResolvedValueOnce({ ok: false, code: 'generation-conflict' })
    .mockRejectedValueOnce(new Error('network unavailable'))
  vi.mocked(resolveToolHubRemote).mockResolvedValue({ list, setEnabled })
  const sessions = { list: observable({ current: undefined }), binding: () => undefined }
  render(<ToolsPane ctx={{} as never} sessions={sessions as never} t={t} />)
  await screen.findByRole('button', { name: 'Disable' })
  fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
  await screen.findByText(en['notice.toggleSuccess'])
  expect(setEnabled).toHaveBeenLastCalledWith({ id: 'mcp:alpha', enabled: false, ifGeneration: 1 })
  fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
  await screen.findByText(en['notice.generationConflict'])
  expect(list).toHaveBeenCalledTimes(3)
  fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
  await screen.findByText(en['notice.toggleFailure'])
  expect(screen.queryByText('network unavailable')).toBeNull()
  expect(list).toHaveBeenCalledTimes(3)
})

it('stops catalog polling on close', async () => {
  vi.useFakeTimers()
  const remote = { list: vi.fn(async () => catalog), setEnabled: vi.fn() }
  vi.mocked(resolveToolHubRemote).mockResolvedValue(remote as never)
  const sessions = { list: observable({ current: undefined }), binding: () => undefined }
  let pane!: ReturnType<typeof render>
  await act(async () => { pane = render(<ToolsPane ctx={{} as never} sessions={sessions as never} t={t} />) })
  expect(remote.list).toHaveBeenCalledOnce()
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(remote.list).toHaveBeenCalledTimes(2)
  pane.unmount()
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(remote.list).toHaveBeenCalledTimes(2)
})
