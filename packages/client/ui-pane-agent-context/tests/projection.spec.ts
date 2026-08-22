import { describe, expect, it } from 'vitest'
import { highlightedSkills, projectAgentContext } from '../src/projection.js'

describe('projectAgentContext', () => {
  it('keeps safe plan/skills/invocations and drops raw prompt payloads', () => {
    const projection = projectAgentContext({
      sessionRef: 'session:one',
      planMode: 'plan',
      generation: 2,
      freshness: 'fresh',
      steps: [
        { id: 'step:1', title: 'Outline', status: 'running', requiredSkills: ['writer'], recommendedSkills: ['reviewer'] },
        { id: 'step:bad', title: 'rawPrompt leak', status: 'pending', requiredSkills: [] },
      ],
      skills: [
        { id: 'writer', label: 'Writer', source: 'local', version: '1.0.0', scope: 'session', state: 'active' },
        { id: 'secret', label: 'rawPrompt', source: 'x', version: '1', scope: 'session', state: 'available' },
      ],
      invocations: [{ id: 'inv:1', skillId: 'writer', stepId: 'step:1', status: 'accepted', summary: 'ok', evidenceRef: 'evidence:1' }],
    }, 'step:1')
    expect(projection.steps.map(step => step.id)).toEqual(['step:1'])
    expect(projection.skills.map(skill => skill.id)).toEqual(['writer'])
    expect(projection.invocations).toHaveLength(1)
    expect(highlightedSkills(projection).has('writer')).toBe(true)
  })
})
