/**
 * Read-only `/ordo` command over the owner-authored Agent Ops snapshot.
 * @module @yeisme/dsh-host-ordo-commands
 */

import type { Context } from '@deepseek-ai/cordis'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import {
  needsContractSnapshot,
  type OrdoAgentOpsGateway,
  type OrdoAgentOpsSnapshot,
} from '@yeisme/dsh-host-ordo-agent-ops'
import { parseOrdoCommand, parseSafeOrdoRef, type SafeOrdoRef } from './parser.ts'

export { parseOrdoCommand, parseSafeOrdoRef, type OrdoCommand, type SafeOrdoRef } from './parser.ts'

export const name = 'host-ordo-commands'
export const inject = ['commands', 'ordoAgentOps']

const USAGE = 'Usage: /ordo [help|status [safe-ref]|preview <safe-ref>|capacity]'
const READABLE_STATES = new Set<OrdoAgentOpsSnapshot['state']>(['ready', 'stale'])

const registeredCommandContexts = new WeakSet<object>()

/** Read-only part of the existing Agent Ops gateway used by this package. */
type SnapshotSource = Pick<OrdoAgentOpsGateway, 'snapshot'>

/**
 * Report whether this package's command effect remains registered on one command runtime.
 * @param ctx - context inspected by the package companion.
 * @returns whether the live registry still carries the `/ordo` registration.
 */
export function hasOrdoCommandRegistration(ctx: Context): boolean {
  return registeredCommandContexts.has(ctx.root)
}

/** Build the existing fail-closed state without retaining an owner projection. */
function contractMismatchSnapshot(): OrdoAgentOpsSnapshot {
  return {
    ...needsContractSnapshot(),
    state: 'contract_mismatch',
    freshness: 'stale',
    reasonCode: 'contract_mismatch',
    safeMessage: 'Ordo owner read projection did not match the DSH contract.',
  }
}

/** Read only the existing snapshot gateway and fail closed when its safe projection is absent. */
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

/** URL or token-like fragments that make a one-line command summary unsafe. */
const UNSAFE_SUMMARY_CREDENTIAL = /(?:https?:\/\/|wss?:\/\/|\bBearer\b|\b(?:token|secret|credential|password|api[_-]?key)\b)/iu

/** Absolute-path fragments that make a one-line command summary unsafe. */
const UNSAFE_SUMMARY_PATH = /(?:^|[\s:=])(?:\/|[A-Z]:[\\/])/u

/** Reject strings that would leak a path, URL, token-like value, or control character. */
function isSafeSummaryText(value: string): boolean {
  if (value.length === 0 || /[\u0000-\u001f\u007f]/u.test(value)) return false
  return !(UNSAFE_SUMMARY_CREDENTIAL.test(value) || UNSAFE_SUMMARY_PATH.test(value))
}

/** Render one fixed four-part summary without exposing unmounted-owner facts. */
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

/** Render static syntax help through the same four-part safe summary format. */
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

/** Convert a parser failure to a direct usage error without reflecting unsafe input. */
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

/** Execute one accepted read-only command without calling a provider or mutating owner state. */
function executeOrdoCommand(ctx: Context, invocation: CommandInvocation): CommandResult {
  const command = parseOrdoCommand(invocation.rawInput)
  switch (command.kind) {
    case 'overview': return renderSnapshot(readSnapshot(ctx), undefined, 'overview')
    case 'help': return renderHelp()
    case 'status': return renderSnapshot(readSnapshot(ctx), command.ref, 'status')
    case 'preview': return renderHelpPreview()
    case 'capacity': return renderSnapshot(readSnapshot(ctx), undefined, 'capacity')
    case 'invalid': return syntaxError(command)
    /* v8 ignore next 2 -- the parser owns a closed union and every variant is handled above */
    default: return assertNever(command)
  }
}

/** Render the only truthful preview while no composition-preview owner source is mounted. */
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

/** Fail loudly if the parser adds a new command kind without a renderer. */
function assertNever(value: never): never {
  throw new TypeError(`unknown Ordo command: ${String(value)}`)
}

/**
 * Register `/ordo` only with the existing command runtime and Agent Ops source mounted.
 * @param ctx - Host context carrying the two owned services.
 */
export function apply(ctx: Context): void {
  const commands = ctx.get('commands')
  if (commands === undefined) throw new TypeError('/ordo requires the mounted command runtime')
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
  }, 'host-ordo-commands lifecycle')
}
