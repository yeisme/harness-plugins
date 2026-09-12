import { describe, expect, it, vi } from 'vitest'
import { WorkbenchContextController } from '../src/context.ts'

describe('WorkbenchContextController', () => {
  it('restores and persists project context without owning domain state', () => {
    const writes: unknown[] = []
    const storage = {
      read: vi.fn(() => ({ projectRef: 'project:one', context: 'production' as const, agentRole: 'producer' as const, freshness: 'fresh' as const, generation: 4 })),
      write: (_projectRef: string, value: unknown) => { writes.push(value) },
    }
    const controller = new WorkbenchContextController({ projectRef: 'project:one', storage })
    expect(controller.getSnapshot()).toMatchObject({ context: 'production', agentRole: 'producer', generation: 1 })
    const listener = vi.fn()
    controller.subscribe(listener)
    controller.setContext('review')
    controller.setPendingAction('审阅最新候选')
    expect(listener).toHaveBeenCalledTimes(2)
    expect(writes).toHaveLength(2)
    expect(controller.getSnapshot()).toMatchObject({ context: 'review', pendingAction: '审阅最新候选', generation: 3 })
  })

  it('fails closed for invalid project references', () => {
    expect(() => new WorkbenchContextController({ projectRef: '/private/path' })).toThrow(/Invalid project reference/)
  })

  it('does not emit after dispose', () => {
    const controller = new WorkbenchContextController({ projectRef: 'project:one' })
    const listener = vi.fn()
    controller.subscribe(listener)
    controller.dispose()
    controller.setAgentRole('writer')
    expect(listener).not.toHaveBeenCalled()
  })
})
