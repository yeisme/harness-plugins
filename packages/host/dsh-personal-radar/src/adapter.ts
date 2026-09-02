/**
 * Fixed-command Radar adapter.
 *
 * The adapter maps typed intents to the frozen Radar MCP argv
 * `mcp --transport stdio --lane <lane>` plus one typed MCP request. The
 * binary name comes from user-level config; intents carrying binary/argv,
 * cwd, env overrides, or an unregistered method fail closed. Process
 * execution is delegated to an injected runner so tests and the browser
 * projection never touch the shell.
 */

import {
  RADAR_RECEIPT_SCHEMA,
  type RadarActionReceiptV1,
  type RadarIntentV1,
  type RadarLane,
} from './contracts.js'
import { RADAR_INTENT_OPERATIONS, type RadarOperationV1 } from './intersection.js'

export const RADAR_FIXED_ARGV = ['mcp', '--transport', 'stdio'] as const

export interface RadarAdapterConfigV1 {
  /** Bare executable name from user-level config; no path separators. */
  readonly binary: string
}

export interface RadarSpawnDescriptorV1 {
  readonly binary: string
  readonly argv: readonly string[]
  readonly request: RadarMcpRequestV1
}

export interface RadarMcpRequestV1 {
  readonly tool: 'radar.search' | 'radar.execute'
  readonly args: Readonly<Record<string, unknown>>
  readonly lane: RadarLane
}

export interface RadarRunnerResultV1 {
  readonly ok: boolean
  readonly receipt?: Omit<RadarActionReceiptV1, 'schema' | 'idempotencyKey'>
  readonly error?: string
}

export type RadarRunner = (descriptor: RadarSpawnDescriptorV1) => Promise<RadarRunnerResultV1>

export type RadarAdapterRejectReason = 'unsafe_binary' | 'unregistered_method' | 'spawn_failed'

export type RadarAdapterResult =
  | { readonly ok: true; readonly receipt: RadarActionReceiptV1 }
  | { readonly ok: false; readonly reason: RadarAdapterRejectReason; readonly detail: string }

const SAFE_BINARY = /^[a-z0-9][a-z0-9._-]{0,63}$/i

/** Binary must be a bare executable name; paths, flags, and env are rejected. */
export function isSafeRadarBinary(binary: string): boolean {
  return SAFE_BINARY.test(binary) && !binary.includes('/') && !binary.includes('\\')
}

/** Resolve the lane + MCP request for an intent. Returns undefined for unregistered kinds. */
export function resolveRadarSpawn(config: RadarAdapterConfigV1, intent: RadarIntentV1): RadarSpawnDescriptorV1 | undefined {
  if (!isSafeRadarBinary(config.binary)) return undefined
  const operation: RadarOperationV1 | undefined = RADAR_INTENT_OPERATIONS[intent.kind]
  if (operation === undefined) return undefined

  const argv: readonly string[] = [...RADAR_FIXED_ARGV, '--lane', operation.lane]
  if (operation.tool === 'radar.search') {
    return {
      binary: config.binary,
      argv,
      request: {
        tool: 'radar.search',
        lane: operation.lane,
        args: {
          view: 'opportunities',
          ...(intent.opportunityRefs.length > 0 ? { refs: [...intent.opportunityRefs] } : {}),
        },
      },
    }
  }
  if (operation.action === 'feedback_add') {
    const [ref] = intent.opportunityRefs
	const kind = intent.kind === 'save' ? 'saved' : 'dismissed'
    return {
      binary: config.binary,
      argv,
      request: {
        tool: 'radar.execute',
        lane: operation.lane,
        args: {
          action: 'feedback_add',
		  input: {
			opportunity_ref: ref,
			kind,
			idempotency_key: intent.idempotencyKey,
		  },
        },
      },
    }
  }
  // operator lane is edition_build only; collect/daily_run are never emitted.
  return {
    binary: config.binary,
    argv,
    request: {
      tool: 'radar.execute',
      lane: 'operator',
      args: {
        action: 'edition_build',
		input: {},
      },
    },
  }
}

/**
 * Dispatch one intent through the injected runner. Unknown runner outcomes
 * surface as `unknown` receipts; the adapter never retries on its own.
 */
export async function dispatchRadarIntent(
  config: RadarAdapterConfigV1,
  intent: RadarIntentV1,
  runner: RadarRunner,
): Promise<RadarAdapterResult> {
  if (!isSafeRadarBinary(config.binary)) {
    return { ok: false, reason: 'unsafe_binary', detail: 'radar binary failed the safe-name check' }
  }
  const descriptor = resolveRadarSpawn(config, intent)
  if (descriptor === undefined) {
    return { ok: false, reason: 'unregistered_method', detail: `intent kind ${intent.kind} has no registered spawn` }
  }
  let result: RadarRunnerResultV1
  try {
    result = await runner(descriptor)
  } catch (error) {
    return { ok: false, reason: 'spawn_failed', detail: error instanceof Error ? error.message : 'runner failed' }
  }
  if (!result.ok || result.receipt === undefined) {
    return {
      ok: true,
      receipt: {
        schema: RADAR_RECEIPT_SCHEMA,
        idempotencyKey: intent.idempotencyKey,
        outcome: 'unknown',
        reason: result.error ?? 'radar owner outcome unknown; reconcile by run ref',
      },
    }
  }
  return {
    ok: true,
    receipt: {
      schema: RADAR_RECEIPT_SCHEMA,
      idempotencyKey: intent.idempotencyKey,
      ...result.receipt,
    },
  }
}
