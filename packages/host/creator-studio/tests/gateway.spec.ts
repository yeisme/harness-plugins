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

async function harness(input?: { context?: CreatorStudioContextV1; adapter?: CreatorOwnerAdapterV1; ordo?: { snapshot(): unknown; decide?(decisionRef: string): Promise<unknown> } }): Promise<{ ctx: Context; gateway: CreatorStudioGateway }> {
  const ctx = new Context()
  contexts.push(ctx)
  if (input?.context !== undefined) ctx.provide(CREATOR_STUDIO_EXPECTED_CONTEXT, input.context)
  const directory = new CreatorStudioOwnerDirectory()
  if (input?.adapter !== undefined) directory.register(input.adapter)
  ctx.provide(CREATOR_STUDIO_OWNER_DIRECTORY, directory)
  if (input?.ordo !== undefined) ctx.provide('ordoAgentOps', input.ordo)
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
