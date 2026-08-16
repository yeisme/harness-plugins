/** 读取 Owner 安全投影的只读 `/ordo` 命令。 */

import type { Context } from '@deepseek-ai/cordis'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import { needsContractSnapshot, type OrdoAgentOpsGateway, type OrdoAgentOpsSnapshot } from './bridge.ts'
import { parseOrdoCommand, parseSafeOrdoRef, type SafeOrdoRef } from './parser.ts'

export { parseOrdoCommand, parseSafeOrdoRef, type OrdoCommand, type SafeOrdoRef } from './parser.ts'

/** Cordis 表示名；兼容旧 command package 但不再单独发布运行面。 */
export const name = 'ordo-commands'
/** 命令必须等 Host bridge 和既有 dsh-commands runtime 均可用。 */
export const inject = ['commands', 'ordoAgentOps']

const USAGE = 'Usage: /ordo [help|status [safe-ref]|preview <safe-ref>|capacity]'
const READABLE_STATES = new Set<OrdoAgentOpsSnapshot['state']>(['ready', 'stale'])
const registeredCommandContexts = new WeakSet<object>()

type SnapshotSource = Pick<OrdoAgentOpsGateway, 'snapshot'>

/** 检查当前 runtime 是否已拥有唯一 `/ordo` 注册。 */
export function hasOrdoCommandRegistration(ctx: Context): boolean {
  return registeredCommandContexts.has(ctx.root)
}

function contractMismatchSnapshot(): OrdoAgentOpsSnapshot {
  return {
    ...needsContractSnapshot(),
    state: 'contract_mismatch',
    freshness: 'stale',
    reasonCode: 'contract_mismatch',
    safeMessage: 'Ordo owner read projection did not match the DSH contract.',
  }
}

/** 只读取一个 gateway；任何不安全文本都不能进入命令输出。 */
function readSnapshot(ctx: Context): OrdoAgentOpsSnapshot {
  const source = ctx.get('ordoAgentOps') as SnapshotSource | undefined
  if (source === undefined) return needsContractSnapshot()
  try {
    const snapshot = source.snapshot()
    if (!isSafeSummaryText(snapshot.safeMessage)) return contractMismatchSnapshot()
    if (snapshot.run !== undefined
      && (!isSafeSummaryText(snapshot.run.safeTitle) || parseSafeOrdoRef(snapshot.run.runRef) === undefined)) {
      return contractMismatchSnapshot()
    }
    return snapshot
  } catch {
    return needsContractSnapshot()
  }
}

const UNSAFE_SUMMARY_CREDENTIAL = /(?:https?:\/\/|wss?:\/\/|\bBearer\b|\b(?:token|secret|credential|password|api[_-]?key)\b)/iu
const UNSAFE_SUMMARY_PATH = /(?:^|[\s:=])(?:\/|[A-Z]:[\\/])/u

function isSafeSummaryText(value: string): boolean {
  if (value.length === 0 || /[\u0000-\u001f\u007f]/u.test(value)) return false
  return !(UNSAFE_SUMMARY_CREDENTIAL.test(value) || UNSAFE_SUMMARY_PATH.test(value))
}

function renderSnapshot(snapshot: OrdoAgentOpsSnapshot, ref: SafeOrdoRef | undefined, mode: 'overview' | 'status' | 'capacity'): CommandResult {
  const readable = READABLE_STATES.has(snapshot.state)
  const matchedRun = readable && snapshot.run !== undefined && (ref === undefined || String(snapshot.run.runRef) === ref)
    ? snapshot.run
    : undefined
  const summary = mode === 'capacity'
    ? readable && snapshot.capacity !== undefined
      ? `Capacity: policy cap ${snapshot.capacity.policyCap}; observed or retained ${snapshot.capacity.observedOrRetained}; qualified routes ${snapshot.capacity.qualifiedRoutes}; reservation ${snapshot.capacity.reservationState}.`
      : 'No capacity facts are available from this snapshot.'
    : matchedRun !== undefined
      ? `Run ${matchedRun.runRef}: ${matchedRun.state}; ${matchedRun.safeTitle}; tasks ${matchedRun.completedTaskCount}/${matchedRun.taskCount}; attention ${matchedRun.attentionCount}.`
      : readable
        ? ref === undefined ? 'No safe run reference is available from this snapshot.' : 'No matching safe reference is available from this snapshot.'
        : 'No run or capacity facts are available from this snapshot.'
  const conclusion = readable
    ? mode === 'capacity' ? 'Read-only Ordo capacity summary.' : 'Read-only Ordo status summary.'
    : 'Read-only Ordo snapshot is unavailable for facts.'
  const next = readable
    ? mode === 'capacity' ? 'Run /ordo status to view the current safe summary.' : 'Run /ordo capacity to view safe capacity facts.'
    : 'Run /ordo help to view read-only syntax.'
  return {
    kind: 'success',
    text: [
      `Conclusion: ${conclusion}`,
      `Freshness / status: ${snapshot.freshness}; ${snapshot.state}; ${snapshot.reasonCode}.`,
      `Safe refs / summary: ${summary}`,
      `Next action: ${next}`,
    ].join('\n'),
  }
}

function renderHelp(): CommandResult {
  return {
    kind: 'success',
    text: [
      'Conclusion: Read-only Ordo command help.',
      'Freshness / status: needs_contract; owner_read_contract_unavailable.',
      `Safe refs / summary: ${USAGE}`,
      'Next action: Run /ordo status to read the mounted owner snapshot.',
    ].join('\n'),
  }
}

function syntaxError(error: ReturnType<typeof parseOrdoCommand> & { readonly kind: 'invalid' }): CommandResult {
  const message = error.error === 'unknown'
    ? 'Unsupported /ordo subcommand.'
    : error.error === 'missing-ref'
      ? 'The /ordo preview command requires one safe reference.'
      : error.error === 'extra-arguments'
        ? 'The /ordo command does not accept extra arguments.'
        : 'The supplied reference is not safe.'
  return { kind: 'error', text: `${message} ${USAGE}` }
}

function executeOrdoCommand(ctx: Context, invocation: CommandInvocation): CommandResult {
  const command = parseOrdoCommand(invocation.rawInput)
  switch (command.kind) {
    case 'overview': return renderSnapshot(readSnapshot(ctx), undefined, 'overview')
    case 'help': return renderHelp()
    case 'status': return renderSnapshot(readSnapshot(ctx), command.ref, 'status')
    case 'preview': return renderHelpPreview()
    case 'capacity': return renderSnapshot(readSnapshot(ctx), undefined, 'capacity')
    case 'invalid': return syntaxError(command)
    /* v8 ignore next 2 -- parser 的闭合联合在上方已逐一处理 */
    default: return assertNever(command)
  }
}

function renderHelpPreview(): CommandResult {
  return {
    kind: 'success',
    text: [
      'Conclusion: Read-only composition preview is unavailable.',
      'Freshness / status: needs_contract; owner_read_contract_unavailable.',
      'Safe refs / summary: No composition preview facts are mounted in this DSH runtime.',
      'Next action: Run /ordo status to read the mounted owner snapshot.',
    ].join('\n'),
  }
}

function assertNever(value: never): never {
  throw new TypeError(`unknown Ordo command: ${String(value)}`)
}

/**
 * 在同一个 commands runtime 上只注册一次。guard 的移除与注册 fiber 一起发生，
 * 因而不会把已卸载 profile 的状态泄漏到下一代 Context。
 */
export function apply(ctx: Context): void {
  const commands = ctx.get('commands')
  if (commands === undefined) throw new TypeError('/ordo requires the mounted command runtime')
  if (registeredCommandContexts.has(ctx.root)) return
  ctx.effect(() => {
    registeredCommandContexts.add(ctx.root)
    const unregister = commands.register({
      name: 'ordo',
      description: 'read the safe Ordo Agent Ops snapshot',
      input: { hint: '[help|status [safe-ref]|preview <safe-ref>|capacity]' },
      handler: invocation => executeOrdoCommand(ctx, invocation),
    })
    return () => {
      unregister()
      registeredCommandContexts.delete(ctx.root)
    }
  }, 'ordo-agent-ops: command lifecycle')
}

const OrdoCommandsPlugin = { name, inject, apply }

export default OrdoCommandsPlugin
