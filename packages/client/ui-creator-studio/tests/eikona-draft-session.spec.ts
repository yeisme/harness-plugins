import { expect, it, vi } from 'vitest'
import { EikonaDraftSession, type EikonaDraftRuntime } from '../src/eikona-draft-session.ts'
import type { EikonaDraft } from '@yeisme/dsh-creator-studio-host/contracts'

const initial: EikonaDraft = { schemaVersion: 'eikona.studio_draft.v1', scope: { tenantRef: 'tenant', workspaceRef: 'workspace', projectRef: 'project' }, id: 'primary', revision: 0, fields: { prompt: '', version: '1', size: '', seed: '', variables: [] }, checkpoint: { status: 'editing' } }
function runtime(): EikonaDraftRuntime {
  return { readEikonaDraft: async () => ({ status: 'missing' }), saveEikonaDraft: vi.fn(async input => ({ status: 'saved', requestId: input.requestId, revision: input.draft.revision + 1 })), reconcileEikonaDraft: vi.fn(async () => ({ status: 'unknown' })) }
}
it('does not allow empty UI edits before loading or write during restore', async () => {
  const api = runtime()
  const saved = { ...initial, revision: 5, fields: { ...initial.fields, seed: '-' }, checkpoint: { status: 'preparation_unconfirmed' as const } }
  api.readEikonaDraft = async () => ({ status: 'ready', draft: saved })
  const session = new EikonaDraftSession(api, initial, () => 'one')
  expect(session.edit(initial.fields)).toBe(false)
  await session.load()
  expect(session.snapshot()).toEqual({ phase: 'ready', draft: saved, dirty: false })
  expect(api.saveEikonaDraft).not.toHaveBeenCalled()
})
it('retains original uncertain save and only reconciles after lost acknowledgement', async () => {
  const api = runtime()
  api.saveEikonaDraft = vi.fn(async () => { throw new Error('lost') })
  api.reconcileEikonaDraft = vi.fn(async () => ({ status: 'saved', requestId: 'one', revision: 1 }))
  const session = new EikonaDraftSession(api, initial, () => 'one')
  await session.load()
  session.edit({ ...initial.fields, seed: '-' })
  await session.save()
  expect(session.snapshot()).toMatchObject({ phase: 'unknown', dirty: true, draft: { fields: { seed: '-' } } })
  expect(session.edit(initial.fields)).toBe(false)
  await session.save()
  expect(api.saveEikonaDraft).toHaveBeenCalledOnce()
  await session.reconcile()
  expect(session.snapshot()).toMatchObject({ phase: 'ready', dirty: false, draft: { revision: 1, fields: { seed: '-' } } })
})
it('preserves local content on conflict and ignores late load after disposal', async () => {
  const api = runtime()
  api.saveEikonaDraft = vi.fn(async () => ({ status: 'conflict' }))
  const session = new EikonaDraftSession(api, initial, () => 'one')
  await session.load()
  session.edit({ ...initial.fields, prompt: 'local' })
  await session.save()
  await session.load()
  expect(session.snapshot()).toMatchObject({ phase: 'conflict', dirty: true, draft: { fields: { prompt: 'local' } } })
  const another = new EikonaDraftSession(api, initial, () => 'two')
  const loading = another.load()
  another.dispose()
  await loading
  expect(another.snapshot().draft).toBeUndefined()
})
