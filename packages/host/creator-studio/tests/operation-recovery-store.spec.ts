import { expect, it, vi } from 'vitest'
import { OperationRecoveryStore, type OperationRecoveryStorage, type OperationRecoveryTable } from '../src/operation-recovery-store.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const scope: CreatorStudioContextV1 = { tenantRef: 'tenant:one', workspaceRef: 'workspace:one', projectRef: 'project:one', sessionRef: 'session:one',
  principalRef: 'principal:one', revision: '1', membershipRevision: '1', installationRef: 'install:one', pluginDigest: 'digest:one', policyRevision: '1', runtimeGeneration: 'runtime:one' }
const request = { schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: 'working-copy.save', descriptorRef: 'descriptor:one', expectedTargetRef: 'artifact:one',
  expectedTargetVersion: '1:one', context: scope, idempotencyKey: 'original-key', values: { body: 'PRIVATE_EDITOR_BODY' } }
function fixture() {
  let context: CreatorStudioContextV1 = { ...scope }
  const rows = new Map<string, unknown>()
  const table: OperationRecoveryTable = { get: key => rows.get(key), entries: () => rows.entries(), put: vi.fn(async (key, value) => { rows.set(key, structuredClone(value)) }), delete: vi.fn(async key => rows.delete(key)) }
  const storage: OperationRecoveryStorage = { open: async () => ({ table: () => table, close: async () => {} }) }
  return { rows, table, storage, mount: () => new OperationRecoveryStore(storage, () => context), change: (next: CreatorStudioContextV1) => { context = next } }
}
it('persists only lookup identity and restores it across sessions without overwriting the original key', async () => {
  const h = fixture(), first = h.mount()
  expect((await first.reserve(request)).status).toBe('saved')
  expect(JSON.stringify([...h.rows.values()])).not.toMatch(/PRIVATE_EDITOR_BODY|"values"|"receipt"/)
  await first.close()
  h.change({ ...scope, sessionRef: 'session:two', runtimeGeneration: 'runtime:two' })
  const restored = h.mount()
  expect(await restored.list()).toMatchObject({ status: 'ready', rows: [{ request: { idempotencyKey: 'original-key' } }] })
  expect(await restored.reserve({ ...request, context: { ...scope, sessionRef: 'session:two', runtimeGeneration: 'runtime:two' }, idempotencyKey: 'replacement-key' }))
    .toMatchObject({ status: 'existing', row: { request: { idempotencyKey: 'original-key' } } })
  h.change({ ...scope, principalRef: 'principal:other' })
  expect(await restored.list()).toEqual({ status: 'ready', rows: [] })
  await restored.close()
})
it('serializes duplicate reservations and removes only an exact acknowledged record', async () => {
  const h = fixture(), store = h.mount()
  const [first, second] = await Promise.all([store.reserve(request), store.reserve({ ...request, idempotencyKey: 'second-key' })])
  expect([first.status, second.status]).toEqual(['saved', 'existing'])
  if (first.status !== 'saved') throw Error('expected saved')
  expect(await store.forget({ ...first.row, targetVersion: 'wrong' })).toBe(false)
  expect(await store.forget(first.row)).toBe(true)
  expect(await store.list()).toEqual({ status: 'ready', rows: [] })
  await store.close()
})
it('keeps a possibly durable reservation after a failed acknowledgment', async () => {
  const h = fixture(), store = h.mount()
  vi.mocked(h.table.put).mockImplementationOnce(async (key, value) => { h.rows.set(key, structuredClone(value)); throw Error('lost durable acknowledgment') })
  expect(await store.reserve(request)).toEqual({ status: 'unavailable' })
  await store.close()
  const restored = h.mount()
  expect((await restored.reserve(request)).status).toBe('existing')
  await restored.close()
})
it('retains a saved identity but does not authorize dispatch after context changes during persistence', async () => {
  const h = fixture(), store = h.mount()
  vi.mocked(h.table.put).mockImplementationOnce(async (key, value) => { h.rows.set(key, structuredClone(value)); h.change({ ...scope, principalRef: 'principal:other' }) })
  expect(await store.reserve(request)).toEqual({ status: 'unavailable' })
  expect(await store.list()).toEqual({ status: 'ready', rows: [] })
  h.change(scope)
  expect(await store.list()).toMatchObject({ status: 'ready', rows: [{ request: { idempotencyKey: 'original-key' } }] })
  await store.close()
})
it('does not evict unresolved requests when capacity is exhausted', async () => {
  const h = fixture(), store = h.mount()
  for (let index = 0; index < 128; index++) expect((await store.reserve({ ...request, expectedTargetRef: `artifact:${index}` })).status).toBe('saved')
  expect(await store.reserve({ ...request, expectedTargetRef: 'artifact:overflow' })).toEqual({ status: 'full' })
  expect(h.rows.size).toBe(128)
  await store.close()
})
