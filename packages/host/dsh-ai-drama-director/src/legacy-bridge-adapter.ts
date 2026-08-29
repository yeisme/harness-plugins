/**
 * Explicit legacy bridge adapter.
 *
 * The V1 signer (`createWorkbenchHandoff`) and validator
 * (`verifyWorkbenchHandoff`) stay unchanged during the V2 migration window:
 * at least `LEGACY_BRIDGE_COMPAT_WINDOW_RELEASES` consecutive DSH plugin
 * release windows, field meanings frozen. Removing the legacy contract
 * requires a separate, dedicated change — never this adapter silently
 * reinterpreting V1 fields.
 *
 * The adapter only labels: a legacy result is always marked
 * `legacy_bridge` and must never be reported as V2 consumption.
 */

import {
  createWorkbenchHandoff,
  verifyWorkbenchHandoff,
  type SignedWorkbenchHandoffV1,
  type WorkbenchHandoffIntentV1,
} from './handoff.js'

export const LEGACY_BRIDGE_COMPAT_WINDOW_RELEASES = 2
export const LEGACY_BRIDGE_MODE = 'legacy_bridge' as const

export interface LegacyBridgeIssueInput {
  readonly contextRef: string
  readonly targetSurface: string
  readonly presentationIntent: WorkbenchHandoffIntentV1
  readonly nonce: string
  readonly expiresAt: number
  readonly artifactRef?: string
  readonly receiptRef?: string
}

export interface LegacyBridgeAdapterResultV1 {
  /** Always `legacy_bridge`; a stable label for UI and telemetry. */
  readonly mode: typeof LEGACY_BRIDGE_MODE
  readonly signed: SignedWorkbenchHandoffV1
}

export interface LegacyBridgeAdapter {
  /** Wraps the unchanged V1 signer; undefined when V1 validation fails. */
  issue(input: LegacyBridgeIssueInput): LegacyBridgeAdapterResultV1 | undefined
  /** Delegates to the unchanged V1 validator. */
  verify(signed: SignedWorkbenchHandoffV1, now?: number): ReturnType<typeof verifyWorkbenchHandoff>
  /** True only for adapter-produced (labeled) results. */
  isLegacyResult(value: unknown): value is LegacyBridgeAdapterResultV1
}

export function createLegacyBridgeAdapter(): LegacyBridgeAdapter {
  return {
    issue(input) {
      const signed = createWorkbenchHandoff(input)
      if (signed === undefined) return undefined
      return { mode: LEGACY_BRIDGE_MODE, signed }
    },
    verify: (signed, now) => verifyWorkbenchHandoff(signed, now),
    isLegacyResult(value): value is LegacyBridgeAdapterResultV1 {
      if (value === null || typeof value !== 'object') return false
      const candidate = value as Partial<LegacyBridgeAdapterResultV1>
      return candidate.mode === LEGACY_BRIDGE_MODE
        && typeof candidate.signed === 'object' && candidate.signed !== null
        && typeof (candidate.signed as SignedWorkbenchHandoffV1).digest === 'string'
    },
  }
}
