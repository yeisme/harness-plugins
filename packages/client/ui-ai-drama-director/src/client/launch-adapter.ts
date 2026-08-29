/**
 * Host-approved Workbench launcher adapter (client side).
 *
 * The client never composes a URL, origin, route, or query string. It asks
 * the host-approved launch channel for a descriptor carrying only an opaque
 * short-lived `launchRef` and displays the declared surface, lens intent,
 * contract version, and expiry. Unknown or partial outcomes disable retry —
 * the user explicitly requests a fresh handoff or a status check; nothing
 * auto-mutates, replaces a writer, or synthesizes terminal state.
 */

import {
  BRIDGE_V2_CONTRACT,
  BRIDGE_V2_INTENTS,
  BRIDGE_V2_LENS_MAP,
  type BridgeV2Intent,
  type BridgeV2ReasonCode,
} from '@yeisme/dsh-ai-drama-director'

export const WORKBENCH_LAUNCH_REF_PATTERN = /^lref-[0-9a-f]{24}$/

export interface WorkbenchLaunchDescriptorInputV2 {
  readonly launchRef: string
  readonly targetApplication: string
  readonly targetSurfaceId: string
  readonly presentationIntent: BridgeV2Intent
  readonly expiresAtUnixMs: number
  readonly capabilityVersion: string
}

export type WorkbenchLaunchActivationState =
  | 'launched'
  | 'legacy_bridge'
  | 'disabled'
  | 'unknown'

export interface WorkbenchLaunchActivationV1 {
  readonly state: WorkbenchLaunchActivationState
  readonly legacy: boolean
  readonly contractVersion: typeof BRIDGE_V2_CONTRACT
  readonly intent?: BridgeV2Intent
  readonly lens?: string
  readonly focus?: string
  readonly lensLabel?: string
  readonly expiresAtUnixMs?: number
  readonly capabilityVersion?: string
  readonly disabledReason?: BridgeV2ReasonCode
}

export interface WorkbenchLaunchRequest {
  readonly intent: BridgeV2Intent
}

export interface WorkbenchLaunchAdapterOptions {
  /** The only launch channel: a host-approved transport member. */
  readonly requestLaunch: (request: WorkbenchLaunchRequest) => Promise<unknown>
  readonly now?: () => number
}

export interface WorkbenchLaunchAdapter {
  activate(intent: BridgeV2Intent): Promise<WorkbenchLaunchActivationV1>
  /** Unknown and partial outcomes never auto-retry. */
  canRetry(): false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const DESCRIPTOR_KEYS: ReadonlySet<string> = new Set([
  'launchRef',
  'targetApplication',
  'targetSurfaceId',
  'presentationIntent',
  'expiresAtUnixMs',
  'capabilityVersion',
])

/**
 * Closed-shape validation of the safe launch projection. A descriptor
 * carrying unknown keys, a non-conforming launchRef, or a wrong target is
 * not trusted — the activation degrades to `unknown` instead of guessing.
 */
export function validateWorkbenchLaunchDescriptor(input: unknown): WorkbenchLaunchDescriptorInputV2 | undefined {
  if (!isRecord(input)) return undefined
  for (const key of Object.keys(input)) {
    if (!DESCRIPTOR_KEYS.has(key)) return undefined
  }
  if (typeof input.launchRef !== 'string' || !WORKBENCH_LAUNCH_REF_PATTERN.test(input.launchRef)) return undefined
  if (input.targetApplication !== 'yeisme-workbench') return undefined
  if (input.targetSurfaceId !== 'workbench.agent.spatial') return undefined
  if (typeof input.presentationIntent !== 'string' || !BRIDGE_V2_INTENTS.includes(input.presentationIntent as BridgeV2Intent)) return undefined
  if (typeof input.expiresAtUnixMs !== 'number' || !Number.isSafeInteger(input.expiresAtUnixMs)) return undefined
  if (typeof input.capabilityVersion !== 'string' || input.capabilityVersion.length > 32) return undefined
  return input as unknown as WorkbenchLaunchDescriptorInputV2
}

/** Closed intent → lens preview for UI display (no route, no URL). */
export function bridgeLensPreview(intent: BridgeV2Intent): {
  readonly lens: string
  readonly focus: string
  readonly label: string
} {
  return BRIDGE_V2_LENS_MAP[intent]
}

function unknownActivation(): WorkbenchLaunchActivationV1 {
  return { state: 'unknown', legacy: false, contractVersion: BRIDGE_V2_CONTRACT }
}

export function createWorkbenchLaunchAdapter(options: WorkbenchLaunchAdapterOptions): WorkbenchLaunchAdapter {
  return {
    async activate(intent) {
      let raw: unknown
      try {
        raw = await options.requestLaunch({ intent })
      } catch {
        return unknownActivation()
      }
      if (!isRecord(raw)) return unknownActivation()

      if (raw.mode === 'legacy_bridge' && raw.ok === true) {
        // Explicitly labeled legacy path; success here is never V2 consumption.
        return { state: 'legacy_bridge', legacy: true, contractVersion: BRIDGE_V2_CONTRACT, intent }
      }
      if (raw.ok === false) {
        const reason = raw.disabledReason
        if (typeof reason !== 'string' || reason.length === 0) return unknownActivation()
        return {
          state: 'disabled',
          legacy: false,
          contractVersion: BRIDGE_V2_CONTRACT,
          intent,
          disabledReason: reason as BridgeV2ReasonCode,
        }
      }
      if (raw.mode === 'v2' && raw.ok === true) {
        const descriptor = validateWorkbenchLaunchDescriptor(raw.descriptor)
        if (descriptor === undefined) return unknownActivation()
        const preview = bridgeLensPreview(descriptor.presentationIntent)
        return {
          state: 'launched',
          legacy: false,
          contractVersion: BRIDGE_V2_CONTRACT,
          intent: descriptor.presentationIntent,
          lens: preview.lens,
          focus: preview.focus,
          lensLabel: preview.label,
          expiresAtUnixMs: descriptor.expiresAtUnixMs,
          capabilityVersion: descriptor.capabilityVersion,
        }
      }
      return unknownActivation()
    },
    canRetry: () => false,
  }
}

/** Human-facing summary; contains no envelope body, origin, or URL. */
export function describeWorkbenchLaunch(
  activation: WorkbenchLaunchActivationV1,
  now: () => number = Date.now,
): string {
  switch (activation.state) {
    case 'launched':
      return `Workbench ${activation.lensLabel} lens · ${activation.intent} · ${activation.contractVersion} · expires in ${Math.max(0, Math.round(((activation.expiresAtUnixMs ?? 0) - now()) / 1000))}s`
    case 'legacy_bridge':
      return `[legacy_bridge] Workbench handoff issued via the legacy V1 contract; open Workbench to continue.`
    case 'disabled':
      return `Workbench launch disabled: ${activation.disabledReason}; request a status check or a freshly issued handoff.`
    case 'unknown':
      return `Workbench launch outcome unknown; run an explicit status check or request a new handoff — no automatic retry.`
  }
}
