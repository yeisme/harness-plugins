import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { PANE_ACTION_DESCRIPTOR_SCHEMA, PANE_ACTION_REQUEST_SCHEMA, PANE_ARTIFACT_SCHEMA } from '@yeisme/dsh-pane-protocol'
import { CreatorStudioOwnerDirectory } from '../src/directory.ts'
import {
  CREATOR_STUDIO_EXPECTED_CONTEXT,
  CREATOR_STUDIO_OWNER_DIRECTORY,
  CreatorStudioGateway,
} from '../src/gateway.ts'
import type { CreatorOwnerAdapterV1, CreatorStudioContextV1 } from '../src/types.ts'

const contexts: Context[] = []

describe('candidate selection lifetime', () => {
  it.each(['unchanged', 'project', 'membership', 'adapter'])('checks %s after owner selection returns', async change => {
    const context = expectedContext(), selection = { artifactRef: 'eikona://artifacts/run/candidate', contentDigest: 'a'.repeat(64) }
    let finish!: (value: { status: 'selected'; selection: typeof selection }) => void
    const select = vi.fn(() => new Promise<{ status: 'selected'; selection: typeof selection }>(resolve => { finish = resolve }))
    const { ctx, gateway } = await harness({ context, adapter: adapter({ selectEikonaCandidate: select }) })
    const pending = gateway.selectEikonaCandidate({ selection })
    await vi.waitFor(() => expect(select).toHaveBeenCalledOnce())
    if (change === 'project') context.projectRef = 'project:other'
    if (change === 'membership') (context as { membershipRevision: string }).membershipRevision = '2'
    if (change === 'adapter') (ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory).register(adapter({ transport: 'service', configured: true }))
    finish({ status: 'selected', selection })
    expect(await pending).toEqual(change === 'unchanged' ? { status: 'selected', selection } : { status: 'permission_denied' })
  })
  it('rejects malformed inputs and mismatched selection acknowledgments', async () => {
    const selection = { artifactRef: 'eikona://artifacts/run/candidate', contentDigest: 'a'.repeat(64) }
    const select = vi.fn(async () => ({ status: 'selected' as const, selection: { ...selection, contentDigest: 'b'.repeat(64) } }))
    const { gateway } = await harness({ context: expectedContext(), adapter: adapter({ selectEikonaCandidate: select }) })
    expect(await gateway.selectEikonaCandidate({ selection, ownerURL: 'https://invalid.example' })).toEqual({ status: 'invalid_input' })
    expect(select).not.toHaveBeenCalled()
    expect(await gateway.selectEikonaCandidate({ selection })).toEqual({ status: 'needs_contract' })
  })
})

describe('explicit body read lifetime', () => {
  it.each(['unchanged', 'project', 'membership', 'adapter'])('checks %s binding after the owner returns', async change => {
    const context = expectedContext()
    const artifact = { schema: PANE_ARTIFACT_SCHEMA, owner: 'eikona', kind: 'text', ref: 'artifact:body', version: '1', mediaType: 'text/plain', title: 'Body', evidenceRefs: [], capabilities: [] }
    const content = { artifact, contentRevision: '1', content: 'Fixture body' }
    let finish!: (value: typeof content) => void
    const read = vi.fn(() => new Promise<typeof content>(resolve => { finish = resolve }))
    const { ctx, gateway } = await harness({ context, adapter: adapter({ readArtifactContent: read }) })
    const pending = gateway.readArtifactContent(artifact)
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce())
    if (change === 'project') (context as { projectRef: string }).projectRef = 'project:other'
    if (change === 'membership') (context as { membershipRevision: string }).membershipRevision = '2'
    if (change === 'adapter') {
      const directory = ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory
      directory.register(adapter({ transport: 'service', configured: true }))
    }
    finish(content)
    expect(await pending).toEqual(change === 'unchanged' ? content : null)
    expect(read.mock.calls[0]?.[1]).toEqual(expectedContext())
  })
})

describe('original operation identity persistence', () => {
  it('does not expose a recalled identity after context changes during storage read', async () => {
    const rows = new Map<string, unknown>(), context = expectedContext()
    let switchContext = false
    const storage = { open: async () => ({ table: () => ({ get: (key: string) => rows.get(key),
      entries: () => { if (switchContext) context.projectRef = 'project:other'; return rows.entries() },
      put: async (key: string, value: unknown) => { rows.set(key, value) }, delete: async (key: string) => rows.delete(key),
    }), close: async () => undefined }) }
    const { gateway } = await harness({ context, storage, adapter: adapter({ dispatch: vi.fn(async () => { throw Error('lost') }) }) })
    expect((await gateway.dispatch(request(context))).status).toBe('unknown')
    switchContext = true
    expect(await gateway.recallOperationIdentity({ owner: 'eikona', actionId: 'generate.preview', expectedTargetRef: 'project:one' })).toBeNull()
    expect(rows.size).toBe(1)
  })
  it('recalls a stored original key from a new Gateway without action values', async () => {
    const rows = new Map<string, unknown>()
    const storage = { open: async () => ({ table: (name: string) => ({
      get: (key: string) => name === 'requests' ? rows.get(key) : undefined,
      entries: () => rows.entries(),
      put: async (key: string, value: unknown) => { if (name === 'requests') rows.set(key, value) },
      delete: async (key: string) => name === 'requests' ? rows.delete(key) : false,
    }), close: async () => undefined }) }
    const context = expectedContext()
    const send = vi.fn(async () => { expect(rows.size).toBe(1); throw new Error('lost') })
    const source = adapter({ dispatch: send, reconcile: vi.fn(async () => ({ owner: 'eikona', actionId: 'generate.preview', status: 'completed', receiptRef: 'receipt:original' })) })
    const first = await harness({ context, adapter: source, storage })
    const lost = await first.gateway.dispatch(request(context))
    expect(lost.status).toBe('unknown')
    const restored = await harness({ context, adapter: source, storage })
    const recalled = await restored.gateway.recallOperationIdentity({ owner: 'eikona', actionId: 'generate.preview', expectedTargetRef: 'project:one' })
    expect(recalled).toMatchObject({ owner: 'eikona', actionId: 'generate.preview', idempotencyKey: 'eikona-generate-0001' })
    expect(JSON.stringify(recalled)).not.toMatch(/values|"body"/)
    const recoveries = await restored.gateway.listOperationRecoveries()
    expect(recoveries).toMatchObject({ schemaVersion: 'creator.operation-recovery-page.v1alpha1', status: 'ready', operations: [{ request: { idempotencyKey: 'eikona-generate-0001' }, targetVersion: '1' }] })
    expect(JSON.stringify(recoveries)).not.toMatch(/"values"|"body"/)
    expect((await restored.gateway.dispatch({ ...request(context), idempotencyKey: 'replacement-request' })).status).toBe('reconcile_required')
    expect(send).toHaveBeenCalledOnce()
    expect((await restored.gateway.reconcile(recalled)).status).toBe('completed')
    expect(rows.size).toBe(0)
    expect(await restored.gateway.listOperationRecoveries()).toMatchObject({ status: 'ready', operations: [] })
  })
  it.each([false, true])('does not dispatch when durable storage acknowledgment fails (written=%s)', async written => {
    const rows = new Map<string, unknown>()
    const storage = { open: async () => ({ table: () => ({ get: (key: string) => rows.get(key), entries: () => rows.entries(),
      put: async (key: string, value: unknown) => { if (written) rows.set(key, value); throw Error('storage acknowledgment failed') },
      delete: async (key: string) => rows.delete(key),
    }), close: async () => undefined }) }
    const send = vi.fn(async () => ({ owner: 'eikona', actionId: 'generate.preview', status: 'accepted' as const, receiptRef: 'receipt:accepted' }))
    const { gateway } = await harness({ context: expectedContext(), adapter: adapter({ dispatch: send }), storage })
    expect((await gateway.dispatch(request())).status).toBe('reconcile_required')
    expect(send).not.toHaveBeenCalled()
    expect(rows.size).toBe(Number(written))
  })
})

describe('original operation reconciliation', () => {
  const request = () => ({ schema: 'pane.action-reconcile-request.v1alpha1', owner: 'eikona', actionId: 'generate.preview',
    expectedTargetRef: 'project:one', context: expectedContext(), idempotencyKey: 'creator-original-key' })
  it('queries the original key without snapshot, preview or dispatch', async () => {
    const receipt = { status: 'completed' as const, receiptRef: 'receipt:original', owner: 'eikona', actionId: 'generate.preview' }
    const source = adapter({ reconcile: vi.fn(async () => receipt) })
    const { gateway } = await harness({ context: expectedContext(), adapter: source })
    expect(await gateway.reconcile(request())).toEqual(receipt)
    expect(source.reconcile).toHaveBeenCalledWith(request(), expectedContext())
    expect(source.dispatch).not.toHaveBeenCalled()
    expect(source.snapshot).not.toHaveBeenCalled()
  })
  it('rejects execution payloads and forged scope before calling the owner', async () => {
    const source = adapter({ reconcile: vi.fn() })
    const { gateway } = await harness({ context: expectedContext(), adapter: source })
    expect(await gateway.reconcile({ ...request(), values: { brief: 'must not cross lookup' } })).toMatchObject({ status: 'unknown', reconcileReason: 'request_contract_mismatch' })
    expect(await gateway.reconcile({ ...request(), context: { ...expectedContext(), projectRef: 'project:other' } })).toMatchObject({ status: 'unknown', reconcileReason: 'context_changed' })
    expect(source.reconcile).not.toHaveBeenCalled()
  })
  it('keeps missing adapters, mismatched receipts and failed lookups unknown without dispatch fallback', async () => {
    const source = adapter()
    const { gateway } = await harness({ context: expectedContext(), adapter: source })
    expect(await gateway.reconcile(request())).toMatchObject({ status: 'unknown', reconcileReason: 'reconcile_unavailable' })
    source.reconcile = vi.fn(async () => ({ status: 'completed', receiptRef: 'receipt:wrong', owner: 'sonora', actionId: 'generate.preview' }))
    expect(await gateway.reconcile(request())).toMatchObject({ status: 'unknown', reconcileReason: 'receipt_contract_mismatch' })
    source.reconcile = vi.fn(async () => { throw new Error('private transport details') })
    expect(await gateway.reconcile(request())).toMatchObject({ status: 'unknown', reconcileReason: 'settlement_unknown' })
    expect(source.dispatch).not.toHaveBeenCalled()
  })
})

afterEach(async () => {
  vi.restoreAllMocks()
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

function adapter(overrides: Partial<CreatorOwnerAdapterV1> = {}): CreatorOwnerAdapterV1 {
  const context = expectedContext()
  const action = {
    schema: PANE_ACTION_DESCRIPTOR_SCHEMA,
    descriptorRef: 'action:eikona:generate:one',
    owner: 'eikona',
    actionId: 'generate.preview',
    label: 'Generate preview',
    targetRef: 'project:one',
    targetVersion: '1',
    context,
    risk: 'medium',
    confirmation: 'confirm',
    expiresAt: '2999-08-22T00:00:00.000Z',
    preview: { summary: 'Generate one bounded preview.' },
    fields: [],
  } as const
  return {
    owner: 'eikona',
    transport: 'local',
    snapshot: vi.fn(async () => ({
      schemaVersion: 'creator.owner.snapshot.v1alpha1' as const,
      owner: 'eikona' as const,
      transport: 'local' as const,
      snapshotRef: 'creator:eikona:one',
      snapshotVersion: 1,
      cursor: 'creator:eikona:cursor:one',
      sequence: 1,
      generatedAt: '2026-08-21T00:00:00.000Z',
      context,
      status: 'ready' as const,
      freshness: 'fresh' as const,
      summary: 'Eikona is ready.',
      resources: [],
      actions: [action],
    })),
    dispatch: vi.fn(async () => ({
      status: 'accepted' as const,
      receiptRef: 'receipt:eikona:one',
      actionId: action.actionId,
      owner: 'eikona',
      summary: 'Eikona accepted the request.',
    })),
    ...overrides,
  }
}

async function harness(input?: { context?: CreatorStudioContextV1; adapter?: CreatorOwnerAdapterV1; ordo?: { snapshot(): unknown; decide?(decisionRef: string): Promise<unknown> }; storage?: unknown }): Promise<{ ctx: Context; gateway: CreatorStudioGateway }> {
  const ctx = new Context()
  contexts.push(ctx)
  if (input?.context !== undefined) ctx.provide(CREATOR_STUDIO_EXPECTED_CONTEXT, input.context)
  const directory = new CreatorStudioOwnerDirectory()
  if (input?.adapter !== undefined) directory.register(input.adapter)
  ctx.provide(CREATOR_STUDIO_OWNER_DIRECTORY, directory)
  if (input?.ordo !== undefined) ctx.provide('ordoAgentOps', input.ordo)
  if (input?.storage !== undefined) ctx.provide('storageDomain', input.storage)
  await ctx.plugin(CreatorStudioGateway)
  return { ctx, gateway: ctx.get('creatorStudio') as CreatorStudioGateway }
}

function asset(projectRef: string, ref: string) {
  return {
    owner: 'eikona' as const,
    projectRef,
    ref,
    version: '1',
    kind: 'image',
    title: `Asset ${ref}`,
    status: 'ready',
    artifact: { schema: PANE_ARTIFACT_SCHEMA, owner: 'eikona', kind: 'image', ref: `artifact:${ref}`, version: '1', mediaType: 'image/png', title: `Asset ${ref}`, evidenceRefs: [], capabilities: ['open'] as const },
    evidenceRefs: [],
  }
}

function ordoSnapshot() {
  return {
    schemaVersion: 'ordo.agent_ops.snapshot.v1alpha1',
    snapshotRef: 'ordo:snapshot:one',
    snapshotVersion: 1,
    generatedAt: '2026-08-28T00:00:00.000Z',
    state: 'ready',
    freshness: 'fresh',
    reasonCode: 'owner_snapshot',
    source: 'owner',
    safeMessage: 'Ordo creator operations are ready.',
    context: { tenantRef: 'tenant:one', workspaceRef: 'workspace:one', principalRef: 'principal:one', contextRevision: 1, installationRef: 'install:web' },
    run: { runRef: 'run:one', state: 'active', safeTitle: 'Render current episode', taskCount: 4, completedTaskCount: 2, attentionCount: 1 },
    actions: [{ actionType: 'ordo.approval.decide', decisionRef: 'decision:one', targetRef: 'shot:one', targetVersion: 1, ownerRef: 'owner:scaena', safeEffect: 'Approve the current shot candidate', expiresAt: '2999-08-28T00:00:00.000Z', previewDigest: 'a'.repeat(64), contractDigest: 'b'.repeat(64) }],
  }
}

function request(context = expectedContext()) {
  return {
    schema: PANE_ACTION_REQUEST_SCHEMA,
    descriptorRef: 'action:eikona:generate:one',
    owner: 'eikona',
    actionId: 'generate.preview',
    expectedTargetRef: 'project:one',
    expectedTargetVersion: '1',
    context,
    idempotencyKey: 'eikona-generate-0001',
    values: {},
  } as const
}

describe('CreatorStudioGateway', () => {
  it.each(['absent', 'too-small', 'allowed'])('rechecks %s text-body admission against the current descriptor', async mode => {
    const base = adapter()
    const dispatch = vi.fn(async () => ({ status: 'completed' as const, owner: 'eikona', actionId: 'generate.preview', receiptRef: 'receipt:body' }))
    const scoped = adapter({ dispatch, snapshot: async context => {
      const snapshot = await base.snapshot(context)
      return { ...snapshot, actions: snapshot.actions.map(action => ({ ...action,
        fields: [{ key: 'body', kind: 'textarea' as const, label: 'Text', required: true, maxLength: 16384 }],
        ...(mode === 'absent' ? {} : { textBody: { field: 'body', maxBytes: mode === 'allowed' ? 20000 : 100 } }),
      })) }
    } })
    const { gateway } = await harness({ context: expectedContext(), adapter: scoped })
    const result = await gateway.dispatch({ ...request(), textBody: { field: 'body', content: 'a'.repeat(17000) } })
    expect(dispatch).toHaveBeenCalledTimes(mode === 'allowed' ? 1 : 0)
    expect(result.status === 'completed').toBe(mode === 'allowed')
  })

  it('fails closed without a complete server-injected context', async () => {
    const { gateway } = await harness({ adapter: adapter() })
    const snapshot = await gateway.snapshot()
    expect(snapshot).toMatchObject({ status: 'contract_mismatch', freshness: 'unknown', reasonCode: 'context_unavailable' })
    expect(snapshot.context).toBeUndefined()
    expect(snapshot.owners.every(owner => owner.resources.length === 0 && owner.actions.length === 0)).toBe(true)
  })

  it('composes one ready owner with bounded unavailable projections for the remaining owners', async () => {
    const { gateway } = await harness({ context: expectedContext(), adapter: adapter() })
    const snapshot = await gateway.snapshot()
    expect(snapshot).toMatchObject({ status: 'partial', freshness: 'stale', reasonCode: 'partial_owner_projection' })
    expect(snapshot.owners).toHaveLength(6)
    expect(snapshot.owners.find(owner => owner.owner === 'eikona')).toMatchObject({ status: 'ready', freshness: 'fresh', transport: 'local' })
    expect(snapshot.owners.filter(owner => owner.status === 'offline')).toHaveLength(5)
  })

  it('revalidates the current descriptor and forwards one request to the selected owner', async () => {
    const owner = adapter()
    const { gateway } = await harness({ context: expectedContext(), adapter: owner })
    const receipt = await gateway.dispatch(request())
    expect(receipt).toMatchObject({ status: 'accepted', receiptRef: 'receipt:eikona:one', owner: 'eikona' })
    expect(owner.snapshot).toHaveBeenCalledTimes(1)
    expect(owner.dispatch).toHaveBeenCalledTimes(1)
  })

  it('preserves uncertain settlement as unknown and never retries the mutation', async () => {
    const dispatch = vi.fn(async () => { throw new Error('transport settlement is uncertain') })
    const owner = adapter({ dispatch })
    const { gateway } = await harness({ context: expectedContext(), adapter: owner })
    const receipt = await gateway.dispatch(request())
    expect(receipt).toMatchObject({ status: 'unknown', reconcileReason: 'settlement_unknown' })
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('rejects a drifted context before invoking the owner mutation', async () => {
    const owner = adapter()
    const { gateway } = await harness({ context: expectedContext(), adapter: owner })
    const receipt = await gateway.dispatch(request({ ...expectedContext(), runtimeGeneration: 'runtime:two' }))
    expect(receipt).toMatchObject({ status: 'reconcile_required', reconcileReason: 'context_changed' })
    expect(owner.snapshot).not.toHaveBeenCalled()
    expect(owner.dispatch).not.toHaveBeenCalled()
  })

  it('returns current-project assets by default and paginates explicit all-project assets', async () => {
    const base = adapter()
    const { owner: _owner, projectRef: _projectRef, ...currentResource } = asset('project:one', 'current')
    const owner = adapter({
      snapshot: vi.fn(async context => ({ ...await base.snapshot(context), resources: [currentResource] })),
      listAssets: vi.fn(async () => ({ status: 'ready' as const, safeMessage: 'Eikona assets ready.', items: [asset('project:one', 'one'), asset('project:two', 'two')] })),
    })
    const { gateway } = await harness({ context: expectedContext(), adapter: owner })
    await expect(gateway.assets({ scope: 'current_project' })).resolves.toMatchObject({ status: 'partial', items: [{ projectRef: 'project:one', ref: 'current' }] })
    const first = await gateway.assets({ scope: 'all_projects', limit: 1 })
    expect(first).toMatchObject({ scope: 'all_projects', items: [{ projectRef: 'project:one' }], nextCursor: 'assets:1' })
    const second = await gateway.assets({ scope: 'all_projects', limit: 1, cursor: first.nextCursor })
    expect(second.items).toMatchObject([{ projectRef: 'project:two' }])
    expect(owner.listAssets).toHaveBeenCalledWith({ scope: 'all_projects' }, expectedContext())
  })

  it('fails current-project assets closed when project context is unavailable', async () => {
    const { projectRef: _projectRef, ...withoutProject } = expectedContext()
    const { gateway } = await harness({ context: withoutProject, adapter: adapter() })
    await expect(gateway.assets({ scope: 'current_project' })).resolves.toMatchObject({ status: 'needs_contract', reasonCode: 'project_context_unavailable', items: [] })
  })

  it('preserves explicit all-project asset permission denial', async () => {
    const owner = adapter({ listAssets: vi.fn(async () => ({ status: 'permission_denied' as const, safeMessage: 'Asset access denied.', items: [] })) })
    const { gateway } = await harness({ context: expectedContext(), adapter: owner })
    await expect(gateway.assets({ scope: 'all_projects' })).resolves.toMatchObject({ status: 'permission_denied', reasonCode: 'permission_denied', items: [], permissionDeniedOwners: ['eikona'] })
  })

  it('maps the Ordo snapshot into independent generation and approval projections', async () => {
    const { gateway } = await harness({ context: expectedContext(), adapter: adapter(), ordo: { snapshot: () => ordoSnapshot() } })
    const snapshot = await gateway.snapshot()
    expect(snapshot.generationRuns).toMatchObject([{ ref: 'run:one', source: 'ordo', completedTaskCount: 2 }])
    expect(snapshot.approvals).toMatchObject([{ ref: 'decision:one', source: 'ordo', status: 'pending' }])
    expect(snapshot.jobs).toEqual([])
    expect(snapshot.reviews).toEqual([])
  })

  it('forwards one fresh approval decision and preserves uncertain settlement without retry', async () => {
    const decide = vi.fn(async () => { throw new Error('settlement uncertain') })
    const { gateway } = await harness({ context: expectedContext(), ordo: { snapshot: () => ordoSnapshot(), decide } })
    const receipt = await gateway.decideApproval({ decisionRef: 'decision:one' })
    expect(receipt).toMatchObject({ status: 'unknown', reconcileReason: 'settlement_unknown' })
    expect(decide).toHaveBeenCalledOnce()
    expect(decide).toHaveBeenCalledWith('decision:one')
  })
})

describe('fixed batch input gateway', () => {
  it.each(['unchanged', 'project', 'membership', 'adapter', 'digest'])('rejects stale or substituted %s observations', async change => {
    const context = expectedContext(), input = { batchRef: 'batch:one', digest: `sha256:${'a'.repeat(64)}` }
    let finish!: (value: unknown) => void
    const read = vi.fn(() => new Promise(resolve => { finish = resolve }))
    const { ctx, gateway } = await harness({ context, adapter: adapter({ readEikonaBatchInput: read }) })
    const pending = gateway.readEikonaBatchInput(input)
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce())
    if (change === 'project') context.projectRef = 'project:other'
    if (change === 'membership') (context as { membershipRevision: string }).membershipRevision = '2'
    if (change === 'adapter') (ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory).register(adapter({ transport: 'service', configured: true }))
    const value = { status: 'ready', projectRef: 'project:owner', ...input, ...(change === 'digest' ? { digest: `sha256:${'b'.repeat(64)}` } : {}), requestCount: 1, candidateCount: 2, executionAuthorized: false }
    finish(value)
    expect(await pending).toEqual(change === 'unchanged' ? value : { status: 'unconfirmed' })
  })
})
it('rejects oversized batch pages and non-advancing cursors', async () => {
  const item = { batchRef: 'batch:one', digest: `sha256:${'a'.repeat(64)}`, requestCount: 1, candidateCount: 1 }
  const cursor = `${'a'.repeat(64)}-${'b'.repeat(64)}-${'c'.repeat(64)}.json`
  let page: unknown = { status: 'ready', projectRef: 'project:owner', items: [item], nextCursor: cursor }
  const { gateway } = await harness({ context: expectedContext(), adapter: adapter({ listEikonaBatchInputs: async () => page }) })
  expect(await gateway.listEikonaBatchInputs({ limit: 1, cursor })).toEqual({ status: 'unconfirmed' })
  page = { status: 'ready', projectRef: 'project:owner', items: [item, { ...item, batchRef: 'batch:two' }] }
  expect(await gateway.listEikonaBatchInputs({ limit: 1 })).toEqual({ status: 'unconfirmed' })
  page = { status: 'ready', projectRef: 'project:owner', items: [item] }
  expect(await gateway.listEikonaBatchInputs({ limit: 1 })).toEqual(page)
})
it('keeps batch planning distinct from execution authorization and rejects mismatched costs', async () => {
 const input = { batchRef: 'batch:one', digest: `sha256:${'a'.repeat(64)}` }
 const fixed = { status: 'ready', projectRef: 'project:owner', ...input, planDigest: `sha256:${'b'.repeat(64)}`, planStatus: 'blocked', requestCount: 1, estimatedCalls: 1, maxParallelRequests: 1, maxProviderCalls: 1, costEstimateKnown: false, blockers: [{ requestId: 'request:one', code: 'COST_ESTIMATE_UNKNOWN' }], executionAuthorized: false }
 let result: unknown = fixed
 const { gateway } = await harness({ context: expectedContext(), adapter: adapter({ readEikonaBatchPlan: async () => result }) })
 expect(await gateway.readEikonaBatchPlan(input)).toEqual(fixed)
 for (const value of [{ ...fixed, executionAuthorized: true }, { ...fixed, estimatedUSDUpper: 0 }, { ...fixed, digest: `sha256:${'c'.repeat(64)}` }]) {
  result = value
  expect(await gateway.readEikonaBatchPlan(input)).toEqual({ status: 'unconfirmed' })
 }
})


describe('owner snapshot isolation', () => {
  it('reads only the requested adapter while retaining the old six-owner snapshot contract', async () => {
    const read = vi.fn(adapter().snapshot)
    const { ctx, gateway } = await harness({ context: expectedContext(), adapter: adapter({ snapshot: read }) })
    const blocked = vi.fn(() => new Promise<never>(() => {}))
    ;(ctx.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory).register(adapter({ owner: 'scaena', snapshot: blocked }))
    const snapshot = await gateway.snapshotOwner('eikona')
    expect(snapshot.owners.map(owner => owner.owner)).toEqual(['eikona'])
    expect(snapshot.status).toBe('ready')
    expect(read).toHaveBeenCalledOnce()
    expect(blocked).not.toHaveBeenCalled()
    await expect(gateway.snapshotOwner('unknown')).rejects.toThrow()
  })
})
