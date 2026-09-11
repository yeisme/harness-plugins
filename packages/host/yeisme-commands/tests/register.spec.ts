import { describe, expect, it } from 'vitest'
import { yeismeUrlCommand, yeismeUrlCommandHandler } from '../src/url-command.js'
import {
  YEISMO_NOTICE_COMMAND,
  YeismeCommandError,
  assertYeismeCommandName,
  registerYeismeCommand,
  yeismoNoticeHandler,
  type CommandRegistryLike,
} from '../src/index.ts'

function fakeRegistry(existing: string[] = []): CommandRegistryLike & { definitions: Map<string, unknown> } {
  const definitions = new Map<string, unknown>()
  for (const name of existing) definitions.set(name, { name })
  return {
    definitions,
    find(_agent, name) {
      const value = definitions.get(name)
      return value === undefined ? undefined : { name }
    },
    register(definition) {
      definitions.set(definition.name, definition)
      return () => { definitions.delete(definition.name) }
    },
  }
}

describe('Yeisme command registration', () => {
  it('accepts yeisme- names and rejects others', () => {
    expect(() => assertYeismeCommandName('yeisme-notice')).not.toThrow()
    expect(() => assertYeismeCommandName('yeismo-notice')).not.toThrow()
    expect(() => assertYeismeCommandName('plan')).toThrow(YeismeCommandError)
    expect(() => assertYeismeCommandName('YEISME-notice')).toThrow(YeismeCommandError)
  })

  it('rejects duplicate names', () => {
    const registry = fakeRegistry(['yeismo-notice'])
    expect(() => registerYeismeCommand(registry, YEISMO_NOTICE_COMMAND)).toThrow(/duplicate Yeisme command/)
  })

  it('registers yeismo-notice with recordInput false', () => {
    const registry = fakeRegistry()
    const dispose = registerYeismeCommand(registry, YEISMO_NOTICE_COMMAND)
    const stored = registry.definitions.get('yeismo-notice') as { recordInput?: boolean; name: string }
    expect(stored.name).toBe('yeismo-notice')
    expect(stored.recordInput).toBe(false)
    expect(yeismoNoticeHandler()).toEqual({ kind: 'success', text: 'Yeisme notice: no owner notifications projected.' })
    dispose()
    expect(registry.definitions.has('yeismo-notice')).toBe(false)
  })
})

describe('yeisme-url command (dsh-url-session-v1 §6.2)', () => {
  it('prints the current session link with origin + SessionId only', async () => {
    const handler = yeismeUrlCommandHandler({ server: { port: 3080, host: '127.0.0.1' } })
    const result = await handler({ agent: { id: 'sess-a' } } as never)
    expect(result).toEqual({ kind: 'success', text: 'http://127.0.0.1:3080/?s=sess-a' })
    expect((result as { text: string }).text).not.toMatch(/token|cookie|authorization/i)
  })

  it('maps a 0.0.0.0 bind to the loopback literal for display', async () => {
    const handler = yeismeUrlCommandHandler({ server: { port: 80, host: '0.0.0.0' } })
    const result = await handler({ agent: { id: 'abc123' } } as never)
    expect((result as { text: string }).text).toBe('http://127.0.0.1:80/?s=abc123')
  })

  it('fails honestly when the session id is not a shareable literal', async () => {
    const handler = yeismeUrlCommandHandler({ server: { port: 3080, host: '127.0.0.1' } })
    const result = await handler({ agent: { id: '../escape' } } as never)
    expect(result.kind).toBe('error')
  })

  it('registers under the commands registry only when webServer is bound', () => {
    const command = yeismeUrlCommand({ server: { port: 3080, host: '127.0.0.1' } })
    expect(command.name).toBe('yeisme-url')
    expect(command.recordInput).toBe(false)
  })
})
