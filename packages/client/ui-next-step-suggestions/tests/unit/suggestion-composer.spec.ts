import { describe, expect, it } from 'vitest'
import {
  appendPrompt,
  applySelected,
  composeParallelPrompt,
  mergeSuggestions,
} from '../../src/client/suggestion-composer.ts'
import type { NextStepSuggestionV1, SuggestionSource } from '../../src/client/types.ts'

const a: NextStepSuggestionV1 = {
  id: 'a',
  label: '方案A',
  prompt: '/plan-select {"optionId":"a"}',
  source: 'plan',
  parallelSafe: true,
  order: 1,
}

const b: NextStepSuggestionV1 = {
  id: 'b',
  label: '方案B',
  prompt: '/plan-select {"optionId":"b"}',
  source: 'plan',
  parallelSafe: true,
  order: 0,
}

describe('appendPrompt', () => {
  it('replaces an empty draft', () => {
    expect(appendPrompt('', 'hello')).toBe('hello')
  })

  it('appends to a non-empty draft on a new line', () => {
    expect(appendPrompt('first', 'second')).toBe('first\nsecond')
  })

  it('trims trailing whitespace before appending', () => {
    expect(appendPrompt('first  ', 'second')).toBe('first\nsecond')
  })
})

describe('applySelected', () => {
  it('applies suggestions in selection order', () => {
    expect(applySelected('', [a, b])).toBe('/plan-select {"optionId":"a"}\n/plan-select {"optionId":"b"}')
  })
})

describe('composeParallelPrompt', () => {
  it('builds a parallel prompt with labels and prompts', () => {
    const text = composeParallelPrompt([a, b])
    expect(text).toContain('1. 方案A — /plan-select {"optionId":"a"}')
    expect(text).toContain('2. 方案B — /plan-select {"optionId":"b"}')
    expect(text).toContain('请并行执行以下方案')
  })
})

describe('mergeSuggestions', () => {
  it('deduplicates by id and sorts by order', () => {
    const source: SuggestionSource = {
      id: 'source',
      getSuggestions: () => [a, b, { ...a, order: 5 }],
    }
    const merged = mergeSuggestions([source])
    expect(merged.map(item => item.id)).toEqual(['b', 'a'])
  })
})
