/**
 * Cross-repository conformance evaluation.
 *
 * Canonical fixtures plus this reference evaluator define the shared
 * acceptance semantics for the V2 bridge: DSH executes them in its own
 * tests, and the Workbench consumer implements the same outcomes against
 * the same fixture files (fixture version must match) before rollout
 * readiness can be claimed. The ingress evaluator is a reference state
 * machine — Workbench keeps its own server-side implementation.
 */

import {
  BRIDGE_V2_LENS_MAP,
  digestBridgeV2,
  validateWorkbenchAiDramaBridgeV2,
  type BridgeV2IssueInput,
  type BridgeV2ReasonCode,
  type BridgeV2Intent,
  type WorkbenchAiDramaBridgeV2,
} from './bridge-v2.js'
import {
  createWorkbenchLaunchProvider,
  createWorkbenchBridgeTargetRegistry,
  probeWorkbenchBridgeCapability,
  BRIDGE_CAPABILITY_FRESHNESS_MS,
  type WorkbenchBridgeTargetEntryV1,
} from './bridge-launch.js'

export const BRIDGE_V2_FIXTURE_VERSION = '2026-08-29.1'

export type BridgeFixtureKind = 'validate' | 'issue' | 'consume' | 'ingress'
export type BridgeFixtureActor = 'provider' | 'consumer' | 'both'

export interface BridgeFixtureCase {
  readonly id: string
  readonly kind: BridgeFixtureKind
  readonly actor: BridgeFixtureActor
  readonly category: string
  readonly describe: string
  readonly given: Record<string, unknown>
  readonly expect: {
    readonly ok: boolean
    readonly reason?: BridgeV2ReasonCode
    readonly mode?: 'v2' | 'legacy_bridge'
    readonly state?: string
    readonly lens?: string
    readonly focus?: string
  }
}

export interface BridgeFixtureManifest {
  readonly fixtureVersion: string
  readonly contract: string
  readonly cases: readonly {
    readonly id: string
    readonly file: string
    readonly kind: BridgeFixtureKind
    readonly actor: BridgeFixtureActor
  }[]
}

/* -------------------- fixture payload helpers -------------------- */

export const BRIDGE_FIXTURE_BASE_INPUT: Omit<BridgeV2IssueInput, 'presentationIntent'> = {
  sourceSurfaceId: 'dsh.drama.director',
  workspaceRef: 'ws:alpha',
  projectRef: 'proj:drama-1',
  showRef: 'show:101',
  episodeRef: 'ep:5',
  resourceRef: 'artifact:shot-boards-12',
  resourceVersion: 'r42',
  contextRevision: 7,
  artifactRef: 'artifact:shot-boards-12',
  ttlMs: 300_000,
}

export const BRIDGE_FIXTURE_NOW_MS = 1_800_000_000_000

export const BRIDGE_FIXTURE_NONCE = '0123456789abcdef0123456789abcdef'

export const BRIDGE_FIXTURE_TARGET: WorkbenchBridgeTargetEntryV1 = {
  targetSurfaceId: 'workbench.agent.spatial',
  targetApplication: 'yeisme-workbench',
  supportedContracts: ['dsh.workbench_ai_drama_bridge.v2', 'drama.workbench-handoff.v1'],
  capabilityVersion: 'wb-2026.08',
  probedAtMs: BRIDGE_FIXTURE_NOW_MS,
}

/** Builds a deterministic, digest-complete envelope for fixture files. */
export function buildBridgeFixtureEnvelope(
  overrides: Partial<Omit<WorkbenchAiDramaBridgeV2, 'contractDigest'>> = {},
): WorkbenchAiDramaBridgeV2 {
  const base: Omit<WorkbenchAiDramaBridgeV2, 'contractDigest'> = {
    contractVersion: 'dsh.workbench_ai_drama_bridge.v2',
    direction: 'dsh_to_workbench',
    sourceSurfaceId: BRIDGE_FIXTURE_BASE_INPUT.sourceSurfaceId,
    targetSurfaceId: 'workbench.agent.spatial',
    workspaceRef: BRIDGE_FIXTURE_BASE_INPUT.workspaceRef,
    projectRef: BRIDGE_FIXTURE_BASE_INPUT.projectRef,
    showRef: BRIDGE_FIXTURE_BASE_INPUT.showRef,
    episodeRef: BRIDGE_FIXTURE_BASE_INPUT.episodeRef,
    resourceRef: BRIDGE_FIXTURE_BASE_INPUT.resourceRef,
    resourceVersion: BRIDGE_FIXTURE_BASE_INPUT.resourceVersion,
    contextRevision: BRIDGE_FIXTURE_BASE_INPUT.contextRevision,
    presentationIntent: 'open_artifact',
    expiresAtUnixMs: BRIDGE_FIXTURE_NOW_MS + 300_000,
    nonce: BRIDGE_FIXTURE_NONCE,
    ...overrides,
  }
  return { ...base, contractDigest: digestBridgeV2(base) }
}

/* -------------------- kind: validate -------------------- */

export function evaluateBridgeV2Validate(envelope: unknown, nowMs: number = BRIDGE_FIXTURE_NOW_MS): BridgeFixtureCase['expect'] {
  const result = validateWorkbenchAiDramaBridgeV2(envelope, () => nowMs)
  if (result.ok) return { ok: true }
  return { ok: false, reason: result.reason }
}

/* -------------------- kind: issue -------------------- */

/** Fixture target aliases; 'default' and BRIDGE_FIXTURE_TARGET are identical. */
export function resolveBridgeFixtureTarget(
  alias: string | WorkbenchBridgeTargetEntryV1 | null | undefined,
  nowMs: number = BRIDGE_FIXTURE_NOW_MS,
): WorkbenchBridgeTargetEntryV1 | null {
  if (alias === null || alias === undefined) return null
  if (typeof alias !== 'string') return alias
  switch (alias) {
    case 'default':
      return BRIDGE_FIXTURE_TARGET
    case 'legacy-only':
      return { ...BRIDGE_FIXTURE_TARGET, supportedContracts: ['drama.workbench-handoff.v1'] }
    case 'stale':
      return { ...BRIDGE_FIXTURE_TARGET, probedAtMs: nowMs - (BRIDGE_CAPABILITY_FRESHNESS_MS + 1) }
    case 'incompatible':
      return { ...BRIDGE_FIXTURE_TARGET, supportedContracts: ['workbench.other.v9'] }
    default:
      return null
  }
}

export function evaluateBridgeV2Issue(given: {
  readonly target?: string | WorkbenchBridgeTargetEntryV1 | null
  readonly enabled?: boolean
  readonly request?: Partial<BridgeV2IssueInput>
  readonly repeat?: number
  readonly conflictRequest?: Partial<BridgeV2IssueInput>
  readonly nowMs?: number
}): BridgeFixtureCase['expect'] {
  const nowMs = given.nowMs ?? BRIDGE_FIXTURE_NOW_MS
  const registry = createWorkbenchBridgeTargetRegistry()
  // `null` means "no registered consumer" and must not fall back to default.
  const target = resolveBridgeFixtureTarget(given.target === undefined ? 'default' : given.target, nowMs)
  if (target !== null) {
    registry.register(target)
  }
  const provider = createWorkbenchLaunchProvider({
    registry,
    enabled: given.enabled ?? true,
    now: () => nowMs,
  })
  const request: BridgeV2IssueInput = {
    ...BRIDGE_FIXTURE_BASE_INPUT,
    presentationIntent: 'open_artifact',
    now: () => nowMs,
    ...given.request,
  }
  const legacyInput = {
    contextRef: request.showRef,
    targetSurface: 'workbench',
    presentationIntent: 'open_show',
    nonce: 'fixture-legacy-nonce',
    expiresAt: nowMs + 300_000,
  } as const

  let result = provider.issue({ v2: request, legacy: legacyInput })
  for (let index = 1; index < (given.repeat ?? 1); index += 1) {
    result = provider.issue({ v2: request, legacy: legacyInput })
  }
  if (given.conflictRequest !== undefined) {
    result = provider.issue({
      v2: { ...request, ...given.conflictRequest, now: () => nowMs },
      legacy: legacyInput,
    })
  }
  if (result.ok) {
    return { ok: true, mode: result.mode }
  }
  return { ok: false, reason: result.disabledReason }
}

/* -------------------- kind: consume -------------------- */

export function evaluateBridgeV2Consume(given: {
  readonly request?: Partial<BridgeV2IssueInput>
  readonly advanceMs?: number
  readonly launchRef?: string
  readonly nowMs?: number
}): { readonly expect: BridgeFixtureCase['expect']; readonly launchRef?: string } {
  const baseMs = given.nowMs ?? BRIDGE_FIXTURE_NOW_MS
  let clock = baseMs
  const registry = createWorkbenchBridgeTargetRegistry()
  registry.register(BRIDGE_FIXTURE_TARGET)
  const provider = createWorkbenchLaunchProvider({ registry, enabled: true, now: () => clock })
  const request: BridgeV2IssueInput = {
    ...BRIDGE_FIXTURE_BASE_INPUT,
    presentationIntent: 'open_artifact',
    now: () => clock,
    ...given.request,
  }
  const issued = provider.issue({
    v2: request,
    legacy: { contextRef: 'show:101', targetSurface: 'workbench', presentationIntent: 'open_show', nonce: 'fixture-legacy-nonce', expiresAt: clock + 300_000 },
  })
  if (!issued.ok || issued.mode !== 'v2') {
    return { expect: { ok: false, reason: 'unknown' } }
  }
  clock = baseMs + (given.advanceMs ?? 0)
  const consumed = provider.consume(given.launchRef ?? issued.descriptor.launchRef)
  return {
    expect: consumed.ok
      ? { ok: true, state: consumed.state }
      : { ok: false, state: consumed.state, reason: consumed.reason },
    launchRef: issued.descriptor.launchRef,
  }
}

/* -------------------- kind: ingress (reference consumer) -------------------- */

export interface BridgeIngressOwnerSnapshot {
  readonly resourceExists: boolean
  readonly ownerResourceVersion?: string
  readonly ownerContextRevision?: number
  readonly principalAuthorized: boolean
}

interface ReplayEntry {
  readonly canonicalDigest: string
  readonly outcome: BridgeFixtureCase['expect']
}

const REPLAY_CAPACITY = 256

/**
 * Reference Workbench ingress: revalidate → replay record → authorization →
 * version reconcile → lens mapping. Never trusts DSH-authored permissions
 * or terminal state; never mutates owner data on failure.
 */
export function evaluateBridgeV2Ingress(given: {
  readonly envelope: unknown
  readonly owner: BridgeIngressOwnerSnapshot
  readonly tenantRef?: string
  readonly replayBefore?: readonly { readonly envelope: unknown; readonly tenantRef?: string }[]
  readonly nowMs?: number
}): BridgeFixtureCase['expect'] {
  const nowMs = given.nowMs ?? BRIDGE_FIXTURE_NOW_MS
  const replay = new Map<string, ReplayEntry>()
  const tenant = given.tenantRef ?? 'tenant:fixture'

  const runOnce = (envelope: unknown, tenantKey: string): BridgeFixtureCase['expect'] => {
    const validated = validateWorkbenchAiDramaBridgeV2(envelope, () => nowMs)
    if (!validated.ok) {
      // Ingress surfaces structural damage as contract mismatch; expiry
      // keeps its dedicated terminal state.
      return validated.reason === 'expired'
        ? { ok: false, state: 'expired', reason: 'expired' }
        : { ok: false, state: 'contract_mismatch', reason: 'contract_mismatch' }
    }
    const replayKey = `${tenantKey}|${validated.envelope.nonce}|${validated.envelope.contractVersion}`
    const canonicalDigest = digestBridgeV2(validated.envelope)
    const prior = replay.get(replayKey)
    if (prior !== undefined) {
      if (prior.canonicalDigest !== canonicalDigest) {
        return { ok: false, state: 'replay_conflict', reason: 'replay_conflict' }
      }
      return prior.outcome
    }
    let outcome: BridgeFixtureCase['expect']
    if (!given.owner.principalAuthorized) {
      outcome = { ok: false, state: 'denied', reason: 'denied' }
    } else if (!given.owner.resourceExists) {
      outcome = { ok: false, state: 'reconcile_required', reason: 'reconcile_required' }
    } else if (
      (validated.envelope.resourceVersion !== undefined && validated.envelope.resourceVersion !== given.owner.ownerResourceVersion)
      || (given.owner.ownerContextRevision !== undefined && validated.envelope.contextRevision !== given.owner.ownerContextRevision)
    ) {
      outcome = { ok: false, state: 'reconcile_required', reason: 'reconcile_required' }
    } else {
      const mapping = BRIDGE_V2_LENS_MAP[validated.envelope.presentationIntent]
      outcome = { ok: true, state: 'opened', lens: mapping.lens, focus: mapping.focus }
    }
    if (replay.size >= REPLAY_CAPACITY) {
      const oldest = replay.keys().next()
      if (!oldest.done) replay.delete(oldest.value)
    }
    replay.set(replayKey, { canonicalDigest, outcome })
    return outcome
  }

  for (const earlier of given.replayBefore ?? []) {
    runOnce(earlier.envelope, earlier.tenantRef ?? tenant)
  }
  return runOnce(given.envelope, tenant)
}

/* -------------------- manifest loading -------------------- */

export function parseBridgeFixtureManifest(input: unknown): BridgeFixtureManifest | undefined {
  if (input === null || typeof input !== 'object') return undefined
  const value = input as Partial<BridgeFixtureManifest>
  if (typeof value.fixtureVersion !== 'string' || value.fixtureVersion !== BRIDGE_V2_FIXTURE_VERSION) return undefined
  if (typeof value.contract !== 'string' || value.contract !== 'dsh.workbench_ai_drama_bridge.v2') return undefined
  if (!Array.isArray(value.cases)) return undefined
  return value as BridgeFixtureManifest
}

export function parseBridgeFixtureCase(input: unknown): BridgeFixtureCase | undefined {
  if (input === null || typeof input !== 'object') return undefined
  const value = input as Partial<BridgeFixtureCase>
  if (typeof value.id !== 'string' || typeof value.category !== 'string' || typeof value.describe !== 'string') return undefined
  if (typeof value.given !== 'object' || value.given === null) return undefined
  if (typeof value.expect !== 'object' || value.expect === null) return undefined
  const kinds: readonly BridgeFixtureKind[] = ['validate', 'issue', 'consume', 'ingress']
  const actors: readonly BridgeFixtureActor[] = ['provider', 'consumer', 'both']
  if (!kinds.includes(value.kind as BridgeFixtureKind) || !actors.includes(value.actor as BridgeFixtureActor)) return undefined
  return value as BridgeFixtureCase
}

/** Runs one fixture case against this repository's reference semantics. */
export function runBridgeFixtureCase(fixture: BridgeFixtureCase): BridgeFixtureCase['expect'] {
  const given = fixture.given as {
    envelope?: unknown
    target?: WorkbenchBridgeTargetEntryV1 | null
    enabled?: boolean
    request?: Partial<BridgeV2IssueInput>
    advanceMs?: number
    nowMs?: number
    owner?: BridgeIngressOwnerSnapshot
    replayBefore?: { readonly envelope: unknown; readonly tenantRef?: string }[]
  }
  switch (fixture.kind) {
    case 'validate':
      return evaluateBridgeV2Validate(given.envelope, given.nowMs)
    case 'issue':
      return evaluateBridgeV2Issue(given)
    case 'consume':
      return evaluateBridgeV2Consume(given).expect
    case 'ingress':
      return evaluateBridgeV2Ingress({
        envelope: given.envelope,
        owner: given.owner ?? { resourceExists: true, principalAuthorized: true, ownerResourceVersion: 'r42', ownerContextRevision: 7 },
        replayBefore: given.replayBefore,
        nowMs: given.nowMs,
      })
  }
}

/** Capability probe is fixture-relevant too (stale / no-consumer cases). */
export function evaluateBridgeCapabilityFixture(
  entry: WorkbenchBridgeTargetEntryV1 | undefined,
  nowMs: number = BRIDGE_FIXTURE_NOW_MS,
): { readonly mode: string; readonly reason?: BridgeV2ReasonCode } {
  const capability = probeWorkbenchBridgeCapability(entry, () => nowMs, BRIDGE_CAPABILITY_FRESHNESS_MS)
  return capability.mode === 'disabled'
    ? { mode: 'disabled', reason: capability.reasonCode }
    : { mode: capability.mode }
}

export type { BridgeV2Intent, BridgeV2ReasonCode }
