// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
import { CreatorActionComposer } from '../src/projection-components.tsx'
import { CreatorStudioController } from '../src/controller.ts'
import { action, creatorSnapshot } from './fixtures.ts'
import type { PaneActionReceiptV1 } from '@yeisme/dsh-pane-protocol'

afterEach(cleanup)

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

it('offers original-operation reconciliation without submitting form values', () => {
  const snapshot = creatorSnapshot(), descriptor = action('eikona', 'image')
  const dispatchAction = vi.fn(), reconcileAction = vi.fn(async () => ({ status: 'unknown' as const, receiptRef: 'receipt:original' }))
  const state = { ...new CreatorStudioController({} as never).store.getSnapshot(),
    lastReceipt: { status: 'unknown' as const, receiptRef: 'receipt:original', owner: 'eikona', actionId: descriptor.actionId } }
  const props = { owner: { ...snapshot.owners[0]!, actions: [descriptor] }, task: 'image' as const, snapshot, state }
  const view = render(<CreatorActionComposer {...props} controller={{ dispatchAction, reconcileAction }} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Brief' }), { target: { value: 'next draft' } })
  fireEvent.click(screen.getByRole('button', { name: '核对原操作' }))
  expect(reconcileAction).toHaveBeenCalledWith(descriptor)
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
