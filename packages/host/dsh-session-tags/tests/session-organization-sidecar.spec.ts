import { describe, expect, it } from 'vitest'
import {
  SessionOrganizationSidecar,
  createSessionTagsSidecar,
  type OrganizationTablePort,
  type SessionOrganizationStorePort,
  type SessionTagsTablePort,
} from '../src/index.ts'
import type {
  BatchReceiptV1,
  FunctionTypeV1,
  OrganizationRuleV1,
  SessionOrganizationAssignmentV1,
  SessionTagRowV1,
  TagCatalogEntryV1,
} from '../src/index.ts'

class MemoryTable<T> implements OrganizationTablePort<T> {
  readonly rows = new Map<string, T>()
  get(key: string) { return this.rows.get(key) }
  entries() { return this.rows.entries() }
  async put(key: string, value: T) { this.rows.set(key, value) }
  async delete(key: string) { return this.rows.delete(key) }
}

class MemoryTagsTable implements SessionTagsTablePort {
  readonly rows = new Map<string, SessionTagRowV1>()
  get(key: string) { return this.rows.get(key) }
  entries() { return this.rows.entries() }
  async put(key: string, value: SessionTagRowV1) { this.rows.set(key, value) }
  async delete(key: string) { return this.rows.delete(key) }
}

function harness(options: {
  classify?: boolean
  lifecycle?: (sessionId: string, action: 'archive' | 'restore' | 'purge') => 'ok' | 'rejected' | 'not_available'
} = {}) {
  const functionTypes = new MemoryTable<FunctionTypeV1>()
  const assignments = new MemoryTable<SessionOrganizationAssignmentV1>()
  const tagCatalog = new MemoryTable<TagCatalogEntryV1>()
  const rules = new MemoryTable<OrganizationRuleV1>()
  const batchRuns = new MemoryTable<BatchReceiptV1>()
  const store: SessionOrganizationStorePort = { functionTypes, assignments, tagCatalog, rules, batchRuns }
  const tagTable = new MemoryTagsTable()
  const sessions = new Set(['s1', 's2'])
  let sequence = 0
  const next = () => `id-${++sequence}`
  let now = 100
  const tags = createSessionTagsSidecar({
    table: tagTable,
    identity: {
      async inspectIdentity(sessionId) {
        return sessions.has(sessionId) ? { createdAt: `created:${sessionId}` } : undefined
      },
    },
    newVersion: next,
  })
  const sidecar = new SessionOrganizationSidecar({
    store,
    tags,
    now: () => now,
    newId: next,
    ...(options.classify === true ? {
      classifier: {
        async classify() {
          return { functionTypeId: 'research', tags: ['history', 'CJK'], confidence: 0.9, modelRef: 'configured/default' }
        },
      },
    } : {}),
    ...(options.lifecycle === undefined ? {} : {
      lifecycle: {
        async mutate(input: { sessionId: string; action: 'archive' | 'restore' | 'purge' }) {
          return { status: options.lifecycle?.(input.sessionId, input.action) ?? 'not_available' }
        },
      },
    }),
  })
  return { sidecar, store, tags, tagTable, setNow: (value: number) => { now = value } }
}

describe('SessionOrganizationSidecar', () => {
  it('returns built-ins and applies assignment CAS', async () => {
    const { sidecar } = harness()
    expect((await sidecar.snapshot()).functionTypes).toHaveLength(8)
    const first = await sidecar.setAssignment({
      sessionId: 's1', workspaceRef: 'w1', functionTypeId: 'planning',
      functionLocked: true, tagsLocked: false, ifVersion: null,
    })
    expect(first).toMatchObject({ ok: true, assignment: { functionTypeId: 'planning', functionLocked: true } })
    const conflict = await sidecar.setAssignment({
      sessionId: 's1', workspaceRef: 'w1', functionTypeId: 'research',
      functionLocked: true, tagsLocked: false, ifVersion: null,
    })
    expect(conflict).toMatchObject({ ok: false, code: 'version-conflict' })
  })

  it('classifies once, writes tags, and creates workspace catalog metadata', async () => {
    const { sidecar, tagTable } = harness({ classify: true })
    const result = await sidecar.classify({
      sessionId: 's1', workspaceRef: 'w1', title: 'Research CJK search', userMessages: ['compare tokenizers'],
    })
    expect(result).toMatchObject({ ok: true, assignment: { functionTypeId: 'research', confidence: 0.9 }, tags: ['history', 'CJK'] })
    expect(tagTable.rows.get('s1')?.tags).toEqual(['history', 'CJK'])
    const snapshot = await sidecar.snapshot()
    expect(snapshot.tagCatalog.map(item => item.name)).toEqual(['history', 'CJK'])
    const second = await sidecar.classify({
      sessionId: 's1', workspaceRef: 'w1', title: 'ignored', userMessages: [],
    })
    expect(second).toMatchObject({ ok: true, assignment: { version: result.ok ? result.assignment.version : '' } })
  })

  it('executes and undoes an assignment batch with decisionRef', async () => {
    const { sidecar } = harness()
    const planned = await sidecar.planBatch({
      targets: [{ sessionId: 's1', workspaceRef: 'w1' }, { sessionId: 's2', workspaceRef: 'w1' }],
      action: { type: 'set-function', functionTypeId: 'implementation' },
    })
    expect(planned.ok).toBe(true)
    if (!planned.ok) return
    const executed = await sidecar.executeBatch({ planId: planned.plan.id, decisionRef: planned.plan.decisionRef })
    expect(executed).toMatchObject({ ok: true, receipt: { status: 'ok' } })
    if (!executed.ok) return
    const undone = await sidecar.undoBatch({ receiptId: executed.receipt.id })
    expect(undone).toMatchObject({ ok: true, receipt: { status: 'ok' } })
    expect((await sidecar.snapshot()).assignments).toEqual([])
  })

  it('rejects stale batch targets without overwriting', async () => {
    const { sidecar } = harness()
    const planned = await sidecar.planBatch({
      targets: [{ sessionId: 's1', workspaceRef: 'w1' }],
      action: { type: 'set-function', functionTypeId: 'planning' },
    })
    if (!planned.ok) return
    await sidecar.setAssignment({
      sessionId: 's1', workspaceRef: 'w1', functionTypeId: 'research',
      functionLocked: true, tagsLocked: false, ifVersion: null,
    })
    const executed = await sidecar.executeBatch({ planId: planned.plan.id, decisionRef: planned.plan.decisionRef })
    expect(executed).toMatchObject({ ok: true, receipt: { status: 'rejected', items: [{ status: 'stale' }] } })
  })

  it('requires temporary admin and exact count phrase for purge', async () => {
    const { sidecar } = harness({ lifecycle: () => 'ok' })
    const planned = await sidecar.planBatch({
      targets: [{ sessionId: 's1', workspaceRef: 'w1' }],
      action: { type: 'purge' },
    })
    if (!planned.ok) return
    expect(await sidecar.executeBatch({ planId: planned.plan.id, decisionRef: planned.plan.decisionRef, confirmationText: 'DELETE 1' }))
      .toMatchObject({ ok: false, code: 'admin-required' })
    const grant = sidecar.unlockAdmin()
    expect(await sidecar.executeBatch({
      planId: planned.plan.id,
      decisionRef: planned.plan.decisionRef,
      confirmationText: 'wrong',
      adminToken: grant.token,
    })).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(await sidecar.executeBatch({
      planId: planned.plan.id,
      decisionRef: planned.plan.decisionRef,
      confirmationText: 'DELETE 1',
      adminToken: grant.token,
    })).toMatchObject({ ok: true, receipt: { status: 'ok', undoExpiresAt: null } })
  })
})
