import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import {
  OrdoAgentOpsGateway,
  ORDO_AGENT_OPS_EXPECTED_CONTEXT,
  needsContractSnapshot,
  type OrdoAgentOpsExpectedContext,
  type OrdoAgentOpsOwnerSource,
  type OrdoAgentOpsSnapshot,
} from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

function expectedContext(overrides: Partial<OrdoAgentOpsExpectedContext> = {}): OrdoAgentOpsExpectedContext {
  return {
    tenantRef: 'tenant-1' as never,
    workspaceRef: 'workspace-1' as never,
    principalRef: 'principal-1' as never,
    contextRevision: 1,
    installationRef: 'installation-1' as never,
    ...overrides,
  }
}

function ownerSnapshot(overrides: Partial<OrdoAgentOpsSnapshot> = {}): OrdoAgentOpsSnapshot {
  return {
    schemaVersion: 'ordo.agent_ops.snapshot.v1alpha1',
    snapshotRef: 'snapshot-1' as never,
    snapshotVersion: 1,
    generatedAt: '2026-08-14T00:00:00.000Z',
    state: 'ready',
    freshness: 'fresh',
    reasonCode: 'owner_snapshot',
    source: 'owner',
    safeMessage: 'Owner projection is available.',
    context: expectedContext(),
    run: {
      runRef: 'run-1' as never,
      state: 'active',
      safeTitle: 'Safe run summary',
      taskCount: 3,
      completedTaskCount: 1,
      attentionCount: 1,
    },
    capacity: {
      policyCap: 2,
      observedOrRetained: 1,
      qualifiedRoutes: 1,
      reservationState: 'not_reserved',
    },
    ...overrides,
  }
}

function expectNoFacts(snapshot: OrdoAgentOpsSnapshot): void {
  expect(snapshot).not.toHaveProperty('run')
  expect(snapshot).not.toHaveProperty('capacity')
}

describe('OrdoAgentOpsGateway', () => {
  it('publishes one read-only snapshot Remote', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(OrdoAgentOpsGateway)
    const gateway = ctx.get('ordoAgentOps') as OrdoAgentOpsGateway
    expect(gateway.typertRemote).toMatchObject({
      serviceKey: 'ordoAgentOps',
      namespace: 'ordoAgentOps',
    })
    expect(remoteMethods(gateway)).toEqual([
      { method: 'snapshot', invocation: { kind: 'direct' } },
    ])
  })

  it('fails closed without a valid server-injected expected context', async () => {
    for (const injected of [undefined, { tenantRef: 'tenant-1' }]) {
      const ctx = new Context()
      contexts.push(ctx)
      if (injected !== undefined) ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, injected)
      ctx.provide('ordoAgentOpsOwner', { snapshot: () => ownerSnapshot() } satisfies OrdoAgentOpsOwnerSource)
      await ctx.plugin(OrdoAgentOpsGateway)
      const snapshot = (ctx.get('ordoAgentOps') as OrdoAgentOpsGateway).snapshot()
      expect(snapshot).toEqual(needsContractSnapshot(snapshot.generatedAt))
      expect(snapshot.safeMessage).not.toMatch(/https?:|Bearer|token|\//i)
      expectNoFacts(snapshot)
    }
  })

  it('fails closed without an Ordo owner source', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, expectedContext())
    await ctx.plugin(OrdoAgentOpsGateway)
    const gateway = ctx.get('ordoAgentOps') as OrdoAgentOpsGateway
    const snapshot = gateway.snapshot()
    expect(snapshot).toMatchObject({
      state: 'needs_contract',
      reasonCode: 'owner_read_contract_unavailable',
    })
    expectNoFacts(snapshot)
  })

  it('returns an exact ready owner projection without creating a second state', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const projection = ownerSnapshot()
    ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, expectedContext())
    ctx.provide('ordoAgentOpsOwner', { snapshot: () => projection } satisfies OrdoAgentOpsOwnerSource)
    await ctx.plugin(OrdoAgentOpsGateway)
    const gateway = ctx.get('ordoAgentOps') as OrdoAgentOpsGateway
    expect(gateway.snapshot()).toEqual(projection)
  })

  it('returns an exact stale owner projection', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const projection = ownerSnapshot({
      state: 'stale',
      freshness: 'stale',
      reasonCode: 'context_stale',
      safeMessage: 'Owner projection is stale.',
    })
    ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, expectedContext())
    ctx.provide('ordoAgentOpsOwner', { snapshot: () => projection } satisfies OrdoAgentOpsOwnerSource)
    await ctx.plugin(OrdoAgentOpsGateway)
    const gateway = ctx.get('ordoAgentOps') as OrdoAgentOpsGateway
    expect(gateway.snapshot()).toEqual(projection)
  })

  it('rejects a missing owner context and context drift without exposing facts', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const missingContextSnapshot = (({ context: _context, ...snapshot }) => snapshot)(ownerSnapshot())
    const snapshots = [
      missingContextSnapshot,
      ownerSnapshot({ context: expectedContext({ installationRef: 'installation-drift' as never }) }),
    ]
    ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, expectedContext())
    ctx.provide('ordoAgentOpsOwner', { snapshot: () => snapshots.shift()! } satisfies OrdoAgentOpsOwnerSource)
    await ctx.plugin(OrdoAgentOpsGateway)
    const gateway = ctx.get('ordoAgentOps') as OrdoAgentOpsGateway
    for (const snapshot of [gateway.snapshot(), gateway.snapshot()]) {
      expect(snapshot).toMatchObject({
        state: 'contract_mismatch',
        freshness: 'stale',
        reasonCode: 'contract_mismatch',
      })
      expect(snapshot.safeMessage).not.toMatch(/installation-drift|https?:|Bearer|token/i)
      expectNoFacts(snapshot)
    }
  })

  it('keeps the constructor-captured expected context after the Context key changes', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const injected = {
      tenantRef: 'tenant-1' as never,
      workspaceRef: 'workspace-1' as never,
      principalRef: 'principal-1' as never,
      contextRevision: 1,
      installationRef: 'installation-1' as never,
    }
    const disposeExpectedContext = ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, {
      ...injected,
    } satisfies OrdoAgentOpsExpectedContext)
    ctx.provide('ordoAgentOpsOwner', { snapshot: () => ownerSnapshot() } satisfies OrdoAgentOpsOwnerSource)
    await ctx.plugin(OrdoAgentOpsGateway)
    injected.tenantRef = 'tenant-mutated' as never
    disposeExpectedContext()
    ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, expectedContext({ tenantRef: 'tenant-replaced' as never }))
    const gateway = ctx.get('ordoAgentOps') as OrdoAgentOpsGateway
    expect(gateway.snapshot()).toMatchObject({
      state: 'ready',
      source: 'owner',
      reasonCode: 'owner_snapshot',
    })
  })

  it('rejects a non-ready snapshot carrying run or capacity facts', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, expectedContext())
    ctx.provide('ordoAgentOpsOwner', {
      snapshot: () => ownerSnapshot({
        state: 'offline',
        freshness: 'offline',
        reasonCode: 'owner_projection_unavailable',
      }),
    } satisfies OrdoAgentOpsOwnerSource)
    await ctx.plugin(OrdoAgentOpsGateway)
    const snapshot = (ctx.get('ordoAgentOps') as OrdoAgentOpsGateway).snapshot()
    expect(snapshot).toMatchObject({ state: 'contract_mismatch', reasonCode: 'contract_mismatch' })
    expectNoFacts(snapshot)
  })

  it('fails closed when an owner projection contains an unsafe ref or unknown field', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const owner: OrdoAgentOpsOwnerSource = {
      snapshot: () => ({
        ...needsContractSnapshot('2026-08-14T00:00:00.000Z'),
        state: 'ready',
        freshness: 'fresh',
        reasonCode: 'owner_snapshot',
        source: 'owner',
        safeMessage: 'owner projection',
        context: {
          tenantRef: 'tenant-1' as never,
          workspaceRef: '/srv/private/worktree' as never,
          principalRef: 'principal-1' as never,
          contextRevision: 1,
          installationRef: 'installation-1' as never,
        },
        privatePath: '/srv/private/worktree',
      } as unknown as ReturnType<OrdoAgentOpsOwnerSource['snapshot']>),
    }
    ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, expectedContext())
    ctx.provide('ordoAgentOpsOwner', owner)
    await ctx.plugin(OrdoAgentOpsGateway)
    const gateway = ctx.get('ordoAgentOps') as OrdoAgentOpsGateway
    expect(gateway.snapshot()).toMatchObject({
      state: 'contract_mismatch',
      freshness: 'stale',
      reasonCode: 'contract_mismatch',
    })
    expect(gateway.snapshot().safeMessage).not.toMatch(/srv|private|https?:|Bearer|token/i)
    expectNoFacts(gateway.snapshot())
  })

  it('maps an owner read exception to a safe offline projection', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const owner: OrdoAgentOpsOwnerSource = {
      snapshot: () => { throw new Error('Bearer provider secret') },
    }
    ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, expectedContext())
    ctx.provide('ordoAgentOpsOwner', owner)
    await ctx.plugin(OrdoAgentOpsGateway)
    const gateway = ctx.get('ordoAgentOps') as OrdoAgentOpsGateway
    expect(gateway.snapshot()).toMatchObject({
      state: 'offline',
      freshness: 'offline',
      reasonCode: 'owner_projection_unavailable',
    })
    expect(gateway.snapshot().safeMessage).not.toMatch(/secret|Bearer|provider/i)
    expectNoFacts(gateway.snapshot())
  })
})
