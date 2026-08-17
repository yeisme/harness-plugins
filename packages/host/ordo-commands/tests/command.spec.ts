import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import type { Agent } from '@deepseek-ai/dsh-agent'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import {
  OrdoAgentOpsGateway,
  ORDO_AGENT_OPS_EXPECTED_CONTEXT,
  type OrdoAgentOpsExpectedContext,
  type OrdoAgentOpsOwnerSource,
  type OrdoAgentOpsSnapshot,
} from '@yeisme/dsh-ordo-agent-ops'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import * as LegacyHost from '../../ordo-agent-ops/src/index.ts'
import * as OrdoCommands from '../src/index.ts'
import * as OrdoCommandsInvariant from '../src/invariant.ts'
import { parseOrdoCommand, parseSafeOrdoRef } from '../src/parser.ts'

const contexts: Context[] = []
let loaderRoot: string | undefined

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  if (loaderRoot !== undefined) await rm(loaderRoot, { recursive: true, force: true })
  loaderRoot = undefined
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

function snapshot(overrides: Partial<OrdoAgentOpsSnapshot> = {}): OrdoAgentOpsSnapshot {
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

function agent(id = 'ordo-command'): Agent {
  return {
    session: Session.create(SessionId(id)),
    status: 'idle',
    options: {},
    reserveTurnAdmission: () => () => undefined,
  } as unknown as Agent
}

async function harness(owner?: OrdoAgentOpsOwnerSource): Promise<{
  readonly ctx: Context
  readonly agent: Agent
  readonly plugin: Awaited<ReturnType<Context['plugin']>>
}> {
  const ctx = new Context()
  contexts.push(ctx)
  ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, expectedContext())
  if (owner !== undefined) ctx.provide('ordoAgentOpsOwner', owner)
  await ctx.plugin(CommandRuntime)
  await ctx.plugin(OrdoAgentOpsGateway)
  const plugin = await ctx.plugin(OrdoCommands)
  return { ctx, agent: agent(`ordo-command-${Math.random()}`), plugin }
}

async function run(test: Awaited<ReturnType<typeof harness>>, suffix = ''): Promise<NonNullable<Awaited<ReturnType<CommandRuntime['execute']>>>> {
  const execution = await test.ctx.commands.execute(test.agent, `/ordo${suffix}`, new AbortController().signal)
  if (execution === undefined) throw new Error('ordo command was not registered')
  return execution
}

function noFacts(text: string): void {
  expect(text).toContain('No run or capacity facts are available from this snapshot.')
  expect(text).not.toMatch(/Run run-|Capacity: policy cap/u)
}

function expectLifecycle(test: Awaited<ReturnType<typeof harness>>, args: string): void {
  const events = test.agent.session.events.slice(-2)
  expect(events.map(event => event.type)).toEqual(['command/run', 'command/done'])
  const runEvent = events[0]
  const doneEvent = events[1]
  if (runEvent?.type !== 'command/run' || doneEvent?.type !== 'command/done') throw new Error('missing command lifecycle')
  expect(runEvent.data).toMatchObject({ name: 'ordo', args, source: { kind: 'user' } })
  expect(doneEvent.data.commandId).toBe(runEvent.data.commandId)
  expect(test.agent.session.deriveMessages()).toEqual([])
}

describe('/ordo parser', () => {
  it.each([
    ['', { kind: 'overview' }],
    [' help', { kind: 'help' }],
    [' status', { kind: 'status' }],
    [' status run-1', { kind: 'status', ref: 'run-1' }],
    [' preview run-1', { kind: 'preview', ref: 'run-1' }],
    [' capacity', { kind: 'capacity' }],
  ])('accepts the read-only grammar %j', (input, expected) => {
    expect(parseOrdoCommand(input)).toEqual(expected)
  })

  it.each([
    [' preview', 'missing-ref'],
    [' help extra', 'extra-arguments'],
    [' capacity extra', 'extra-arguments'],
    [' status run-1 extra', 'extra-arguments'],
    [' status undefined', 'unsafe-ref'],
    [' status /srv/private', 'unsafe-ref'],
    [' status https://owner.invalid/run', 'unsafe-ref'],
    [' status run\u0000bad', 'unsafe-ref'],
    [' launch run-1', 'unknown'],
  ] as const)('rejects %j as %s', (input, error) => {
    expect(parseOrdoCommand(input)).toEqual({ kind: 'invalid', error })
  })

  it('accepts only non-path opaque reference tokens', () => {
    expect(parseSafeOrdoRef('run_1.2-3')).toBe('run_1.2-3')
    expect(parseSafeOrdoRef('')).toBeUndefined()
    expect(parseSafeOrdoRef('../run')).toBeUndefined()
    expect(parseSafeOrdoRef('file:///run')).toBeUndefined()
    expect(parseSafeOrdoRef('undefined')).toBeUndefined()
  })
})

describe('@yeisme/dsh-host-ordo-commands registration', () => {
  it('registers one Loader-safe command, validates the source relation, and disposes it', async () => {
    const test = await harness({ snapshot })
    expect(OrdoCommands.name).toBe('host-ordo-commands')
    expect(OrdoCommands.inject).toEqual(['commands', 'ordoAgentOps'])
    expect(OrdoCommandsInvariant.inject).toEqual(['invariants'])
    const loader = Object.create(Loader.prototype) as Loader
    expect(loader.unwrapExports(OrdoCommands)).toBe(OrdoCommands.default)
    expect(test.ctx.commands.list(test.agent)).toContainEqual({
      name: 'ordo',
      description: 'read or safely preview the Ordo Agent Ops projection',
      input: { hint: '[help|status [safe-ref]|preview <safe-ref>|capacity|qualify <preset-id>|reconcile <safe-ref>|approve <decision-ref>]' },
    })
    expect(OrdoCommands.hasOrdoCommandRegistration(test.ctx)).toBe(true)

    await test.ctx.plugin(InvariantRegistry)
    await expect(test.ctx.plugin(OrdoCommandsInvariant).await()).resolves.toBeDefined()

    await test.plugin.dispose()
    expect(test.ctx.commands.find(test.agent, 'ordo')).toBeUndefined()
    expect(OrdoCommands.hasOrdoCommandRegistration(test.ctx)).toBe(false)
  })

  it('boots the actual Loader composition and returns the owner-gated summary', async () => {
    loaderRoot = await mkdtemp(join(tmpdir(), 'dsh-ordo-command-loader-'))
    const configPath = join(loaderRoot, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@deepseek-ai/dsh-commands'",
      "- name: '@yeisme/dsh-host-ordo-agent-ops'",
      "- name: '@yeisme/dsh-host-ordo-commands'",
      '',
    ].join('\n'))

    const ctx = new Context()
    contexts.push(ctx)
    ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, expectedContext())
    ctx.baseUrl = pathToFileURL(loaderRoot).href + '/'
    await ctx.plugin(Loader)
    ctx.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@deepseek-ai/dsh-commands', CommandRuntime],
      ['@yeisme/dsh-host-ordo-agent-ops', LegacyHost],
      ['@yeisme/dsh-host-ordo-commands', OrdoCommands],
    ])
    ctx.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof ctx.loader.internal>
    await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await ctx.loader.await()

    const owner = agent('ordo-loader')
    expect(ctx.commands.list(owner).map(command => command.name)).toContain('ordo')
    const execution = await ctx.commands.execute(owner, '/ordo status', new AbortController().signal)
    expect(execution?.result).toMatchObject({ kind: 'success' })
    expect(execution?.result.text).toContain('needs_contract; owner_read_contract_unavailable.')
    noFacts(execution?.result.text ?? '')
  })
})

describe('/ordo read-only command', () => {
  it('returns four-part help and precise syntax errors without reflecting unsafe input', async () => {
    const test = await harness()
    const help = await run(test, ' help')
    expect(help.result).toEqual({
      kind: 'success',
      text: [
        'Conclusion: Read-only Ordo command help.',
        'Freshness / status: needs_contract; owner_read_contract_unavailable.',
        'Safe refs / summary: Usage: /ordo [help|status [safe-ref]|preview <safe-ref>|capacity|qualify <preset-id>|reconcile <safe-ref>|approve <decision-ref>|run <launch|cancel|redispatch>]',
        'Next action: Run /ordo status to read the mounted owner snapshot.',
      ].join('\n'),
    })
    expectLifecycle(test, ' help')

    for (const suffix of [' launch', ' preview', ' status /srv/private Bearer token']) {
      const rejected = await run(test, suffix)
      expect(rejected.result.kind).toBe('error')
      expect(rejected.result.text).toContain('Usage: /ordo')
      expect(rejected.result.text).not.toMatch(/srv|Bearer|token|https?:/iu)
    }
  })

  it('fails closed with needs_contract and never emits unmounted owner facts', async () => {
    const test = await harness()
    const result = await run(test, ' status')
    expect(result.result.kind).toBe('success')
    expect(result.result.text).toContain('needs_contract; owner_read_contract_unavailable.')
    noFacts(result.result.text ?? '')
    expectLifecycle(test, ' status')
  })

  it('renders a ready status and capacity from the one snapshot source', async () => {
    const test = await harness({ snapshot })
    const status = await run(test, ' status run-1')
    expect(status.result).toEqual({
      kind: 'success',
      text: [
        'Conclusion: Read-only Ordo status summary.',
        'Freshness / status: fresh; ready; owner_snapshot.',
        'Safe refs / summary: Run run-1: active; Safe run summary; tasks 1/3; attention 1.',
        'Next action: Run /ordo capacity to view safe capacity facts.',
      ].join('\n'),
    })
    expectLifecycle(test, ' status run-1')

    const capacity = await run(test, ' capacity')
    expect(capacity.result.text).toContain('Capacity: policy cap 2; observed or retained 1; qualified routes 1; reservation not_reserved.')
    expectLifecycle(test, ' capacity')
  })

  it('does not turn an unmatched safe reference into a fabricated run fact', async () => {
    const test = await harness({ snapshot })
    const result = await run(test, ' status different-run')
    expect(result.result.text).toContain('No matching safe reference is available from this snapshot.')
    expect(result.result.text).not.toContain('Run run-1')
  })

  it('reports preview as needs_contract without reading or inventing composition facts', async () => {
    const test = await harness({ snapshot })
    const result = await run(test, ' preview run-1')
    expect(result.result).toEqual({
      kind: 'success',
      text: [
        'Conclusion: Read-only composition preview is unavailable.',
        'Freshness / status: needs_contract; owner_read_contract_unavailable.',
        'Safe refs / summary: No composition preview facts are mounted in this DSH runtime.',
        'Next action: Run /ordo status to read the mounted owner snapshot.',
      ].join('\n'),
    })
    expect(result.result.text).not.toMatch(/run-1|Capacity|provider|https?:/iu)
  })

  it.each([
    ['stale', { snapshot: () => snapshot({ state: 'stale', freshness: 'stale', reasonCode: 'context_stale' }) }, 'stale; stale; context_stale.', false],
    ['offline', { snapshot: () => { throw new Error('Bearer provider secret') } }, 'offline; offline; owner_projection_unavailable.', true],
    ['permission denied', { snapshot: () => {
      const { run: _run, capacity: _capacity, ...denied } = snapshot({
        state: 'permission_denied', freshness: 'offline', reasonCode: 'permission_denied',
      })
      return denied
    } }, 'offline; permission_denied; permission_denied.', true],
    ['contract mismatch', { snapshot: () => snapshot({ context: expectedContext({ installationRef: 'installation-drift' as never }) }) }, 'stale; contract_mismatch; contract_mismatch.', true],
  ] as const)('preserves the %s fail-closed/read state without unsafe facts', async (_name, owner, status, expectNoFacts) => {
    const test = await harness(owner)
    const result = await run(test, ' status')
    expect(result.result.text).toContain(status)
    if (expectNoFacts) noFacts(result.result.text ?? '')
    expect(result.result.text).not.toMatch(/https?:|Bearer|secret|provider|installation-drift|\/srv/u)
  })

  it('rejects an unsafe owner projection before it can reach command text', async () => {
    const test = await harness({
      snapshot: () => snapshot({
        safeMessage: 'Bearer token at https://owner.invalid/srv/private',
      }),
    })
    const result = await run(test, ' status')
    expect(result.result.text).toContain('contract_mismatch; contract_mismatch.')
    noFacts(result.result.text ?? '')
    expect(result.result.text).not.toMatch(/https?:|Bearer|token|srv|private/u)
  })
})
