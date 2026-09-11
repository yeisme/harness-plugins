import { describe, expect, it } from 'vitest'
import { resumeUrlSuffix } from '../src/index.ts'

describe('web-app --resume URL composition', () => {
  it('canonical /s/<id> when the SPA history fallback is enabled', () => {
    expect(resumeUrlSuffix('abc123', true)).toBe('/s/abc123')
  })

  it('query alias when the fallback is off (zero server change)', () => {
    expect(resumeUrlSuffix('abc123', false)).toBe('/?s=abc123')
  })

  it('percent-encodes ids exactly once', () => {
    expect(resumeUrlSuffix('abc-123', true)).toBe('/s/abc-123')
  })

  it('adds nothing without a session', () => {
    expect(resumeUrlSuffix(undefined, true)).toBe('')
    expect(resumeUrlSuffix(undefined, false)).toBe('')
  })

  it('ignores non-literal ids defensively (startup validates first)', () => {
    expect(resumeUrlSuffix('../escape', true)).toBe('')
    expect(resumeUrlSuffix('', true)).toBe('')
    expect(resumeUrlSuffix('a'.repeat(200), true)).toBe('')
  })
})
