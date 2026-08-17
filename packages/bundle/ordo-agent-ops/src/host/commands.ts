/** 读取 Owner 安全投影的只读 `/ordo` 命令。 */

import type { Context } from '@deepseek-ai/cordis'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import {
  needsContractSnapshot,
  type OrdoAgentOpsActionDescriptor,
  type OrdoAgentOpsGateway,
  type OrdoAgentOpsSnapshot,
} from './bridge.ts'
import { parseOrdoCommand, parseSafeOrdoRef, type SafeOrdoRef } from './parser.ts'

export { parseOrdoCommand, parseSafeOrdoRef, parseSafePresetId, type OrdoCommand, type SafeOrdoRef } from './parser.ts'

/** Cordis 表示名；兼容旧 command package 但不再单独发布运行面。 */
export const name = 'ordo-commands'
/** 命令必须等 Host bridge 和既有 dsh-commands runtime 均可用。 */
export const inject = ['commands', 'ordoAgentOps']

const USAGE = 'Usage: /ordo [help|status [safe-ref]|preview <safe-ref>|capacity|qualify <preset-id>|reconcile <safe-ref>|approve <decision-ref>|run <launch|cancel|redispatch>]'
const READABLE_STATES = new Set<OrdoAgentOpsSnapshot['state']>(['ready', 'stale'])
const registeredCommandContexts = new WeakSet<object>()

type SnapshotSource = Pick<OrdoAgentOpsGateway, 'snapshot' | 'decide'>

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
      ? 'The /ordo command requires one safe reference.'
      : error.error === 'extra-arguments'
        ? 'The /ordo command does not accept extra arguments.'
        : 'The supplied reference is not safe.'
  return { kind: 'error', text: `${message} ${USAGE}` }
}

async function executeOrdoCommand(ctx: Context, invocation: CommandInvocation): Promise<CommandResult> {
  const command = parseOrdoCommand(invocation.rawInput)
  switch (command.kind) {
    case 'overview': return renderSnapshot(readSnapshot(ctx), undefined, 'overview')
    case 'help': return renderHelp()
    case 'status': return renderSnapshot(readSnapshot(ctx), command.ref, 'status')
    case 'preview': return renderHelpPreview()
    case 'capacity': return renderSnapshot(readSnapshot(ctx), undefined, 'capacity')
    case 'qualify': return renderQualify(ctx, command.presetId)
    case 'reconcile': return renderActionPreview(readSnapshot(ctx), command.ref, 'ordo.reconcile.request')
    case 'approve': return approveAction(ctx, command.decisionRef)
    case 'run-unavailable': return notAvailable(`run ${command.operation}`, 'Durable reservation, writer fencing, and the owner action contract are not available.')
    case 'invalid': return syntaxError(command)
    /* v8 ignore next 2 -- parser 的闭合联合在上方已逐一处理 */
    default: return assertNever(command)
  }
}

/** Qualify remains a read-only composition handoff until Ordo opens its typed action. */
function renderQualify(ctx: Context, presetId: SafeOrdoRef): CommandResult {
  const composition = ctx.get('agentCompositionPreview') as { project?: (id: string) => Promise<unknown> } | undefined
  if (typeof composition?.project !== 'function') {
    return notAvailable('qualify', 'The independent composition preview owner is not mounted.')
  }
  return {
    kind: 'success',
    text: [
      'Conclusion: Qualification requires the Ordo owner handoff.',
      'Freshness / status: preview_only; no DSH mutation was submitted.',
      `Safe refs / summary: Preset ${presetId}; composition preview is available to the owner.`,
      `Next action: Run ordo agent qualify ${presetId} --approve --events in an authorized Ordo environment.`,
    ].join('\n'),
  }
}

function renderActionPreview(
  snapshot: OrdoAgentOpsSnapshot,
  targetRef: SafeOrdoRef,
  actionType: OrdoAgentOpsActionDescriptor['actionType'],
): CommandResult {
  if (snapshot.state !== 'ready' || snapshot.freshness !== 'fresh') {
    return notAvailable('reconcile', `The owner snapshot is ${snapshot.freshness}/${snapshot.state}; refresh before preview.`)
  }
  if (snapshot.reasonCode !== 'reconcile_required') {
    return notAvailable('reconcile', 'Only owner-marked reconcile_required resources may be reconciled.')
  }
  const descriptor = snapshot.actions?.find(action => action.actionType === actionType && String(action.targetRef) === targetRef)
  if (descriptor === undefined || Date.parse(descriptor.expiresAt) <= Date.now()) {
    return notAvailable('reconcile', 'No current server-authored reconcile preview is available for this safe reference.')
  }
  return previewResult(descriptor)
}

function previewResult(descriptor: OrdoAgentOpsActionDescriptor): CommandResult {
  return {
    kind: 'success',
    text: [
      'Conclusion: Owner action preview only; no mutation was submitted.',
      `Freshness / status: fresh; previewed; expires ${descriptor.expiresAt}.`,
      `Safe refs / summary: target ${descriptor.targetRef}; effect ${descriptor.safeEffect}; owner ${descriptor.ownerRef}; decision ${descriptor.decisionRef}; preview_digest ${descriptor.previewDigest}.`,
      `Next action: Run /ordo approve ${descriptor.decisionRef} before the preview expires.`,
    ].join('\n'),
  }
}

async function approveAction(ctx: Context, decisionRef: SafeOrdoRef): Promise<CommandResult> {
  const source = ctx.get('ordoAgentOps') as SnapshotSource | undefined
  const snapshot = readSnapshot(ctx)
  if (source === undefined || snapshot.state !== 'ready' || snapshot.freshness !== 'fresh' || snapshot.context === undefined) {
    return notAvailable('approve', 'A fresh owner snapshot and bound action source are required.')
  }
  const descriptor = snapshot.actions?.find(action => String(action.decisionRef) === decisionRef)
  if (descriptor === undefined || Date.parse(descriptor.expiresAt) <= Date.now()) {
    return notAvailable('approve', 'This decision reference is stale, unknown, or not bound to the current tenant context.')
  }
  const receipt = await source.decide(decisionRef)
  if (receipt.kind === 'rejected') {
    return { kind: 'error', text: `rejected: ${receipt.rejection.reason}. ${receipt.rejection.safeMessage}` }
  }
  if (receipt.kind === 'unknown') {
    return { kind: 'error', text: `${receipt.state}: ${receipt.safeSummary} Do not retry; read /ordo status and request a fresh reconcile preview.` }
  }
  return {
    kind: 'success',
    text: [
      'Conclusion: Owner action receipt received.',
      `Freshness / status: ${receipt.receipt.state}; owner_confirmed.`,
      `Safe refs / summary: receipt ${receipt.receipt.receiptRef}; ${receipt.receipt.safeSummary}`,
      'Next action: Refresh /ordo status; unknown outcomes remain reconcile-only.',
    ].join('\n'),
  }
}

function notAvailable(action: string, reason: string): CommandResult {
  return { kind: 'error', text: `not_available: ${action}. ${reason} ${USAGE}` }
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
      description: 'read or safely preview the Ordo Agent Ops projection',
      input: { hint: '[help|status [safe-ref]|preview <safe-ref>|capacity|qualify <preset-id>|reconcile <safe-ref>|approve <decision-ref>]' },
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
