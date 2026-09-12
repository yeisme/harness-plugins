// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CREATOR_COMPOSER_INSERT_TIMEOUT_MS, CreatorArtifactWorkspace } from '../src/artifact-workspace.tsx'
import { createCreatorStudioTranslator, en, pseudoLong, pseudoRtl, zh } from '../src/locales.ts'
import { creatorSnapshot } from './fixtures.ts'
import { MermaidGraftController } from '../../ui-mermaid-render/src/client/observer.ts'
import { labelsFor } from '../../ui-mermaid-render/src/client/locales.ts'

const textArtifact = (ref = 'artifact:script', version = '7', title = 'Script') => ({ schema: 'pane.artifact.v1alpha1', owner: 'eikona', kind: 'text', ref, version, mediaType: 'text/markdown', title, evidenceRefs: [], capabilities: ['preview'] } as const)
const stateOf = (snapshot: ReturnType<typeof creatorSnapshot>) => ({ phase: 'ready' as const, snapshot, errorCode: null, pendingDescriptorRef: null, pendingApprovalRef: null, lastReceipt: null, assetPhase: 'cold' as const, assetQuery: { scope: 'current_project' as const }, assetItems: [], assetNextCursor: null, assetStatus: null, assetMessage: null, assetUnavailableOwners: [], assetErrorCode: null })
const descriptor = (input: { ref: string; actionId: string; label: string; targetRef: string; targetVersion: string; fields: readonly unknown[] }) => ({ schema: 'pane.action-descriptor.v1alpha1', descriptorRef: input.ref, owner: 'eikona', actionId: input.actionId, label: input.label, targetRef: input.targetRef, targetVersion: input.targetVersion, context: creatorSnapshot().context!, risk: 'low', confirmation: 'none', expiresAt: '2999-01-01T00:00:00Z', preview: { summary: input.label }, fields: input.fields } as const)
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function ownerWith(artifacts: readonly unknown[], actions: readonly unknown[]) {
  const snapshot = creatorSnapshot()
  return { snapshot, owner: { ...snapshot.owners.find(item => item.owner === 'eikona')!, actions, artifactWorkspace: { status: 'ready' as const, safeMessage: 'Ready.', artifacts } } }
}

describe('CreatorArtifactWorkspace', () => {
  it.each([false, true])('uses recovery and advertised save byte limits without truncation; textBody=%s', async supportsTextBody => {
    const artifact = { ...textArtifact('artifact:large-recovery', '1'), owner: 'auctra' as const }
    const save = { ...descriptor({ ref: 'action:large-recovery', actionId: 'working-copy.save', label: 'Save', targetRef: artifact.ref, targetVersion: '1',
      fields: [{ key: 'body', kind: 'textarea', label: 'Body', required: true, maxLength: 16_384 }, { key: 'revision', kind: 'text', label: 'Revision', required: true, maxLength: 160 }] }), owner: 'auctra' as const,
      ...(supportsTextBody ? { textBody: { field: 'body', maxBytes: 2 * 1024 * 1024 } } : {}) }
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [], actions: { saveDraft: { descriptorRef: save.descriptorRef, contentField: 'body', contentRevisionField: 'revision' } } }], [save])
    data.snapshot = { ...data.snapshot, context: { ...data.snapshot.context!, projectRef: `project:large-recovery-only-${supportsTextBody}` } }
    const owner = { ...data.owner, owner: 'auctra' as const }
    const runtime = { resolveArtifact: vi.fn(), dispatchAction: vi.fn(), readArtifactContent: vi.fn().mockResolvedValue({ artifact, contentRevision: '1', content: 'original' }),
      saveAuctraRecoveryDraft: vi.fn().mockResolvedValue({ status: 'unconfirmed' }), listAuctraRecoveryDrafts: vi.fn(), readAuctraRecoveryDraft: vi.fn() }
    render(<CreatorArtifactWorkspace owner={owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={runtime} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    const editor = await screen.findByDisplayValue('original') as HTMLTextAreaElement
    const recovery = screen.getByRole('button', { name: '保存恢复副本' }) as HTMLButtonElement
    const atLimit = '😀'.repeat(512 * 1024)
    fireEvent.change(editor, { target: { value: atLimit + 'a' } })
    expect(recovery.disabled).toBe(true)
    expect((screen.getByRole('button', { name: '保存草稿', exact: true }) as HTMLButtonElement).disabled).toBe(true)
    expect(editor.value).toBe(atLimit + 'a')
    fireEvent.change(editor, { target: { value: atLimit } })
    expect(recovery.disabled).toBe(false)
    expect((screen.getByRole('button', { name: '保存草稿', exact: true }) as HTMLButtonElement).disabled).toBe(!supportsTextBody)
    fireEvent.click(recovery)
    await waitFor(() => expect(runtime.saveAuctraRecoveryDraft).toHaveBeenCalledOnce())
    expect(runtime.saveAuctraRecoveryDraft.mock.calls[0]![0].content).toBe(atLimit)
    expect(runtime.dispatchAction).not.toHaveBeenCalled()
    expect(editor.value).toBe(atLimit)
  })

  it('restores an owner recovery buffer into the editor only after explicit confirmation', async () => {
    const version = '0:' + 'a'.repeat(64)
    const artifact = { ...textArtifact('artifact:auctra-recovery', version), owner: 'auctra' as const }
    const data = ownerWith([{ artifact, acceptedVersion: version, candidates: [] }], [])
    data.snapshot = { ...data.snapshot, context: { ...data.snapshot.context!, projectRef: 'project:recovery-test-only' } }
    const owner = { ...data.owner, owner: 'auctra' as const }
    const draft = { ref: 'auctra:editor-recovery:' + 'b'.repeat(32) + ':erd-' + 'c'.repeat(32), unitRef: 'text:note', baseVersion: version, revision: 1, contentDigest: 'd'.repeat(64), byteLength: 9, updatedAt: '2026-09-08T00:00:00Z' }
    const runtime = { resolveArtifact: vi.fn(), readArtifactContent: vi.fn().mockResolvedValue({ artifact, contentRevision: version, content: 'original' }), dispatchAction: vi.fn(),
      listAuctraRecoveryDrafts: vi.fn().mockResolvedValue({ status: 'ready', value: { drafts: [draft] } }),
      readAuctraRecoveryDraft: vi.fn().mockResolvedValue({ status: 'ready', value: { draft, content: 'recovered', sourceChanged: false, currentSourceVersion: version } }) }
    render(<CreatorArtifactWorkspace owner={owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={runtime} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await screen.findByDisplayValue('original')
    expect(runtime.listAuctraRecoveryDrafts).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '查找恢复草稿' }))
    fireEvent.click(await screen.findByRole('button', { name: '读取草稿' }))
    await screen.findByText('recovered')
    expect(screen.getByDisplayValue('original')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '恢复为未提交输入' }))
    await screen.findByDisplayValue('recovered')
    expect(runtime.listAuctraRecoveryDrafts).toHaveBeenCalledWith({ artifact, limit: 50 })
    expect(runtime.dispatchAction).not.toHaveBeenCalled()
  })

  it('starts a fresh body read on return without waiting for the earlier visit read', async () => {
    const artifact = textArtifact('artifact:return-read', '1', 'Return read')
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [] }], [])
    const oldRead = deferred<any>(), currentRead = deferred<any>()
    const readArtifactContent = vi.fn().mockImplementationOnce(() => oldRead.promise)
      .mockResolvedValueOnce({ artifact, contentRevision: 'other', content: 'other project' })
      .mockImplementationOnce(() => currentRead.promise)
    const runtime = { resolveArtifact: vi.fn(), readArtifactContent, dispatchAction: vi.fn() }
    const rendered = render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={runtime} />)
    await waitFor(() => expect(readArtifactContent).toHaveBeenCalledOnce())
    const other = { ...data.snapshot, context: { ...data.snapshot.context!, projectRef: 'project:other' } }
    rendered.rerender(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={other} state={stateOf(other)} runtime={runtime} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('other project'))
    rendered.rerender(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={runtime} />)
    await waitFor(() => expect(readArtifactContent).toHaveBeenCalledTimes(3))
    await act(async () => { oldRead.resolve({ artifact, contentRevision: 'old', content: 'obsolete visit' }) })
    expect(screen.queryByDisplayValue('obsolete visit')).toBeNull()
    await act(async () => { currentRead.resolve({ artifact, contentRevision: 'current', content: 'current visit' }) })
    expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('current visit')
    expect(readArtifactContent).toHaveBeenCalledTimes(3)
  })
  it('does not let an earlier visit overwrite a newer save after returning to identical context values', async () => {
    const artifact = textArtifact('artifact:return-save', '1', 'Return save')
    const save = descriptor({ ref: 'action:eikona:return-save', actionId: 'artifact.save', label: 'Save', targetRef: artifact.ref, targetVersion: '1',
      fields: [{ key: 'body', kind: 'textarea', label: 'Body', required: true }, { key: 'revision', kind: 'text', label: 'Revision', required: true }] })
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [], actions: { saveDraft: { descriptorRef: save.descriptorRef, contentField: 'body', contentRevisionField: 'revision' } } }], [save])
    const oldConfirmation = deferred<any>()
    const readArtifactContent = vi.fn().mockResolvedValueOnce({ artifact, contentRevision: '1', content: 'original' })
      .mockImplementationOnce(() => oldConfirmation.promise)
      .mockResolvedValueOnce({ artifact, contentRevision: 'other:1', content: 'other project' })
      .mockResolvedValueOnce({ artifact, contentRevision: '2', content: 'first saved' })
      .mockResolvedValueOnce({ artifact, contentRevision: '3', content: 'second saved' })
    const dispatchAction = vi.fn(async () => ({ owner: 'eikona', actionId: save.actionId, status: 'completed' as const, receiptRef: 'receipt:return-save' }))
    const runtime = { resolveArtifact: vi.fn(), readArtifactContent, dispatchAction }
    const rendered = render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={runtime} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    const editor = () => document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement
    await waitFor(() => expect(editor().value).toBe('original'))
    fireEvent.change(editor(), { target: { value: 'first saved' } })
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    await waitFor(() => expect(readArtifactContent).toHaveBeenCalledTimes(2))
    const other = { ...data.snapshot, context: { ...data.snapshot.context!, projectRef: 'project:other' } }
    rendered.rerender(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={other} state={stateOf(other)} runtime={runtime} />)
    await waitFor(() => expect(editor().value).toBe('other project'))
    rendered.rerender(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={runtime} />)
    await waitFor(() => expect(editor().value).toBe('first saved'))
    fireEvent.change(editor(), { target: { value: 'second saved' } })
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    await waitFor(() => expect(screen.queryByText('当前编辑只保留在本次 Pane 中；关闭前会保持未保存保护。')).toBeNull())
    await act(async () => { oldConfirmation.resolve({ artifact, contentRevision: '2', content: 'first saved' }) })
    expect(editor().value).toBe('second saved')
    expect(readArtifactContent).toHaveBeenCalledTimes(5)
  })
  it.each([false, true])('detaches an old save and ignores its receipt after switching; new save pending=%s', async newSave => {
    const artifact = textArtifact('artifact:scoped-save', '1', 'Scoped save')
    const save = descriptor({ ref: 'action:eikona:scoped-save', actionId: 'artifact.save', label: 'Save', targetRef: artifact.ref, targetVersion: '1',
      fields: [{ key: 'body', kind: 'textarea', label: 'Body', required: true }, { key: 'revision', kind: 'text', label: 'Revision', required: true }] })
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [], actions: { saveDraft: { descriptorRef: save.descriptorRef, contentField: 'body', contentRevisionField: 'revision' } } }], [save])
    const pending = deferred<any>()
    const nextPending = deferred<any>()
    const dispatchAction = vi.fn().mockImplementationOnce(() => pending.promise).mockImplementation(() => nextPending.promise)
    const readArtifactContent = vi.fn().mockResolvedValueOnce({ artifact, contentRevision: 'old:1', content: 'old project' })
      .mockResolvedValue({ artifact, contentRevision: 'new:1', content: 'new project' })
    const runtime = { resolveArtifact: vi.fn(), readArtifactContent, dispatchAction }
    const rendered = render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={runtime} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('old project'))
    fireEvent.change(document.querySelector('[data-creator-artifact-editor] textarea')!, { target: { value: 'old submitted' } })
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    expect(dispatchAction).toHaveBeenCalledOnce()
    const nextSnapshot = { ...data.snapshot, context: { ...data.snapshot.context!, projectRef: 'project:other', revision: '2' } }
    const nextOwner = { ...data.owner, context: nextSnapshot.context, actions: [{ ...save, context: nextSnapshot.context }] }
    rendered.rerender(<CreatorArtifactWorkspace owner={nextOwner as never} snapshot={nextSnapshot} state={stateOf(nextSnapshot)} runtime={runtime} />)
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('new project'))
    expect((screen.getByRole('button', { name: '保存草稿' }) as HTMLButtonElement).disabled).toBe(false)
    if (newSave) {
      fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))
      fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
      expect(dispatchAction).toHaveBeenCalledTimes(2)
    }
    await act(async () => { pending.resolve({ owner: 'eikona', actionId: save.actionId, status: 'completed', receiptRef: 'receipt:old-project', outputArtifacts: [{ ...artifact, version: '2' }] }) })
    expect(readArtifactContent).toHaveBeenCalledTimes(2)
    expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('new project')
    expect(dispatchAction).toHaveBeenCalledTimes(newSave ? 2 : 1)
    expect((screen.getByRole('button', { name: '保存草稿' }) as HTMLButtonElement).disabled).toBe(newSave)
  })
  it.each(['ambiguous', 'other-ref', 'wrong-read-version'])('keeps a draft when fixed-version confirmation is %s', async mode => {
    const artifact = textArtifact('artifact:unconfirmed-save', '1', 'Unconfirmed'), saved = { ...artifact, version: '2' }
    const save = descriptor({ ref: 'action:eikona:unconfirmed-save', actionId: 'artifact.save', label: 'Save', targetRef: artifact.ref, targetVersion: '1',
      fields: [{ key: 'body', kind: 'textarea', label: 'Body', required: true }, { key: 'revision', kind: 'text', label: 'Revision', required: true }] })
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [], actions: { saveDraft: { descriptorRef: save.descriptorRef, contentField: 'body', contentRevisionField: 'revision' } } }], [save])
    const result = deferred<any>()
    const readArtifactContent = vi.fn().mockResolvedValueOnce({ artifact, contentRevision: 'revision:1', content: 'original' })
      .mockResolvedValue({ artifact: { ...saved, version: '3' }, contentRevision: 'revision:3', content: 'edited' })
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent, dispatchAction: vi.fn(() => result.promise) }} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('original'))
    fireEvent.change(document.querySelector('[data-creator-artifact-editor] textarea')!, { target: { value: 'edited' } })
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    await act(async () => { result.resolve({ owner: 'eikona', actionId: save.actionId, status: 'completed', receiptRef: 'receipt:unconfirmed',
      outputArtifacts: mode === 'ambiguous' ? [saved, { ...saved, version: '3' }] : mode === 'other-ref' ? [{ ...saved, ref: 'artifact:other' }] : [saved] }) })
    expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('edited')
    expect(screen.getByText('当前编辑只保留在本次 Pane 中；关闭前会保持未保存保护。')).toBeTruthy()
    expect(readArtifactContent).toHaveBeenCalledTimes(mode === 'wrong-read-version' ? 2 : 1)
  })
  it.each([false, true])('confirms a new fixed version and preserves interim input; interim=%s', async interim => {
    const artifact = textArtifact('artifact:fixed-save', '1', 'Fixed save'), saved = { ...artifact, version: '2' }
    const fields = [{ key: 'body', kind: 'textarea', label: 'Body', required: true }, { key: 'revision', kind: 'text', label: 'Revision', required: true }]
    const save = descriptor({ ref: 'action:eikona:fixed-save', actionId: 'artifact.save', label: 'Save', targetRef: artifact.ref, targetVersion: '1', fields })
    const binding = { contentField: 'body', contentRevisionField: 'revision' }
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [], actions: { saveDraft: { ...binding, descriptorRef: save.descriptorRef } } }], [save])
    const pending = deferred<any>()
    const dispatchAction = vi.fn(() => pending.promise)
    const readArtifactContent = vi.fn(async (claim: typeof artifact) => ({ artifact: claim, contentRevision: `revision:${claim.version}`, content: claim.version === '1' ? 'original' : 'submitted' }))
    const runtime = { resolveArtifact: vi.fn(), readArtifactContent: readArtifactContent as never, dispatchAction }
    const mounted = render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={runtime} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('original'))
    fireEvent.change(document.querySelector('[data-creator-artifact-editor] textarea')!, { target: { value: 'submitted' } })
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    if (interim) fireEvent.change(document.querySelector('[data-creator-artifact-editor] textarea')!, { target: { value: 'new interim edit' } })
    await act(async () => { pending.resolve({ owner: 'eikona', actionId: save.actionId, status: 'completed', receiptRef: 'receipt:fixed-save', outputArtifacts: [saved] }) })
    expect(readArtifactContent).toHaveBeenLastCalledWith(saved)
    expect(readArtifactContent).toHaveBeenCalledTimes(2)
    expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe(interim ? 'new interim edit' : 'submitted')
    expect((screen.getByRole('button', { name: '保存草稿' }) as HTMLButtonElement).disabled).toBe(true)
    expect(Boolean(screen.queryByText('当前编辑只保留在本次 Pane 中；关闭前会保持未保存保护。'))).toBe(interim)
    const nextAction = { ...save, descriptorRef: 'action:eikona:fixed-save-two', targetVersion: '2' }
    const next = ownerWith([{ artifact: saved, acceptedVersion: '2', candidates: [], actions: { saveDraft: { ...binding, descriptorRef: nextAction.descriptorRef } } }], [nextAction])
    mounted.rerender(<CreatorArtifactWorkspace owner={next.owner as never} snapshot={next.snapshot} state={stateOf(next.snapshot)} runtime={runtime} />)
    expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe(interim ? 'new interim edit' : 'submitted')
    expect((screen.getByRole('button', { name: '保存草稿' }) as HTMLButtonElement).disabled).toBe(false)
    expect(readArtifactContent).toHaveBeenCalledTimes(2)
  })
  it('keeps the source draft dirty when creating a candidate completes', async () => {
    const artifact = textArtifact('artifact:candidate-source', '1', 'Candidate source')
    const candidate = descriptor({ ref: 'action:eikona:candidate-only', actionId: 'artifact.candidate', label: 'Candidate', targetRef: artifact.ref, targetVersion: artifact.version,
      fields: [{ key: 'body', kind: 'textarea', label: 'Body', required: true }, { key: 'revision', kind: 'text', label: 'Revision', required: true }] })
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [], actions: { createCandidate: { descriptorRef: candidate.descriptorRef, contentField: 'body', contentRevisionField: 'revision' } } }], [candidate])
    const result = deferred<any>()
    const readArtifactContent = vi.fn().mockResolvedValueOnce({ artifact, contentRevision: 'revision:1', content: 'original' })
      .mockResolvedValue({ artifact, contentRevision: 'revision:2', content: 'candidate draft' })
    const dispatchAction = vi.fn(() => result.promise)
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent, dispatchAction }} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('original'))
    fireEvent.change(document.querySelector('[data-creator-artifact-editor] textarea')!, { target: { value: 'candidate draft' } })
    fireEvent.click(screen.getByRole('button', { name: '创建候选' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    await act(async () => { result.resolve({ owner: 'eikona', actionId: candidate.actionId, status: 'completed', receiptRef: 'receipt:candidate-only',
      outputArtifacts: [{ ...artifact, ref: 'artifact:new-candidate', version: '2' }] }) })
    expect(dispatchAction).toHaveBeenCalledOnce()
    expect(readArtifactContent).toHaveBeenCalledOnce()
    expect(screen.getByText('当前编辑只保留在本次 Pane 中；关闭前会保持未保存保护。')).toBeTruthy()
    expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('candidate draft')
  })
  it('saves the next in-flight edit using the newly confirmed owner revision exactly once', async () => {
    const artifact = textArtifact('artifact:auto-next', '1', 'Auto next')
    const save = descriptor({ ref: 'action:auto-next', actionId: 'artifact.save', label: 'Save', targetRef: artifact.ref, targetVersion: artifact.version, fields: [{ key: 'body', label: 'Body', kind: 'textarea', required: true }, { key: 'revision', label: 'Revision', kind: 'text', required: true }] })
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [], actions: { saveDraft: { descriptorRef: save.descriptorRef, contentField: 'body', contentRevisionField: 'revision' } } }], [save])
    let persisted = { artifact, contentRevision: '1', content: 'original' }
    const first = deferred<any>()
    const completed = { status: 'completed' as const, receiptRef: 'receipt:auto-next', owner: 'eikona', actionId: save.actionId }
    const dispatchAction = vi.fn().mockImplementationOnce(() => first.promise).mockImplementation(async (_descriptor, values) => {
      expect(values.revision).toBe(persisted.contentRevision)
      persisted = { ...persisted, contentRevision: '3', content: values.body }
      return completed
    })
    const readArtifactContent = vi.fn(async () => persisted)
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent, dispatchAction }} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect(document.querySelector('[data-creator-artifact-editor] textarea')).not.toBeNull())
    const editor = document.querySelector('[data-creator-artifact-editor] textarea')!
    fireEvent.change(editor, { target: { value: 'first edit' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '自动保存当前成果' }))
    await waitFor(() => expect(dispatchAction).toHaveBeenCalledTimes(1), { timeout: 2000 })
    expect(dispatchAction.mock.calls[0]![1]).toEqual({ body: 'first edit', revision: '1' })
    fireEvent.change(editor, { target: { value: 'second edit' } })
    await act(async () => { persisted = { ...persisted, contentRevision: '2', content: 'first edit' }; first.resolve(completed); await first.promise })
    await waitFor(() => expect(dispatchAction).toHaveBeenCalledTimes(2), { timeout: 2000 })
    expect(dispatchAction.mock.calls[1]![1]).toEqual({ body: 'second edit', revision: '2' })
    await screen.findByText('当前没有待自动保存的编辑。')
    expect((editor as HTMLTextAreaElement).value).toBe('second edit')
    expect(readArtifactContent).toHaveBeenCalledTimes(3)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 900)) })
    expect(dispatchAction).toHaveBeenCalledTimes(2)
  })

  it.each(['completed', 'unknown'] as const)('automatically saves through owner CAS and pauses on %s when unconfirmed', async status => {
    const artifact = textArtifact('artifact:auto-save', '1', 'Automatic')
    const save = descriptor({ ref: 'action:auto-save', actionId: 'artifact.save', label: 'Save', targetRef: artifact.ref, targetVersion: artifact.version, fields: [{ key: 'body', label: 'Body', kind: 'textarea', required: true }, { key: 'revision', label: 'Revision', kind: 'text', required: true }] })
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [], actions: { saveDraft: { descriptorRef: save.descriptorRef, contentField: 'body', contentRevisionField: 'revision' } } }], [save])
    const pending = deferred<any>()
    const dispatchAction = vi.fn(() => pending.promise)
    const readArtifactContent = vi.fn().mockResolvedValueOnce({ artifact, contentRevision: '1', content: 'original' }).mockResolvedValue({ artifact, contentRevision: '2', content: 'automatic edit' })
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent, dispatchAction }} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect(document.querySelector('[data-creator-artifact-editor] textarea')).not.toBeNull())
    const editor = document.querySelector('[data-creator-artifact-editor] textarea')!
    fireEvent.change(editor, { target: { value: 'automatic edit' } })
    expect(dispatchAction).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox', { name: '自动保存当前成果' }))
    await waitFor(() => expect(dispatchAction).toHaveBeenCalledExactlyOnceWith(save, { body: 'automatic edit', revision: '1' }), { timeout: 2000 })
    fireEvent.change(editor, { target: { value: 'later edit' } })
    // Disabling scheduling does not cancel reconciliation of the in-flight save.
    if (status === 'completed') fireEvent.click(screen.getByRole('checkbox', { name: '自动保存当前成果' }))
    await act(async () => { pending.resolve({ status, receiptRef: 'receipt:auto-save', owner: 'eikona', actionId: save.actionId }); await pending.promise })
    if (status === 'completed') await waitFor(() => expect(readArtifactContent).toHaveBeenCalledTimes(2))
    else {
      await screen.findByText('自动保存已暂停；正文仍保留，请先核对原操作或修复保存问题。')
      expect(readArtifactContent).toHaveBeenCalledTimes(1)
      expect((screen.getByRole('button', { name: '恢复自动保存' }) as HTMLButtonElement).disabled).toBe(true)
    }
    expect((editor as HTMLTextAreaElement).value).toBe('later edit')
    expect(dispatchAction).toHaveBeenCalledTimes(1)
  })

  it('does not auto-save while IME composition is in progress', async () => {
    const artifact = textArtifact('artifact:ime', '1', 'IME')
    const save = descriptor({ ref: 'action:ime', actionId: 'artifact.save', label: 'Save', targetRef: artifact.ref, targetVersion: artifact.version, fields: [{ key: 'body', label: 'Body', kind: 'textarea', required: true }, { key: 'revision', label: 'Revision', kind: 'text', required: true }] })
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [], actions: { saveDraft: { descriptorRef: save.descriptorRef, contentField: 'body', contentRevisionField: 'revision' } } }], [save])
    const dispatchAction = vi.fn(async () => ({ status: 'completed' as const, receiptRef: 'receipt:ime', owner: 'eikona', actionId: save.actionId }))
    const readArtifactContent = vi.fn().mockResolvedValue({ artifact, contentRevision: '1', content: 'original' })
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent, dispatchAction }} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect(document.querySelector('[data-creator-artifact-editor] textarea')).not.toBeNull())
    const editor = document.querySelector('[data-creator-artifact-editor] textarea')!
    fireEvent.click(screen.getByRole('checkbox', { name: '自动保存当前成果' }))
    fireEvent.compositionStart(editor)
    fireEvent.change(editor, { target: { value: 'ni' } })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 900)) })
    expect(dispatchAction).not.toHaveBeenCalled()
    fireEvent.change(editor, { target: { value: '你' } })
    fireEvent.compositionEnd(editor)
    await waitFor(() => expect(dispatchAction).toHaveBeenCalledTimes(1), { timeout: 2000 })
    expect(dispatchAction.mock.calls[0]![1]).toEqual({ body: '你', revision: '1' })
  })

  it.each([false, true])('reconciles an unknown save without resubmitting and preserves later edits=%s', async laterEdit => {
    const artifact = textArtifact('artifact:recover-save', '1', 'Recover save')
    const save = descriptor({ ref: 'action:eikona:recover-save', actionId: 'artifact.save', label: 'Save', targetRef: artifact.ref, targetVersion: artifact.version, fields: [{ key: 'body', label: 'Body', kind: 'textarea', required: true }, { key: 'revision', label: 'Revision', kind: 'text', required: true }] })
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [], actions: { saveDraft: { descriptorRef: save.descriptorRef, contentField: 'body', contentRevisionField: 'revision' } } }], [save])
    const unknown = { status: 'unknown' as const, receiptRef: 'receipt:original', owner: 'eikona', actionId: save.actionId }
    const lookup = deferred<any>()
    const dispatchAction = vi.fn(async () => unknown)
    const reconcileAction = vi.fn(() => lookup.promise)
    const readArtifactContent = vi.fn().mockResolvedValueOnce({ artifact, contentRevision: '1', content: 'original' }).mockResolvedValue({ artifact, contentRevision: '2', content: 'submitted edit' })
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={{ ...stateOf(data.snapshot), lastReceipt: unknown } as never} runtime={{ resolveArtifact: vi.fn(), readArtifactContent, dispatchAction, reconcileAction }} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect(document.querySelector('[data-creator-artifact-editor] textarea')).not.toBeNull())
    fireEvent.change(document.querySelector('[data-creator-artifact-editor] textarea')!, { target: { value: 'submitted edit' } })
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    await waitFor(() => expect(dispatchAction).toHaveBeenCalledTimes(1))
    const reconcile = screen.getByRole('button', { name: '核对原操作' })
    fireEvent.click(reconcile)
    fireEvent.click(reconcile)
    await waitFor(() => expect(reconcileAction).toHaveBeenCalledExactlyOnceWith(save))
    if (laterEdit) fireEvent.change(document.querySelector('[data-creator-artifact-editor] textarea')!, { target: { value: 'later edit' } })
    await act(async () => { lookup.resolve({ ...unknown, status: 'completed' }); await lookup.promise })
    await waitFor(() => expect(readArtifactContent).toHaveBeenCalledTimes(2))
    await waitFor(() => expect((screen.getByRole('button', { name: '保存草稿' }) as HTMLButtonElement).disabled).toBe(false))
    expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe(laterEdit ? 'later edit' : 'submitted edit')
    expect(screen.queryByText('当前编辑只保留在本次 Pane 中；关闭前会保持未保存保护。') !== null).toBe(laterEdit)
    expect(dispatchAction).toHaveBeenCalledTimes(1)
  })

  it.each(['version', 'context'] as const)('isolates reading state across a %s change and async body loading', async change => {
    const artifact = textArtifact('artifact:reading-isolation', '1', 'Isolated')
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [] }], [])
    const pending = deferred<any>()
    const runtime = { resolveArtifact: vi.fn(), readArtifactContent: vi.fn().mockResolvedValueOnce({ artifact, contentRevision: '1', content: '0123456789\n'.repeat(100) }).mockImplementationOnce(() => pending.promise).mockResolvedValue({ artifact, contentRevision: '1', content: '0123456789\n'.repeat(100) }), dispatchAction: vi.fn() }
    const element = (owner: typeof data.owner, snapshot: typeof data.snapshot) => <CreatorArtifactWorkspace owner={owner as never} snapshot={snapshot} state={stateOf(snapshot)} runtime={runtime} />
    const mounted = render(element(data.owner, data.snapshot))
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect(document.querySelector('[data-creator-artifact-editor] textarea')).not.toBeNull())
    const original = document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement
    original.setSelectionRange(6, 17, 'backward')
    fireEvent.scroll(original, { target: { scrollTop: 160 } })
    const nextArtifact = change === 'version' ? { ...artifact, version: '2' } : artifact
    const nextOwner = { ...data.owner, artifactWorkspace: { ...data.owner.artifactWorkspace, artifacts: [{ artifact: nextArtifact, acceptedVersion: nextArtifact.version, candidates: [] }] } }
    const nextSnapshot = change === 'context' ? { ...data.snapshot, context: { ...data.snapshot.context!, workspaceRef: 'workspace:other', principalRef: 'principal:other' } } : data.snapshot
    mounted.rerender(element(nextOwner, nextSnapshot))
    await waitFor(() => expect(runtime.readArtifactContent).toHaveBeenCalledTimes(2))
    expect(document.querySelector('[data-creator-artifact-editor] textarea')).toBeNull()
    await act(async () => { pending.resolve({ artifact: nextArtifact, contentRevision: '2', content: 'different body\n'.repeat(100) }); await pending.promise })
    const fresh = document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement
    expect([fresh.scrollTop, fresh.selectionStart, fresh.selectionEnd]).toEqual([0, 0, 0])
    fireEvent.scroll(fresh, { target: { scrollTop: 80 } })
    mounted.rerender(element(data.owner, data.snapshot))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement)?.value).toContain('0123456789'))
    const returned = document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement
    expect([returned.scrollTop, returned.selectionStart, returned.selectionEnd]).toEqual(change === 'version' ? [160, 6, 17] : [0, 0, 0])
  })

  it('restores independent source selections and preview scroll without stealing tab focus', async () => {
    const first = textArtifact('artifact:reading-one', '1', 'Reading One')
    const second = textArtifact('artifact:reading-two', '1', 'Reading Two')
    const data = ownerWith([first, second].map(artifact => ({ artifact, acceptedVersion: '1', candidates: [] })), [])
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent: vi.fn(async artifact => ({ artifact, contentRevision: '1', content: '0123456789\n'.repeat(100) })), dispatchAction: vi.fn() }} />)
    await waitFor(() => expect(document.querySelector('[data-creator-artifact-preview]')).not.toBeNull())
    const preview = document.querySelector('[data-creator-artifact-preview]') as HTMLElement
    fireEvent.scroll(preview, { target: { scrollTop: 320, scrollLeft: 12 } })
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    const editor = document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement
    editor.setSelectionRange(5, 14, 'backward')
    fireEvent.scroll(editor, { target: { scrollTop: 180, scrollLeft: 9 } })
    fireEvent.click(screen.getByRole('button', { name: 'Reading Two' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement)?.value).toContain('0123456789'))
    const other = document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement
    expect(other.scrollTop).toBe(0)
    expect(other.selectionStart).toBe(0)
    fireEvent.scroll(other, { target: { scrollTop: 70 } })
    fireEvent.click(screen.getByRole('button', { name: 'Reading One' }))
    const restored = document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement
    expect([restored.scrollTop, restored.scrollLeft, restored.selectionStart, restored.selectionEnd, restored.selectionDirection]).toEqual([180, 9, 5, 14, 'backward'])
    fireEvent.click(screen.getByRole('tab', { name: '预览' }))
    expect((document.querySelector('[data-creator-artifact-preview]') as HTMLElement).scrollTop).toBe(320)
    const sourceTab = screen.getByRole('tab', { name: '源码' })
    sourceTab.focus()
    fireEvent.click(sourceTab)
    expect(document.activeElement).toBe(sourceTab)
    expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).selectionEnd).toBe(14)
  })

  it.each(['before-unmount', 'after-unmount'] as const)('releases preview resources resolved %s', async timing => {
    const revoke = vi.fn()
    vi.stubGlobal('URL', class extends URL { static revokeObjectURL = revoke })
    const artifact = { ...textArtifact('artifact:late-image', '1', 'Image'), kind: 'image', mediaType: 'image/png' }
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [] }], [])
    const pending = deferred<string>()
    const resolveArtifact = vi.fn(() => pending.promise)
    const mounted = render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact, readArtifactContent: vi.fn(async () => undefined), dispatchAction: vi.fn() }} />)
    expect(resolveArtifact).toHaveBeenCalledTimes(1)
    if (timing === 'after-unmount') mounted.unmount()
    await act(async () => { pending.resolve('blob:synthetic-preview'); await pending.promise })
    if (timing === 'before-unmount') { expect(revoke).not.toHaveBeenCalled(); mounted.unmount() }
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:synthetic-preview')
    expect(document.querySelector('[data-dsh-media-image-selection-stage]')).toBeNull()
  })

  it.each(['before-error', 'after-error'] as const)('releases the surviving comparison resource resolved %s', async timing => {
    const revoke = vi.fn()
    vi.stubGlobal('URL', class extends URL { static revokeObjectURL = revoke })
    const artifact = { ...textArtifact('artifact:compare-image', '1', 'Image'), kind: 'image', mediaType: 'image/png' }
    const candidate = { ...artifact, ref: 'artifact:compare-candidate', version: '2' }
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [{ ref: 'candidate:2', version: '2', title: 'Candidate', status: 'ready', artifact: candidate }] }], [])
    const pending = deferred<string>()
    let reject!: (error: Error) => void
    const failed = new Promise<string>((_, no) => { reject = no })
    const resolveArtifact = vi.fn().mockResolvedValueOnce('https://media.example/preview.png').mockImplementationOnce(() => pending.promise).mockImplementationOnce(() => failed)
    const mounted = render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact, readArtifactContent: vi.fn(async () => undefined), dispatchAction: vi.fn() }} />)
    fireEvent.click(screen.getByRole('tab', { name: '比较' }))
    await waitFor(() => expect(resolveArtifact).toHaveBeenCalledTimes(3))
    if (timing === 'before-error') await act(async () => { pending.resolve('blob:synthetic-comparison'); await pending.promise })
    await act(async () => { reject(new Error('synthetic resource unavailable')); await failed.catch(() => undefined) })
    if (timing === 'after-error') await act(async () => { pending.resolve('blob:synthetic-comparison'); await pending.promise })
    await waitFor(() => expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:synthetic-comparison'))
    mounted.unmount()
    expect(revoke).toHaveBeenCalledTimes(1)
  })

  it.each(['error', 'unavailable'] as const)('explicitly retries an initial %s body without an automatic loop or mutation', async outcome => {
    const artifact = textArtifact('artifact:retry', '1', 'Retry')
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [] }], [])
    const pending = deferred<any>()
    const readArtifactContent = vi.fn()
    if (outcome === 'error') readArtifactContent.mockRejectedValueOnce(new Error('temporary transport failure'))
    else readArtifactContent.mockResolvedValueOnce(undefined)
    readArtifactContent.mockImplementationOnce(() => pending.promise)
    const dispatchAction = vi.fn()
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent, dispatchAction }} />)
    const retry = await screen.findByRole('button', { name: '重新读取正文' })
    expect(readArtifactContent).toHaveBeenCalledTimes(1)
    fireEvent.click(retry)
    await waitFor(() => expect(readArtifactContent).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('button', { name: '重新读取正文' })).toBeNull()
    pending.resolve({ artifact, contentRevision: '1', content: 'Recovered content' })
    await screen.findByText('Recovered content')
    expect(dispatchAction).not.toHaveBeenCalled()
    expect(readArtifactContent).toHaveBeenCalledTimes(2)
  })

  it('reports malformed and bounded table previews while preserving the full editable source', async () => {
    const artifact = { ...textArtifact('artifact:csv', '1', 'CSV'), mediaType: 'text/csv' }
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [] }], [])
    const source = 'name,note\nAlice,"unfinished'
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent: vi.fn(async () => ({ artifact, contentRevision: '1', content: source })), dispatchAction: vi.fn() }} />)
    await screen.findByText(/表格格式错误/)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    const editor = document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement
    expect(editor.value).toBe(source)
    const large = 'name,note\nAlice,' + 'x'.repeat(2_001)
    fireEvent.change(editor, { target: { value: large } })
    fireEvent.click(screen.getByRole('tab', { name: '预览' }))
    await screen.findByText('表格预览仅显示预算范围内的内容。')
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe(large)
    fireEvent.change(document.querySelector('[data-creator-artifact-editor] textarea')!, { target: { value: 'name,note\n"Alice, B","line1\nline2"' } })
    fireEvent.click(screen.getByRole('tab', { name: '预览' }))
    expect(screen.queryByText(/表格格式错误/)).toBeNull()
    expect(screen.queryByText('表格预览仅显示预算范围内的内容。')).toBeNull()
  })

  it('keeps a draft across empty-to-ready and ready-to-empty owner snapshots', async () => {
    const artifact = textArtifact('artifact:arriving', '1', 'Arriving')
    const empty = ownerWith([], [])
    const ready = ownerWith([{ artifact, acceptedVersion: '1', candidates: [] }], [])
    const runtime = { resolveArtifact: vi.fn(), readArtifactContent: vi.fn(async () => ({ artifact, contentRevision: '1', content: 'Owner body' })), dispatchAction: vi.fn() }
    const ui = (data: ReturnType<typeof ownerWith>) => <CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={runtime} />
    const rendered = render(ui(empty))
    expect(screen.queryByRole('tablist')).toBeNull()
    rendered.rerender(ui(ready))
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect(document.querySelector('[data-creator-artifact-editor] textarea')).not.toBeNull())
    fireEvent.change(document.querySelector('[data-creator-artifact-editor] textarea')!, { target: { value: 'Keep this local edit' } })
    rendered.rerender(ui(empty))
    expect(screen.queryByRole('tablist')).toBeNull()
    rendered.rerender(ui(ready))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('Keep this local edit'))
  })

  it('uses one tab stop, arrow/Home/End navigation and a named panel without losing source edits', async () => {
    const artifact = textArtifact('artifact:keyboard', '1', 'Keyboard')
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [] }], [])
    const runtime = { resolveArtifact: vi.fn(), readArtifactContent: vi.fn(async () => ({ artifact, contentRevision: '1', content: 'Owner body' })), dispatchAction: vi.fn() }
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={runtime} />)
    const preview = screen.getByRole('tab', { name: '预览' })
    const source = screen.getByRole('tab', { name: '源码' })
    const compare = screen.getByRole('tab', { name: '比较' })
    expect(preview.tabIndex).toBe(0)
    expect(source.tabIndex).toBe(-1)
    preview.focus()
    fireEvent.keyDown(preview, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(source)
    const panel = screen.getByRole('tabpanel', { name: '源码' })
    expect(source.getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.getAttribute('aria-labelledby')).toBe(source.id)
    await waitFor(() => expect(panel.querySelector('textarea')).not.toBeNull())
    fireEvent.change(panel.querySelector('textarea')!, { target: { value: 'Keyboard draft' } })
    fireEvent.keyDown(source, { key: 'End' })
    expect(document.activeElement).toBe(compare)
    fireEvent.keyDown(compare, { key: 'Home' })
    expect(document.activeElement).toBe(preview)
    fireEvent.keyDown(preview, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(compare)
    fireEvent.keyDown(compare, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(source)
    expect((screen.getByRole('tabpanel', { name: '源码' }).querySelector('textarea') as HTMLTextAreaElement).value).toBe('Keyboard draft')
    fireEvent.keyDown(source, { key: 'ArrowRight', isComposing: true })
    expect(document.activeElement).toBe(source)
    fireEvent.keyDown(source, { key: 'ArrowRight', altKey: true })
    expect(document.activeElement).toBe(source)
    screen.getByRole('tablist').style.direction = 'rtl'
    fireEvent.keyDown(source, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(preview)
    fireEvent.keyDown(preview, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(source)
  })

  it('uses the full body, previews the live draft, and preserves edits across item switches and snapshot refresh', async () => {
    const a = textArtifact('artifact:a', '7', 'A')
    const b = textArtifact('artifact:b', '2', 'B')
    const save = descriptor({ ref: 'action:eikona:save', actionId: 'artifact.save', label: 'Save', targetRef: a.ref, targetVersion: a.version, fields: [{ key: 'body', label: 'Body', kind: 'textarea', required: true }] })
    const data = ownerWith([
      { artifact: a, acceptedVersion: '7', textPreview: { after: 'bounded preview' }, candidates: [], actions: { saveDraft: { descriptorRef: save.descriptorRef, contentField: 'body' } } },
      { artifact: b, acceptedVersion: '2', candidates: [] },
    ], [save])
    const fullA = `${'full body '.repeat(400)}END`
    const runtime = { resolveArtifact: vi.fn(), readArtifactContent: vi.fn(async artifact => ({ artifact, contentRevision: `full:${artifact.version}`, content: artifact.ref === a.ref ? fullA : 'body B' })), dispatchAction: vi.fn(async () => ({ status: 'unknown' as const, receiptRef: 'receipt:unknown', owner: 'eikona', actionId: 'artifact.save', reconcileReason: 'settlement_unknown' })) }
    const onDirty = vi.fn()
    const rendered = render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={runtime} onDirty={onDirty} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect(document.querySelector('[data-creator-artifact-editor] textarea')).not.toBeNull())
    const editor = document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement
    expect(editor.value.length).toBeGreaterThan(1_200)
    expect(editor.value.endsWith('END')).toBe(true)
    fireEvent.change(editor, { target: { value: '# local edit\n\ncurrent' } })
    fireEvent.click(screen.getByRole('tab', { name: '预览' }))
    expect(document.querySelector('[data-creator-artifact-preview]')?.textContent).toContain('local edit')
    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('body B'))
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('# local edit\n\ncurrent'))
    rendered.rerender(<CreatorArtifactWorkspace owner={{ ...data.owner, snapshotRef: 'creator:snapshot:refresh' } as never} snapshot={{ ...data.snapshot, snapshotRef: 'creator:snapshot:refresh' } as never} state={stateOf(data.snapshot)} runtime={runtime} onDirty={onDirty} />)
    expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('# local edit\n\ncurrent')
    rendered.unmount()
    expect(onDirty.mock.calls.at(-1)?.[0]).toBe(true)
  })

  it('keeps independent body reads alive while switching candidates and allows every key to finish', async () => {
    const artifact = textArtifact('artifact:base', '1', 'Base')
    const one = textArtifact('artifact:candidate-one', '2', 'One')
    const two = textArtifact('artifact:candidate-two', '3', 'Two')
    const attach = descriptor({ ref: 'action:eikona:attach-switch', actionId: 'context.attach', label: 'Attach', targetRef: artifact.ref, targetVersion: artifact.version, fields: [{ key: 'body', label: 'Body', kind: 'textarea', required: true }, { key: 'content_revision', label: 'Revision', kind: 'text', required: true }, { key: 'candidate_ref', label: 'Candidate', kind: 'text', required: true }, { key: 'candidate_version', label: 'Candidate version', kind: 'text', required: true }] })
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [
      { ref: 'candidate:one', version: '2', title: 'One', status: 'ready' as const, artifact: one },
      { ref: 'candidate:two', version: '3', title: 'Two', status: 'ready' as const, artifact: two },
    ], actions: { attachContext: { descriptorRef: attach.descriptorRef, contentField: 'body', contentRevisionField: 'content_revision', candidateRefField: 'candidate_ref', candidateVersionField: 'candidate_version' } } }], [attach])
    const reads = new Map([[artifact.ref, deferred<any>()], [one.ref, deferred<any>()], [two.ref, deferred<any>()]])
    const readArtifactContent = vi.fn((current: { ref: string }) => reads.get(current.ref)!.promise)
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent: readArtifactContent as never, dispatchAction: vi.fn() }} />)
    fireEvent.click(screen.getByRole('tab', { name: '比较' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'candidate:two' } })
    expect(readArtifactContent).toHaveBeenCalledWith(expect.objectContaining({ ref: artifact.ref }))
    expect(readArtifactContent).toHaveBeenCalledWith(expect.objectContaining({ ref: one.ref }))
    await waitFor(() => expect(readArtifactContent).toHaveBeenCalledWith(expect.objectContaining({ ref: two.ref })))
    reads.get(artifact.ref)!.resolve({ artifact, contentRevision: 'body:1', content: 'base body' })
    reads.get(one.ref)!.resolve({ artifact: one, contentRevision: 'body:2', content: 'one body' })
    reads.get(two.ref)!.resolve({ artifact: two, contentRevision: 'body:3', content: 'two body' })
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('base body'))
    fireEvent.click(screen.getByRole('tab', { name: '比较' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'candidate:one' } })
    fireEvent.click(screen.getByRole('button', { name: '加入主对话' }))
    expect((screen.getByRole('button', { name: '执行操作' }) as HTMLButtonElement).disabled).toBe(false)
    expect(readArtifactContent).toHaveBeenCalledTimes(3)
  })

  it('epochs body caches by the full Creator context and ignores a late prior-context read', async () => {
    const artifact = textArtifact('artifact:context', '1', 'Context draft')
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [] }], [])
    const oldRead = deferred<any>()
    const readArtifactContent = vi.fn()
      .mockImplementationOnce(() => oldRead.promise)
      .mockResolvedValueOnce({ artifact, contentRevision: 'new:1', content: 'new workspace body' })
    const rendered = render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent, dispatchAction: vi.fn() }} />)
    const nextSnapshot = { ...data.snapshot, snapshotRef: 'creator:snapshot:new-context', context: { ...data.snapshot.context!, projectRef: 'project:two', sessionRef: 'session:two', revision: '2', membershipRevision: 'membership:two', installationRef: 'install:two', pluginDigest: 'digest:two' } }
    rendered.rerender(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={nextSnapshot as never} state={stateOf(nextSnapshot as never)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent, dispatchAction: vi.fn() }} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('new workspace body'))
    oldRead.resolve({ artifact, contentRevision: 'old:1', content: 'old workspace body' })
    await Promise.resolve()
    expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('new workspace body')
    expect(readArtifactContent).toHaveBeenCalledTimes(2)
  })

  it('keeps artifact ref and version tuples distinct when delimiter text would collide', async () => {
    const one = textArtifact('artifact:a:b', 'c', 'Tuple one')
    const two = textArtifact('artifact:a', 'b:c', 'Tuple two')
    const data = ownerWith([{ artifact: one, acceptedVersion: one.version, candidates: [] }, { artifact: two, acceptedVersion: two.version, candidates: [] }], [])
    const readArtifactContent = vi.fn(async (artifact: typeof one) => ({ artifact, contentRevision: `revision:${artifact.ref}`, content: artifact.ref === one.ref ? 'tuple one body' : 'tuple two body' }))
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent: readArtifactContent as never, dispatchAction: vi.fn() }} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('tuple one body'))
    fireEvent.click(screen.getByRole('button', { name: 'Tuple two' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('tuple two body'))
  })

  it('retains an edited draft after queued acceptance and clears it only after completed revision confirmation', async () => {
    const artifact = textArtifact('artifact:save', '1', 'Save draft')
    const save = descriptor({ ref: 'action:eikona:save-cas', actionId: 'artifact.save', label: 'Save', targetRef: artifact.ref, targetVersion: artifact.version, fields: [{ key: 'body', label: 'Body', kind: 'textarea', required: true }, { key: 'content_revision', label: 'Revision', kind: 'text', required: true }] })
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [], actions: { saveDraft: { descriptorRef: save.descriptorRef, contentField: 'body', contentRevisionField: 'content_revision' } } }], [save])
    let readCount = 0
    const readArtifactContent = vi.fn(async () => ++readCount === 1 ? { artifact, contentRevision: 'revision:1', content: 'original' } : { artifact, contentRevision: 'revision:2', content: 'edited' })
    const accepted = vi.fn(async () => ({ status: 'accepted' as const, receiptRef: 'receipt:queued', owner: 'eikona', actionId: save.actionId }))
    const first = render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent, dispatchAction: accepted }} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect(document.querySelector('[data-creator-artifact-editor] textarea')).not.toBeNull())
    fireEvent.change(document.querySelector('[data-creator-artifact-editor] textarea')!, { target: { value: 'edited' } })
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    expect(screen.getByText('当前编辑只保留在本次 Pane 中；关闭前会保持未保存保护。')).toBeTruthy()
    expect(readArtifactContent).toHaveBeenCalledTimes(1)
    first.unmount()

    readCount = 0
    readArtifactContent.mockClear()
    const completed = vi.fn(async () => ({ status: 'completed' as const, receiptRef: 'receipt:completed', owner: 'eikona', actionId: save.actionId }))
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent, dispatchAction: completed }} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('original'))
    fireEvent.change(document.querySelector('[data-creator-artifact-editor] textarea')!, { target: { value: 'edited' } })
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    await waitFor(() => expect(screen.queryByText('当前编辑只保留在本次 Pane 中；关闭前会保持未保存保护。')).toBeNull())
    expect(completed).toHaveBeenCalledWith(save, expect.objectContaining({ body: 'edited', content_revision: 'revision:1' }))
    expect(readArtifactContent).toHaveBeenCalledTimes(2)
  })

  it('keeps an interim edit made after save submission while recording the completed submitted revision', async () => {
    const artifact = textArtifact('artifact:save-race', '1', 'Save race')
    const save = descriptor({ ref: 'action:eikona:save-race', actionId: 'artifact.save', label: 'Save', targetRef: artifact.ref, targetVersion: artifact.version, fields: [{ key: 'body', label: 'Body', kind: 'textarea', required: true }, { key: 'content_revision', label: 'Revision', kind: 'text', required: true }] })
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [], actions: { saveDraft: { descriptorRef: save.descriptorRef, contentField: 'body', contentRevisionField: 'content_revision' } } }], [save])
    const receipt = deferred<any>()
    const readArtifactContent = vi.fn()
      .mockResolvedValueOnce({ artifact, contentRevision: 'revision:1', content: 'original' })
      .mockResolvedValueOnce({ artifact, contentRevision: 'revision:2', content: 'submitted A' })
    const dispatchAction = vi.fn(() => receipt.promise)
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent, dispatchAction }} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('original'))
    const editor = document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'submitted A' } })
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    expect(dispatchAction).toHaveBeenCalledWith(save, expect.objectContaining({ body: 'submitted A', content_revision: 'revision:1' }))
    fireEvent.change(editor, { target: { value: 'interim edit B' } })
    receipt.resolve({ status: 'completed', receiptRef: 'receipt:save-race', owner: 'eikona', actionId: save.actionId })
    await waitFor(() => expect(readArtifactContent).toHaveBeenCalledTimes(2))
    expect(editor.value).toBe('interim edit B')
    expect(screen.getByText('当前编辑只保留在本次 Pane 中；关闭前会保持未保存保护。')).toBeTruthy()
  })

  it('does not let a delayed confirmation for completed A overwrite a newer completed B cache', async () => {
    const artifact = textArtifact('artifact:confirm-order', '1', 'Confirmation order')
    const save = descriptor({ ref: 'action:eikona:confirm-order', actionId: 'artifact.save', label: 'Save', targetRef: artifact.ref, targetVersion: artifact.version, fields: [{ key: 'body', label: 'Body', kind: 'textarea', required: true, maxLength: 16_384 }, { key: 'content_revision', label: 'Revision', kind: 'text', required: true, maxLength: 160 }] })
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [], actions: { saveDraft: { descriptorRef: save.descriptorRef, contentField: 'body', contentRevisionField: 'content_revision' } } }], [save])
    const confirmationA = deferred<any>()
    const readArtifactContent = vi.fn()
      .mockResolvedValueOnce({ artifact, contentRevision: 'revision:1', content: 'original' })
      .mockImplementationOnce(() => confirmationA.promise)
      .mockResolvedValueOnce({ artifact, contentRevision: 'revision:3', content: 'completed B' })
    const dispatchAction = vi.fn(async () => ({ status: 'completed' as const, receiptRef: 'receipt:completed', owner: 'eikona', actionId: save.actionId }))
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent, dispatchAction }} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('original'))
    const editor = document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'completed A' } })
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    await waitFor(() => expect(readArtifactContent).toHaveBeenCalledTimes(2))
    fireEvent.change(editor, { target: { value: 'completed B' } })
    await waitFor(() => expect((screen.getByRole('button', { name: '执行操作' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    await waitFor(() => expect(readArtifactContent).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(editor.value).toBe('completed B'))
    confirmationA.resolve({ artifact, contentRevision: 'revision:2', content: 'completed A' })
    await Promise.resolve()
    expect(editor.value).toBe('completed B')
  })

  it('keeps an over-limit full body intact and disables owner submission with its exact cap', async () => {
    const artifact = textArtifact('artifact:large-action', '1', 'Large action body')
    const save = descriptor({ ref: 'action:eikona:large-action', actionId: 'artifact.save', label: 'Save', targetRef: artifact.ref, targetVersion: artifact.version, fields: [{ key: 'body', label: 'Body', kind: 'textarea', required: true, maxLength: 8_000 }, { key: 'content_revision', label: 'Revision', kind: 'text', required: true, maxLength: 160 }] })
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [], actions: { saveDraft: { descriptorRef: save.descriptorRef, contentField: 'body', contentRevisionField: 'content_revision' } } }], [save])
    const full = `# Large\n${'preserve exactly '.repeat(700)}`
    const dispatchAction = vi.fn()
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent: vi.fn(async () => ({ artifact, contentRevision: 'revision:1', content: full })), dispatchAction }} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe(full))
    const saveButton = screen.getByRole('button', { name: '保存草稿' }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)
    expect(saveButton.title).toContain('8000')
    fireEvent.click(saveButton)
    expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe(full)
    expect(dispatchAction).not.toHaveBeenCalled()
  })

  it('globally fences lifecycle dispatch and binds one completed receipt to its original submission', async () => {
    const artifact = textArtifact('artifact:lifecycle-fence', '1', 'Lifecycle fence')
    const fields = [{ key: 'body', label: 'Body', kind: 'textarea', required: true, maxLength: 16_384 }, { key: 'content_revision', label: 'Revision', kind: 'text', required: true, maxLength: 160 }]
    const save = descriptor({ ref: 'action:eikona:fence-save', actionId: 'artifact.save', label: 'Save', targetRef: artifact.ref, targetVersion: artifact.version, fields })
    const candidate = descriptor({ ref: 'action:eikona:fence-candidate', actionId: 'artifact.candidate', label: 'Candidate', targetRef: artifact.ref, targetVersion: artifact.version, fields })
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [], actions: { saveDraft: { descriptorRef: save.descriptorRef, contentField: 'body', contentRevisionField: 'content_revision' }, createCandidate: { descriptorRef: candidate.descriptorRef, contentField: 'body', contentRevisionField: 'content_revision' } } }], [save, candidate])
    const pending = deferred<any>()
    const dispatchAction = vi.fn(() => pending.promise)
    const readArtifactContent = vi.fn().mockResolvedValueOnce({ artifact, contentRevision: 'revision:1', content: 'body' }).mockResolvedValueOnce({ artifact, contentRevision: 'revision:2', content: 'body' })
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent, dispatchAction }} />)
    await waitFor(() => expect((screen.getByRole('button', { name: '保存草稿' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))
    const execute = screen.getByRole('button', { name: '执行操作' })
    fireEvent.click(execute); fireEvent.click(execute)
    expect(dispatchAction).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('button', { name: '创建候选' }) as HTMLButtonElement).disabled).toBe(true)
    pending.resolve({ status: 'completed', receiptRef: 'receipt:fenced', owner: 'eikona', actionId: save.actionId })
    await waitFor(() => expect(readArtifactContent).toHaveBeenCalledTimes(2))
    expect(dispatchAction).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])('restores the original reconciliation entry only while its version is current; changed=%s', async changed => {
    const first = textArtifact('artifact:unknown-one', '1', 'Unknown one')
    const second = textArtifact('artifact:unknown-two', '1', 'Unknown two')
    const firstSave = descriptor({ ref: 'action:eikona:unknown-one', actionId: 'artifact.save.one', label: 'Save one', targetRef: first.ref, targetVersion: first.version, fields: [{ key: 'body', label: 'Body', kind: 'textarea', required: true, maxLength: 16_384 }, { key: 'content_revision', label: 'Revision', kind: 'text', required: true, maxLength: 160 }] })
    const secondSave = descriptor({ ref: 'action:eikona:unknown-two', actionId: 'artifact.save.two', label: 'Save two', targetRef: second.ref, targetVersion: second.version, fields: [{ key: 'body', label: 'Body', kind: 'textarea', required: true, maxLength: 16_384 }, { key: 'content_revision', label: 'Revision', kind: 'text', required: true, maxLength: 160 }] })
    const data = ownerWith([
      { artifact: first, acceptedVersion: '1', candidates: [], actions: { saveDraft: { descriptorRef: firstSave.descriptorRef, contentField: 'body', contentRevisionField: 'content_revision' } } },
      { artifact: second, acceptedVersion: '1', candidates: [], actions: { saveDraft: { descriptorRef: secondSave.descriptorRef, contentField: 'body', contentRevisionField: 'content_revision' } } },
    ], [firstSave, secondSave])
    const dispatchAction = vi.fn(async () => ({ status: 'unknown' as const, receiptRef: 'receipt:unknown-lock', owner: 'eikona', actionId: firstSave.actionId, reconcileReason: 'settlement_unknown' }))
    const reconcileAction = vi.fn(async () => ({ status: 'completed' as const, receiptRef: 'receipt:unknown-lock', owner: 'eikona', actionId: firstSave.actionId }))
    const mounted = render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={{ ...stateOf(data.snapshot), lastReceipt: { status: 'unknown', receiptRef: 'receipt:unknown-lock', owner: 'eikona', actionId: firstSave.actionId } } as never} runtime={{ resolveArtifact: vi.fn(), readArtifactContent: vi.fn(async artifact => ({ artifact, contentRevision: 'revision:1', content: 'body' })), dispatchAction, reconcileAction }} />)
    await waitFor(() => expect((screen.getByRole('button', { name: '保存草稿' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    await waitFor(() => expect(dispatchAction).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Unknown two' }))
    const secondAction = screen.getByRole('button', { name: '保存草稿' }) as HTMLButtonElement
    expect(secondAction.disabled).toBe(true)
    expect(secondAction.title).toBe('Owner 正在处理上一项操作。')
    fireEvent.click(secondAction)
    expect(dispatchAction).toHaveBeenCalledTimes(1)
    if (changed) {
      const changedOwner = { ...data.owner, artifactWorkspace: { ...data.owner.artifactWorkspace, artifacts: data.owner.artifactWorkspace.artifacts.map((item: any) => item.artifact.ref === first.ref ? { ...item, artifact: { ...item.artifact, version: '2' } } : item) } }
      mounted.rerender(<CreatorArtifactWorkspace owner={changedOwner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent: vi.fn(async artifact => ({ artifact, contentRevision: 'revision:2', content: 'body' })), dispatchAction, reconcileAction }} />)
      const recovery = screen.getByRole('button', { name: '返回待核对操作' }) as HTMLButtonElement
      expect(recovery.disabled).toBe(true)
      fireEvent.click(recovery)
      expect(reconcileAction).not.toHaveBeenCalled()
      expect(dispatchAction).toHaveBeenCalledTimes(1)
      return
    }
    fireEvent.click(screen.getByRole('button', { name: '返回待核对操作' }))
    expect(screen.queryByRole('button', { name: '返回待核对操作' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '核对原操作' }))
    await waitFor(() => expect(reconcileAction).toHaveBeenCalledExactlyOnceWith(firstSave))
    await waitFor(() => expect((screen.getByRole('button', { name: '保存草稿' }) as HTMLButtonElement).disabled).toBe(false))
    expect(dispatchAction).toHaveBeenCalledTimes(1)
  })

  it('binds candidate two, source version, and preserves locked values on partial settlement', async () => {
    const artifact = textArtifact()
    const adopt = descriptor({ ref: 'action:eikona:adopt', actionId: 'artifact.adopt', label: 'Adopt', targetRef: artifact.ref, targetVersion: artifact.version, fields: [
      { key: 'candidate_ref', label: 'Candidate', kind: 'text', required: true }, { key: 'candidate_version', label: 'Version', kind: 'text', required: true }, { key: 'source_version', label: 'Source version', kind: 'text', required: true },
    ] })
    const data = ownerWith([{ artifact, acceptedVersion: '7', sourceVersion: 'source:7', candidates: [
      { ref: 'candidate:one', version: '8', sourceVersion: 'source:8', title: 'One', status: 'ready' as const },
      { ref: 'candidate:two', version: '9', sourceVersion: 'source:9', title: 'Two', status: 'ready' as const },
    ], actions: { adopt: { descriptorRef: adopt.descriptorRef, candidateRefField: 'candidate_ref', candidateVersionField: 'candidate_version', sourceVersionField: 'source_version' } } }], [adopt])
    const dispatchAction = vi.fn(async () => ({ status: 'partial' as const, receiptRef: 'receipt:partial', owner: 'eikona', actionId: 'artifact.adopt', reconcileReason: 'owner_partial' }))
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent: vi.fn(async () => undefined), dispatchAction }} />)
    fireEvent.click(screen.getByRole('tab', { name: '比较' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'candidate:two' } })
    fireEvent.click(screen.getByRole('button', { name: '采纳候选' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    expect(dispatchAction).toHaveBeenCalledWith(adopt, expect.objectContaining({ candidate_ref: 'candidate:two', candidate_version: '9', source_version: 'source:9' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    expect(dispatchAction).toHaveBeenLastCalledWith(adopt, expect.objectContaining({ candidate_ref: 'candidate:two', candidate_version: '9', source_version: 'source:9' }))
  })

  it('shows and dispatches an exact visual image region plus annotation', async () => {
    const artifact = { ...textArtifact('artifact:image', '3', 'Image'), kind: 'image', mediaType: 'image/png' } as const
    const crop = descriptor({ ref: 'action:eikona:crop', actionId: 'artifact.crop', label: 'Crop', targetRef: artifact.ref, targetVersion: artifact.version, fields: [{ key: 'range', label: 'Range', kind: 'text', required: true }, { key: 'note', label: 'Note', kind: 'text', required: true }] })
    const data = ownerWith([{ artifact, acceptedVersion: '3', media: { width: 1000, height: 500 }, candidates: [], actions: { createCandidate: { descriptorRef: crop.descriptorRef, rangeField: 'range', annotationField: 'note' } } }], [crop])
    const dispatchAction = vi.fn(async () => ({ status: 'unknown' as const, receiptRef: 'receipt:unknown', owner: 'eikona', actionId: 'artifact.crop', reconcileReason: 'unknown' }))
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(async () => 'https://media.example/image.png'), readArtifactContent: vi.fn(async () => undefined), dispatchAction }} />)
    await waitFor(() => expect(document.querySelector('[data-dsh-media-image-selection-stage]')).not.toBeNull())
    const stage = document.querySelector('[data-dsh-media-image-selection-stage]') as HTMLElement
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, toJSON: () => ({}) })
    fireEvent.pointerDown(stage, { isPrimary: true, clientX: 20, clientY: 20, pointerId: 1 })
    fireEvent.pointerUp(stage, { clientX: 120, clientY: 80, pointerId: 1 })
    const overlay = document.querySelector('[data-dsh-media-image-selection]') as HTMLElement
    expect(overlay.dataset.selectionX).toBe('0.1')
    expect(overlay.dataset.selectionWidth).toBe('0.5')
    expect(document.querySelector('[data-dsh-media-image-crop-preview]')).not.toBeNull()
    fireEvent.change(screen.getByPlaceholderText('说明要修改或保留的内容'), { target: { value: 'keep the face' } })
    fireEvent.click(screen.getByRole('button', { name: '创建候选' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    expect(dispatchAction).toHaveBeenCalledWith(crop, expect.objectContaining({ range: JSON.stringify({ kind: 'image', x: 0.1, y: 0.2, width: 0.5, height: 0.6 }), note: 'keep the face' }))
  })

  it.each([{ kind: 'audio', mediaType: 'audio/mpeg', element: 'audio' }, { kind: 'video', mediaType: 'video/mp4', element: 'video' }] as const)('updates the visual $kind timeline, plays the selected interval, and dispatches the same range', async ({ kind, mediaType, element }) => {
    const artifact = { ...textArtifact(`artifact:${kind}`, '4', kind), kind, mediaType } as const
    const crop = descriptor({ ref: `action:eikona:${kind}-crop`, actionId: `artifact.${kind}.crop`, label: `${kind} crop`, targetRef: artifact.ref, targetVersion: artifact.version, fields: [{ key: 'range', label: 'Range', kind: 'text', required: true }] })
    const data = ownerWith([{ artifact, acceptedVersion: '4', media: { durationMs: 20_000 }, candidates: [], actions: { createCandidate: { descriptorRef: crop.descriptorRef, rangeField: 'range' } } }], [crop])
    const dispatchAction = vi.fn(async () => ({ status: 'unknown' as const, receiptRef: 'receipt:unknown', owner: 'eikona', actionId: crop.actionId, reconcileReason: 'unknown' }))
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(async () => `https://media.example/${kind}`), readArtifactContent: vi.fn(async () => undefined), dispatchAction }} />)
    await screen.findByRole('button', { name: '播放所选时间段' })
    fireEvent.change(screen.getByLabelText('起点'), { target: { value: '2500' } })
    fireEvent.change(screen.getByLabelText('终点'), { target: { value: '9000' } })
    const visual = document.querySelector('[data-creator-artifact-range-preview]') as HTMLElement
    expect(visual.style.getPropertyValue('--range-start')).toBe('12.5%')
    expect(visual.style.getPropertyValue('--range-width')).toBe('32.5%')
    fireEvent.click(screen.getByRole('button', { name: '播放所选时间段' }))
    expect(play).toHaveBeenCalledTimes(1)
    expect((document.querySelector(element) as HTMLMediaElement).currentTime).toBe(2.5)
    fireEvent.click(screen.getByRole('button', { name: '创建候选' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    expect(dispatchAction).toHaveBeenCalledWith(crop, expect.objectContaining({ range: JSON.stringify({ kind: 'time', startMs: 2500, endMs: 9000 }) }))
  })

  it.each(['image', 'image-region'] as const)('uses %s proof without silently changing its range semantics', async kind => {
    const artifact = { ...textArtifact('artifact:referenced-image', '3', 'Image'), kind: 'image', mediaType: 'image/png' } as const
    const attach = descriptor({ ref: 'action:eikona:image-attach', actionId: 'context.attach', label: 'Authorize image', targetRef: artifact.ref, targetVersion: artifact.version, fields: [] })
    const proof = { id: 'reference:image', kind, intent: 'content' as const, scope: 'artifact/media', digest: 'digest:image', freshness: 'fresh' as const }
    const data = ownerWith([{ artifact, acceptedVersion: '3', media: { width: 1000, height: 500 }, referenceProof: proof, candidates: [], actions: { attachContext: { descriptorRef: attach.descriptorRef } } }], [attach])
    const target = { workspaceId: 'workspace:one', conversationId: 'conversation:one' }
    const insertReference = vi.fn(async (input: any) => ({ version: 1 as const, requestId: input.requestId, target, ok: true }))
    const dispatchAction = vi.fn(async () => ({ status: 'completed' as const, receiptRef: 'receipt:image', owner: 'eikona', actionId: 'context.attach' }))
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(async () => 'https://media.example/image.png'), readArtifactContent: vi.fn(async () => undefined), dispatchAction }} composerBridge={{ snapshot: () => ({ available: true, target }), insertReference }} />)
    await waitFor(() => expect(document.querySelector('[data-dsh-media-image-selection-stage]')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: '加入主对话' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    await waitFor(() => expect(insertReference).toHaveBeenCalledTimes(1))
    const reference = insertReference.mock.calls[0]![0].reference
    expect(reference.kind).toBe(kind)
    if (kind === 'image') expect(reference).not.toHaveProperty('region')
    else expect(reference.region).toEqual({ x: 0, y: 0, width: 1, height: 1 })
    expect(reference).not.toHaveProperty('bytes')
    expect(reference).not.toHaveProperty('url')
    const stage = document.querySelector('[data-dsh-media-image-selection-stage]') as HTMLElement
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, toJSON: () => ({}) })
    fireEvent.pointerDown(stage, { isPrimary: true, clientX: 20, clientY: 20, pointerId: 1 })
    fireEvent.pointerUp(stage, { clientX: 120, clientY: 80, pointerId: 1 })
    const add = screen.getByRole('button', { name: '加入主对话' }) as HTMLButtonElement
    await waitFor(() => expect(add.disabled).toBe(kind === 'image'))
    if (kind === 'image') expect(add.title).toContain('不支持当前框选范围')
  })

  it('does not invent a media time range when the owner omitted duration', async () => {
    const artifact = { ...textArtifact('artifact:unknown-duration', '1', 'Unknown duration'), kind: 'audio', mediaType: 'audio/mpeg' } as const
    const crop = descriptor({ ref: 'action:eikona:unknown-duration', actionId: 'artifact.audio.crop', label: 'Crop', targetRef: artifact.ref, targetVersion: artifact.version, fields: [{ key: 'range', label: 'Range', kind: 'text', required: true }] })
    const data = ownerWith([{ artifact, acceptedVersion: '1', candidates: [], actions: { createCandidate: { descriptorRef: crop.descriptorRef, rangeField: 'range' } } }], [crop])
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(async () => 'https://media.example/audio'), readArtifactContent: vi.fn(async () => undefined), dispatchAction: vi.fn() }} />)
    expect(screen.getByText('Owner 尚未提供可信时长，不能提交时间范围。')).toBeTruthy()
    expect((screen.getByRole('button', { name: '创建候选' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('waits for the private Host Composer receipt and sends only the selected candidate opaque proof', async () => {
    const artifact = textArtifact()
    const candidateArtifact = textArtifact('artifact:candidate-two', '9', 'Candidate Two')
    const attach = descriptor({ ref: 'action:eikona:attach', actionId: 'context.attach', label: 'Authorize', targetRef: artifact.ref, targetVersion: artifact.version, fields: [{ key: 'candidate_ref', label: 'Candidate', kind: 'text', required: true }, { key: 'candidate_version', label: 'Version', kind: 'text', required: true }, { key: 'body', label: 'Body', kind: 'textarea', required: true }, { key: 'content_revision', label: 'Content revision', kind: 'text', required: true }] })
    const proof = { id: 'reference:candidate-two', kind: 'file' as const, intent: 'content' as const, scope: 'artifact/body', digest: 'digest-candidate-two', freshness: 'fresh' as const }
    const data = ownerWith([{ artifact, acceptedVersion: '7', candidates: [
      { ref: 'candidate:one', version: '8', title: 'One', status: 'ready' as const },
      { ref: 'candidate:two', version: '9', title: 'Two', status: 'ready' as const, artifact: candidateArtifact, referenceProof: proof },
    ], actions: { attachContext: { descriptorRef: attach.descriptorRef, candidateRefField: 'candidate_ref', candidateVersionField: 'candidate_version', contentField: 'body', contentRevisionField: 'content_revision' } } }], [attach])
    const target = { workspaceId: 'workspace:one', conversationId: 'conversation:one', draftRevision: 3 }
    let detail: any
    const insertReference = vi.fn(async (input: any) => { detail = input; return { version: 1 as const, requestId: input.requestId, target, ok: true } })
    const dispatchAction = vi.fn(async () => ({ status: 'completed' as const, receiptRef: 'receipt:authorized', owner: 'eikona', actionId: 'context.attach' }))
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent: vi.fn(async item => ({ artifact: item, contentRevision: `content:${item.version}`, content: item.ref === candidateArtifact.ref ? 'candidate two full body' : 'base body' })), dispatchAction }} composerBridge={{ snapshot: () => ({ available: true, target, features: { editablePrompt: true } }), insertReference }} />)
    fireEvent.click(screen.getByRole('tab', { name: '比较' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'candidate:two' } })
    expect(detail).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: '加入主对话' }))
    await waitFor(() => expect((screen.getByRole('button', { name: '执行操作' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    await waitFor(() => expect(screen.getByText('Host Composer 已确认加入目标对话。')).toBeTruthy())
    expect(dispatchAction).toHaveBeenCalledWith(attach, expect.objectContaining({ candidate_ref: 'candidate:two', candidate_version: '9', body: 'candidate two full body', content_revision: 'content:9' }))
    expect(insertReference).toHaveBeenCalledTimes(1)
    expect(detail.reference).toMatchObject({ ref: 'artifact:candidate-two', version: '9', digest: 'digest-candidate-two' })
    expect(detail.reference).not.toHaveProperty('prompt')
  })

  it('blocks re-reference while the visible body has unsaved local edits', async () => {
    const artifact = textArtifact('artifact:unsaved', '1', 'Unsaved')
    const attach = descriptor({ ref: 'action:eikona:attach-unsaved', actionId: 'context.attach', label: 'Authorize', targetRef: artifact.ref, targetVersion: artifact.version, fields: [{ key: 'body', label: 'Body', kind: 'textarea', required: true }, { key: 'content_revision', label: 'Revision', kind: 'text', required: true }] })
    const proof = { id: 'reference:unsaved', kind: 'file' as const, intent: 'content' as const, scope: 'artifact/body', digest: 'digest:unsaved', freshness: 'fresh' as const }
    const data = ownerWith([{ artifact, acceptedVersion: '1', referenceProof: proof, candidates: [], actions: { attachContext: { descriptorRef: attach.descriptorRef, contentField: 'body', contentRevisionField: 'content_revision' } } }], [attach])
    const insertReference = vi.fn()
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent: vi.fn(async () => ({ artifact, contentRevision: 'revision:1', content: 'persisted' })), dispatchAction: vi.fn() }} composerBridge={{ snapshot: () => ({ available: true, target: { workspaceId: 'workspace:one', conversationId: 'conversation:one' }, features: { editablePrompt: true } }), insertReference }} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('persisted'))
    fireEvent.change(document.querySelector('[data-creator-artifact-editor] textarea')!, { target: { value: 'local edit' } })
    const add = screen.getByRole('button', { name: '加入主对话' }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
    expect(add.title).toBe('当前内容有未保存修改；请先保存或创建候选，再按已持久版本加入主对话。')
    fireEvent.click(add)
    expect(insertReference).not.toHaveBeenCalled()
  })

  it('turns a timed-out private insertion into an exact reconcile lock without resending', async () => {
    const artifact = textArtifact('artifact:timeout', '1', 'Timeout')
    const attach = descriptor({ ref: 'action:eikona:attach-timeout', actionId: 'context.attach', label: 'Authorize', targetRef: artifact.ref, targetVersion: artifact.version, fields: [{ key: 'body', label: 'Body', kind: 'textarea', required: true }, { key: 'content_revision', label: 'Revision', kind: 'text', required: true }] })
    const proof = { id: 'reference:timeout', kind: 'file' as const, intent: 'content' as const, scope: 'artifact/body', digest: 'digest:timeout', freshness: 'fresh' as const }
    const data = ownerWith([{ artifact, acceptedVersion: '1', referenceProof: proof, candidates: [], actions: { attachContext: { descriptorRef: attach.descriptorRef, contentField: 'body', contentRevisionField: 'content_revision' } } }], [attach])
    const target = { workspaceId: 'workspace:one', conversationId: 'conversation:one', draftRevision: 4 }
    const insertReference = vi.fn((_detail: any, _signal?: AbortSignal) => new Promise<never>(() => {}))
    let settlement: any = { status: 'unknown' }
    const referenceInsertion = vi.fn(() => settlement)
    const composerBridge = { snapshot: vi.fn(() => ({ available: true as const, target, features: { editablePrompt: true }, references: [{ id: proof.id, kind: proof.kind, intent: proof.intent, owner: artifact.owner, ref: artifact.ref, version: artifact.version, label: artifact.title, scope: proof.scope, digest: proof.digest, freshness: proof.freshness }] })), insertReference, referenceInsertion }
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent: vi.fn(async () => ({ artifact, contentRevision: 'revision:1', content: 'persisted' })), dispatchAction: vi.fn(async () => ({ status: 'completed' as const, receiptRef: 'receipt:authorized', owner: 'eikona', actionId: attach.actionId })) }} composerBridge={composerBridge} />)
    fireEvent.click(screen.getByRole('button', { name: '加入主对话' }))
    await waitFor(() => expect((screen.getByRole('button', { name: '执行操作' }) as HTMLButtonElement).disabled).toBe(false))
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
      await vi.advanceTimersByTimeAsync(0)
      expect(insertReference).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(CREATOR_COMPOSER_INSERT_TIMEOUT_MS)
      expect(screen.getByText('未收到 Host Composer 回执；插入结果未知，请勿重复提交。')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: '对账插入结果' }))
      expect(insertReference).toHaveBeenCalledTimes(1)
      const request = insertReference.mock.calls[0]![0]
      expect(referenceInsertion).toHaveBeenCalledWith({ requestId: request.requestId, target })
      expect((screen.getByRole('button', { name: '加入主对话' }) as HTMLButtonElement).disabled).toBe(true)
      settlement = { status: 'settled', receipt: { version: 1, requestId: request.requestId, target, ok: true, reference: { id: proof.id, occurrenceId: 2, kind: proof.kind } } }
      fireEvent.click(screen.getByRole('button', { name: '对账插入结果' }))
      expect(screen.getByText('Host Composer 已确认加入目标对话。')).toBeTruthy()
      expect(insertReference).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('routes the current Mermaid draft through the installed renderer graft and keeps HTML inert', async () => {
    const diagram = { ...textArtifact('artifact:diagram', '1', 'Diagram'), kind: 'diagram', mediaType: 'text/vnd.mermaid' } as const
    const data = ownerWith([{ artifact: diagram, acceptedVersion: '1', candidates: [] }], [])
    const runtime = { resolveArtifact: vi.fn(), readArtifactContent: vi.fn(async () => ({ artifact: diagram, contentRevision: '1', content: 'graph TD\nA-->B' })), dispatchAction: vi.fn() }
    const rendered = render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={runtime as never} />)
    await waitFor(() => expect(document.querySelector('[data-preview-kind="mermaid"] pre code')).not.toBeNull())
    const renderer = { render: vi.fn(async () => '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>'), setTheme: vi.fn(), dispose: vi.fn() }
    const graft = new MermaidGraftController({ labels: labelsFor('zh-CN'), renderer, stableMs: 0 })
    graft.start(document)
    await waitFor(() => expect(document.querySelector('[data-dsh-mermaid-figure]')).not.toBeNull())
    expect(renderer.render).toHaveBeenCalledWith('graph TD\nA-->B')
    graft.stop()

    const html = { ...diagram, ref: 'artifact:html', kind: 'code', mediaType: 'text/html', title: 'HTML' } as const
    const openEnvironment = descriptor({ ref: 'action:eikona:environment', actionId: 'environment.preview.open', label: 'Open preview', targetRef: html.ref, targetVersion: html.version, fields: [] })
    const dispatchAction = vi.fn(async () => ({ status: 'accepted' as const, receiptRef: 'receipt:environment', owner: 'eikona', actionId: openEnvironment.actionId }))
    rendered.rerender(<CreatorArtifactWorkspace owner={{ ...data.owner, actions: [openEnvironment], artifactWorkspace: { status: 'ready', safeMessage: 'Ready.', artifacts: [{ artifact: html, acceptedVersion: '1', candidates: [], actions: { openEnvironment: { descriptorRef: openEnvironment.descriptorRef } } }] } } as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ ...runtime, dispatchAction, readArtifactContent: vi.fn(async () => ({ artifact: html, contentRevision: '1', content: '<script>window.__creatorExecuted=true</script><h1>Safe</h1>' })) } as never} />)
    await screen.findByRole('heading', { name: 'Safe' })
    expect(document.querySelector('[data-preview-kind="static-html"] script')).toBeNull()
    expect(document.querySelector('[data-preview-kind="static-html"]')?.textContent).not.toContain('window.__creatorExecuted')
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toContain('<script>window.__creatorExecuted=true</script>'))
    fireEvent.change(document.querySelector('[data-creator-artifact-editor] textarea')!, { target: { value: '<h1>Edited HTML</h1><table><tr><td>Cell</td></tr></table>' } })
    fireEvent.click(screen.getByRole('tab', { name: '预览' }))
    await screen.findByRole('heading', { name: 'Edited HTML' })
    expect(document.querySelector('[data-static-html-content] td')?.textContent).toBe('Cell')
    expect((window as typeof window & { __creatorExecuted?: boolean }).__creatorExecuted).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: '打开开发预览' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    expect(dispatchAction).toHaveBeenCalledWith(openEnvironment, {})
  })

  it('pages candidate history in the compare workspace and keeps the loaded page after a failed next request', async () => {
    const artifact = { ...textArtifact('auctra:working-copy:note', '0:base', 'Working Copy'), owner: 'auctra' as const, capabilities: ['preview', 'candidate.history.read'] }
    const first = { ref: 'cand-hist001', version: '0:one', title: '1 edits, 12 bytes. Adoption updates Working Copy only.', status: 'ready' as const, sourceVersion: '0:base' }
    const second = { ref: 'cand-hist002', version: '0:two', title: '1 edits, 18 bytes. Adoption updates Working Copy only.', status: 'ready' as const, sourceVersion: '0:base' }
    const data = ownerWith([{ artifact, acceptedVersion: artifact.version, candidates: [first] }], [])
    const readCandidatePage = vi.fn()
      .mockResolvedValueOnce({ schemaVersion: 'creator.candidate-page.v1alpha1', status: 'ready', artifact, candidates: [first], nextCursor: 'page_two' })
      .mockResolvedValueOnce({ schemaVersion: 'creator.candidate-page.v1alpha1', status: 'invalid_input' })
      .mockResolvedValueOnce({ schemaVersion: 'creator.candidate-page.v1alpha1', status: 'ready', artifact, candidates: [second] })
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent: vi.fn(async () => undefined), dispatchAction: vi.fn(), readCandidatePage }} />)
    fireEvent.click(screen.getByRole('tab', { name: '比较' }))
    expect(readCandidatePage).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '加载历史' }))
    await waitFor(() => expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('cand-hist001'))
    expect(screen.getByRole('option', { name: /1 edits/ }).getAttribute('value')).toBe('cand-hist001')
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    await screen.findByText(/历史加载失败/)
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('cand-hist001')
    expect(screen.queryByRole('option', { name: /18 bytes/ })).toBeNull()
    expect(readCandidatePage.mock.calls[1]?.[0]).toMatchObject({ cursor: 'page_two', limit: 50, artifact: expect.objectContaining({ ref: artifact.ref, version: artifact.version }) })
    fireEvent.click(screen.getByRole('button', { name: '刷新首页' }))
    await waitFor(() => expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('cand-hist002'))
    expect(readCandidatePage.mock.calls[2]?.[0]).not.toHaveProperty('cursor')
    expect(readCandidatePage).toHaveBeenCalledTimes(3)
  })

  it('restores an Auctra draft after workspace remount in the same project and session', async () => {
    const artifact = { ...textArtifact('auctra:working-copy:note', '0:base', 'Working Copy'), owner: 'auctra' as const }
    const data = ownerWith([{ artifact, acceptedVersion: artifact.version, candidates: [] }], [])
    const runtime = { resolveArtifact: vi.fn(), readArtifactContent: vi.fn(async () => ({ artifact, contentRevision: artifact.version, content: 'owner body' })), dispatchAction: vi.fn() }
    const first = render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={runtime as never} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('owner body'))
    fireEvent.change(document.querySelector('[data-creator-artifact-editor] textarea')!, { target: { value: 'unsaved Auctra draft' } })
    first.unmount()
    const restored = render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={runtime as never} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('unsaved Auctra draft'))
    restored.unmount()
    const other = { ...data.snapshot, context: { ...data.snapshot.context!, sessionRef: 'session:two' } }
    const switched = render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={other} state={stateOf(other)} runtime={runtime as never} />)
    fireEvent.click(screen.getByRole('tab', { name: '源码' }))
    await waitFor(() => expect((document.querySelector('[data-creator-artifact-editor] textarea') as HTMLTextAreaElement).value).toBe('owner body'))
    switched.unmount()
  })

  it('renders zh, en, and pseudo copy from complete locale tables', async () => {
    expect(Object.keys(en)).toEqual(Object.keys(zh))
    expect(Object.keys(pseudoLong)).toEqual(Object.keys(zh))
    expect(Object.keys(pseudoRtl)).toEqual(Object.keys(zh))
    const artifact = textArtifact()
    const data = ownerWith([{ artifact, acceptedVersion: '7', candidates: [] }], [])
    const runtime = { resolveArtifact: vi.fn(), readArtifactContent: vi.fn(async () => ({ artifact, contentRevision: '7', content: '# Body' })), dispatchAction: vi.fn() }
    const rendered = render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={runtime as never} t={createCreatorStudioTranslator('en')} />)
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeTruthy()
    rendered.rerender(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={runtime as never} t={createCreatorStudioTranslator('pseudo-long')} />)
    expect(screen.getByRole('tab', { name: /Preeviieew/u })).toBeTruthy()
  })
})
