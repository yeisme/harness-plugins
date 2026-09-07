// @vitest-environment jsdom
import { createElement, useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ExplorerTree } from '../src/explorer/tree-ui.js'
import { createExplorerTreeState, reduceExplorerTree, type ExplorerTreeNodeV1 } from '../src/explorer/tree-state.js'
import type { ExplorerMutationProposalV1, ExplorerRuntimeV2 } from '../src/explorer/runtime.js'
afterEach(cleanup)
const nodes: ExplorerTreeNodeV1[] = ['one', 'two'].map(ref => ({ ref, name: ref, version: 'v1', kind: 'directory', hasChildren: true, capabilities: [], freshness: 'fresh', availability: { mutate: 'available' } }))
function setup(enabled = true) {
  const execute = vi.fn(async () => ({ ok: true }))
  const propose = vi.fn<NonNullable<ExplorerRuntimeV2['mutation']>['propose']>(async input => ({ ...input, proposalRef: 'proposal', summary: 'Synthetic preflight', risks: [], conflicts: [], reversible: true, expiresAt: 'future', execute }))
  const runtime: ExplorerRuntimeV2 = { roots: async () => nodes, listChildren: async () => [], openResource: vi.fn(() => ({ ok: true })), mutation: { enabled, disabledReason: 'Owner offline', propose } }
  let replaceNodes: (next: ExplorerTreeNodeV1[]) => void = () => {}
  function Harness({ activeRuntime = runtime }: { activeRuntime?: ExplorerRuntimeV2 }) {
    const [state, setState] = useState(() => reduceExplorerTree(reduceExplorerTree(createExplorerTreeState(), { type: 'hydrate_roots', nodes }), { type: 'select', ref: 'one' }))
    replaceNodes = next => setState(current => reduceExplorerTree(current, { type: 'hydrate_roots', nodes: next }))
    return createElement(ExplorerTree, { state, runtime: activeRuntime, onIntent: setState })
  }
  const view = render(createElement(Harness))
  return { ...view, runtime, propose, execute, replaceNodes: (next: ExplorerTreeNodeV1[]) => act(() => replaceNodes(next)), switchRuntime: (next: ExplorerRuntimeV2) => view.rerender(createElement(Harness, { activeRuntime: next })) }
}
it('binds right-click preflight to clicked row without opening a session target', async () => {
  const { container, propose, execute, runtime } = setup()
  fireEvent.contextMenu(container.querySelector('[data-explorer-ref=two]')!)
  expect(container.querySelector('[data-explorer-ref=one]')?.getAttribute('aria-selected')).toBe('true')
  fireEvent.click(screen.getByRole('menuitem', { name: '移到废纸篓' }))
  await waitFor(() => expect(propose).toHaveBeenCalledWith({ action: 'trash', targetRefs: ['two'] }))
  expect(execute).not.toHaveBeenCalled()
  const confirmation = await screen.findByRole('button', { name: '确认执行' })
  expect(document.activeElement).toBe(confirmation)
  fireEvent.click(confirmation)
  await waitFor(() => expect(execute).toHaveBeenCalledOnce())
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('tree')))
  expect(screen.getByRole('tree').getAttribute('aria-activedescendant')).toBe('explorer-row-two')
  expect(runtime.openResource).not.toHaveBeenCalled()
})
it.each([{ key: 'F10', shiftKey: true }, { key: 'ContextMenu' }])('opens, navigates and restores keyboard focus: %j', async key => {
  setup()
  fireEvent.keyDown(screen.getByRole('tree'), key)
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: '新建文件' }))
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: '新建目录' }))
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('tree')))
  expect(screen.queryByRole('menu')).toBeNull()
})
it('explains disabled actions and keeps cancellation available', async () => {
  const { propose } = setup(false)
  fireEvent.keyDown(screen.getByRole('tree'), { key: 'ContextMenu' })
  expect(screen.getByRole('menuitem', { name: /重命名 Owner offline/ }).hasAttribute('disabled')).toBe(true)
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: '取消' }))
  fireEvent.click(document.activeElement!)
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('tree')))
  expect(propose).not.toHaveBeenCalled()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function syntheticProposal(summary: string): ExplorerMutationProposalV1 {
  return { proposalRef: summary, summary, action: 'trash', risks: [], conflicts: [], reversible: true, expiresAt: 'future', execute: vi.fn(async () => ({ ok: true })) }
}
function startTrash(container: HTMLElement, ref = 'one') {
  fireEvent.contextMenu(container.querySelector(`[data-explorer-ref=${ref}]`)!)
  fireEvent.click(screen.getByRole('menuitem', { name: '移到废纸篓' }))
}
it('keeps newer preflight B when cancelled A resolves last', async () => {
  const { container, propose } = setup()
  const a = deferred<ExplorerMutationProposalV1>()
  const b = deferred<ExplorerMutationProposalV1>()
  propose.mockImplementationOnce(() => a.promise).mockImplementationOnce(() => b.promise)
  startTrash(container)
  fireEvent.click(screen.getByRole('button', { name: '取消' }))
  startTrash(container, 'two')
  const first = syntheticProposal('Old A')
  const second = syntheticProposal('Current B')
  await act(async () => b.resolve(second))
  await act(async () => a.resolve(first))
  expect(screen.queryByText('Old A')).toBeNull()
  expect(screen.getByText('Current B')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '确认执行' }))
  await waitFor(() => expect(second.execute).toHaveBeenCalledOnce())
  expect(first.execute).not.toHaveBeenCalled()
})
it.each(['resolve', 'reject'] as const)('ignores %s after cancelling a pending preflight', async settlement => {
  const { container, propose } = setup()
  const request = deferred<ExplorerMutationProposalV1>()
  propose.mockImplementationOnce(() => request.promise)
  startTrash(container)
  fireEvent.keyDown(screen.getByRole('button', { name: '取消' }), { key: 'Escape' })
  await act(async () => { if (settlement === 'resolve') request.resolve(syntheticProposal('Cancelled result')); else request.reject(new Error('Cancelled failure')) })
  expect(screen.queryByText('Cancelled result')).toBeNull()
  expect(screen.queryByText('Cancelled failure')).toBeNull()
  expect(screen.queryByRole('button', { name: '确认执行' })).toBeNull()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('tree')))
})
it('ignores a pending preflight after runtime switch', async () => {
  const { container, propose, runtime, switchRuntime } = setup()
  const request = deferred<ExplorerMutationProposalV1>()
  propose.mockImplementationOnce(() => request.promise)
  startTrash(container)
  switchRuntime({ ...runtime, workspaceRef: 'workspace-two' })
  await act(async () => request.resolve(syntheticProposal('Other runtime result')))
  expect(screen.queryByText('Other runtime result')).toBeNull()
  expect(screen.queryByRole('button', { name: '确认执行' })).toBeNull()
})
it('ignores completion of an executed proposal after a newer action context opens', async () => {
  const { container, propose } = setup()
  const completion = deferred<{ ok: boolean }>()
  const old = { ...syntheticProposal('Executing A'), execute: vi.fn(() => completion.promise) }
  propose.mockResolvedValueOnce(old).mockResolvedValueOnce(syntheticProposal('Current B'))
  startTrash(container)
  fireEvent.click(await screen.findByRole('button', { name: '确认执行' }))
  startTrash(container, 'two')
  await screen.findByText('Current B')
  await act(async () => completion.resolve({ ok: true }))
  expect(screen.getByText('Current B')).toBeTruthy()
  expect(screen.queryByText('已完成')).toBeNull()
})
it('Escape restores a visible fallback when the originating row was deleted', async () => {
  const { container, replaceNodes } = setup()
  fireEvent.contextMenu(container.querySelector('[data-explorer-ref=two]')!)
  replaceNodes([nodes[0]!])
  fireEvent.keyDown(screen.getByRole('menuitem', { name: '取消' }), { key: 'Escape' })
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('tree')))
  expect(screen.getByRole('tree').getAttribute('aria-activedescendant')).toBe('explorer-row-one')
})
