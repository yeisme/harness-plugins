import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import CreatorStudioPlugin, {
  CREATOR_STUDIO_EXPECTED_CONTEXT,
  CREATOR_STUDIO_OWNER_DIRECTORY,
  apply,
  creatorStudioBundleV1,
  registerCreatorStudioOwner,
  type CreatorOwnerAdapterV1,
  type CreatorStudioContextV1,
} from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

function expectedContext(): CreatorStudioContextV1 {
  return {
    tenantRef: 'tenant:one',
    workspaceRef: 'workspace:one',
    projectRef: 'project:one',
    sessionRef: 'session:one',
    principalRef: 'principal:one',
    revision: '1',
    membershipRevision: '1',
    installationRef: 'install:web',
    pluginDigest: 'digest:creator',
    policyRevision: '1',
    runtimeGeneration: 'runtime:1',
  }
}

function provideTypert(ctx: Context) {
  const unregister = vi.fn()
  const register = vi.fn(() => unregister)
  ctx.provide('typert', { register })
  return { register, unregister }
}

function eikonaAdapter(): CreatorOwnerAdapterV1 {
  return {
    owner: 'eikona',
    transport: 'local',
    snapshot: context => ({
      schemaVersion: 'creator.owner.snapshot.v1alpha1',
      owner: 'eikona',
      transport: 'local',
      snapshotRef: 'creator:eikona:one',
      snapshotVersion: 1,
      cursor: 'creator:eikona:cursor:one',
      sequence: 1,
      generatedAt: '2026-08-21T00:00:00.000Z',
      context,
      status: 'ready',
      freshness: 'fresh',
      summary: 'Eikona is ready.',
      resources: [],
      actions: [],
    }),
    dispatch: async () => ({ status: 'rejected', receiptRef: 'receipt:eikona:none', owner: 'eikona', summary: 'No action was requested.' }),
  }
}

describe('@yeisme/dsh-creator-studio bundle', () => {
  it('mounts one shared directory and one safe Remote', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const typert = provideTypert(ctx)
    ctx.provide(CREATOR_STUDIO_EXPECTED_CONTEXT, expectedContext())
    const plugin = await ctx.plugin(CreatorStudioPlugin)
    registerCreatorStudioOwner(ctx, eikonaAdapter())

    expect(ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY)).toBeDefined()
    const remote = ctx.get('creatorStudio') as { snapshot(): Promise<{ owners: readonly { owner: string; status: string }[] }> }
    const snapshot = await remote.snapshot()
    expect(snapshot.owners.find(owner => owner.owner === 'eikona')).toMatchObject({ status: 'ready' })
    expect(snapshot.owners).toHaveLength(6)
    expect(typert.register).toHaveBeenCalledWith(expect.objectContaining({
      face: 'host',
      invocations: expect.arrayContaining([
        expect.objectContaining({ namespace: 'creatorStudio', method: 'snapshot' }),
        expect.objectContaining({ namespace: 'creatorStudio', method: 'dispatch' }),
        expect.objectContaining({ namespace: 'creatorStudio', method: 'resolveArtifact' }),
        expect.objectContaining({ namespace: 'creatorStudio', method: 'assets' }),
        expect.objectContaining({ namespace: 'creatorStudio', method: 'decideApproval' }),
      ]),
    }))

    await plugin.dispose()
    expect(ctx.get('creatorStudio')).toBeUndefined()
    expect(ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY)).toBeUndefined()
    expect(typert.unregister).toHaveBeenCalledOnce()
  })

  it('reference-counts compatible loader rows without duplicating services', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    provideTypert(ctx)
    ctx.provide(CREATOR_STUDIO_EXPECTED_CONTEXT, expectedContext())
    const first = await ctx.plugin(CreatorStudioPlugin)
    const second = await ctx.plugin({ name: 'creator-studio-compat-test', inject: [], apply })
    expect(ctx.get('creatorStudio')).toBeDefined()

    await first.dispose()
    expect(ctx.get('creatorStudio')).toBeDefined()
    await second.dispose()
    expect(ctx.get('creatorStudio')).toBeUndefined()
  })

  it('publishes one profile row and a versioned ecosystem descriptor', async () => {
    const patchPath = fileURLToPath(new URL('../cordis.patch.yml', import.meta.url))
    const patch = await readFile(patchPath, 'utf8')
    expect(creatorStudioBundleV1).toMatchObject({ id: 'dsh-creator-studio', version: '0.1.0-rc.1' })
    expect(creatorStudioBundleV1.owners).toHaveLength(6)
    expect(patch.match(/id: dsh-creator-studio/gu)).toHaveLength(1)
    expect(patch).not.toMatch(/id: (?:pane-workbench|dsh-desktop-workbench)/u)
  })
})
