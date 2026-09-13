import { describe, expect, it, vi } from 'vitest'
import { ProjectController } from '../src/client/project-controller.ts'
import { ProjectSnapshotSchema, type ProjectRemote, type ProjectSnapshot } from '../src/project-contract.ts'
import { OrdoProjectOwner } from '../src/host/project-owner.ts'
import { Context } from '@deepseek-ai/cordis'
import { OrdoAgentOpsGateway, ORDO_AGENT_OPS_EXPECTED_CONTEXT } from '../src/host/bridge.ts'

function snapshot(projectRef = 'project.a', version = 'a'.repeat(64)): ProjectSnapshot {
  return { schemaVersion: 'ordo.project_ops.snapshot.v1', projectRef, version, generatedAt: '2026-09-12T00:00:00.000Z', freshness: 'fresh',
    runs: [{ ref: 'plan.a', title: 'Plan A', state: 'current', kind: 'plan', planRef: 'plan-a@1' }], tasks: [], agents: [], events: [], limitations: [], window: { eventLimit: 200, truncated: false },
    actions: [{ id: 'plan.approve', targetRef: 'plan.a', confirmation: true }],
  }
}
function remote(data = snapshot()): ProjectRemote {
  return { projects: vi.fn(async () => ({ projects: [{ ref: data.projectRef, title: 'A' }] })), projectSnapshot: vi.fn(async () => data),
    projectEvents: vi.fn(async () => ({ projectRef: data.projectRef, cursor: data.version, changed: false, refetch: false, events: [], window: data.window })),
    projectInvoke: vi.fn(async request => ({ schemaVersion: 'ordo.project_ops.receipt.v1', ref: 'receipt.a', requestId: request.requestId, action: request.action, targetRef: request.targetRef, projectRef: request.projectRef, state: 'accepted', reason: 'owner_accepted' })),
  }
}
describe('project controller and boundary', () => {
  it('the Remote rejects missing or changed host context before exposing project facts', async () => {
    const ctx = new Context()
    const source = vi.spyOn(OrdoProjectOwner.prototype, 'projects').mockResolvedValue({ projects: [] })
    const gateway = new OrdoAgentOpsGateway(ctx)
    try {
      await expect(gateway.projects()).rejects.toThrow('project_context_unavailable')
      expect(source).not.toHaveBeenCalled()
    } finally { source.mockRestore(); await ctx.fiber.dispose() }
  })

  it('a context removed during an owner read prevents a late response from crossing the Remote', async () => {
    const ctx = new Context()
    const remove = ctx.provide(ORDO_AGENT_OPS_EXPECTED_CONTEXT, { tenantRef: 'local', workspaceRef: 'local-workspace', principalRef: 'local-operator', contextRevision: 1, installationRef: 'dsh-ordo-agent-ops' })
    let complete!: (value: { projects: [] }) => void
    const source = vi.spyOn(OrdoProjectOwner.prototype, 'projects').mockImplementation(() => new Promise(resolve => { complete = resolve }))
    const gateway = new OrdoAgentOpsGateway(ctx)
    try {
      const pending = gateway.projects()
      remove()
      complete({ projects: [] })
      await expect(pending).rejects.toThrow('project_context_unavailable')
    } finally { source.mockRestore(); await ctx.fiber.dispose() }
  })

  it('does not apply a previous connection generation after reset', async () => {
    const resolves: ((data: ProjectSnapshot) => void)[] = []
    const api = remote(); api.projectSnapshot = () => new Promise(resolve => { resolves.push(resolve) })
    const controller = new ProjectController(api, 'project.a'); const first = controller.load()
    controller.reset()
    resolves[1]!(snapshot('project.a', 'b'.repeat(64))); await controller.load()
    resolves[0]!(snapshot()); await first
    expect(controller.getSnapshot().snapshot?.version).toBe('b'.repeat(64)); controller.dispose()
  })

  it('rejects private fields and mismatched project snapshots', async () => {
    expect(ProjectSnapshotSchema.safeParse({ ...snapshot(), root: '/private/project' }).success).toBe(false)
    const controller = new ProjectController(remote(snapshot('project.b')), 'project.a')
    await controller.load()
    expect(controller.getSnapshot().phase).toBe('offline')
    expect(controller.getSnapshot().snapshot).toBeUndefined()
    controller.dispose()
  })
  it('ignores late results after disposal and keeps projects isolated', async () => {
    let complete!: (data: ProjectSnapshot) => void
    const aRemote = remote(); aRemote.projectSnapshot = () => new Promise(resolve => { complete = resolve })
    const a = new ProjectController(aRemote, 'project.a'); const pending = a.load(); a.dispose()
    const b = new ProjectController(remote(snapshot('project.b')), 'project.b'); await b.load()
    complete(snapshot()); await pending
    expect(a.getSnapshot().snapshot).toBeUndefined(); expect(b.getSnapshot().snapshot?.projectRef).toBe('project.b'); b.dispose()
  })
  it('refetches after changed cursor, preserves last safe data offline and blocks mutations', async () => {
    const api = remote(); const controller = new ProjectController(api, 'project.a'); await controller.load()
    api.projectEvents = vi.fn(async () => ({ projectRef: 'project.a', cursor: 'b'.repeat(64), changed: true, refetch: true, events: [], window: { eventLimit: 200, truncated: false } }))
    await controller.poll(); expect(api.projectSnapshot).toHaveBeenCalledTimes(2)
    api.projectEvents = vi.fn(async () => { throw new Error('offline') }); await controller.poll()
    await controller.invoke('plan.approve', 'plan.a', true)
    expect(api.projectInvoke).not.toHaveBeenCalled(); expect(controller.getSnapshot().snapshot?.version).toBe('a'.repeat(64)); controller.dispose()
  })
  it('requires explicit confirmation and reconciles the exact request after uncertain settlement', async () => {
    const api = remote(); const controller = new ProjectController(api, 'project.a'); await controller.load()
    await controller.invoke('plan.approve', 'plan.a', false); expect(api.projectInvoke).not.toHaveBeenCalled()
    const requests: unknown[] = []; const invoke = api.projectInvoke
    api.projectInvoke = async request => { requests.push(request); if (requests.length === 1) throw new Error('lost response'); return invoke(request) }
    await controller.invoke('plan.approve', 'plan.a', true)
    await controller.invoke('plan.approve', 'plan.a', true)
    expect(requests).toHaveLength(1)
    await controller.reconcilePending(); expect(requests[1]).toEqual(requests[0]); expect(controller.getSnapshot().receipt?.state).toBe('accepted'); controller.dispose()
  })
  it('host only forwards registered project refs and validates the owner result', async () => {
    const exec = vi.fn(async (args: readonly string[]) => args[0] === 'projects' ? { projects: [{ ref: 'project.a', title: 'A' }] } : { snapshot: snapshot() })
    const owner = new OrdoProjectOwner(exec)
    await expect(owner.snapshot('project.other')).rejects.toThrow('project_not_registered')
    expect(exec).toHaveBeenCalledTimes(1)
    expect((await owner.snapshot('project.a')).projectRef).toBe('project.a')
    expect(exec.mock.calls.at(-1)?.[0]).toEqual(['snapshot', '--project', 'project.a'])
    owner.dispose()
  })
})
