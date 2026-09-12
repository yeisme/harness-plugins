// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { OperationRecoveryNotice } from '../src/operation-recovery-notice.tsx'
import { creatorSnapshot } from './fixtures.ts'
import { defaultCreatorStudioTranslator as t } from '../src/locales.ts'
afterEach(cleanup)
const snapshot = creatorSnapshot(), owner = snapshot.owners[0]!
const request = { schema: 'pane.action-reconcile-request.v1alpha1' as const, owner: owner.owner, actionId: 'previous.action', expectedTargetRef: 'artifact:original', context: snapshot.context!, idempotencyKey: 'stored-original-key' }
const page = { schemaVersion: 'creator.operation-recovery-page.v1alpha1' as const, status: 'ready' as const, context: snapshot.context!, operations: [{ request, targetVersion: '1' }] }
it('identifies an Eikona candidate when its completed action is absent after reload', async () => {
  const runtime = { listOperationRecoveries: vi.fn(async () => ({ ...page, operations: [{ ...page.operations[0]!, request: { ...request, actionId: 'candidate.adopt', expectedTargetRef: 'eikona://artifacts/run-media/candidate' } }] })), reconcileStoredOperation: vi.fn() }
  render(<OperationRecoveryNotice owner={{ ...owner, actions: [] }} runtime={runtime} receiptRevision="reload" t={t} />)
  await screen.findByText('run-media / candidate · 采用候选')
  expect(runtime.reconcileStoredOperation).not.toHaveBeenCalled()
})
it('discovers the pending operation without executing it and keeps unknown results available', async () => {
  const reconcileStoredOperation = vi.fn(async () => ({ owner: owner.owner, actionId: request.actionId, status: 'unknown' as const, receiptRef: 'receipt:unknown' }))
  const runtime = { listOperationRecoveries: vi.fn(async () => page), reconcileStoredOperation }
  render(<OperationRecoveryNotice owner={owner} runtime={runtime} receiptRevision="initial" t={t} />)
  const query = await screen.findByRole('button', { name: '查询上次结果' })
  expect(reconcileStoredOperation).not.toHaveBeenCalled()
  fireEvent.click(query)
  await screen.findByText('上次结果仍未确认，未重新执行。')
  expect(reconcileStoredOperation).toHaveBeenCalledExactlyOnceWith(request)
  expect(screen.getByRole('button', { name: '查询上次结果' })).toBeTruthy()
})
it('does not refresh or publish a response after unmounting the project', async () => {
  let resolve!: (value: { status: 'completed'; receiptRef: string }) => void
  const runtime = { listOperationRecoveries: vi.fn(async () => page), reconcileStoredOperation: vi.fn(() => new Promise<{ status: 'completed'; receiptRef: string }>(done => { resolve = done })) }
  const view = render(<OperationRecoveryNotice owner={owner} runtime={runtime} receiptRevision="initial" t={t} />)
  fireEvent.click(await screen.findByRole('button', { name: '查询上次结果' }))
  await waitFor(() => expect(runtime.reconcileStoredOperation).toHaveBeenCalledOnce())
  view.unmount()
  await act(async () => { resolve({ status: 'completed', receiptRef: 'receipt:original' }) })
  expect(runtime.listOperationRecoveries).toHaveBeenCalledOnce()
})
it('distinguishes confirmed failure from an unknown result without retrying', async () => {
  const runtime = { listOperationRecoveries: vi.fn().mockResolvedValueOnce(page).mockResolvedValue({ ...page, operations: [] }),
    reconcileStoredOperation: vi.fn(async () => ({ owner: owner.owner, actionId: request.actionId, status: 'failed' as const, receiptRef: 'receipt:failed' })) }
  render(<OperationRecoveryNotice owner={owner} runtime={runtime} receiptRevision="initial" t={t} />)
  fireEvent.click(await screen.findByRole('button', { name: '查询上次结果' }))
  await screen.findByText('已确认上次操作失败，未重新执行。')
  expect(runtime.reconcileStoredOperation).toHaveBeenCalledOnce()
  await waitFor(() => expect(screen.queryByRole('button', { name: '查询上次结果' })).toBeNull())
})
