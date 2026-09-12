// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, act, waitFor } from '@testing-library/react'
import { CreatorActionComposer } from '../src/projection-components.tsx'
import { CreatorStudioController } from '../src/controller.ts'
import { action, creatorSnapshot } from './fixtures.ts'
import type { PaneActionReceiptV1 } from '@yeisme/dsh-pane-protocol'
import { createEikonaAdoptionDescriptor } from '../../../host/creator-studio/src/eikona-adoption-descriptor.ts'

afterEach(cleanup)

it('disables resubmission while preserving the original operation reconciliation control', () => {
  const snapshot = creatorSnapshot(), descriptor = action('eikona', 'image')
  const state = { ...new CreatorStudioController({} as never).store.getSnapshot(), lastReceipt: { status: 'unknown' as const, owner: 'eikona', actionId: descriptor.actionId, receiptRef: 'receipt:original' } }
  const dispatchAction = vi.fn(), reconcileAction = vi.fn()
  render(<CreatorActionComposer owner={{ ...snapshot.owners[0]!, actions: [descriptor] }} task="image" snapshot={snapshot} state={state}
    controller={{ dispatchAction, reconcileAction, hasUnresolvedAction: () => true }} initialValues={{ brief: 'next draft' }} />)
  expect((screen.getByRole('button', { name: '执行操作' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: '核对原操作' }) as HTMLButtonElement).disabled).toBe(false)
  expect(screen.getByText('上次操作结果待核对，请先查询上次结果。')).toBeTruthy()
  expect(dispatchAction).not.toHaveBeenCalled()
})

it('retains the completed owner receipt after refresh removes the consumed action', () => {
  const snapshot = creatorSnapshot(), descriptor = action('eikona', 'image')
  const state = { ...new CreatorStudioController({} as never).store.getSnapshot(), lastReceipt: {
    owner: 'eikona', actionId: descriptor.actionId, status: 'completed' as const, receiptRef: 'receipt:adopted' } }
  const props = { owner: { ...snapshot.owners[0]!, actions: [descriptor] }, task: 'image' as const, snapshot, state, controller: { dispatchAction: vi.fn() } }
  const view = render(<CreatorActionComposer {...props} />)
  view.rerender(<CreatorActionComposer {...props} owner={{ ...props.owner, actions: [] }} />)
  expect(screen.getByText('receipt:adopted')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '执行操作' })).toBeNull()
  view.rerender(<CreatorActionComposer {...props} owner={{ ...props.owner, owner: 'sonora', actions: [] }} />)
  expect(screen.queryByText('receipt:adopted')).toBeNull()
})

it('keeps the chosen action and separate drafts when switching descriptors', () => {
  const snapshot = creatorSnapshot(), first = { ...action('eikona', 'image'), confirmation: 'confirm' as const }
  const second = { ...first, descriptorRef: 'action:second', label: 'Second action' }
  const dispatchAction = vi.fn()
  render(<CreatorActionComposer owner={{ ...snapshot.owners[0]!, actions: [first, second] }} task="image" snapshot={snapshot}
    state={new CreatorStudioController({} as never).store.getSnapshot()} controller={{ dispatchAction }} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Brief' }), { target: { value: 'first draft' } })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.change(screen.getByRole('combobox'), { target: { value: second.descriptorRef } })
  expect(screen.getByRole('heading', { name: second.label })).toBeTruthy()
  expect((screen.getByRole('textbox', { name: 'Brief' }) as HTMLTextAreaElement).value).toBe('')
  fireEvent.change(screen.getByRole('textbox', { name: 'Brief' }), { target: { value: 'second draft' } })
  fireEvent.change(screen.getByRole('combobox'), { target: { value: first.descriptorRef } })
  expect((screen.getByRole('textbox', { name: 'Brief' }) as HTMLTextAreaElement).value).toBe('first draft')
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: second.descriptorRef } })
  expect((screen.getByRole('textbox', { name: 'Brief' }) as HTMLTextAreaElement).value).toBe('second draft')
  expect(dispatchAction).not.toHaveBeenCalled()
})

it('confirms and submits the real Eikona adoption descriptor without manually entering fixed fields', async () => {
  const snapshot = creatorSnapshot(), digest = 'a'.repeat(64)
  const built = createEikonaAdoptionDescriptor({ status: 'prepared', executionAuthorized: false,
    artifactRef: 'eikona://artifacts/run/candidate', observedAt: new Date().toISOString(),
    request: { project_ref: 'project', asset_ref: 'run', review_version: 'candidate', decision: 'accept', expected_content_digest: digest, require_no_decision: true } }, snapshot.context!)
  if (!built) throw new Error('Missing adoption descriptor')
  const dispatchAction = vi.fn(async (): Promise<PaneActionReceiptV1> => ({ owner: 'eikona', actionId: built.descriptor.actionId, status: 'completed', receiptRef: 'receipt:adopted' }))
  render(<CreatorActionComposer owner={{ ...snapshot.owners[0]!, actions: [built.descriptor] }} task="image" snapshot={snapshot}
    state={new CreatorStudioController({} as never).store.getSnapshot()} controller={{ dispatchAction }} />)
  expect((screen.getByRole('button', { name: '执行操作' }) as HTMLButtonElement).disabled).toBe(true)
  expect(dispatchAction).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('checkbox'))
  expect(dispatchAction).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
  await waitFor(() => expect(dispatchAction).toHaveBeenCalledExactlyOnceWith(built.descriptor, built.values))
  expect(built.values).toEqual({ run_id: 'run', candidate_id: 'candidate', content_digest: digest, decision_version: 0 })
})

it('invalidates confirmation and reseeds fixed values when the owner replaces a descriptor', () => {
  const snapshot = creatorSnapshot(), original = action('eikona', 'image')
  const descriptor = { ...original, confirmation: 'confirm' as const, fields: [{ key: 'decision_version', label: 'Decision version', kind: 'number' as const, required: true, min: 0, max: 0 }] }
  const props = { owner: { ...snapshot.owners[0]!, actions: [descriptor] }, task: 'image' as const, snapshot, state: new CreatorStudioController({} as never).store.getSnapshot(), controller: { dispatchAction: vi.fn() } }
  const view = render(<CreatorActionComposer {...props} />)
  fireEvent.click(screen.getByRole('checkbox'))
  const next = { ...descriptor, descriptorRef: 'descriptor:new-version', fields: [{ ...descriptor.fields[0]!, min: 1, max: 1 }] }
  view.rerender(<CreatorActionComposer {...props} owner={{ ...props.owner, actions: [next] }} />)
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  expect((screen.getByRole('spinbutton', { name: 'Decision version' }) as HTMLInputElement).value).toBe('1')
  expect((screen.getByRole('button', { name: '执行操作' }) as HTMLButtonElement).disabled).toBe(true)
  expect(props.controller.dispatchAction).not.toHaveBeenCalled()
})

it('seeds owner-fixed fields while still requiring explicit confirmation', async () => {
  const snapshot = creatorSnapshot(), descriptor = { ...action('eikona', 'image'), confirmation: 'confirm' as const,
    fields: [{ key: 'candidate_id', label: 'Candidate', kind: 'select' as const, required: true, options: [{ value: 'candidate', label: 'Candidate one' }] },
      { key: 'decision_version', label: 'Decision version', kind: 'number' as const, required: true, min: 0, max: 0 }] }
  const dispatchAction = vi.fn(async () => ({ status: 'completed' as const, receiptRef: 'receipt:adopted' }))
  render(<CreatorActionComposer owner={{ ...snapshot.owners[0]!, actions: [descriptor] }} task="image" snapshot={snapshot} state={new CreatorStudioController({} as never).store.getSnapshot()} controller={{ dispatchAction }} />)
  expect((screen.getByRole('combobox', { name: 'Candidate' }) as HTMLSelectElement).value).toBe('candidate')
  expect((screen.getByRole('spinbutton', { name: 'Decision version' }) as HTMLInputElement).value).toBe('0')
  expect((screen.getByRole('button', { name: '执行操作' }) as HTMLButtonElement).disabled).toBe(true)
  expect(dispatchAction).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
  await waitFor(() => expect(dispatchAction).toHaveBeenCalledOnce())
  expect(dispatchAction.mock.calls[0]?.[1]).toEqual({ candidate_id: 'candidate', decision_version: 0 })
})

it('keeps separate project drafts and does not apply a late receipt to the new form', async () => {
  const snapshot = creatorSnapshot(), descriptor = action('eikona', 'image')
  let finish!: (receipt: PaneActionReceiptV1) => void
  const dispatchAction = vi.fn(() => new Promise<PaneActionReceiptV1>(resolve => { finish = resolve }))
  const onReceipt = vi.fn()
  const props = { owner: { ...snapshot.owners[0]!, actions: [descriptor] }, task: 'image' as const, snapshot,
    state: new CreatorStudioController({} as never).store.getSnapshot(), controller: { dispatchAction }, onReceipt }
  const view = render(<CreatorActionComposer {...props} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Brief' }), { target: { value: 'project A draft' } })
  fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
  const second = { ...snapshot, context: { ...snapshot.context!, projectRef: 'project:two' } }
  view.rerender(<CreatorActionComposer {...props} snapshot={second} />)
  expect((screen.getByRole('button', { name: '执行操作' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('textbox', { name: 'Brief' }) as HTMLTextAreaElement).value).toBe('')
  fireEvent.change(screen.getByRole('textbox', { name: 'Brief' }), { target: { value: 'project B draft' } })
  await act(async () => { finish({ status: 'completed', owner: 'eikona', actionId: descriptor.actionId, receiptRef: 'receipt:A' }) })
  expect(onReceipt).not.toHaveBeenCalled()
  expect((screen.getByRole('textbox', { name: 'Brief' }) as HTMLTextAreaElement).value).toBe('project B draft')
  view.rerender(<CreatorActionComposer {...props} />)
  expect((screen.getByRole('textbox', { name: 'Brief' }) as HTMLTextAreaElement).value).toBe('project A draft')
  view.rerender(<CreatorActionComposer {...props} snapshot={second} />)
  expect((screen.getByRole('textbox', { name: 'Brief' }) as HTMLTextAreaElement).value).toBe('project B draft')
  expect(dispatchAction).toHaveBeenCalledOnce()
})

it('defaults to the canonical Eikona model only when offered and preserves an explicit selection', () => {
  const snapshot = creatorSnapshot(), base = action('eikona', 'image')
  const model = 'openai/gpt-5.4-image-2'
  const descriptor = { ...base, fields: [{ key: 'model', label: 'Model', kind: 'select' as const, required: true,
    options: [{ value: 'fixture/alternative', label: 'Alternative' }, { value: model, label: 'Canonical' }] }] }
  const props = { owner: { ...snapshot.owners[0]!, actions: [descriptor] }, task: 'image' as const, snapshot,
    state: new CreatorStudioController({} as never).store.getSnapshot(), controller: { dispatchAction: vi.fn() } }
  const first = render(<CreatorActionComposer {...props} />)
  expect((screen.getByRole('combobox', { name: 'Model' }) as HTMLSelectElement).value).toBe(model)
  first.unmount()
  const second = render(<CreatorActionComposer {...props} initialValues={{ model: 'fixture/alternative' }} />)
  expect((screen.getByRole('combobox', { name: 'Model' }) as HTMLSelectElement).value).toBe('fixture/alternative')
  second.unmount()
  render(<CreatorActionComposer {...props} owner={{ ...props.owner, actions: [{ ...descriptor, fields: [{ ...descriptor.fields[0]!, options: [{ value: 'fixture/alternative', label: 'Alternative' }] }] }] }} />)
  expect((screen.getByRole('combobox', { name: 'Model' }) as HTMLSelectElement).value).toBe('')
  expect(props.controller.dispatchAction).not.toHaveBeenCalled()
})

it('distinguishes missing cost, explicit zero and an estimate without inventing a price', () => {
  const snapshot = creatorSnapshot(), descriptor = action('eikona', 'image')
  const props = { task: 'image' as const, snapshot, state: new CreatorStudioController({} as never).store.getSnapshot(), controller: { dispatchAction: vi.fn() } }
  const owner = { ...snapshot.owners[0]!, actions: [descriptor] }
  const view = render(<CreatorActionComposer {...props} owner={owner} />)
  expect(screen.getByText('费用未知：Owner 尚未提供报价。')).toBeTruthy()
  expect(document.querySelector('[data-cost-state="unknown"]')).not.toBeNull()
  view.rerender(<CreatorActionComposer {...props} owner={{ ...owner, actions: [{ ...descriptor, preview: { ...descriptor.preview, cost: { currency: 'USD', amount: 0, estimate: false } } }] }} />)
  expect(screen.getByText('Owner 报价 USD 0')).toBeTruthy()
  expect(document.querySelector('[data-cost-state="quoted"]')).not.toBeNull()
  view.rerender(<CreatorActionComposer {...props} owner={{ ...owner, actions: [{ ...descriptor, preview: { ...descriptor.preview, cost: { currency: 'USD', amount: 2, estimate: true } } }] }} />)
  expect(screen.getByText('预计 USD 2')).toBeTruthy()
  expect(document.querySelector('[data-cost-state="estimated"]')).not.toBeNull()
})

it.each(['unknown', 'partial'] as const)('offers original-operation reconciliation for %s without submitting form values', async status => {
  const snapshot = creatorSnapshot(), descriptor = action('eikona', 'image')
  const dispatchAction = vi.fn(), reconcileAction = vi.fn(async () => ({ status, receiptRef: 'receipt:original' }))
  const state = { ...new CreatorStudioController({} as never).store.getSnapshot(),
    lastReceipt: { status, receiptRef: 'receipt:original', owner: 'eikona', actionId: descriptor.actionId } }
  const props = { owner: { ...snapshot.owners[0]!, actions: [descriptor] }, task: 'image' as const, snapshot, state }
  const view = render(<CreatorActionComposer {...props} controller={{ dispatchAction, reconcileAction }} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Brief' }), { target: { value: 'next draft' } })
  fireEvent.click(screen.getByRole('button', { name: '核对原操作' }))
  await waitFor(() => expect(reconcileAction).toHaveBeenCalledWith(descriptor))
  expect(dispatchAction).not.toHaveBeenCalled()
  view.rerender(<CreatorActionComposer {...props} controller={{ dispatchAction }} />)
  expect((screen.getByRole('button', { name: '核对原操作' }) as HTMLButtonElement).disabled).toBe(true)
})

it('binds confirmation to the exact parameters and refreshed owner descriptor', () => {
  const snapshot = creatorSnapshot()
  const descriptor = { ...action('eikona', 'image'), confirmation: 'confirm' as const }
  const owner = { ...snapshot.owners[0]!, actions: [descriptor] }
  const state = new CreatorStudioController({} as never).store.getSnapshot()
  const dispatchAction = vi.fn()
  const props = { owner, task: 'image' as const, snapshot, state, controller: { dispatchAction } }
  const view = render(<CreatorActionComposer {...props} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Brief' }), { target: { value: 'first' } })
  const confirm = screen.getByRole('checkbox') as HTMLInputElement
  fireEvent.click(confirm)
  expect(confirm.checked).toBe(true)
  fireEvent.change(screen.getByRole('textbox', { name: 'Brief' }), { target: { value: 'second' } })
  expect(confirm.checked).toBe(false)
  fireEvent.click(confirm)
  view.rerender(<CreatorActionComposer {...props} owner={{ ...owner, actions: [{ ...descriptor, preview: { summary: 'Changed owner plan', cost: { currency: 'USD', amount: 2, estimate: true } } }] }} />)
  expect(confirm.checked).toBe(false)
  expect(dispatchAction).not.toHaveBeenCalled()
})

it('filters Auctra Checkpoint and export actions by presentation group', () => {
  const snapshot = creatorSnapshot()
  const checkpoint = { ...action('auctra', 'text', 'working-copy.checkpoint.create'), descriptorRef: 'action:auctra:checkpoint', label: 'Create Checkpoint', presentation: { task: 'text', owner: 'auctra', group: 'versions' } }
  const exportAction = { ...action('auctra', 'text', 'text.export'), descriptorRef: 'action:auctra:export', label: 'Export fixed version', presentation: { task: 'text', owner: 'auctra', group: 'export' } }
  const owner = { ...snapshot.owners.find(item => item.owner === 'auctra')!, actions: [checkpoint, exportAction] }
  const state = new CreatorStudioController({} as never).store.getSnapshot()
  const controller = { dispatchAction: vi.fn() }
  const versions = render(<CreatorActionComposer owner={owner} task="text" snapshot={snapshot} state={state} controller={controller} presentationGroup="versions" />)
  expect(screen.getByRole('heading', { name: checkpoint.label })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: exportAction.label })).toBeNull()
  versions.unmount()
  render(<CreatorActionComposer owner={owner} task="text" snapshot={snapshot} state={state} controller={controller} presentationGroup="export" />)
  expect(screen.getByRole('heading', { name: exportAction.label })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: checkpoint.label })).toBeNull()
})

it('preserves the next draft typed while the submitted request completes', async () => {
  const snapshot = creatorSnapshot()
  const descriptor = action('eikona', 'image')
  let resolve!: (receipt: PaneActionReceiptV1) => void
  const dispatchAction = vi.fn(() => new Promise<PaneActionReceiptV1>(done => { resolve = done }))
  render(<CreatorActionComposer owner={{ ...snapshot.owners[0]!, actions: [descriptor] }} task="image" snapshot={snapshot}
    state={new CreatorStudioController({} as never).store.getSnapshot()} controller={{ dispatchAction }} />)
  const input = screen.getByRole('textbox', { name: 'Brief' }) as HTMLTextAreaElement
  fireEvent.change(input, { target: { value: 'submitted' } })
  fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
  fireEvent.change(input, { target: { value: 'next draft' } })
  await act(async () => { resolve({ status: 'completed', receiptRef: 'receipt:one', owner: 'eikona', actionId: 'eikona.create' }) })
  expect(input.value).toBe('next draft')
  expect(dispatchAction).toHaveBeenCalledWith(descriptor, { brief: 'submitted' })
})


it.each(['unmount', 'context'])('ignores a late reconciliation receipt after %s', async change => {
  const snapshot = creatorSnapshot(), descriptor = action('eikona', 'image')
  let resolve!: (value: any) => void
  const result = new Promise<any>(done => { resolve = done })
  const reconcileAction = vi.fn(() => result), dispatchAction = vi.fn(), onReceipt = vi.fn()
  const state = { ...new CreatorStudioController({} as never).store.getSnapshot(), lastReceipt: { status: 'unknown' as const, receiptRef: 'receipt:original', owner: 'eikona', actionId: descriptor.actionId } }
  const props = { owner: { ...snapshot.owners[0]!, actions: [descriptor] }, task: 'image' as const, snapshot, state, controller: { dispatchAction, reconcileAction }, onReceipt }
  const view = render(<CreatorActionComposer {...props} />)
  fireEvent.click(screen.getByRole('button', { name: '核对原操作' }))
  await waitFor(() => expect(reconcileAction).toHaveBeenCalledTimes(1))
  if (change === 'unmount') view.unmount()
  else view.rerender(<CreatorActionComposer {...props} snapshot={{ ...snapshot, context: { ...snapshot.context!, workspaceRef: 'workspace:other' } }} />)
  await act(async () => { resolve({ status: 'completed', receiptRef: 'receipt:original', owner: 'eikona', actionId: descriptor.actionId }); await result })
  expect(onReceipt).not.toHaveBeenCalled()
  expect(dispatchAction).not.toHaveBeenCalled()
})
