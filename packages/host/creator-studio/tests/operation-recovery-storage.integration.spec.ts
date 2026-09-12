import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { expect, it } from 'vitest'
import { OperationRecoveryStore, type OperationRecoveryStorage } from '../src/operation-recovery-store.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

it('reopens original lookup identity from real DSH storage without persisting body or dispatching', async () => {
  const staging = resolve(import.meta.dirname, '../../../../temp/dsh-unified-host-source')
  const load = (path: string) => import(pathToFileURL(join(staging, path)).href)
  const storage = await load('packages/storage/storage/lib/index.js')
  const json = await load('packages/storage/storage-json/lib/index.js')
  const domain = await load('packages/storage/storage-domain/lib/index.js')
  const directory = await mkdtemp(join(tmpdir(), 'creator-recovery-'))
  let context: CreatorStudioContextV1 = { tenantRef: 'tenant:fixture', workspaceRef: 'workspace:fixture', projectRef: 'project:fixture', sessionRef: 'session:one',
    principalRef: 'principal:fixture', revision: '1', membershipRevision: '1', installationRef: 'install:fixture', pluginDigest: 'digest:fixture', policyRevision: '1', runtimeGeneration: 'runtime:one' }
  const request = { schema: 'pane.action-request.v1alpha1', owner: 'auctra', actionId: 'working-copy.candidate.adopt', descriptorRef: 'descriptor:fixture',
    expectedTargetRef: 'artifact:fixture', expectedTargetVersion: '1:fixture', context, idempotencyKey: 'original-recovery-key', values: { body: 'PRIVATE_DRAFT_NOT_FOR_STORAGE' } }
  let root: Context | undefined, store: OperationRecoveryStore | undefined
  async function mount() {
    root = new Context()
    await root.plugin(storage.default)
    await root.plugin({ name: 'recovery-json', inject: ['storage'], apply: (ctx: Context) => json.apply(ctx, { root: directory }) })
    await root.plugin({ name: 'recovery-domain', inject: ['storage'], apply: (ctx: Context) => domain.apply(ctx, { backend: 'json', routes: {} }) })
    store = new OperationRecoveryStore(root.get('storageDomain' as never) as OperationRecoveryStorage, () => context)
  }
  try {
    await mount()
    expect((await store!.reserve(request)).status).toBe('saved')
    const persisted = await readFile(join(directory, 'yeisme_creator_recovery_v1.json'), 'utf8')
    expect(persisted).toContain('original-recovery-key')
    expect(persisted).not.toContain('PRIVATE_DRAFT_NOT_FOR_STORAGE')
    expect(persisted).not.toContain('"values"')
    await store!.close(); await root!.fiber.dispose()
    context = { ...context, sessionRef: 'session:two', runtimeGeneration: 'runtime:two' }
    await mount()
    const found = await store!.list()
    expect(found).toMatchObject({ status: 'ready', rows: [{ request: { idempotencyKey: 'original-recovery-key', context: { sessionRef: 'session:one' } } }] })
    expect((await store!.reserve({ ...request, context, idempotencyKey: 'replacement-key' })).status).toBe('existing')
  } finally {
    await store?.close(); await root?.fiber.dispose(); await rm(directory, { recursive: true, force: true })
  }
}, 30000)
