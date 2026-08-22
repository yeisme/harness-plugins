// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFileTreeHostAdapter } from '../src/file-tree-host.ts'
import { useFileTree } from '../src/client/use-file-tree.ts'
import type { FileEntryV1 } from '../src/types.ts'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

function Probe({ adapter, enabled }: { adapter?: ReturnType<typeof createFileTreeHostAdapter>; enabled: boolean }) {
  const { status, entries, error, retry, loadChildren } = useFileTree(adapter, undefined, enabled)
  return createElement('div', { 'data-status': status },
    createElement('span', { 'data-error': error ?? '' }, error ?? ''),
    ...entries.map(entry => createElement('span', { key: entry.id, 'data-entry': entry.name }, entry.name)),
    createElement('button', { type: 'button', onClick: retry }, 'retry'),
    createElement('button', { type: 'button', onClick: () => { if (entries[0] !== undefined) void loadChildren(entries[0]) } }, 'loadChild'),
  )
}

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function renderProbe(adapter: ReturnType<typeof createFileTreeHostAdapter> | undefined, enabled: boolean) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(createElement(Probe, { adapter, enabled })))
}

describe('useFileTree', () => {
  it('stays idle while disabled and does not call the adapter', () => {
    const listDirectory = vi.fn(async () => ({ path: '/', entries: [] }))
    const adapter = createFileTreeHostAdapter(listDirectory)
    renderProbe(adapter, false)
    expect(container.querySelector('[data-status]')?.getAttribute('data-status')).toBe('idle')
    expect(listDirectory).not.toHaveBeenCalled()
  })

  it('loads root entries when enabled', async () => {
    const listDirectory = vi.fn(async () => ({
      path: '/workspace',
      entries: [{ name: 'src', path: '/workspace/src', hidden: false }],
    }))
    const adapter = createFileTreeHostAdapter(listDirectory)
    renderProbe(adapter, true)
    await act(async () => {})
    expect(container.querySelector('[data-status]')?.getAttribute('data-status')).toBe('ready')
    expect(container.querySelector('[data-entry="src"]')).toBeTruthy()
    expect(container.textContent).not.toContain('/workspace/src')
  })

  it('loads children on demand and merges them into entries', async () => {
    const listDirectory = vi.fn(async (path?: string) => path === '/workspace/src'
      ? { path: '/workspace/src', entries: [{ name: 'client', path: '/workspace/src/client', hidden: false }] }
      : { path: '/workspace', entries: [{ name: 'src', path: '/workspace/src', hidden: false }] })
    const adapter = createFileTreeHostAdapter(listDirectory)
    renderProbe(adapter, true)
    await act(async () => {})
    act(() => { container.querySelector<HTMLButtonElement>('button:nth-of-type(2)')?.click() })
    await act(async () => {})
    expect(container.querySelector('[data-entry="client"]')).toBeTruthy()
  })

  it('surfaces errors and retries', async () => {
    const listDirectory = vi.fn(async () => { throw new Error('directory-unreadable') })
    const adapter = createFileTreeHostAdapter(listDirectory)
    renderProbe(adapter, true)
    await act(async () => {})
    expect(container.querySelector('[data-status]')?.getAttribute('data-status')).toBe('error')
    expect(container.textContent).toContain('directory-unreadable')
    listDirectory.mockResolvedValueOnce({ path: '/', entries: [{ name: 'fixed', path: '/fixed', hidden: false }] })
    act(() => { container.querySelector<HTMLButtonElement>('button:first-of-type')?.click() })
    await act(async () => {})
    expect(container.querySelector('[data-status]')?.getAttribute('data-status')).toBe('ready')
    expect(container.querySelector('[data-entry="fixed"]')).toBeTruthy()
  })
})
