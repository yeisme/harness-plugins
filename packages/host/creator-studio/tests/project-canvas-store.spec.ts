import { describe, expect, it, vi } from 'vitest'
import { PROJECT_CANVAS_SCHEMA, type ProjectCanvasDocument } from '@yeisme/dsh-pane-protocol'
import { ProjectCanvasStore, type ProjectCanvasStorage, type ProjectCanvasTable } from '../src/project-canvas-store.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

function context(): CreatorStudioContextV1 {
  return { tenantRef: 'tenant:one', workspaceRef: 'workspace:one', projectRef: 'project:one', sessionRef: 'session:one',
    principalRef: 'principal:one', revision: '1', membershipRevision: '1', installationRef: 'install:one',
    pluginDigest: 'digest:one', policyRevision: '1', runtimeGeneration: 'runtime:one' }
}
function document(): ProjectCanvasDocument {
  return { schema: PROJECT_CANVAS_SCHEMA, id: 'main', scope: { workspaceRef: 'workspace:one', projectRef: 'project:one' },
    revision: 0, camera: { x: 0, y: 0, zoom: 1 }, nodes: [], edges: [] }
}
function harness() {
  let current: CreatorStudioContextV1 | undefined = context()
  const rows = new Map<string, unknown>()
  const table: ProjectCanvasTable = { get: key => rows.get(key), put: vi.fn(async (key, value) => { rows.set(key, structuredClone(value)) }) }
  const close = vi.fn(async () => {})
  const storage: ProjectCanvasStorage = { open: vi.fn(async () => ({ table: () => table, close })) }
  const store = new ProjectCanvasStore(storage, () => current)
  return { store, storage, rows, table, close, setContext: (value: CreatorStudioContextV1 | undefined) => { current = value } }
}
const read = { scope: document().scope, documentId: 'main' }

describe('Host project canvas persistence', () => {
  it('does not write when opening a missing document and confirms only after durable put', async () => {
    const h = harness()
    expect(await h.store.read(read)).toEqual({ status: 'missing' })
    expect(h.table.put).not.toHaveBeenCalled()
    expect(await h.store.save({ requestId: 'save-1', document: document() })).toEqual({ status: 'saved', requestId: 'save-1', revision: 1 })
    expect(await h.store.read(read)).toMatchObject({ status: 'ready', document: { revision: 1 } })
    await h.store.close()
    expect(h.close).toHaveBeenCalledOnce()
  })

  it('serializes simultaneous writers so one stale base conflicts', async () => {
    const h = harness()
    const results = await Promise.all(['one', 'two'].map(requestId => h.store.save({ requestId, document: document() })))
    expect(results).toEqual([{ status: 'saved', requestId: 'one', revision: 1 }, { status: 'conflict', revision: 1 }])
    expect(h.table.put).toHaveBeenCalledOnce()
  })

  it('replays the original receipt and rejects request id reuse with different content', async () => {
    const h = harness()
    const request = { requestId: 'save-1', document: document() }
    const original = await h.store.save(request)
    expect(await h.store.save(request)).toEqual(original)
    expect(await h.store.save({ ...request, document: { ...document(), camera: { x: 1, y: 0, zoom: 1 } } })).toEqual({ status: 'conflict', revision: 1 })
    expect(h.table.put).toHaveBeenCalledOnce()
  })

  it('returns unknown for a lost write response and reconciles without another put', async () => {
    const h = harness()
    vi.mocked(h.table.put).mockImplementationOnce(async (key, value) => { h.rows.set(key, value); throw new Error('private failure details') })
    expect(await h.store.save({ requestId: 'save-1', document: document() })).toEqual({ status: 'unknown' })
    expect(await h.store.reconcile({ ...read, requestId: 'save-1' })).toEqual({ status: 'saved', requestId: 'save-1', revision: 1 })
    expect(h.table.put).toHaveBeenCalledOnce()
  })

  it('does not invent failure or replay when a receipt is absent', async () => {
    const h = harness()
    expect(await h.store.reconcile({ ...read, requestId: 'not-confirmed' })).toEqual({ status: 'unknown' })
    expect(h.table.put).not.toHaveBeenCalled()
  })

  it('rejects cross-project and forged authority without opening storage', async () => {
    const h = harness()
    expect(await h.store.read({ ...read, scope: { ...read.scope, projectRef: 'project:other' } })).toEqual({ status: 'forbidden' })
    expect(await h.store.save({ requestId: 'save-1', principalRef: 'forged', document: document() })).toEqual({ status: 'invalid' })
    expect(h.storage.open).not.toHaveBeenCalled()
    h.setContext(undefined)
    expect(await h.store.save({ requestId: 'save-1', document: document() })).toEqual({ status: 'forbidden' })
  })

  it('shares project content across sessions but isolates tenants', async () => {
    const h = harness()
    await h.store.save({ requestId: 'save-1', document: document() })
    h.setContext({ ...context(), sessionRef: 'session:two' })
    expect(await h.store.read(read)).toMatchObject({ status: 'ready' })
    h.setContext({ ...context(), tenantRef: 'tenant:two' })
    expect(await h.store.read(read)).toEqual({ status: 'missing' })
  })

  it('rechecks context after async acquisition and preserves rejected drafts', async () => {
    const h = harness()
    let release!: () => void
    vi.mocked(h.storage.open).mockImplementationOnce(async () => { await new Promise<void>(resolve => { release = resolve }); return { table: () => h.table, close: h.close } })
    const saving = h.store.save({ requestId: 'save-1', document: document() })
    await Promise.resolve()
    h.setContext({ ...context(), membershipRevision: 'revoked' })
    release()
    expect(await saving).toEqual({ status: 'forbidden' })
    expect(h.table.put).not.toHaveBeenCalled()
  })

  it('reads confirmed rows after remount without sharing an in-memory document cache', async () => {
    const h = harness()
    await h.store.save({ requestId: 'save-1', document: document() })
    await h.store.close()
    const next = new ProjectCanvasStore(h.storage, context)
    expect(await next.read(read)).toMatchObject({ status: 'ready', document: { revision: 1 } })
    expect(await h.store.read(read)).toEqual({ status: 'forbidden' })
    await next.close()
  })
})
