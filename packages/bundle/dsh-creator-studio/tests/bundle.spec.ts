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
  validateCreatorArtifactContent,
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
  it('exposes the artifact content validator from the installable entry', () => {
    expect(validateCreatorArtifactContent).toBeTypeOf('function')
    expect(validateCreatorArtifactContent({ body: 'unattested' })).toBeUndefined()
  })

  it('mounts one shared directory and one safe Remote', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const typert = provideTypert(ctx)
    ctx.provide(CREATOR_STUDIO_EXPECTED_CONTEXT, expectedContext())
    const plugin = await ctx.plugin(CreatorStudioPlugin)
    registerCreatorStudioOwner(ctx, eikonaAdapter())

    expect(ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY)).toBeDefined()
    const remote = ctx.get('creatorStudio') as { snapshot(): Promise<{ owners: readonly { owner: string; status: string }[] }>; readArtifactContent(input: unknown): Promise<unknown> }
    expect(remote.readArtifactContent).toBeTypeOf('function')
    const snapshot = await remote.snapshot()
    expect(snapshot.owners.find(owner => owner.owner === 'eikona')).toMatchObject({ status: 'ready' })
    expect(snapshot.owners).toHaveLength(6)
    expect(typert.register).toHaveBeenCalledWith(expect.objectContaining({
      face: 'host',
      invocations: expect.arrayContaining([
        expect.objectContaining({ namespace: 'creatorStudio', method: 'snapshot' }),
        expect.objectContaining({ namespace: 'creatorStudio', method: 'dispatch' }),
        expect.objectContaining({ namespace: 'creatorStudio', method: 'resolveArtifact' }),
        expect.objectContaining({ namespace: 'creatorStudio', method: 'readArtifactContent', parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }], result: { mode: 'src-json' } }),
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

  it('registers Creator references through the real gateway and rejects stale or cross-target proof', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    provideTypert(ctx)
    const context = expectedContext()
    ctx.provide(CREATOR_STUDIO_EXPECTED_CONTEXT, context)
    ctx.provide('workspaceRegistry' as never, { list: () => [{ id: context.workspaceRef, sessionIds: [context.sessionRef] }] } as never)
    const providers = new Map<string, { resolve(input: unknown, signal: AbortSignal): Promise<unknown> }>()
    ctx.provide('composerReferenceOwners' as never, { version: 1, register: (owner: string, provider: { resolve(input: unknown, signal: AbortSignal): Promise<unknown> }) => { providers.set(owner, provider); return () => { providers.delete(owner) } } } as never)
    const mounted = await ctx.plugin(CreatorStudioPlugin)
    const artifact = { schema: 'pane.artifact.v1alpha1' as const, owner: 'eikona', kind: 'text' as const, ref: 'artifact:reference', version: '1', mediaType: 'text/markdown', title: 'Reference', evidenceRefs: [], capabilities: ['preview' as const] }
    const proof = { id: 'proof:one', kind: 'file' as const, intent: 'content' as const, scope: 'artifact/body' as const, digest: 'digest:one', freshness: 'fresh' as const }
    let revoked = false
    const original = eikonaAdapter()
    const read = vi.fn(async () => ({ artifact, contentRevision: 'body:1', content: 'Owner-authorized body' }))
    registerCreatorStudioOwner(ctx, { ...original, snapshot: async input => ({ ...await original.snapshot(input), status: revoked ? 'permission_denied' : 'ready', artifactWorkspace: { status: 'ready', safeMessage: 'Ready', artifacts: [{ artifact, acceptedVersion: '1', candidates: [], referenceProof: proof }] } }), readArtifactContent: read })
    await vi.waitFor(() => expect(providers.size).toBe(6))
    const gateway = ctx.get('creatorStudio') as { snapshot(): Promise<{ owners: unknown[] }> }
    expect((await gateway.snapshot()).owners[0]).toMatchObject({ owner: 'eikona', status: 'ready', artifactWorkspace: { artifacts: [{ referenceProof: proof }] } })
    const owner = providers.get('eikona')!
    const claim = { id: proof.id, owner: artifact.owner, ref: artifact.ref, kind: proof.kind, intent: proof.intent, scope: proof.scope, digest: proof.digest, version: artifact.version }
    const resolve = (reference = claim, sessionId = context.sessionRef) => owner.resolve({ sessionId, cwd: '', reference }, new AbortController().signal)
    await expect(resolve()).resolves.toMatchObject({ label: 'Reference', snapshot: { type: 'text', text: 'Owner-authorized body', truncated: false } })
    read.mockClear()
    await expect(resolve({ ...claim, digest: 'forged' })).resolves.toBeUndefined()
    await expect(resolve(claim, 'session:other')).resolves.toBeUndefined()
    expect(read).not.toHaveBeenCalled()
    revoked = true
    await expect(resolve()).resolves.toBeUndefined()
    expect(read).not.toHaveBeenCalled()
    await mounted.dispose()
    expect(providers.size).toBe(0)
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
