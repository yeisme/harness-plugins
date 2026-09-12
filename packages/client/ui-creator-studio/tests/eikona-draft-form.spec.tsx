// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EikonaPreparationForm } from '../src/eikona-preparation-form.tsx'
import { defaultCreatorStudioTranslator as t } from '../src/locales.ts'
import type { EikonaDraftRuntime } from '../src/eikona-draft-session.ts'
import type { EikonaDraft } from '@yeisme/dsh-creator-studio-host/contracts'
afterEach(cleanup)
const scope = { tenantRef: 'tenant', workspaceRef: 'workspace', projectRef: 'project' }
const draft: EikonaDraft = { schemaVersion: 'eikona.studio_draft.v1', scope, id: 'primary', revision: 3, fields: { prompt: 'prompt-one', version: '1', size: '', seed: '', variables: [] }, checkpoint: { status: 'editing' } }
function runtime(): EikonaDraftRuntime { return { readEikonaDraft: vi.fn(async () => ({ status: 'ready', draft })), saveEikonaDraft: vi.fn(async input => ({ status: 'saved', requestId: input.requestId, revision: input.draft.revision + 1 })), reconcileEikonaDraft: vi.fn(async () => ({ status: 'unknown' })) } }
it('retains oversized variable content and explains why saving and preparation are disabled', async () => {
  const api = runtime(), prepare = vi.fn(async () => ({ status: 'unconfirmed' as const }))
  const variables = Array.from({ length: 26 }, (_, index) => ({ name: `variable${index}`, value: '中'.repeat(4096) }))
  api.readEikonaDraft = async () => ({ status: 'ready', draft: { ...draft, fields: { ...draft.fields, variables } } })
  render(<EikonaPreparationForm draftStorage={{ runtime: api, scope }} prepare={prepare} available t={t} />)
  await screen.findByText('草稿已读取；修改后请保存草稿。')
  fireEvent.click(screen.getByRole('button', { name: '添加变量' }))
  fireEvent.change(screen.getByLabelText('变量名 27'), { target: { value: 'extra' } })
  const input = screen.getByLabelText('变量内容 27') as HTMLTextAreaElement
  fireEvent.change(input, { target: { value: '中'.repeat(4096) } })
  expect(screen.getByRole('alert').textContent).toContain('草稿超过保存限制')
  expect(input.value.length).toBe(4096)
  expect((screen.getByRole('button', { name: '保存生成草稿' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: '创建准备' }) as HTMLButtonElement).disabled).toBe(true)
  expect(prepare).not.toHaveBeenCalled()
  expect(api.saveEikonaDraft).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { value: '' } })
  expect(screen.queryByRole('alert')).toBeNull()
  expect((screen.getByRole('button', { name: '保存生成草稿' }) as HTMLButtonElement).disabled).toBe(false)
})
it.each(['saved', 'unknown'] as const)('unlocks revoked approval only after observation persistence is %s', async savedStatus => {
  const api = runtime(), prepare = vi.fn(async () => ({ status: 'unconfirmed' as const }))
  const binding = { approvalRef: `ega_${'a'.repeat(64)}`, preparationRef: `egp_${'b'.repeat(64)}`, digest: 'c'.repeat(64) }
  api.readEikonaDraft = async () => ({ status: 'ready', draft: { ...draft, checkpoint: { status: 'approval_observed', ...binding } } })
  api.saveEikonaDraft = vi.fn(async input => savedStatus === 'saved' ? { status: 'saved', requestId: input.requestId, revision: input.draft.revision + 1 } : { status: 'unknown' })
  const observation = { status: 'observed' as const, ...binding, projectId: 'project', revoked: true, expired: false, observedAt: '2026-09-09T00:00:00Z', expiresAt: '2999-01-01T00:00:00Z', consumedOperation: `own_${'d'.repeat(24)}` }
  render(<EikonaPreparationForm draftStorage={{ runtime: api, scope }} prepare={prepare} readStatus={async () => observation} available t={t} />)
  fireEvent.click(await screen.findByRole('button', { name: '核对已保存批准' }))
  fireEvent.click(await screen.findByRole('button', { name: '保存核对结果并继续编辑' }))
  await waitFor(() => expect(api.saveEikonaDraft).toHaveBeenCalledWith(expect.objectContaining({ draft: expect.objectContaining({ checkpoint: expect.objectContaining({ status: 'approval_reconciled', ...binding, revoked: true, consumedOperation: observation.consumedOperation }) }) })))
  await waitFor(() => expect((screen.getByRole('button', { name: '创建准备' }) as HTMLButtonElement).disabled).toBe(savedStatus !== 'saved'))
  expect(prepare).not.toHaveBeenCalled()
})
it('clears the leave guard only for confirmed matching fields and restores it after editing', async () => {
  const api = runtime(), onDirty = vi.fn()
  render(<EikonaPreparationForm draftStorage={{ runtime: api, scope }} onDirty={onDirty} prepare={async () => ({ status: 'unconfirmed' })} available t={t} />)
  await waitFor(() => expect(onDirty).toHaveBeenLastCalledWith(false))
  fireEvent.change(screen.getByLabelText('尺寸（可选）'), { target: { value: '1536x1024' } })
  expect(onDirty).toHaveBeenLastCalledWith(true)
  fireEvent.click(screen.getByRole('button', { name: '保存生成草稿' }))
  await waitFor(() => expect(onDirty).toHaveBeenLastCalledWith(false))
  fireEvent.change(screen.getByLabelText('随机种子（可选整数）'), { target: { value: '42' } })
  expect(onDirty).toHaveBeenLastCalledWith(true)
})
it('keeps the leave guard for unknown saves until the original receipt is reconciled', async () => {
  const api = runtime(), onDirty = vi.fn()
  let savedId = ''
  api.saveEikonaDraft = async input => { savedId = input.requestId; return { status: 'unknown' } }
  api.reconcileEikonaDraft = async () => ({ status: 'saved', requestId: savedId, revision: 4 })
  render(<EikonaPreparationForm draftStorage={{ runtime: api, scope }} onDirty={onDirty} prepare={async () => ({ status: 'unconfirmed' })} available t={t} />)
  await screen.findByText('草稿已读取；修改后请保存草稿。')
  fireEvent.change(screen.getByLabelText('尺寸（可选）'), { target: { value: '1536x1024' } })
  fireEvent.click(screen.getByRole('button', { name: '保存生成草稿' }))
  const reconcile = await screen.findByRole('button', { name: '核对草稿保存' })
  expect(onDirty).toHaveBeenLastCalledWith(true)
  fireEvent.click(reconcile)
  await waitFor(() => expect(onDirty).toHaveBeenLastCalledWith(false))
})
it('does not start an owner request after unmount while its checkpoint save is pending', async () => {
  const api = runtime(), prepare = vi.fn(async () => ({ status: 'unconfirmed' as const }))
  let finish!: () => void
  api.saveEikonaDraft = vi.fn(input => new Promise(resolve => { finish = () => resolve({ status: 'saved', requestId: input.requestId, revision: input.draft.revision + 1 }) }))
  const view = render(<EikonaPreparationForm draftStorage={{ runtime: api, scope }} prepare={prepare} available t={t} />)
  await screen.findByText('草稿已读取；修改后请保存草稿。')
  fireEvent.click(screen.getByRole('button', { name: '创建准备' }))
  await waitFor(() => expect(api.saveEikonaDraft).toHaveBeenCalledOnce())
  view.unmount()
  finish()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(prepare).not.toHaveBeenCalled()
})
it('restores in StrictMode without owner requests and saves edited fields explicitly', async () => {
  const api = runtime(), prepare = vi.fn(async () => ({ status: 'unconfirmed' as const }))
  render(<StrictMode><EikonaPreparationForm draftStorage={{ runtime: api, scope }} prepare={prepare} available t={t} /></StrictMode>)
  await waitFor(() => expect((screen.getByLabelText('提示词 ID') as HTMLInputElement).value).toBe('prompt-one'))
  expect(prepare).not.toHaveBeenCalled()
  expect(api.saveEikonaDraft).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('随机种子（可选整数）'), { target: { value: '-' } })
  fireEvent.click(screen.getByRole('button', { name: '保存生成草稿' }))
  await waitFor(() => expect(api.saveEikonaDraft).toHaveBeenCalledWith(expect.objectContaining({ draft: expect.objectContaining({ revision: 3, fields: expect.objectContaining({ seed: '-' }) }) })))
})
it('does not send preparation if its durable uncertainty marker cannot be confirmed', async () => {
  const api = runtime(), prepare = vi.fn(async () => ({ status: 'unconfirmed' as const }))
  api.saveEikonaDraft = vi.fn(async () => ({ status: 'unknown' }))
  render(<EikonaPreparationForm draftStorage={{ runtime: api, scope }} prepare={prepare} available t={t} />)
  await screen.findByText('草稿已读取；修改后请保存草稿。')
  fireEvent.click(screen.getByRole('button', { name: '创建准备' }))
  await screen.findByRole('button', { name: '核对草稿保存' })
  expect(prepare).not.toHaveBeenCalled()
  expect(api.saveEikonaDraft).toHaveBeenCalledWith(expect.objectContaining({ draft: expect.objectContaining({ checkpoint: { status: 'preparation_unconfirmed' } }) }))
})
it('restores uncertain owner state without permitting another prepare', async () => {
  const api = runtime(), prepare = vi.fn(async () => ({ status: 'unconfirmed' as const }))
  api.readEikonaDraft = async () => ({ status: 'ready', draft: { ...draft, checkpoint: { status: 'preparation_unconfirmed' } } })
  render(<EikonaPreparationForm draftStorage={{ runtime: api, scope }} prepare={prepare} available t={t} />)
  await screen.findByText(/已恢复待核对的 owner 操作/u)
  expect((screen.getByRole('button', { name: '创建准备' }) as HTMLButtonElement).disabled).toBe(true)
  expect(prepare).not.toHaveBeenCalled()
})
