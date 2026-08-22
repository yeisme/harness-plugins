import { describe, expect, it } from 'vitest'
import { PARALLEL_DIRECTIVE_MAX_CHARS, wrapParallelDirective } from '../src/parallel.js'

describe('parallel directive', () => {
  it('wraps user text with a bounded fixed directive', () => {
    const wrapped = wrapParallelDirective('write tests')
    expect(wrapped).toContain('[parallel mode]')
    expect(wrapped.endsWith('\nwrite tests')).toBe(true)
    expect(wrapped.length).toBeLessThan(PARALLEL_DIRECTIVE_MAX_CHARS + 20)
  })
})
