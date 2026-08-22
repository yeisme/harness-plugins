import { describe, expect, it } from 'vitest'
import { planOptionsToSuggestions } from '../../src/client/plan-options-source.ts'
import type { PlanOptionsProjectionValue } from '../../src/client/types.ts'

const value: PlanOptionsProjectionValue = {
  latest: {
    planId: 'plan-1',
    round: 1,
    status: 'proposed',
    options: [
      { optionId: 'fast', title: '快速方案', summary: 'fast', markdown: '# Fast', recommended: true },
      { optionId: 'safe', title: '稳妥方案', summary: 'safe', markdown: '# Safe' },
    ],
  },
  revisions: [],
}

describe('planOptionsToSuggestions', () => {
  it('returns empty when projection is absent', () => {
    expect(planOptionsToSuggestions(undefined)).toEqual([])
  })

  it('converts proposed options into plan-select prompts', () => {
    const suggestions = planOptionsToSuggestions(value)
    expect(suggestions).toHaveLength(2)
    expect(suggestions[0]!.label).toBe('快速方案')
    expect(suggestions[0]!.prompt).toBe('/plan-select {"optionId":"fast"}')
    expect(suggestions[0]!.order).toBe(-1)
    expect(suggestions[1]!.order).toBe(0)
  })

  it('returns empty for selected or superseded options', () => {
    expect(planOptionsToSuggestions({
      latest: { ...value.latest!, status: 'selected' },
      revisions: [],
    })).toEqual([])
    expect(planOptionsToSuggestions({
      latest: { ...value.latest!, status: 'superseded' },
      revisions: [],
    })).toEqual([])
  })
})
