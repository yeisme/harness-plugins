import { describe, expect, it } from 'vitest'
import {
  appendPrompt,
  applyPrompt,
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

describe('applyPrompt replace/append preference', () => {
  it('defaults to append on a non-empty draft', () => {
    expect(applyPrompt('existing', '/plan-select {"optionId":"a"}')).toBe('existing\n/plan-select {"optionId":"a"}')
  })

  it('replaces the draft when the preference is replace', () => {
    expect(applyPrompt('existing', ' /plan-select {"optionId":"a"} ', 'replace')).toBe('/plan-select {"optionId":"a"}')
  })

  it('keeps the trimmed prompt on an empty draft in both modes', () => {
    expect(applyPrompt('', ' hello ', 'replace')).toBe('hello')
    expect(applyPrompt('', ' hello ')).toBe('hello')
  })
})

describe('applySelected replace/append preference', () => {
  it('replaces the whole draft with the selected prompts in replace mode', () => {
    expect(applySelected('old draft', [a, b], 'replace')).toBe('/plan-select {"optionId":"a"}\n/plan-select {"optionId":"b"}')
  })

  it('still appends by default', () => {
    expect(applySelected('old draft', [a])).toBe('old draft\n/plan-select {"optionId":"a"}')
  })
})
