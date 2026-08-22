import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { PANE_ACTION_DESCRIPTOR_SCHEMA, PANE_ACTION_REQUEST_SCHEMA } from '@yeisme/dsh-pane-protocol'
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

async function harness(input?: { context?: CreatorStudioContextV1; adapter?: CreatorOwnerAdapterV1 }): Promise<{ ctx: Context; gateway: CreatorStudioGateway }> {
  const ctx = new Context()
  contexts.push(ctx)
  if (input?.context !== undefined) ctx.provide(CREATOR_STUDIO_EXPECTED_CONTEXT, input.context)
  const directory = new CreatorStudioOwnerDirectory()
  if (input?.adapter !== undefined) directory.register(input.adapter)
  ctx.provide(CREATOR_STUDIO_OWNER_DIRECTORY, directory)
  await ctx.plugin(CreatorStudioGateway)
  return { ctx, gateway: ctx.get('creatorStudio') as CreatorStudioGateway }
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
})
