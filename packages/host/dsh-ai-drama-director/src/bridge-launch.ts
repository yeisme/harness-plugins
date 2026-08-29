/**
 * Host-approved Workbench launcher.
 *
 * The provider resolves only registry-approved target identities — never a
 * raw origin, route, or credential — and hands the Client nothing but an
 * opaque, short-lived `launchRef` safe projection. Actual origins and any
 * server-to-server exchange stay host-side; Workbench re-authorizes and
 * refetches owner data on ingress. No scheduler, ledger, or terminal-state
 * ownership lives here: bounded maps with TTL sweeps only.
 */

import {
  BRIDGE_V2_CONTRACT,
  WORKBENCH_AGENT_SPATIAL_SURFACE,
  WORKBENCH_TARGET_APPLICATION,
  canonicalizeBridgeV2,
  createWorkbenchAiDramaBridgeV2,
  digestBridgeV2,
  type BridgeV2IssueInput,
  type BridgeV2Intent,
  type BridgeV2ReasonCode,
  type WorkbenchAiDramaBridgeV2,
} from './bridge-v2.js'
import {
  createBridgeEvidenceEmitter,
  type BridgeEvidenceEmitter,
} from './bridge-evidence.js'
import {
  createLegacyBridgeAdapter,
  type LegacyBridgeAdapter,
  type LegacyBridgeIssueInput,
  type LegacyBridgeAdapterResultV1,
} from './legacy-bridge-adapter.js'

const DRAMA_WORKBENCH_HANDOFF_V1 = 'drama.workbench-handoff.v1'
const LAUNCH_REF_PATTERN = /^lref-[0-9a-f]{24}$/

/** Capability probe results are honored for this long before going stale. */
export const BRIDGE_CAPABILITY_FRESHNESS_MS = 300_000

export interface WorkbenchBridgeTargetEntryV1 {
  readonly targetSurfaceId: typeof WORKBENCH_AGENT_SPATIAL_SURFACE
  readonly targetApplication: typeof WORKBENCH_TARGET_APPLICATION
  readonly supportedContracts: readonly string[]
  readonly capabilityVersion: string
  readonly probedAtMs: number
}

/** Keys a registry entry may never carry (origins, routes, auth material). */
const TARGET_ENTRY_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  'targetSurfaceId',
  'targetApplication',
  'supportedContracts',
  'capabilityVersion',
  'probedAtMs',
])

export type WorkbenchBridgeTargetRegistration =
  | { readonly ok: true; readonly entry: WorkbenchBridgeTargetEntryV1 }
  | { readonly ok: false; readonly reason: BridgeV2ReasonCode; readonly detail: string }

export interface WorkbenchBridgeTargetRegistry {
  register(entry: unknown): WorkbenchBridgeTargetRegistration
  resolve(targetSurfaceId: string): WorkbenchBridgeTargetEntryV1 | undefined
  size(): number
}

function isEntryShape(entry: Record<string, unknown>): boolean {
  return entry.targetSurfaceId === WORKBENCH_AGENT_SPATIAL_SURFACE
    && entry.targetApplication === WORKBENCH_TARGET_APPLICATION
    && Array.isArray(entry.supportedContracts)
    && entry.supportedContracts.every(contract => typeof contract === 'string')
    && typeof entry.capabilityVersion === 'string' && entry.capabilityVersion.length > 0 && entry.capabilityVersion.length <= 32
    && typeof entry.probedAtMs === 'number' && Number.isSafeInteger(entry.probedAtMs)
}

/**
 * Trusted target registry. Registration is closed-shape: an entry carrying
 * any key beyond the approved identity fields is rejected (`denied`) so no
 * origin, URL, token, or credential can slip into a launch path.
 */
export function createWorkbenchBridgeTargetRegistry(): WorkbenchBridgeTargetRegistry {
  const entries = new Map<string, WorkbenchBridgeTargetEntryV1>()
  return {
    register(candidate) {
      if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return { ok: false, reason: 'denied', detail: 'target entry is not an object' }
      }
      const record = candidate as Record<string, unknown>
      for (const key of Object.keys(record)) {
        if (!TARGET_ENTRY_ALLOWED_KEYS.has(key)) {
          return { ok: false, reason: 'denied', detail: 'target entry carries a key outside the approved identity shape' }
        }
      }
      if (!isEntryShape(record)) {
        return { ok: false, reason: 'denied', detail: 'target entry does not match the approved identity shape' }
      }
      const entry = record as unknown as WorkbenchBridgeTargetEntryV1
      entries.set(entry.targetSurfaceId, entry)
      return { ok: true, entry }
    },
    resolve(targetSurfaceId) {
      return entries.get(targetSurfaceId)
    },
    size: () => entries.size,
  }
}

export type WorkbenchBridgeCapability =
  | { readonly mode: 'v2'; readonly capabilityVersion: string }
  | { readonly mode: 'legacy_only'; readonly capabilityVersion: string }
  | {
    readonly mode: 'disabled'
    readonly reasonCode: BridgeV2ReasonCode
    readonly detail: string
  }

/**
 * Probes the approved target's advertised contracts with freshness. V2 is
 * preferred; a legacy-only consumer falls back explicitly; a stale or
 * incompatible consumer disables launching with a stable reason — never a
 * guessed URL or a dead button.
 */
export function probeWorkbenchBridgeCapability(
  entry: WorkbenchBridgeTargetEntryV1 | undefined,
  now: () => number = Date.now,
  freshnessWindowMs: number = BRIDGE_CAPABILITY_FRESHNESS_MS,
): WorkbenchBridgeCapability {
  if (entry === undefined) {
    return { mode: 'disabled', reasonCode: 'target_unavailable', detail: 'no approved workbench target is registered' }
  }
  if (now() - entry.probedAtMs > freshnessWindowMs) {
    return { mode: 'disabled', reasonCode: 'stale', detail: 'workbench capability probe is stale' }
  }
  const supportsV2 = entry.supportedContracts.includes(BRIDGE_V2_CONTRACT)
  const supportsLegacy = entry.supportedContracts.includes(DRAMA_WORKBENCH_HANDOFF_V1)
  if (supportsV2) return { mode: 'v2', capabilityVersion: entry.capabilityVersion }
  if (supportsLegacy) return { mode: 'legacy_only', capabilityVersion: entry.capabilityVersion }
  return { mode: 'disabled', reasonCode: 'contract_mismatch', detail: 'workbench consumer advertises no compatible contract' }
}

/** Safe launch projection — the only thing the Client ever receives. */
export interface WorkbenchLaunchDescriptorV2 {
  readonly launchRef: string
  readonly targetApplication: typeof WORKBENCH_TARGET_APPLICATION
  readonly targetSurfaceId: typeof WORKBENCH_AGENT_SPATIAL_SURFACE
  readonly presentationIntent: BridgeV2Intent
  readonly expiresAtUnixMs: number
  readonly capabilityVersion: string
}

export type WorkbenchBridgeIssuance =
  | { readonly ok: true; readonly mode: 'v2'; readonly descriptor: WorkbenchLaunchDescriptorV2 }
  | { readonly ok: true; readonly mode: 'legacy_bridge'; readonly legacy: LegacyBridgeAdapterResultV1 }
  | {
    readonly ok: false
    readonly disabledReason: BridgeV2ReasonCode
    readonly capabilityVersion?: string
    readonly detail: string
  }

export type WorkbenchBridgeConsumption =
  | {
    readonly ok: true
    readonly state: 'launched'
    readonly launchRef: string
    readonly presentationIntent: BridgeV2Intent
    readonly consumedAtMs: number
  }
  | {
    readonly ok: false
    readonly state: 'expired' | 'unknown'
    readonly reason: BridgeV2ReasonCode
    readonly launchRef?: string
  }

export interface WorkbenchLaunchProviderIssueInput {
  readonly v2: BridgeV2IssueInput
  readonly legacy: LegacyBridgeIssueInput
}

export interface WorkbenchLaunchProvider {
  /** Rollback switch: stops V2 issuance immediately; existing refs expire naturally. */
  setEnabled(enabled: boolean): void
  isEnabled(): boolean
  issue(input: WorkbenchLaunchProviderIssueInput): WorkbenchBridgeIssuance
  consume(launchRef: string): WorkbenchBridgeConsumption
}

interface LaunchRecord {
  readonly launchRef: string
  readonly canonicalDigest: string
  readonly envelope: WorkbenchAiDramaBridgeV2
  readonly expiresAtUnixMs: number
  consumedAtMs?: number
  lastResult?: WorkbenchBridgeConsumption
}

function generateLaunchRef(): string | undefined {
  const source = (globalThis as { readonly crypto?: { getRandomValues?: (buffer: Uint8Array) => Uint8Array } }).crypto
  if (source?.getRandomValues === undefined) return undefined
  const bytes = new Uint8Array(12)
  source.getRandomValues(bytes)
  return `lref-${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`
}

export interface WorkbenchLaunchProviderOptions {
  readonly registry: WorkbenchBridgeTargetRegistry
  /** Feature flag; off by default so rollout is canary-gated. */
  readonly enabled?: boolean
  readonly legacyAdapter?: LegacyBridgeAdapter
  readonly evidence?: BridgeEvidenceEmitter
  readonly ttlMs?: number
  readonly capacity?: number
  readonly now?: () => number
}

/**
 * Host-approved launcher. Duplicate canonical requests (same nonce, same
 * payload) return the same launchRef — bounded idempotency, not a ledger.
 * The same nonce with a different payload is a `replay_conflict`.
 */
export function createWorkbenchLaunchProvider(
  options: WorkbenchLaunchProviderOptions,
): WorkbenchLaunchProvider {
  const now = options.now ?? Date.now
  const registry = options.registry
  const legacyAdapter = options.legacyAdapter ?? createLegacyBridgeAdapter()
  const evidence = options.evidence ?? createBridgeEvidenceEmitter()
  const capacity = Math.max(1, options.capacity ?? 128)
  let enabled = options.enabled ?? false

  const byRef = new Map<string, LaunchRecord>()
  const byCanonical = new Map<string, LaunchRecord>()
  const byNonce = new Map<string, LaunchRecord>()

  const evict = (): void => {
    while (byRef.size > capacity) {
      const oldest = byRef.keys().next()
      if (oldest.done) break
      const record = byRef.get(oldest.value)
      byRef.delete(oldest.value)
      if (record !== undefined) {
        byCanonical.delete(record.canonicalDigest)
        if (byNonce.get(record.envelope.nonce) === record) byNonce.delete(record.envelope.nonce)
      }
    }
  }

  return {
    setEnabled(next) {
      enabled = next
    },
    isEnabled: () => enabled,

    issue(input) {
      const entry = registry.resolve(WORKBENCH_AGENT_SPATIAL_SURFACE)
      const capability = probeWorkbenchBridgeCapability(entry, now)

      if (capability.mode === 'disabled') {
        const evidenceKind = capability.reasonCode === 'target_unavailable'
          ? 'bridge_target_unavailable'
          : capability.reasonCode === 'stale'
            ? 'bridge_target_unavailable'
            : 'bridge_contract_mismatch'
        evidence.emit({
          kind: evidenceKind,
          intent: input.v2.presentationIntent,
          reasonCode: capability.reasonCode,
        })
        return {
          ok: false,
          disabledReason: capability.reasonCode,
          detail: capability.detail,
          ...(entry === undefined ? {} : { capabilityVersion: entry.capabilityVersion }),
        }
      }

      const useV2 = enabled && capability.mode === 'v2'
      if (!useV2) {
        // V2 off (rollback/canary) or consumer is legacy-only: explicit,
        // labeled legacy adapter — never reported as V2 consumption.
        const legacy = legacyAdapter.issue(input.legacy)
        if (legacy === undefined) {
          evidence.emit({ kind: 'bridge_denied', intent: input.v2.presentationIntent, reasonCode: 'legacy_bridge' })
          return {
            ok: false,
            disabledReason: 'legacy_bridge',
            detail: enabled
              ? 'consumer is legacy-only and the legacy adapter rejected the handoff'
              : 'V2 issuance is disabled and no usable legacy handoff could be issued',
            ...(entry === undefined ? {} : { capabilityVersion: entry.capabilityVersion }),
          }
        }
        evidence.emit({ kind: 'bridge_issued', intent: input.v2.presentationIntent, reasonCode: 'legacy_bridge' })
        return { ok: true, mode: 'legacy_bridge', legacy }
      }

      const issued = createWorkbenchAiDramaBridgeV2({ ...input.v2, ...(options.ttlMs === undefined ? {} : { ttlMs: options.ttlMs }) })
      if (!issued.ok) {
        evidence.emit({ kind: 'bridge_contract_mismatch', intent: input.v2.presentationIntent, reasonCode: issued.reason })
        return { ok: false, disabledReason: issued.reason, detail: issued.detail, capabilityVersion: entry?.capabilityVersion }
      }
      const envelope = issued.envelope
      const canonicalDigest = digestBridgeV2(envelope)

      const nonceOwner = byNonce.get(envelope.nonce)
      if (nonceOwner !== undefined && nonceOwner.canonicalDigest !== canonicalDigest) {
        evidence.emit({ kind: 'bridge_contract_mismatch', intent: envelope.presentationIntent, reasonCode: 'replay_conflict' })
        return {
          ok: false,
          disabledReason: 'replay_conflict',
          detail: 'nonce was already issued with a different canonical payload',
          capabilityVersion: entry?.capabilityVersion,
        }
      }

      const existing = byCanonical.get(canonicalDigest)
      if (existing !== undefined && existing.expiresAtUnixMs > now()) {
        // Bounded idempotency: identical canonical request, same launchRef.
        evidence.emit({ kind: 'bridge_issued', intent: envelope.presentationIntent, correlationRef: existing.launchRef })
        return {
          ok: true,
          mode: 'v2',
          descriptor: {
            launchRef: existing.launchRef,
            targetApplication: WORKBENCH_TARGET_APPLICATION,
            targetSurfaceId: WORKBENCH_AGENT_SPATIAL_SURFACE,
            presentationIntent: envelope.presentationIntent,
            expiresAtUnixMs: existing.expiresAtUnixMs,
            capabilityVersion: entry?.capabilityVersion ?? '',
          },
        }
      }

      const launchRef = generateLaunchRef()
      if (launchRef === undefined || !LAUNCH_REF_PATTERN.test(launchRef)) {
        evidence.emit({ kind: 'bridge_denied', intent: envelope.presentationIntent, reasonCode: 'unknown' })
        return {
          ok: false,
          disabledReason: 'unknown',
          detail: 'no cryptographic entropy source is available to mint a launchRef',
          capabilityVersion: entry?.capabilityVersion,
        }
      }

      const record: LaunchRecord = {
        launchRef,
        canonicalDigest,
        envelope,
        expiresAtUnixMs: envelope.expiresAtUnixMs,
      }
      byRef.set(launchRef, record)
      byCanonical.set(canonicalDigest, record)
      byNonce.set(envelope.nonce, record)
      evict()

      evidence.emit({
        kind: 'bridge_issued',
        intent: envelope.presentationIntent,
        correlationRef: launchRef,
        ...(envelope.resourceVersion === undefined ? {} : { resourceVersion: envelope.resourceVersion }),
        ...(envelope.contextRevision === undefined ? {} : { contextRevision: envelope.contextRevision }),
      })
      return {
        ok: true,
        mode: 'v2',
        descriptor: {
          launchRef,
          targetApplication: WORKBENCH_TARGET_APPLICATION,
          targetSurfaceId: WORKBENCH_AGENT_SPATIAL_SURFACE,
          presentationIntent: envelope.presentationIntent,
          expiresAtUnixMs: envelope.expiresAtUnixMs,
          capabilityVersion: entry?.capabilityVersion ?? '',
        },
      }
    },

    consume(launchRef) {
      evidence.emit({ kind: 'bridge_launch_requested', correlationRef: launchRef })
      const record = byRef.get(launchRef)
      if (record === undefined) {
        return { ok: false, state: 'unknown', reason: 'unknown' }
      }
      if (record.lastResult !== undefined) {
        // Idempotent: the same launchRef returns its original result.
        return record.lastResult
      }
      if (record.expiresAtUnixMs <= now()) {
        const result: WorkbenchBridgeConsumption = { ok: false, state: 'expired', reason: 'expired', launchRef }
        record.lastResult = result
        evidence.emit({ kind: 'bridge_expired', intent: record.envelope.presentationIntent, correlationRef: launchRef, reasonCode: 'expired' })
        return result
      }
      const consumedAtMs = now()
      const result: WorkbenchBridgeConsumption = {
        ok: true,
        state: 'launched',
        launchRef,
        presentationIntent: record.envelope.presentationIntent,
        consumedAtMs,
      }
      record.consumedAtMs = consumedAtMs
      record.lastResult = result
      evidence.emit({
        kind: 'bridge_consumed',
        intent: record.envelope.presentationIntent,
        correlationRef: launchRef,
        ...(record.envelope.resourceVersion === undefined ? {} : { resourceVersion: record.envelope.resourceVersion }),
      })
      return result
    },
  }
}

/** Exposed for conformance tooling: canonical serialization of a record body. */
export function bridgeV2CanonicalBody(envelope: WorkbenchAiDramaBridgeV2): string {
  return canonicalizeBridgeV2(envelope)
}
