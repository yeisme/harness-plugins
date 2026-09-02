import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import OrdoAgentOpsPlugin, {
  applyLegacyCommands,
  applyLegacyHostBridge,
  ORDO_AGENT_OPS_ACTION_SOURCE,
  ORDO_AGENT_OPS_EXPECTED_CONTEXT,
  type OrdoAgentOpsExpectedContext,
  type OrdoAgentOpsActionSource,
  type OrdoAgentOpsOwnerSource,
  type OrdoAgentOpsSnapshot,
} from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

function expectedContext(): OrdoAgentOpsExpectedContext {
  return {
    tenantRef: 'tenant-1' as never,
    workspaceRef: 'workspace-1' as never,
    principalRef: 'principal-1' as never,
    contextRevision: 1,
    installationRef: 'installation-1' as never,
  }
}

function snapshot(): OrdoAgentOpsSnapshot {
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
  }
}

function actionSnapshot(): OrdoAgentOpsSnapshot {
  return {
    ...snapshot(),
    reasonCode: 'reconcile_required',
    actions: [{
      actionType: 'ordo.approval.decide',
      decisionRef: 'decision-1' as never,
      targetRef: 'run-1' as never,
      targetVersion: 1,
      ownerRef: 'ordo-owner' as never,
      safeEffect: 'reconcile the owner target',
      expiresAt: '2999-01-01T00:00:00.000Z',
      previewDigest: 'a'.repeat(64),
      contractDigest: 'b'.repeat(64),
    }],
  }
}

function reconcileSnapshot(): OrdoAgentOpsSnapshot {
  return {
    ...snapshot(),
    reasonCode: 'reconcile_required',
    actions: [{
      actionType: 'ordo.reconcile.request',
      decisionRef: 'reconcile-decision-1' as never,
      targetRef: 'run-1' as never,
      targetVersion: 1,
      ownerRef: 'ordo-owner' as never,
      safeEffect: 'request owner reconciliation for the target',
      expiresAt: '2999-01-01T00:00:00.000Z',
      previewDigest: 'c'.repeat(64),
      contractDigest: 'd'.repeat(64),
    }],
  }
}

function agent(): Agent {
  return {
    session: Session.create(SessionId('unified-ordo')),
    status: 'idle',
    options: {},
    reserveTurnAdmission: () => () => undefined,
  } as unknown as Agent
}

async function harness(
  owner: OrdoAgentOpsOwnerSource = { snapshot },
  actionSource?: OrdoAgentOpsActionSource,
  composition?: { project(id: string): Promise<unknown> },
): Promise<Context> {
  const ctx = new Context()
  contexts.push(ctx)
  ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, expectedContext())
  ctx.provide('ordoAgentOpsOwner', owner)
  if (actionSource !== undefined) ctx.provide(ORDO_AGENT_OPS_ACTION_SOURCE, actionSource)
  if (composition !== undefined) ctx.provide('agentCompositionPreview', composition)
  await ctx.plugin(CommandRuntime)
  return ctx
}

describe('@yeisme/dsh-ordo-agent-ops Host consolidation', () => {
  it('binds the local ordo CLI owner when no owner source is mounted', async () => {
    const previous = process.env.ORDO_BIN
    process.env.ORDO_BIN = '/nonexistent/ordo-cli-missing'
    try {
      const ctx = new Context()
      contexts.push(ctx)
      await ctx.plugin(CommandRuntime)
      await ctx.plugin(OrdoAgentOpsPlugin)
      const snapshot = (ctx.get('ordoAgentOps') as { snapshot(): OrdoAgentOpsSnapshot }).snapshot()
      expect(snapshot.state).toBe('offline')
      expect(snapshot.reasonCode).toBe('owner_projection_unavailable')
      expect(snapshot.safeMessage).toMatch(/ordo CLI/i)
      expect(snapshot.run).toBeUndefined()
    } finally {
      if (previous === undefined) delete process.env.ORDO_BIN
      else process.env.ORDO_BIN = previous
    }
  })

  it('mounts the Remote and one /ordo command from the single package', async () => {
    const ctx = await harness()
    const plugin = await ctx.plugin(OrdoAgentOpsPlugin)
    const commands = ctx.commands.list(agent()).filter(command => command.name === 'ordo')

    expect(ctx.get('ordoAgentOps')).toMatchObject({ typertRemote: { serviceKey: 'ordoAgentOps' } })
    expect(commands).toHaveLength(1)
    const execution = await ctx.commands.execute(agent(), '/ordo status', new AbortController().signal)
    expect(execution?.result.text).toContain('Run run-1: active')

    await plugin.dispose()
    expect(ctx.get('ordoAgentOps')).toBeUndefined()
    expect(ctx.commands.list(agent()).find(command => command.name === 'ordo')).toBeUndefined()
  })

  it('keeps legacy and unified rows reference-counted without duplicate mount', async () => {
    const ctx = await harness()
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const unified = await ctx.plugin(OrdoAgentOpsPlugin)
    const legacyBridge = await ctx.plugin({ inject: [], apply: applyLegacyHostBridge })
    const legacyCommand = await ctx.plugin({ inject: ['commands', 'ordoAgentOps'], apply: applyLegacyCommands })

    expect(ctx.commands.list(agent()).filter(command => command.name === 'ordo')).toHaveLength(1)
    expect(ctx.get('ordoAgentOps')).toBeDefined()

    await unified.dispose()
    expect(ctx.commands.list(agent()).filter(command => command.name === 'ordo')).toHaveLength(1)
    await legacyBridge.dispose()
    expect(ctx.get('ordoAgentOps')).toBeDefined()
    await legacyCommand.dispose()
    expect(ctx.get('ordoAgentOps')).toBeUndefined()
    expect(ctx.commands.list(agent()).find(command => command.name === 'ordo')).toBeUndefined()
    expect(warning).not.toHaveBeenCalled()
  })

  it('serializes an immediate reacquire behind the previous generation teardown', async () => {
    const ctx = await harness()
    const first = await ctx.plugin(OrdoAgentOpsPlugin)
    const firstDispose = first.dispose()
    const second = await ctx.plugin(OrdoAgentOpsPlugin)

    await firstDispose
    expect(ctx.get('ordoAgentOps')).toBeDefined()
    expect(ctx.commands.list(agent()).filter(command => command.name === 'ordo')).toHaveLength(1)

    await second.dispose()
    expect(ctx.get('ordoAgentOps')).toBeUndefined()
  })

  it.each([
    ['transport uncertainty', { decide: vi.fn().mockRejectedValue(new Error('transport unavailable')) }, 'still_unknown:', false],
    ['malformed settlement', { decide: vi.fn().mockResolvedValue({}) }, 'still_unknown:', false],
    ['explicit owner rejection', { decide: vi.fn(async () => ({ kind: 'rejected' as const, reason: 'stale' as const, safeMessage: 'Owner preview is stale.' })) }, 'rejected: stale.', true],
  ] as const)('preserves %s as a typed fail-closed command result', async (_name, actionSource, marker, rejected) => {
    const ctx = await harness({ snapshot: actionSnapshot }, actionSource)
    await ctx.plugin(OrdoAgentOpsPlugin)

    const execution = await ctx.commands.execute(agent(), '/ordo approve decision-1', new AbortController().signal)
    expect(execution?.result.text).toContain(marker)
    expect(execution?.result.text).not.toContain('owner_confirmed')
    if (rejected) expect(execution?.result.text).not.toContain('reconcile')
    else {
      expect(execution?.result.text).toContain('reconcile')
      expect(execution?.result.text).not.toContain('rejected:')
    }
  })

  it('previews reconcile with the server-authored descriptor and does not mutate', async () => {
    const decide = vi.fn()
    const ctx = await harness({ snapshot: reconcileSnapshot }, { decide })
    await ctx.plugin(OrdoAgentOpsPlugin)

    const execution = await ctx.commands.execute(agent(), '/ordo reconcile run-1', new AbortController().signal)
    expect(execution?.result).toEqual({
      kind: 'success',
      text: [
        'Conclusion: Owner action preview only; no mutation was submitted.',
        'Freshness / status: fresh; previewed; expires 2999-01-01T00:00:00.000Z.',
        'Safe refs / summary: target run-1; effect request owner reconciliation for the target; owner ordo-owner; decision reconcile-decision-1; preview_digest cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.',
        'Next action: Run /ordo approve reconcile-decision-1 before the preview expires.',
      ].join('\n'),
    })
    expect(decide).not.toHaveBeenCalled()
  })

  it.each([
    ['stale snapshot', { snapshot: () => ({ ...reconcileSnapshot(), state: 'stale' as const, freshness: 'stale' as const, reasonCode: 'context_stale' as const }) }, 'refresh before preview'],
    ['wrong owner reason', { snapshot: () => ({ ...reconcileSnapshot(), reasonCode: 'owner_snapshot' as const }) }, 'Only owner-marked reconcile_required resources'],
    ['expired descriptor', { snapshot: () => ({ ...reconcileSnapshot(), actions: reconcileSnapshot().actions?.map(action => ({ ...action, expiresAt: '2000-01-01T00:00:00.000Z' })) }) }, 'No current server-authored reconcile preview'],
  ] as const)('keeps reconcile closed for %s', async (_name, owner, reason) => {
    const ctx = await harness(owner)
    await ctx.plugin(OrdoAgentOpsPlugin)

    const execution = await ctx.commands.execute(agent(), '/ordo reconcile run-1', new AbortController().signal)
    expect(execution?.result.kind).toBe('error')
    expect(execution?.result.text).toContain(reason)
    expect(execution?.result.text).not.toContain('preview_digest')
  })

  it.each(['launch', 'cancel', 'redispatch'] as const)('keeps run %s unavailable', async operation => {
    const ctx = await harness()
    await ctx.plugin(OrdoAgentOpsPlugin)

    const execution = await ctx.commands.execute(agent(), `/ordo run ${operation}`, new AbortController().signal)
    expect(execution?.result.kind).toBe('error')
    expect(execution?.result.text).toContain(`not_available: run ${operation}.`)
    expect(execution?.result.text).not.toContain('owner_confirmed')
  })

  it('forwards the decision ref, preview digest, and complete expected context to the owner CAS boundary', async () => {
    const decide = vi.fn(async () => ({
      receiptRef: 'receipt-1' as never,
      state: 'accepted' as const,
      safeSummary: 'Owner accepted the reconciliation request.',
    }))
    const ctx = await harness({ snapshot: reconcileSnapshot }, { decide })
    await ctx.plugin(OrdoAgentOpsPlugin)

    const execution = await ctx.commands.execute(agent(), '/ordo approve reconcile-decision-1', new AbortController().signal)
    expect(execution?.result.kind).toBe('success')
    expect(decide).toHaveBeenCalledWith({
      decisionRef: 'reconcile-decision-1',
      previewDigest: 'c'.repeat(64),
      expectedContext: expectedContext(),
    })
    expect(execution?.result.text).toContain('receipt receipt-1; Owner accepted the reconciliation request.')
  })

  it('does not forward approve after the owner context drifts', async () => {
    const decide = vi.fn()
    const owner = {
      snapshot: () => ({
        ...reconcileSnapshot(),
        context: { ...expectedContext(), contextRevision: 2 },
      }),
    }
    const ctx = await harness(owner, { decide })
    await ctx.plugin(OrdoAgentOpsPlugin)

    const execution = await ctx.commands.execute(agent(), '/ordo approve reconcile-decision-1', new AbortController().signal)
    expect(execution?.result.kind).toBe('error')
    expect(execution?.result.text).toContain('not_available: approve.')
    expect(decide).not.toHaveBeenCalled()
  })

  it('renders a safe composition preview and exact owner handoff for qualify', async () => {
    const project = vi.fn(async (id: string) => ({
      schema: 'dsh.composition.preview.v0',
      preset: { id, trust: 'system', composition_stamp: { mtime_ms: 0, size: 1 }, generation: 1 },
      health: { shape_ok: true, mount_ok: true, provable_mount_ref: 'mount-1' },
      drift: { state: 'none' },
      composition: {
        tools: [{ name: 'safe-tool', schema_digest: 'a'.repeat(64), source: 'preset' }],
        prompt_sections: [{ id: 'system', section_digest: 'b'.repeat(64), source: 'preset' }],
        projection_units: [{ key: 'permissions', source: 'global' }],
        permissions: { sandbox_mode: 'workspace-write', approval_policy: 'ask', contrib_source: 'host' },
      },
      capability_digest: 'c'.repeat(64),
      generated_at: '2026-08-18T00:00:00.000Z',
    }))
    const ctx = await harness({ snapshot }, undefined, { project })
    await ctx.plugin(OrdoAgentOpsPlugin)

    const execution = await ctx.commands.execute(agent(), '/ordo qualify standard', new AbortController().signal)
    expect(execution?.result.kind).toBe('success')
    expect(execution?.result.text).toContain('target standard; effect owner-side qualification handoff; owner Ordo CLI; expiry not_applicable')
    expect(execution?.result.text).toContain('preview_digest cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')
    expect(execution?.result.text).toContain('Next action: Run ordo agent qualify standard --approve --events')
    expect(project).toHaveBeenCalledWith('standard')
  })

  it.each([
    ['owner missing', undefined, 'independent composition preview owner is not mounted'],
    ['owner error', { project: async () => { throw new Error('private owner detail') } }, 'did not return a readable projection'],
    ['contract mismatch', { project: vi.fn().mockResolvedValue({ preset: { id: 'standard' } }) }, 'did not match the safe DSH projection contract'],
    ['unsafe nested projection', { project: vi.fn().mockResolvedValue({
      schema: 'dsh.composition.preview.v0',
      preset: { id: 'standard', trust: 'system', composition_stamp: { mtime_ms: 0, size: 1 }, generation: 1 },
      health: { shape_ok: true, mount_ok: true, provable_mount_ref: 'mount-1' },
      drift: { state: 'none' },
      composition: {
        tools: [{ name: 'safe-tool', schema_digest: 'a'.repeat(64), source: 'preset', text: 'private prompt' }],
        prompt_sections: [],
        projection_units: [],
        permissions: { sandbox_mode: 'workspace-write', approval_policy: 'ask', contrib_source: 'host' },
      },
      capability_digest: 'c'.repeat(64),
      generated_at: '2026-08-18T00:00:00.000Z',
    }) }, 'did not match the safe DSH projection contract'],
  ] as const)('keeps qualify closed for %s', async (_name, composition, reason) => {
    const ctx = await harness({ snapshot }, undefined, composition)
    await ctx.plugin(OrdoAgentOpsPlugin)

    const execution = await ctx.commands.execute(agent(), '/ordo qualify standard', new AbortController().signal)
    expect(execution?.result.kind).toBe('error')
    expect(execution?.result.text).toContain(reason)
    expect(execution?.result.text).not.toMatch(/private|https?:|\/(?:srv|home)\b/iu)
  })
})

describe('package contract', () => {
  it('declares only the unified Ordo package in the patch', async () => {
    const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
      dependencies: Record<string, string>
    }
    const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')

    expect(manifest.dependencies).toEqual({
      '@yeisme/dsh-client-ui-surface': 'workspace:^',
      zod: '^4.4.3',
    })
    expect(patch).toContain("name: '@yeisme/dsh-ordo-agent-ops'")
    expect(patch).not.toMatch(/dsh-host-ordo-agent-ops|dsh-host-ordo-commands|dsh-client-ui-ordo-agent-ops|dsh-agent-composition-preview/)
  })

  it('contains no AionUI/Web Shell DOM interception contract', async () => {
    const client = await readFile(new URL('../src/client/sidebar.tsx', import.meta.url), 'utf8')
    const allSource = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')
    expect(`${client}\n${allSource}`).not.toMatch(/data-dsh-frame|gridTemplateColumns|MutationObserver|aionui-panel|\/aionui-panel\//iu)
  })
})
