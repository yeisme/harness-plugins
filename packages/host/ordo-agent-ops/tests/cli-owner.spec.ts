import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  OrdoAgentOpsGateway,
  ORDO_AGENT_OPS_EXPECTED_CONTEXT,
  createLocalOrdoCliOwner,
  type OrdoAgentOpsOwnerSource,
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

describe('host shim CLI owner through OrdoAgentOpsGateway', () => {
  it('forwards a successful CLI projection through the shipped gateway', async () => {
    const owner = createLocalOrdoCliOwner({
      exec: (argv) => {
        if (argv[0] === 'doctor') return { status: 1, stdout: '' }
        if (argv[0] === 'approval') {
          return { status: 2, stdout: JSON.stringify({ status: 'failed', error: { code: 'invalid_args' } }) }
        }
        return {
          status: 0,
          stdout: envelope([{
            team_id: 'team.live',
            description: 'Duty board',
            status: 'active',
            members: [{ name: 'writer-a', role: 'writer', status: 'working' }],
            tasks: [
              { task_id: 't1', subject: 'Outline', status: 'in_progress', mode: 'write', dependencies: [], assignee: 'writer-a' },
              { task_id: 't2', subject: 'Done', status: 'completed', mode: 'read_only', dependencies: [] },
            ],
            policy: { max_writers: 1, max_concurrent_members: 2 },
            evidence_refs: ['ev-live'],
          }]),
        }
      },
      now: () => NOW,
    })
    const ctx = new Context()
    contexts.push(ctx)
    ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, owner.expectedContext)
    ctx.provide('ordoAgentOpsOwner', owner satisfies OrdoAgentOpsOwnerSource)
    await ctx.plugin(OrdoAgentOpsGateway)
    const snapshot = (ctx.get('ordoAgentOps') as OrdoAgentOpsGateway).snapshot()
    expect(snapshot.state).toBe('ready')
    expect(snapshot.run).toMatchObject({
      runRef: 'team.live',
      safeTitle: 'Duty board',
      taskCount: 2,
      completedTaskCount: 1,
    })
    expect(snapshot.evidenceRefs).toEqual(['ev-live'])
  })

  it('forwards CLI unavailability as offline without demo facts', async () => {
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
    expect(snapshot).toMatchObject({
      state: 'offline',
      reasonCode: 'owner_projection_unavailable',
      safeMessage: 'Local ordo CLI is not available.',
    })
    expect(snapshot.run).toBeUndefined()
    expect(snapshot.capacity).toBeUndefined()
  })
})
