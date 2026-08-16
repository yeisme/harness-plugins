import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import OrdoAgentOpsPlugin, {
  applyLegacyCommands,
  applyLegacyHostBridge,
  ORDO_AGENT_OPS_EXPECTED_CONTEXT,
  type OrdoAgentOpsExpectedContext,
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

function agent(): Agent {
  return {
    session: Session.create(SessionId('unified-ordo')),
    status: 'idle',
    options: {},
    reserveTurnAdmission: () => () => undefined,
  } as unknown as Agent
}

async function harness(): Promise<Context> {
  const ctx = new Context()
  contexts.push(ctx)
  ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, expectedContext())
  ctx.provide('ordoAgentOpsOwner', { snapshot } satisfies OrdoAgentOpsOwnerSource)
  await ctx.plugin(CommandRuntime)
  return ctx
}

describe('@yeisme/dsh-ordo-agent-ops Host consolidation', () => {
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
})

describe('package contract', () => {
  it('declares only the unified package and independent composition preview in the patch', async () => {
    const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
      dependencies: Record<string, string>
    }
    const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')

    expect(manifest.dependencies).toEqual({
      '@yeisme/dsh-agent-composition-preview': 'workspace:^',
      zod: '^4.4.3',
    })
    expect(patch).toContain("name: '@yeisme/dsh-ordo-agent-ops'")
    expect(patch).toContain("name: '@yeisme/dsh-agent-composition-preview'")
    expect(patch).not.toMatch(/dsh-host-ordo-agent-ops|dsh-host-ordo-commands|dsh-client-ui-ordo-agent-ops/)
  })

  it('contains no AionUI/Web Shell DOM interception contract', async () => {
    const client = await readFile(new URL('../src/client/sidebar.tsx', import.meta.url), 'utf8')
    const allSource = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')
    expect(`${client}\n${allSource}`).not.toMatch(/data-dsh-frame|gridTemplateColumns|MutationObserver|aionui-panel|\/aionui-panel\//iu)
  })
})
