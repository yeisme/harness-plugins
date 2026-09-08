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
