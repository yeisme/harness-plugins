import { expect, it } from 'vitest'
import { EikonaDraftStore, type EikonaDraftStorage } from '../src/eikona-draft-store.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = { tenantRef: 'tenant', workspaceRef: 'workspace', projectRef: 'project', sessionRef: 'session', principalRef: 'principal', revision: '1', membershipRevision: '1', installationRef: 'installation', pluginDigest: 'digest', policyRevision: '1', runtimeGeneration: '1' }
const scope = { tenantRef: 'tenant', workspaceRef: 'workspace', projectRef: 'project' }
const draft = () => ({ schemaVersion: 'eikona.studio_draft.v1', scope, id: 'primary', revision: 0, fields: { prompt: '', version: '1', size: '', seed: '-', variables: [] }, checkpoint: { status: 'preparation_unconfirmed' } })
const query = { scope, id: 'primary' }
function harness() {
  const rows = new Map<string, unknown>()
  let current = context, throwAfterWrite = false, writes = 0
  const storage: EikonaDraftStorage = { open: async () => ({ table: () => ({ get: key => rows.get(key), put: async (key, value) => { rows.set(key, structuredClone(value)); writes++; if (throwAfterWrite) throw new Error('lost acknowledgement') } }), close: async () => {} }) }
  return { open: () => new EikonaDraftStore(storage, () => current), writes: () => writes, change: (value: CreatorStudioContextV1) => { current = value }, loseAck: () => { throwAfterWrite = true } }
}

it('restores unresolved draft across store close/reopen and another session without writing on read', async () => {
  const h = harness(), first = h.open()
  expect(await first.read(query)).toEqual({ status: 'missing' })
  expect(h.writes()).toBe(0)
  expect(await first.save({ requestId: 'one', draft: draft() })).toEqual({ status: 'saved', requestId: 'one', revision: 1 })
  await first.close()
  h.change({ ...context, sessionRef: 'another-session' })
  const second = h.open()
  expect(await second.read(query)).toMatchObject({ status: 'ready', draft: { revision: 1, fields: { seed: '-' }, checkpoint: { status: 'preparation_unconfirmed' } } })
  expect(h.writes()).toBe(1)
  await second.close()
})

it('serializes competing base revisions and rejects reused request identity with different contents', async () => {
  const h = harness(), store = h.open()
  const results = await Promise.all([store.save({ requestId: 'one', draft: draft() }), store.save({ requestId: 'two', draft: draft() })])
  expect(results.map(item => item.status)).toEqual(['saved', 'conflict'])
  expect(await store.save({ requestId: 'one', draft: draft() })).toMatchObject({ status: 'saved', revision: 1 })
  expect(await store.save({ requestId: 'one', draft: { ...draft(), fields: { ...draft().fields, seed: '12' } } })).toEqual({ status: 'conflict' })
  expect(h.writes()).toBe(1)
  await store.close()
})

it('reconciles a committed write with lost acknowledgement without another write', async () => {
  const h = harness(), store = h.open()
  h.loseAck()
  expect(await store.save({ requestId: 'one', draft: draft() })).toEqual({ status: 'unknown' })
  expect(await store.reconcile({ ...query, requestId: 'one' })).toEqual({ status: 'saved', requestId: 'one', revision: 1 })
  expect(await store.reconcile({ ...query, requestId: 'missing' })).toEqual({ status: 'unknown' })
  expect(h.writes()).toBe(1)
  await store.close()
})

it('rejects old-project requests and closed stores', async () => {
  const h = harness(), store = h.open()
  h.change({ ...context, projectRef: 'other' })
  expect(await store.save({ requestId: 'one', draft: draft() })).toEqual({ status: 'forbidden' })
  expect(await store.read(query)).toEqual({ status: 'forbidden' })
  expect(h.writes()).toBe(0)
  await store.close()
  h.change(context)
  expect(await store.read(query)).toEqual({ status: 'forbidden' })
})
