/** Yeisme-prefixed DSH command registration. Does not fork dsh-commands. */

import type { Context } from '@deepseek-ai/cordis'
import type { CommandDefinition, CommandResult } from '@deepseek-ai/dsh-commands'
import { yeismeUrlCommand } from './url-command.js'
export { YEISME_URL_COMMAND_NAME, sessionShareUrl, webOrigin, yeismeUrlCommand, yeismeUrlCommandHandler } from './url-command.js'
export type { UrlCommandDeps, WebServerLike } from './url-command.js'

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
export const inject = ['commands', 'webServer']

export function apply(ctx: Context): () => void {
  const commands = ctx.get('commands') as CommandRegistryLike | undefined
  if (commands === undefined) return () => {}
  const disposers = [registerYeismeCommand(commands, YEISMO_NOTICE_COMMAND)]
  // /yeisme-url 只在 Web 运行时在场时注册（capability probe：tui 等无
  // webServer 的 profile 不出现死命令）。
  try {
    const server = ctx.get('webServer') as { readonly port?: unknown; readonly host?: unknown } | undefined
    if (server !== undefined && typeof server.port === 'number' && typeof server.host === 'string') {
      disposers.push(registerYeismeCommand(commands, yeismeUrlCommand({ server: { port: server.port, host: server.host } })))
    }
  } catch {
    // webServer 缺席（未注入或未 bind）：跳过 url 命令，不中断其它命令。
  }
  return () => { for (const dispose of disposers) dispose() }
}

const YeismeCommandsPlugin = { name, inject, apply }
export default YeismeCommandsPlugin
