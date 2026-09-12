// @vitest-environment jsdom
import { createCreatorStudioTranslator } from '../src/locales.ts'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuctraRecoveryLoader } from '../src/auctra-recovery-loader.tsx'
import { AuctraRecoveryDrafts } from '../src/auctra-recovery-drafts.tsx'

afterEach(cleanup)
const draft={ref:'auctra:editor-recovery:'+'a'.repeat(32)+':erd-'+'b'.repeat(32),unitRef:'text:note',baseVersion:'0:'+'c'.repeat(64),revision:1,contentDigest:'d'.repeat(64),byteLength:5,updatedAt:'2026-09-08T00:00:00Z'}
it('reads only after an explicit click and restores as unsubmitted input', async()=>{
 const onRead=vi.fn().mockResolvedValue({content:'draft',sourceChanged:true,currentSourceVersion:'1:'+'e'.repeat(64)})
 const onRestore=vi.fn()
 render(<AuctraRecoveryDrafts drafts={[draft]} onRead={onRead} onRestore={onRestore}/>)
 expect(screen.queryByText('draft')).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'读取草稿'}))
 await waitFor(()=>expect(screen.getByText('draft')).toBeTruthy())
 expect(screen.getByText(/来源已更新/)).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'恢复为未提交输入'}))
 expect(onRestore).toHaveBeenCalledWith(draft,'draft')
 expect(onRead).toHaveBeenCalledTimes(1)
})
it('does not read or restore when unavailable',()=>{
 const onRead=vi.fn();const onRestore=vi.fn()
 render(<AuctraRecoveryDrafts drafts={[]} onRead={onRead} onRestore={onRestore} />)
 expect(screen.getByText('暂无可恢复草稿')).toBeTruthy()
 expect(onRead).not.toHaveBeenCalled()
})

it('clears old previews and rejects late reads after a scope change', async () => {
 let resolve!: (value: { content: string; sourceChanged: boolean; currentSourceVersion: string }) => void
 const onRead = vi.fn(() => new Promise<{ content: string; sourceChanged: boolean; currentSourceVersion: string }>(done => { resolve = done }))
 const onRestore = vi.fn()
 const view = render(<AuctraRecoveryDrafts scopeKey="project:one" drafts={[draft]} onRead={onRead} onRestore={onRestore} />)
 fireEvent.click(screen.getByRole('button', { name: '读取草稿' }))
 view.rerender(<AuctraRecoveryDrafts scopeKey="project:two" drafts={[draft]} onRead={onRead} onRestore={onRestore} />)
 await act(async () => resolve({ content: 'OLD_PRIVATE_BODY', sourceChanged: false, currentSourceVersion: draft.baseVersion }))
 expect(screen.queryByText('OLD_PRIVATE_BODY')).toBeNull()
 expect(screen.queryByRole('button', { name: '恢复为未提交输入' })).toBeNull()
 expect(onRestore).not.toHaveBeenCalled()
})
it('removes a previously read preview when its draft revision changes', async () => {
 const onRead = vi.fn().mockResolvedValue({ content: 'old draft', sourceChanged: false, currentSourceVersion: draft.baseVersion })
 const onRestore = vi.fn()
 const view = render(<AuctraRecoveryDrafts drafts={[draft]} onRead={onRead} onRestore={onRestore} />)
 fireEvent.click(screen.getByRole('button', { name: '读取草稿' }))
 await screen.findByText('old draft')
 view.rerender(<AuctraRecoveryDrafts drafts={[{ ...draft, revision: 2 }]} onRead={onRead} onRestore={onRestore} />)
 expect(screen.queryByText('old draft')).toBeNull()
 expect(screen.queryByRole('button', { name: '恢复为未提交输入' })).toBeNull()
})

it('uses English for read, source warning and restore actions', async () => {
 const onRead = vi.fn().mockResolvedValue({ content: 'English draft', sourceChanged: true, currentSourceVersion: draft.baseVersion })
 render(<AuctraRecoveryDrafts drafts={[draft]} onRead={onRead} onRestore={vi.fn()} t={createCreatorStudioTranslator('en')} />)
 fireEvent.click(screen.getByRole('button', { name: 'Read draft' }))
 await screen.findByText('English draft')
 expect(screen.getByText(/source updated/)).toBeTruthy()
 expect(screen.getByRole('button', { name: 'Restore as unsubmitted input' })).toBeTruthy()
 expect(screen.queryByText(/来源/)).toBeNull()
})

it('saves a recovery copy without submission and pauses after an unknown response', async () => {
 const artifact = { schema: 'pane.artifact.v1alpha1' as const, owner: 'auctra', kind: 'text', ref: 'auctra:working-copy:note', version: draft.baseVersion, mediaType: 'text/plain', title: 'Note', evidenceRefs: [], capabilities: [] }
 const save = vi.fn().mockResolvedValueOnce({ status: 'ready', value: { draft, currentSourceVersion: draft.baseVersion, sourceChanged: false } }).mockResolvedValueOnce({ status: 'unconfirmed' })
 const runtime = { saveAuctraRecoveryDraft: save, listAuctraRecoveryDrafts: vi.fn().mockResolvedValue({ status: 'ready', value: { drafts: [draft] } }), readAuctraRecoveryDraft: vi.fn() }
 const base = { artifact, contentRevision: artifact.version, content: 'original' }
 render(<AuctraRecoveryLoader artifact={artifact} base={base} content="unsubmitted" canSave blocked={false} runtime={runtime} onRestore={vi.fn()} />)
 fireEvent.click(screen.getByRole('button', { name: '保存恢复副本' }))
 await screen.findByText('恢复副本已保存，正文尚未提交。')
 expect(save).toHaveBeenNthCalledWith(1, { base, content: 'unsubmitted' })
 fireEvent.click(screen.getByRole('button', { name: '保存恢复副本' }))
 await screen.findByText('恢复副本保存未确认，请先查询并读取已有草稿。')
 expect(save).toHaveBeenNthCalledWith(2, { base, content: 'unsubmitted', previous: draft })
 expect((screen.getByRole('button', { name: '保存恢复副本' }) as HTMLButtonElement).disabled).toBe(true)
 expect(save).toHaveBeenCalledTimes(2)
})

it('retains the current page after transient next-page failure and clears it on lost access', async () => {
 const artifact = { schema: 'pane.artifact.v1alpha1' as const, owner: 'auctra', kind: 'text', ref: 'auctra:working-copy:note', version: draft.baseVersion, mediaType: 'text/plain', title: 'Note', evidenceRefs: [], capabilities: [] }
 const list = vi.fn().mockResolvedValueOnce({ status: 'ready', value: { drafts: [draft], nextCursor: 'page-two' } })
  .mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ status: 'permission_denied' })
 render(<AuctraRecoveryLoader artifact={artifact} blocked={false} runtime={{ listAuctraRecoveryDrafts: list, readAuctraRecoveryDraft: vi.fn() }} onRestore={vi.fn()} />)
 fireEvent.click(screen.getByRole('button', { name: '查找恢复草稿' }))
 await screen.findByRole('button', { name: '下一页恢复草稿' })
 fireEvent.click(screen.getByRole('button', { name: '下一页恢复草稿' }))
 await screen.findByText('恢复草稿读取失败')
 expect(screen.getByText(draft.unitRef)).toBeTruthy()
 fireEvent.click(screen.getByRole('button', { name: '下一页恢复草稿' }))
 await screen.findByText('恢复草稿暂不可用')
 expect(screen.queryByText(draft.unitRef)).toBeNull()
 expect(list.mock.calls[1]?.[0].cursor).toBe('page-two')
 expect(list.mock.calls[2]?.[0].cursor).toBe('page-two')
})
