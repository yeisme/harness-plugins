/**
 * Consumer import of the shipped host fetch/projection (not the adapter's
 * own test file). Drives createLocalOrdoCliOwner + OrdoAgentOpsGateway.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  OrdoAgentOpsGateway,
  ORDO_AGENT_OPS_EXPECTED_CONTEXT,
  createLocalOrdoCliOwner,
} from '@yeisme/dsh-ordo-agent-ops/src/index.ts'

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
    facts: { team_count: teams.length },
    actions: [],
    evidence: [],
    data: { teams },
    error: null,
  })
}

describe('consumer import of local ordo CLI owner', () => {
  it('returns projected run facts from a successful CLI envelope', async () => {
    const calls: string[][] = []
    const owner = createLocalOrdoCliOwner({
      exec: (argv) => {
        calls.push([...argv])
        if (argv[0] === 'doctor') {
          return {
            status: 0,
            stdout: JSON.stringify({
              spec_version: '1.0', mode: 'json', command: 'doctor.run', status: 'success',
              facts: {}, actions: [], evidence: ['evidence:doctor'], data: { evidence: { status: 'ok' } }, error: null,
            }),
          }
        }
        if (argv[0] === 'approval' && argv[1] === 'inspect' && argv[2] === 'preview.deliver.execute.1' && argv[3] === '--json') {
          return {
            status: 0,
            stdout: JSON.stringify({
              spec_version: '1.0', mode: 'json', command: 'approval.inspect', status: 'success',
              facts: {
                preview_ref: 'preview.deliver.execute.1',
                operation_id: 'deliver.execute',
                expires_at: '2999-01-01T00:00:00.000Z',
                redacted_summary: 'Approve bound delivery execute',
              },
              actions: [], evidence: [], data: {}, error: null,
            }),
          }
        }
        if (argv[0] === 'approval') {
          return { status: 2, stdout: JSON.stringify({ status: 'failed', error: { code: 'invalid_args' } }) }
        }
        return {
          status: 0,
          stdout: envelope([{
            team_id: 'team.consumer',
            description: 'Consumer board',
            status: 'active',
            members: [{ name: 'writer-a', role: 'writer', status: 'working' }],
            tasks: [
              { task_id: 't1', subject: 'Outline', status: 'in_progress', mode: 'write', dependencies: [], assignee: 'writer-a' },
              { task_id: 't2', subject: 'Done', status: 'completed', mode: 'read_only', dependencies: [] },
            ],
            policy: { max_writers: 1, max_concurrent_members: 2 },
            evidence_refs: ['ev-consumer'],
            preview_ref: 'preview.deliver.execute.1',
          }]),
        }
      },
      now: () => NOW,
    })
    const ctx = new Context()
    contexts.push(ctx)
    ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, owner.expectedContext)
    ctx.provide('ordoAgentOpsOwner', owner)
    await ctx.plugin(OrdoAgentOpsGateway)
    const snapshot = (ctx.get('ordoAgentOps') as OrdoAgentOpsGateway).snapshot()
    expect(snapshot.state).toBe('ready')
    expect(snapshot.run).toEqual({
      runRef: 'team.consumer',
      state: 'active',
      safeTitle: 'Consumer board',
      taskCount: 2,
      completedTaskCount: 1,
      attentionCount: 0,
    })
    expect(owner.teamSnapshot()?.tasks.map(task => task.title)).toEqual(['Outline', 'Done'])
    expect(snapshot.evidenceRefs).toEqual(expect.arrayContaining(['ev-consumer', 'evidence:doctor', 'evidence:ok']))
    expect(snapshot.actions?.[0]).toMatchObject({
      actionType: 'ordo.approval.decide',
      decisionRef: 'preview.deliver.execute.1',
      safeEffect: 'Approve bound delivery execute',
    })
    expect(calls).toEqual([
      ['team', 'status', '--json'],
      ['doctor', '--json'],
      ['approval', 'inspect', 'preview.deliver.execute.1', '--json'],
    ])
  })

  it('returns the unavailable reason when the CLI binary is missing', async () => {
    const owner = createLocalOrdoCliOwner({
      exec: () => ({ status: null, stdout: '', errorCode: 'ENOENT' }),
      now: () => NOW,
    })
    const ctx = new Context()
    contexts.push(ctx)
    ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, owner.expectedContext)
    ctx.provide('ordoAgentOpsOwner', owner)
    await ctx.plugin(OrdoAgentOpsGateway)
    const snapshot = (ctx.get('ordoAgentOps') as OrdoAgentOpsGateway).snapshot()
    expect(snapshot.state).toBe('offline')
    expect(snapshot.safeMessage).toBe('Local ordo CLI is not available.')
    expect(snapshot.run).toBeUndefined()
    expect(snapshot.capacity).toBeUndefined()
    expect(owner.teamSnapshot()).toBeUndefined()
  })
})
