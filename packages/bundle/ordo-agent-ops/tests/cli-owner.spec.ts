import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  OrdoAgentOpsGateway,
  ORDO_AGENT_OPS_EXPECTED_CONTEXT,
  ORDO_AGENT_OPS_OWNER_SOURCE,
  createLocalOrdoCliOwner,
  type OrdoCliExecResult,
} from '../src/index.ts'

const NOW = '2026-09-01T12:00:00.000Z'
const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

function envelope(teams: unknown[]): string {
  return JSON.stringify({
    spec_version: '1.0',
    mode: 'json',
    command: 'team.status',
    status: 'success',
    summary: `${teams.length} agent team(s).`,
    facts: { team_count: teams.length },
    actions: [],
    evidence: [],
    data: { teams },
    error: null,
  })
}

const LIVE_TEAM = {
  schema_version: 'ordo.agent_team.v0',
  team_id: 'team.demo',
  description: 'Review delivery',
  captain: 'captain',
  status: 'active',
  members: [
    { schema_version: 'ordo.agent_team_member.v0', name: 'writer-a', role: 'writer', runtime_id: 'codex', status: 'working', added_at: NOW },
    { schema_version: 'ordo.agent_team_member.v0', name: 'reviewer-b', role: 'reviewer', runtime_id: 'claude', status: 'idle', added_at: NOW },
  ],
  tasks: [
    { schema_version: 'ordo.agent_team_task.v0', task_id: 't1', subject: 'Draft outline', status: 'in_progress', mode: 'write', dependencies: [], owned_paths: [], workspace_mode: 'none', assignee: 'writer-a', created_at: NOW, updated_at: NOW },
    { schema_version: 'ordo.agent_team_task.v0', task_id: 't2', subject: 'Review copy', status: 'pending', mode: 'read_only', dependencies: ['t1'], owned_paths: [], workspace_mode: 'none', created_at: NOW, updated_at: NOW },
    { schema_version: 'ordo.agent_team_task.v0', task_id: 't3', subject: 'Ship notes', status: 'completed', mode: 'read_only', dependencies: [], owned_paths: [], workspace_mode: 'none', created_at: NOW, updated_at: NOW },
  ],
  policy: { max_writers: 1, max_concurrent_members: 2, member_timeout_ms: 1000 },
  created_at: NOW,
  updated_at: NOW,
  evidence_refs: ['ev-1'],
  preview_ref: 'preview.deliver.execute.1',
}

function execOk(stdout: string): () => OrdoCliExecResult {
  return () => ({ status: 0, stdout })
}

function doctorEnvelope(): string {
  return JSON.stringify({
    spec_version: '1.0',
    mode: 'json',
    command: 'doctor.run',
    status: 'success',
    facts: { health: 'ready' },
    actions: [],
    evidence: ['evidence:doctor'],
    data: { evidence: { status: 'ok' } },
    error: null,
  })
}

function approvalEnvelope(): string {
  return JSON.stringify({
    spec_version: '1.0',
    mode: 'json',
    command: 'approval.inspect',
    status: 'success',
    facts: {
      preview_ref: 'preview.deliver.execute.1',
      operation_id: 'deliver.execute',
      effect: 'local_write',
      policy_revision: 3,
      expires_at: '2999-01-01T00:00:00.000Z',
      redacted_summary: 'Approve bound delivery execute',
    },
    actions: [],
    evidence: [],
    data: { preview_ref: 'preview.deliver.execute.1' },
    error: null,
  })
}

function isApprovalInspect(argv: readonly string[], previewRef: string): boolean {
  return argv[0] === 'approval' && argv[1] === 'inspect' && argv[2] === previewRef && argv[3] === '--json'
}

function routedExec(teamStdout: string): (argv: readonly string[]) => OrdoCliExecResult {
  return (argv) => {
    if (argv[0] === 'doctor') return { status: 0, stdout: doctorEnvelope() }
    if (isApprovalInspect(argv, 'preview.deliver.execute.1')) return { status: 0, stdout: approvalEnvelope() }
    if (argv[0] === 'approval') {
      return { status: 2, stdout: JSON.stringify({ status: 'failed', error: { code: 'invalid_args' } }) }
    }
    return { status: 0, stdout: teamStdout }
  }
}

async function gatewayWith(owner: ReturnType<typeof createLocalOrdoCliOwner>): Promise<OrdoAgentOpsGateway> {
  const ctx = new Context()
  contexts.push(ctx)
  ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, owner.expectedContext)
  ctx.provide(ORDO_AGENT_OPS_OWNER_SOURCE, owner)
  await ctx.plugin(OrdoAgentOpsGateway)
  return ctx.get('ordoAgentOps') as OrdoAgentOpsGateway
}

describe('createLocalOrdoCliOwner', () => {
  it('projects live CLI team facts into the frozen Agent Ops snapshot', async () => {
    const owner = createLocalOrdoCliOwner({ exec: routedExec(envelope([LIVE_TEAM])), now: () => NOW })
    const gateway = await gatewayWith(owner)
    const snapshot = gateway.snapshot()
    expect(snapshot).toMatchObject({
      state: 'ready',
      freshness: 'fresh',
      reasonCode: 'owner_snapshot',
      source: 'owner',
      run: {
        runRef: 'team.demo',
        state: 'active',
        safeTitle: 'Review delivery',
        taskCount: 3,
        completedTaskCount: 1,
        attentionCount: 0,
      },
      capacity: {
        policyCap: 2,
        observedOrRetained: 2,
        qualifiedRoutes: 2,
        reservationState: 'not_reserved',
      },
    })
    expect(snapshot.evidenceRefs).toEqual(expect.arrayContaining(['ev-1', 'evidence:doctor', 'evidence:ok']))
    expect(snapshot.actions?.[0]).toMatchObject({
      actionType: 'ordo.approval.decide',
      decisionRef: 'preview.deliver.execute.1',
      targetRef: 'deliver.execute',
      safeEffect: 'Approve bound delivery execute',
    })
    const team = owner.teamSnapshot()
    expect(team?.tasks.map(task => task.taskRef)).toEqual(['t1', 't2', 't3'])
    expect(team?.tasks[0]).toMatchObject({ title: 'Draft outline', state: 'running', criticality: 'critical', assigneeRef: 'writer-a' })
    expect(team?.evidenceRefs).toEqual(expect.arrayContaining(['ev-1']))
    expect(owner.capability()).toEqual({ capability: 'ordo.team.v1', maturity: 'readonly' })
  })

  it('reports CLI missing as offline with no demo rows', async () => {
    const owner = createLocalOrdoCliOwner({
      exec: () => ({ status: null, stdout: '', errorCode: 'ENOENT' }),
      now: () => NOW,
    })
    const gateway = await gatewayWith(owner)
    const snapshot = gateway.snapshot()
    expect(snapshot).toMatchObject({
      state: 'offline',
      freshness: 'offline',
      reasonCode: 'owner_projection_unavailable',
      safeMessage: 'Local ordo CLI is not available.',
    })
    expect(snapshot).not.toHaveProperty('run')
    expect(snapshot).not.toHaveProperty('capacity')
    expect(snapshot).not.toHaveProperty('actions')
    expect(owner.teamSnapshot()).toBeUndefined()
    expect(owner.capability().maturity).toBe('unavailable')
  })

  it('reports a failed CLI command as offline without inventing records', async () => {
    const owner = createLocalOrdoCliOwner({
      exec: () => ({ status: 2, stdout: '{"status":"failed"}' }),
      now: () => NOW,
    })
    const snapshot = owner.snapshot()
    expect(snapshot.state).toBe('offline')
    expect(snapshot.safeMessage).toBe('Local ordo CLI read failed.')
    expect(snapshot.run).toBeUndefined()
  })

  it('rejects unsafe refs, credentials, and absolute paths from the CLI envelope', async () => {
    const unsafe = {
      ...LIVE_TEAM,
      team_id: '/srv/private/worktree',
      description: 'Bearer provider secret at /etc/passwd',
    }
    const owner = createLocalOrdoCliOwner({ exec: execOk(envelope([unsafe])), now: () => NOW })
    const gateway = await gatewayWith(owner)
    const snapshot = gateway.snapshot()
    expect(snapshot.state).toBe('offline')
    expect(snapshot.safeMessage).not.toMatch(/secret|Bearer|passwd|srv|https?:/i)
    expect(snapshot).not.toHaveProperty('run')
    expect(owner.teamSnapshot()).toBeUndefined()
  })

  it('invokes approval inspect only with a CLI-authored preview-ref', () => {
    const calls: string[][] = []
    const snapshot = createLocalOrdoCliOwner({
      exec: (argv) => {
        calls.push([...argv])
        return routedExec(envelope([LIVE_TEAM]))(argv)
      },
      now: () => NOW,
    }).snapshot()
    expect(calls).toEqual([
      ['team', 'status', '--json'],
      ['doctor', '--json'],
      ['approval', 'inspect', 'preview.deliver.execute.1', '--json'],
    ])
    expect(snapshot.actions?.[0]?.decisionRef).toBe('preview.deliver.execute.1')
  })

  it('skips approval inspect when no CLI-authored preview-ref exists', () => {
    const calls: string[][] = []
    const { preview_ref: _previewRef, ...teamWithoutPreview } = LIVE_TEAM
    void _previewRef
    const snapshot = createLocalOrdoCliOwner({
      exec: (argv) => {
        calls.push([...argv])
        return routedExec(envelope([teamWithoutPreview]))(argv)
      },
      now: () => NOW,
    }).snapshot()
    expect(calls).toEqual([
      ['team', 'status', '--json'],
      ['doctor', '--json'],
    ])
    expect(snapshot.actions).toBeUndefined()
    expect(snapshot.state).toBe('ready')
  })
})
