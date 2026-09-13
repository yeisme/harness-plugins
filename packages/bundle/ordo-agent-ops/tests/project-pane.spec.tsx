// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ProjectPane, ProjectPicker, projectZh, projectGraph } from '../src/client/project-pane.tsx'
import { ProjectController } from '../src/client/project-controller.ts'
import type { ProjectRemote, ProjectSnapshot } from '../src/project-contract.ts'

afterEach(cleanup)
const data: ProjectSnapshot = { schemaVersion: 'ordo.project_ops.snapshot.v1', projectRef: 'project.a', version: 'a'.repeat(64), generatedAt: '2026-09-12T00:00:00.000Z', freshness: 'fresh',
  runs: [{ ref: 'run.a', title: 'Demo', state: 'current', kind: 'plan', planRef: 'plan.a@1' }],
  tasks: [{ ref: 'task.a', runRef: 'run.a', title: 'Draft outline', state: 'blocked', dependencies: [], agentRefs: [], blockers: ['lease_retained'], artifacts: [], evidence: ['evidence.a'], attempts: [{ ref: 'attempt.a', state: 'ambiguous' }] }],
  agents: [], events: [], actions: [{ id: 'plan.approve', targetRef: 'run.a', confirmation: true }], limitations: [], window: { eventLimit: 200, truncated: false },
}
describe('project command pane', () => {
  it('keeps executor selection across views and filters timeline by owner associations', async () => {
    const snapshot: ProjectSnapshot = { ...data,
      agents: [{ ref: 'agent.a', runRef: 'run.a', label: 'Previous writer', role: 'executor', state: 'completed', source: 'ordo', runtime: 'pi' }],
      events: [
        { ref: 'event.a', streamRef: 'run.a', sequence: 1, at: data.generatedAt, kind: 'attempt_started', runRef: 'run.a', taskRef: 'task.a', agentRef: 'agent.a' },
        { ref: 'event.b', streamRef: 'run.a', sequence: 2, at: data.generatedAt, kind: 'other_task_started', runRef: 'run.a' },
      ],
    }
    const api: ProjectRemote = { projects: async () => ({ projects: [] }), projectSnapshot: async () => snapshot, projectEvents: vi.fn(), projectInvoke: vi.fn() }
    const controller = new ProjectController(api, 'project.a')
    const rendered = render(<ProjectPane controller={controller} t={key => projectZh[key]} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Draft outline/ })).toBeTruthy())
    fireEvent.click(screen.getByRole('tab', { name: 'Agent' }))
    fireEvent.click(screen.getByRole('button', { name: /Previous writer/ }))
    expect(within(screen.getByLabelText('对象详情')).getByRole('heading', { name: /Previous writer/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Draft outline/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '时间线' }))
    expect(within(screen.getByLabelText('对象详情')).getByRole('heading', { name: /Previous writer/ })).toBeTruthy()
    expect(screen.getByText('attempt_started')).toBeTruthy()
    expect(screen.queryByText('other_task_started')).toBeNull()
    expect(api.projectInvoke).not.toHaveBeenCalled()
    rendered.unmount(); controller.dispose()
  })
  it('restores project-specific view and selection after switching projects and remounting without executing actions', async () => {
    let stored: unknown
    const api: ProjectRemote = {
      projects: async () => ({ projects: [{ ref: 'project.a', title: 'A' }, { ref: 'project.b', title: 'B' }] }),
      projectSnapshot: async projectRef => ({ ...data, projectRef, tasks: data.tasks.map(task => ({ ...task, title: projectRef === 'project.a' ? 'A task' : 'B task' })) }),
      projectEvents: vi.fn(), projectInvoke: vi.fn(),
    }
    const save = (value: unknown) => { stored = structuredClone(value); return true }
    const first = render(<ProjectPicker remote={api} t={key => projectZh[key]} onRestore={save} />)
    await waitFor(() => expect(screen.getByRole('option', { name: 'A' })).toBeTruthy())
    fireEvent.change(screen.getByLabelText('项目'), { target: { value: 'project.a' } })
    await waitFor(() => expect(screen.getByRole('button', { name: /A task/ })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /A task/ }))
    fireEvent.click(screen.getByRole('tab', { name: '时间线' }))
    fireEvent.change(screen.getByLabelText('项目'), { target: { value: 'project.b' } })
    await waitFor(() => expect(screen.getByRole('button', { name: /B task/ })).toBeTruthy())
    expect(screen.queryByRole('heading', { name: 'A task' })).toBeNull()
    fireEvent.change(screen.getByLabelText('项目'), { target: { value: 'project.a' } })
    await waitFor(() => expect(screen.getByRole('tab', { name: '时间线' }).getAttribute('aria-selected')).toBe('true'))
    first.unmount()
    const second = render(<ProjectPicker remote={api} t={key => projectZh[key]} restore={stored} onRestore={save} />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'A task' })).toBeTruthy())
    expect(screen.getByRole('tab', { name: '时间线' }).getAttribute('aria-selected')).toBe('true')
    expect(api.projectInvoke).not.toHaveBeenCalled(); second.unmount()
  })

  it('starts at attention and shares selection with the task list; actions require a separate confirmation', async () => {
    const api: ProjectRemote = { projects: async () => ({ projects: [] }), projectSnapshot: async () => data, projectEvents: vi.fn(), projectInvoke: vi.fn(async request => ({ schemaVersion: 'ordo.project_ops.receipt.v1', ref: 'receipt.a', requestId: request.requestId, projectRef: request.projectRef, action: request.action, targetRef: request.targetRef, state: 'accepted', reason: 'owner_accepted' })) }
    const controller = new ProjectController(api, 'project.a')
    const rendered = render(<ProjectPane controller={controller} t={key => projectZh[key]} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Draft outline/ })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Draft outline/ }))
    expect(screen.getByText('evidence.a')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '任务列表' }))
    expect(screen.getByLabelText('对象详情')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '批准计划' }))
    expect(api.projectInvoke).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认提交' }))
    await waitFor(() => expect(api.projectInvoke).toHaveBeenCalledOnce())
    rendered.unmount(); controller.dispose()
  })
  it('handles 300 task nodes with real dependency edges and terminates on cycles', () => {
    const tasks = Array.from({ length: 300 }, (_, index) => ({ ...data.tasks[0]!, ref: `task.${index}`, dependencies: index ? [`task.${index - 1}`] : [] }))
    const graph = projectGraph(tasks)
    expect(graph.nodes).toHaveLength(300); expect(graph.edges).toHaveLength(299)
    tasks[0]!.dependencies = ['task.299']; expect(projectGraph(tasks).nodes).toHaveLength(300)
  })
})
