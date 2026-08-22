import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { apply, inject, name } from '../src/index.ts'

describe('dsh-conversation-rewrite host lifecycle', () => {
  it('exposes a no-op host plugin that requires no services', async () => {
    expect(name).toBe('dsh-conversation-rewrite')
    expect(inject).toEqual([])
    const ctx = new Context()
    const fiber = await ctx.plugin({ name, inject, apply })
    await fiber.dispose()
  })
})
