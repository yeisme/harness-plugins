import { describe, expect, it } from 'vitest'
import { ordoSnapshotToDomain } from '../src/ordo.ts'
import { admitOrdoClientAction } from '../src/actions.ts'

describe('ordoSnapshotToDomain', () => {
  it('projects the existing Agent Ops snapshot without inventing launch', () => {
    const domain = ordoSnapshotToDomain({
      state: 'ready',
      freshness: 'fresh',
      run: {
        runRef: 'run:1',
        safeTitle: 'Team run',
        state: 'running',
        taskCount: 12,
        completedTaskCount: 3,
        attentionCount: 1,
      },
      actions: [{ actionType: 'ordo.reconcile.request' }, { actionType: 'run.launch' }],
    })
    expect(domain.owner).toBe('ordo')
    expect(domain.items[0]?.ref).toBe('run:1')
    expect(domain.allowedActions.map(action => action.id)).toEqual(['ordo.reconcile.request'])
    expect(admitOrdoClientAction(domain, 'run.launch').kind).toBe('not_available')
    expect(admitOrdoClientAction(domain, 'ordo.reconcile.request').kind).toBe('approval_required')
  })

  it('projects owner DAG tasks without computing runnable locally', () => {
    const domain = ordoSnapshotToDomain({
      state: 'ready',
      freshness: 'fresh',
      tasks: Array.from({ length: 3 }, (_, index) => ({
        ref: `task:${index + 1}`,
        title: `Task ${index + 1}`,
        state: index === 0 ? 'ready' : 'blocked',
      })),
      actions: [{ actionType: 'ordo.approval.decide' }],
    })
    expect(domain.items).toHaveLength(3)
    expect(domain.items[1]?.status).toBe('blocked')
    expect(admitOrdoClientAction(domain, 'lease.release').kind).toBe('not_available')
  })
})
