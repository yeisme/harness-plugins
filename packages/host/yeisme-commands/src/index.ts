/** Yeisme-prefixed DSH command registration. Does not fork dsh-commands. */

import type { Context } from '@deepseek-ai/cordis'
import type { CommandDefinition, CommandResult } from '@deepseek-ai/dsh-commands'

export const YEISME_COMMAND_PREFIX = 'yeisme-'
export const YEISME_COMMAND_NAME = /^yeisme-[a-z0-9]+(?:[_-][a-z0-9]+)*$/
/** Frozen example command from the slash-command OpenSpec; kept as an explicit exception. */
export const YEISMO_NOTICE_NAME = 'yeismo-notice'

export interface YeismeCommandDefinition {
  readonly name: string
  readonly description: string
  readonly inputHint?: string
  readonly images?: boolean
  readonly recordInput?: boolean
  readonly handler: CommandDefinition['handler']
}

export class YeismeCommandError extends Error {
  override readonly name = 'YeismeCommandError'
  constructor(message: string) {
    super(message)
  }
}

export function assertYeismeCommandName(name: string): void {
  if (name !== YEISMO_NOTICE_NAME && !YEISME_COMMAND_NAME.test(name)) {
    throw new YeismeCommandError(`Yeisme command names must match ${YEISME_COMMAND_NAME} or ${YEISMO_NOTICE_NAME}: ${name}`)
  }
}

export interface CommandRegistryLike {
  find(agent: unknown, name: string): { readonly name: string } | undefined
  register(definition: CommandDefinition): () => void
}

/** Register one Yeisme command; duplicate names fail closed. */
export function registerYeismeCommand(registry: CommandRegistryLike, definition: YeismeCommandDefinition, agent: unknown = {}): () => void {
  assertYeismeCommandName(definition.name)
  if (registry.find(agent, definition.name) !== undefined) {
    throw new YeismeCommandError(`duplicate Yeisme command: ${definition.name}`)
  }
  const registered: CommandDefinition = {
    name: definition.name,
    description: definition.description,
    ...(definition.inputHint === undefined || definition.inputHint.length === 0 ? {} : {
      input: { hint: definition.inputHint },
    }),
    recordInput: definition.recordInput ?? true,
    handler: definition.handler,
  }
  return registry.register(registered)
}

export function yeismoNoticeHandler(): CommandResult {
  return { kind: 'success', text: 'Yeisme notice: no owner notifications projected.' }
}

export const YEISMO_NOTICE_COMMAND: YeismeCommandDefinition = {
  name: YEISMO_NOTICE_NAME,
  description: 'Show a one-line Yeisme notice from the owner projection.',
  recordInput: false,
  handler: () => yeismoNoticeHandler(),
}

export const name = 'yeisme-commands'
export const inject = ['commands']

export function apply(ctx: Context): () => void {
  const commands = ctx.get('commands') as CommandRegistryLike | undefined
  if (commands === undefined) return () => {}
  return registerYeismeCommand(commands, YEISMO_NOTICE_COMMAND)
}

const YeismeCommandsPlugin = { name, inject, apply }
export default YeismeCommandsPlugin
