import { describe, expect, it } from 'vitest'
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
