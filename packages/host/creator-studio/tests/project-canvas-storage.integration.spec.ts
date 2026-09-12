import { createProjectCanvasEditor, editProjectCanvas } from '../../../client/ui-pane-domain/src/project-canvas.js'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { expect, it } from 'vitest'
import { PROJECT_CANVAS_SCHEMA, type ProjectCanvasDocument } from '@yeisme/dsh-pane-protocol'
import { ProjectCanvasStore, type ProjectCanvasStorage } from '../src/project-canvas-store.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'
import { ProjectCanvasController } from '../../../client/ui-pane-domain/src/project-canvas-controller.js'

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
    const controller = new ProjectCanvasController({
      canvasRead: input => store!.read(input),
      canvasSave: input => store!.save(input),
      canvasReconcile: input => store!.reconcile(input),
    }, read, () => 'save:recovered')
    await controller.load()
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', dirty: true, saveStatus: 'dirty', editor: { document } })
    expect(await store!.read(read)).toEqual({ status: 'missing' })
    // The recovered draft re-saves under a fresh request id.
    await controller.save()
    expect(controller.getSnapshot()).toMatchObject({ dirty: false, saveStatus: 'clean', editor: { document: { ...document, revision: 1 } } })
    expect(await store!.reconcile({ ...read, requestId: 'save:recovered' })).toEqual({ status: 'saved', requestId: 'save:recovered', revision: 1 })
    controller.dispose()
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
  document.nodes.push({ id: 'operation:one', kind: 'operation', title: 'Retained selected result', owner: 'eikona', actionRef: 'action:generate', controls: { count: 1 },
    position: { x: 300, y: 30 }, size: { width: 240, height: 180 }, selectedArtifact: { schema: 'pane.artifact.v1alpha1', owner: 'eikona', kind: 'image', ref: 'eikona:asset:fixture', version: '7', mediaType: 'image/png', title: 'Selected image', evidenceRefs: [], capabilities: [] } })
  const edited = editProjectCanvas(createProjectCanvasEditor(document), { ...document.scope, documentId: document.id }, 0, { type: 'controls', id: 'operation:one', controls: { count: 2 } })
  expect(edited.ok).toBe(true)
  if (!edited.ok) throw Error('input edit rejected')
  document.nodes = [...edited.editor.document.nodes]
  expect(document.nodes.find(node => node.id === 'operation:one')).toMatchObject({ inputReviewRequired: true, selectedArtifact: { version: '7' } })
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
    const reopened = await store!.read(read)
    expect(reopened.status).toBe('ready')
    if (reopened.status !== 'ready') throw Error('saved canvas missing')
    expect(reopened.document.nodes.find(node => node.id === 'operation:one')).toMatchObject({ inputReviewRequired: true, controls: { count: 2 }, selectedArtifact: { version: '7' } })
    expect(await store!.reconcile({ ...read, requestId: 'save:one' })).toEqual({ status: 'saved', requestId: 'save:one', revision: 1 })
    expect(await store!.save({ requestId: 'save:stale', document })).toEqual({ status: 'conflict', revision: 1 })
  } finally {
    await store?.close(); await root?.fiber.dispose(); await rm(directory, { recursive: true, force: true })
  }
}, 30000)
