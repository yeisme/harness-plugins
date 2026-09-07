// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CREATOR_COMPOSER_INSERT_TIMEOUT_MS, CreatorArtifactWorkspace } from '../src/artifact-workspace.tsx'
import { createCreatorStudioTranslator, en, pseudoLong, pseudoRtl, zh } from '../src/locales.ts'
import { creatorSnapshot } from './fixtures.ts'
import { MermaidGraftController } from '../../ui-mermaid-render/src/client/observer.ts'
import { labelsFor } from '../../ui-mermaid-render/src/client/locales.ts'

const textArtifact = (ref = 'artifact:script', version = '7', title = 'Script') => ({ schema: 'pane.artifact.v1alpha1', owner: 'eikona', kind: 'text', ref, version, mediaType: 'text/markdown', title, evidenceRefs: [], capabilities: ['preview'] } as const)
const stateOf = (snapshot: ReturnType<typeof creatorSnapshot>) => ({ phase: 'ready' as const, snapshot, errorCode: null, pendingDescriptorRef: null, pendingApprovalRef: null, lastReceipt: null, assetPhase: 'cold' as const, assetQuery: { scope: 'current_project' as const }, assetItems: [], assetNextCursor: null, assetStatus: null, assetMessage: null, assetUnavailableOwners: [], assetErrorCode: null })
const descriptor = (input: { ref: string; actionId: string; label: string; targetRef: string; targetVersion: string; fields: readonly unknown[] }) => ({ schema: 'pane.action-descriptor.v1alpha1', descriptorRef: input.ref, owner: 'eikona', actionId: input.actionId, label: input.label, targetRef: input.targetRef, targetVersion: input.targetVersion, context: creatorSnapshot().context!, risk: 'low', confirmation: 'none', expiresAt: '2999-01-01T00:00:00Z', preview: { summary: input.label }, fields: input.fields } as const)
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }

afterEach(() => { cleanup(); vi.restoreAllMocks() })

function ownerWith(artifacts: readonly unknown[], actions: readonly unknown[]) {
  const snapshot = creatorSnapshot()
  return { snapshot, owner: { ...snapshot.owners.find(item => item.owner === 'eikona')!, actions, artifactWorkspace: { status: 'ready' as const, safeMessage: 'Ready.', artifacts } } }
}

describe('CreatorArtifactWorkspace', () => {
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

  it('retains the global lifecycle lock after an unknown receipt even when another artifact is selected', async () => {
    const first = textArtifact('artifact:unknown-one', '1', 'Unknown one')
    const second = textArtifact('artifact:unknown-two', '1', 'Unknown two')
    const firstSave = descriptor({ ref: 'action:eikona:unknown-one', actionId: 'artifact.save.one', label: 'Save one', targetRef: first.ref, targetVersion: first.version, fields: [{ key: 'body', label: 'Body', kind: 'textarea', required: true, maxLength: 16_384 }, { key: 'content_revision', label: 'Revision', kind: 'text', required: true, maxLength: 160 }] })
    const secondSave = descriptor({ ref: 'action:eikona:unknown-two', actionId: 'artifact.save.two', label: 'Save two', targetRef: second.ref, targetVersion: second.version, fields: [{ key: 'body', label: 'Body', kind: 'textarea', required: true, maxLength: 16_384 }, { key: 'content_revision', label: 'Revision', kind: 'text', required: true, maxLength: 160 }] })
    const data = ownerWith([
      { artifact: first, acceptedVersion: '1', candidates: [], actions: { saveDraft: { descriptorRef: firstSave.descriptorRef, contentField: 'body', contentRevisionField: 'content_revision' } } },
      { artifact: second, acceptedVersion: '1', candidates: [], actions: { saveDraft: { descriptorRef: secondSave.descriptorRef, contentField: 'body', contentRevisionField: 'content_revision' } } },
    ], [firstSave, secondSave])
    const dispatchAction = vi.fn(async () => ({ status: 'unknown' as const, receiptRef: 'receipt:unknown-lock', owner: 'eikona', actionId: firstSave.actionId, reconcileReason: 'settlement_unknown' }))
    render(<CreatorArtifactWorkspace owner={data.owner as never} snapshot={data.snapshot} state={stateOf(data.snapshot)} runtime={{ resolveArtifact: vi.fn(), readArtifactContent: vi.fn(async artifact => ({ artifact, contentRevision: 'revision:1', content: 'body' })), dispatchAction }} />)
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
    fireEvent.pointerDown(stage, { clientX: 20, clientY: 20, pointerId: 1 })
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
    await waitFor(() => expect(document.querySelector('[data-preview-kind="safe-html-source"]')).not.toBeNull())
    expect(document.querySelector('[data-preview-kind="safe-html-source"]')?.textContent).toContain('window.__creatorExecuted')
    expect((window as typeof window & { __creatorExecuted?: boolean }).__creatorExecuted).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: '打开开发预览' }))
    fireEvent.click(screen.getByRole('button', { name: '执行操作' }))
    expect(dispatchAction).toHaveBeenCalledWith(openEnvironment, {})
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
