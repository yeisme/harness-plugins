import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { expect, it } from 'vitest'
import { PROJECT_CANVAS_SCHEMA, type ProjectCanvasDocument } from '@yeisme/dsh-pane-protocol'
import { ProjectCanvasStore, type ProjectCanvasStorage } from '../src/project-canvas-store.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

// Same real storage modules as the DSH preview; this is not a domain-owner acceptance test.
it('recovers a journaled save that never committed after disposing and remounting real JSON storage', async () => {
  const staging = resolve(import.meta.dirname, '../../../../temp/dsh-unified-host-source')
  const load = (path: string) => import(pathToFileURL(join(staging, path)).href)
  const storage = await load('packages/storage/storage/lib/index.js')
  const json = await load('packages/storage/storage-json/lib/index.js')
  const domain = await load('packages/storage/storage-domain/lib/index.js')
  const directory = await mkdtemp(join(tmpdir(), 'canvas-storage-'))
  const context: CreatorStudioContextV1 = {
    tenantRef: 'tenant:fixture', workspaceRef: 'workspace:fixture', projectRef: 'project:fixture', sessionRef: 'session:one',
    principalRef: 'principal:fixture', revision: '1', membershipRevision: '1', installationRef: 'install:fixture',
    pluginDigest: 'digest:fixture', policyRevision: '1', runtimeGeneration: 'runtime:fixture',
  }
  const document: ProjectCanvasDocument = { schema: PROJECT_CANVAS_SCHEMA, id: 'main', revision: 0,
    scope: { workspaceRef: context.workspaceRef, projectRef: context.projectRef }, camera: { x: 0, y: 0, zoom: 1 },
    nodes: [{ id: 'draft:journaled', kind: 'draft', title: 'Journaled draft', text: 'Unsettled canvas content', position: { x: 0, y: 0 }, size: { width: 200, height: 160 } }], edges: [] }
  const read = { scope: document.scope, documentId: document.id }
  let root: Context | undefined
  let store: ProjectCanvasStore | undefined
  // Fail only the commit write for this request: the write-ahead journal put carries inflight and must land.
  const commitRequestId = 'save:journaled'
  async function mount() {
    root = new Context()
    await root.plugin(storage.default)
    await root.plugin({ name: 'canvas-journal-json', inject: ['storage'], apply: (ctx: Context) => json.apply(ctx, { root: directory }) })
    await root.plugin({ name: 'canvas-journal-domain', inject: ['storage'], apply: (ctx: Context) => domain.apply(ctx, { backend: 'json', routes: {} }) })
    const raw = root.get('storageDomain' as never) as ProjectCanvasStorage
    const failing: ProjectCanvasStorage = { open: async spec => {
      const opened = await raw.open(spec)
      return { table: name => {
        const table = opened.table(name)
        const commitLoss = (value: unknown): boolean => {
          const row = value as { inflight?: unknown; receipts?: Array<{ requestId?: string }> } | null
          return row !== null && typeof row === 'object' && row.inflight === undefined
            && Array.isArray(row.receipts) && row.receipts.some(receipt => receipt.requestId === commitRequestId)
        }
        return { get: (key: string) => table.get(key), put: async (key, value) => {
          if (commitLoss(value)) throw new Error('simulated commit loss after journal write')
          await table.put(key, value)
        } }
      }, close: () => opened.close() }
    } }
    store = new ProjectCanvasStore(failing, () => context)
  }
  try {
    await mount()
    // First save: the write-ahead journal lands, the commit write fails without persisting.
    expect(await store!.save({ requestId: commitRequestId, document })).toEqual({ status: 'unknown' })
    await store!.close(); await root!.fiber.dispose()
    // A later session on untouched real storage sees only the journaled intent and settles it definitively.
    await mount()
    expect(await store!.read(read)).toEqual({ status: 'missing', draft: { requestId: commitRequestId, baseRevision: 0, document } })
    expect(await store!.reconcile({ ...read, requestId: commitRequestId })).toEqual({ status: 'not_applied', requestId: commitRequestId })
    expect(await store!.read(read)).toEqual({ status: 'missing' })
    // The recovered draft re-saves under a fresh request id.
    expect(await store!.save({ requestId: 'save:recovered', document })).toEqual({ status: 'saved', requestId: 'save:recovered', revision: 1 })
    expect(await readFile(join(directory, 'yeisme_project_canvas_v1.json'), 'utf8')).toContain('Unsettled canvas content')
  } finally {
    await store?.close(); await root?.fiber.dispose(); await rm(directory, { recursive: true, force: true })
  }
}, 30000)

it('recovers the saved canvas and receipt after disposing and remounting real JSON storage', async () => {
  const staging = resolve(import.meta.dirname, '../../../../temp/dsh-unified-host-source')
  const load = (path: string) => import(pathToFileURL(join(staging, path)).href)
  const storage = await load('packages/storage/storage/lib/index.js')
  const json = await load('packages/storage/storage-json/lib/index.js')
  const domain = await load('packages/storage/storage-domain/lib/index.js')
  const directory = await mkdtemp(join(tmpdir(), 'canvas-storage-'))
  const context: CreatorStudioContextV1 = {
    tenantRef: 'tenant:fixture', workspaceRef: 'workspace:fixture', projectRef: 'project:fixture', sessionRef: 'session:one',
    principalRef: 'principal:fixture', revision: '1', membershipRevision: '1', installationRef: 'install:fixture',
    pluginDigest: 'digest:fixture', policyRevision: '1', runtimeGeneration: 'runtime:fixture',
  }
  const document: ProjectCanvasDocument = { schema: PROJECT_CANVAS_SCHEMA, id: 'main', revision: 0,
    scope: { workspaceRef: context.workspaceRef, projectRef: context.projectRef }, camera: { x: 12, y: 34, zoom: 1.5 },
    nodes: [{ id: 'draft:one', kind: 'draft', title: 'Fixture draft', text: 'Synthetic canvas content', position: { x: 20, y: 30 }, size: { width: 240, height: 180 } }], edges: [] }
  const read = { scope: document.scope, documentId: document.id }
  let root: Context | undefined
  let store: ProjectCanvasStore | undefined
  async function mount() {
    root = new Context()
    await root.plugin(storage.default)
    await root.plugin({ name: 'canvas-fixture-json', inject: ['storage'], apply: (ctx: Context) => json.apply(ctx, { root: directory }) })
    await root.plugin({ name: 'canvas-fixture-domain', inject: ['storage'], apply: (ctx: Context) => domain.apply(ctx, { backend: 'json', routes: {} }) })
    store = new ProjectCanvasStore(root.get('storageDomain' as never) as ProjectCanvasStorage, () => context)
  }
  try {
    await mount()
    expect(await store!.read(read)).toEqual({ status: 'missing' })
    expect(await store!.save({ requestId: 'save:one', document })).toEqual({ status: 'saved', requestId: 'save:one', revision: 1 })
    expect(await readFile(join(directory, 'yeisme_project_canvas_v1.json'), 'utf8')).toContain('Synthetic canvas content')
    await store!.close(); await root!.fiber.dispose()
    await mount()
    expect(await store!.read(read)).toEqual({ status: 'ready', document: { ...document, revision: 1 } })
    expect(await store!.reconcile({ ...read, requestId: 'save:one' })).toEqual({ status: 'saved', requestId: 'save:one', revision: 1 })
    expect(await store!.save({ requestId: 'save:stale', document })).toEqual({ status: 'conflict', revision: 1 })
  } finally {
    await store?.close(); await root?.fiber.dispose(); await rm(directory, { recursive: true, force: true })
  }
}, 30000)
