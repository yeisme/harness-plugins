import { describe, expect, it } from 'vitest'
import { AgentContextController } from '../src/controller.js'
import type { AgentContextSource } from '../src/projection.js'

describe('AgentContextController', () => {
  it('resets selection on session switch and stops emitting after dispose', () => {
    let source: AgentContextSource = {
      sessionRef: 'session:one',
      generation: 1,
      steps: [{ id: 'step:1', title: 'One', status: 'pending', requiredSkills: ['writer'], recommendedSkills: [] }],
      skills: [{ id: 'writer', label: 'Writer', source: 'local', version: '1', scope: 'session', state: 'active' }],
    }
    const listeners = new Set<() => void>()
    const controller = new AgentContextController({
      getSnapshot: () => source,
      subscribe: listener => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    })
    controller.selectStep('step:1')
    expect(controller.getSnapshot().selectedStepId).toBe('step:1')
    controller.switchSession()
    expect(controller.getSnapshot().selectedStepId).toBeUndefined()
    expect(controller.currentTab).toBe('plan')
    controller.dispose()
    expect(listeners.size).toBe(0)
    expect(() => controller.getSnapshot()).toThrow(/disposed/)
  })
})
