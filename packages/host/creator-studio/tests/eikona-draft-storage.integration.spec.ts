import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { expect, it } from 'vitest'
import { CreatorStudioGateway, CREATOR_STUDIO_EXPECTED_CONTEXT, CREATOR_STUDIO_OWNER_DIRECTORY } from '../src/gateway.ts'
import { CreatorStudioOwnerDirectory } from '../src/directory.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

it('restores Eikona drafts through Gateway after disposing and reopening real JSON storage', async () => {
  const staging = resolve(import.meta.dirname, '../../../../temp/dsh-unified-host-source')
  const load = (path: string) => import(pathToFileURL(join(staging, path)).href)
  const storage = await load('packages/storage/storage/lib/index.js')
  const json = await load('packages/storage/storage-json/lib/index.js')
  const domain = await load('packages/storage/storage-domain/lib/index.js')
  const directory = await mkdtemp(join(tmpdir(), 'eikona-draft-storage-'))
  const context: CreatorStudioContextV1 = { tenantRef: 'tenant', workspaceRef: 'workspace', projectRef: 'project', sessionRef: 'session', principalRef: 'principal', revision: '1', membershipRevision: '1', installationRef: 'installation', pluginDigest: 'digest', policyRevision: '1', runtimeGeneration: '1' }
  const scope = { tenantRef: 'tenant', workspaceRef: 'workspace', projectRef: 'project' }
  const draft = { schemaVersion: 'eikona.studio_draft.v1', scope, id: 'primary', revision: 0, fields: { prompt: '', version: '未完成', size: '', seed: '-', variables: [] }, checkpoint: { status: 'preparation_unconfirmed' } }
  let root: Context | undefined
  async function mount(session: string) {
    root = new Context()
    await root.plugin(storage.default)
    await root.plugin({ name: 'draft-json', inject: ['storage'], apply: (ctx: Context) => json.apply(ctx, { root: directory }) })
    await root.plugin({ name: 'draft-domain', inject: ['storage'], apply: (ctx: Context) => domain.apply(ctx, { backend: 'json', routes: {} }) })
    root.provide(CREATOR_STUDIO_EXPECTED_CONTEXT, { ...context, sessionRef: session })
    root.provide(CREATOR_STUDIO_OWNER_DIRECTORY, new CreatorStudioOwnerDirectory())
    await root.plugin(CreatorStudioGateway)
    return root.get('creatorStudio') as CreatorStudioGateway
  }
  try {
    let gateway = await mount('session:first')
    expect(await gateway.readEikonaDraft({ scope, id: 'primary' })).toEqual({ status: 'missing' })
    expect(await gateway.saveEikonaDraft({ requestId: 'save-one', draft })).toEqual({ status: 'saved', requestId: 'save-one', revision: 1 })
    expect(await readFile(join(directory, 'yeisme_eikona_drafts_v1.json'), 'utf8')).toContain('preparation_unconfirmed')
    await root!.fiber.dispose()
    gateway = await mount('session:second')
    expect(await gateway.readEikonaDraft({ scope, id: 'primary' })).toEqual({ status: 'ready', draft: { ...draft, revision: 1 } })
    expect(await gateway.reconcileEikonaDraft({ scope, id: 'primary', requestId: 'save-one' })).toEqual({ status: 'saved', requestId: 'save-one', revision: 1 })
    expect(await gateway.saveEikonaDraft({ requestId: 'stale', draft })).toEqual({ status: 'conflict' })
    expect(await gateway.readEikonaDraft({ scope: { ...scope, projectRef: 'other' }, id: 'primary' })).toEqual({ status: 'forbidden' })
  } finally {
    await root?.fiber.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 30000)
