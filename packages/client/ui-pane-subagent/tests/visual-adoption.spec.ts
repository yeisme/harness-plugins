import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('subagent monitor visual adoption', () => {
  it('uses canonical DSH tokens and status tones', () => {
    const source = readFileSync(fileURLToPath(new URL('../src/view.ts', import.meta.url)), 'utf8')
    expect(source).toContain('@yeisme/dsh-client-ui-surface')
    expect(source).toContain('--vk-text-primary')
    expect(source).toContain('--vk-tone-critical')
    expect(source).toContain('--vk-tone-info')
    expect(source).toContain('--vk-tone-positive')
    expect(source).not.toContain('--dsw-alias-')
    expect(source).not.toContain('--dsw-alias-label-primary')
    expect(source).not.toContain('#88d5a7')
    expect(source).not.toContain('#f39494')
  })
})
