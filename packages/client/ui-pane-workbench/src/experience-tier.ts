/**
 * Experience Tier runtime projection (workspace-capability-matrix).
 *
 * `resolveExperienceTier` is a pure function over one probe result set; the
 * tracker caches that set per session and only re-probes on explicit
 * invalidation (seam hot-plug / owner version events). Tier state is never
 * persisted. Missing seams stay fail-closed; a residual seam object without
 * the required contract face is `contract_mismatch`, never "partially usable".
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { PANE_CORE_HOST_CONTRACT } from './core-pane.js'
import {
  ARTIFACT_INTENT_CAPABILITY,
  ARTIFACT_INTENT_CONTEXT_KEY,
  COMMAND_SURFACE_CONTEXT_KEY,
  PREVIEW_RESOURCE_CAPABILITY,
  PREVIEW_RESOURCE_CONTEXT_KEY,
  TERMINAL_HOST_CONTEXT_KEY,
} from './capability-ledger.js'

export type WorkspaceProbeStateV1 = 'available' | 'missing' | 'contract_mismatch'

export const WORKSPACE_SEAM_IDS = [
  'workspace.core-pane.v1',
  'shell.workspace.right',
  'shell.workspace.bottom',
  'command-surface',
  'terminal-host-v2',
  'preview-resource-v1',
  'artifact-intent-official',
] as const

export type WorkspaceSeamIdV1 = (typeof WORKSPACE_SEAM_IDS)[number]

export type WorkspaceSeamProbeSetV1 = Readonly<Record<WorkspaceSeamIdV1, WorkspaceProbeStateV1>>

/** Standard disabled-reason locale keys under the `paneWorkbench` namespace. */
export type WorkspaceDisabledReasonKey =
  | 'reason.workspaceSeamMissing'
  | 'reason.contractMismatch'
  | 'reason.commandSurfaceMissing'
  | 'reason.geometryTier0'
  | 'reason.terminalSeamMissing'
  | 'reason.previewSeamMissing'
  | 'reason.artifactSeamMissing'
  | 'reason.handoffTargetMissing'
  | 'reason.handoffExpired'
  | 'reason.handoffConsumed'
  | 'reason.presetWriteDenied'

export interface WorkspaceExperienceTierV1 {
  readonly tier: 0 | 1 | 2
  readonly probes: WorkspaceSeamProbeSetV1
  /** Reason key per unavailable seam. Available seams have no entry. */
  readonly reasons: Readonly<Partial<Record<WorkspaceSeamIdV1, WorkspaceDisabledReasonKey>>>
}

const REASON_BY_SEAM: Readonly<Record<WorkspaceSeamIdV1, { missing: WorkspaceDisabledReasonKey; mismatch: WorkspaceDisabledReasonKey }>> = {
  'workspace.core-pane.v1': { missing: 'reason.workspaceSeamMissing', mismatch: 'reason.contractMismatch' },
  'shell.workspace.right': { missing: 'reason.workspaceSeamMissing', mismatch: 'reason.contractMismatch' },
  'shell.workspace.bottom': { missing: 'reason.workspaceSeamMissing', mismatch: 'reason.contractMismatch' },
  'command-surface': { missing: 'reason.commandSurfaceMissing', mismatch: 'reason.contractMismatch' },
  'terminal-host-v2': { missing: 'reason.terminalSeamMissing', mismatch: 'reason.contractMismatch' },
  'preview-resource-v1': { missing: 'reason.previewSeamMissing', mismatch: 'reason.contractMismatch' },
  'artifact-intent-official': { missing: 'reason.artifactSeamMissing', mismatch: 'reason.contractMismatch' },
}

/** Symbolic documentation anchors only — never paths or URLs. */
export const WORKSPACE_SEAM_UNLOCK_ANCHORS: Readonly<Record<WorkspaceSeamIdV1, string>> = {
  'workspace.core-pane.v1': 'unlock-workspace-core-pane',
  'shell.workspace.right': 'unlock-workspace-core-pane',
  'shell.workspace.bottom': 'unlock-workspace-core-pane',
  'command-surface': 'unlock-command-surface',
  'terminal-host-v2': 'unlock-terminal-host',
  'preview-resource-v1': 'unlock-preview-resource',
  'artifact-intent-official': 'unlock-artifact-intent',
}

function resolveTier(probes: WorkspaceSeamProbeSetV1): 0 | 1 | 2 {
  const tier1 = probes['workspace.core-pane.v1'] === 'available'
    && probes['shell.workspace.right'] === 'available'
    && probes['shell.workspace.bottom'] === 'available'
  if (!tier1) return 0
  const tier2 = probes['terminal-host-v2'] === 'available'
    && probes['preview-resource-v1'] === 'available'
    && probes['artifact-intent-official'] === 'available'
  return tier2 ? 2 : 1
}

/** Pure tier judgement. A residual seam object without the contract face stays Tier 0. */
export function resolveExperienceTier(probes: WorkspaceSeamProbeSetV1): WorkspaceExperienceTierV1 {
  const reasons: Partial<Record<WorkspaceSeamIdV1, WorkspaceDisabledReasonKey>> = {}
  for (const seam of WORKSPACE_SEAM_IDS) {
    const state = probes[seam]
    if (state === 'available') continue
    reasons[seam] = state === 'contract_mismatch' ? REASON_BY_SEAM[seam].mismatch : REASON_BY_SEAM[seam].missing
  }
  return { tier: resolveTier(probes), probes, reasons }
}

/** Geometry intents (split/dock/move-region) are host-owned; Tier 0 disables them with one standard reason. */
export function geometryDisabledReasonKey(tier: WorkspaceExperienceTierV1 | 0 | 1 | 2): 'reason.geometryTier0' | undefined {
  const value = typeof tier === 'number' ? tier : tier.tier
  return value === 0 ? 'reason.geometryTier0' : undefined
}

/** Probe subset shape shared with `probePaneWorkbenchHost` in client.ts. */
export interface CorePaneHostProbeLikeV1 {
  readonly missing: readonly string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readContextService(ctx: Pick<ClientContext, 'get'>, name: string): unknown {
  try {
    return ctx.get(name as never)
  } catch {
    return undefined
  }
}

function guardContextService(
  ctx: Pick<ClientContext, 'get'>,
  name: string,
  guard: (candidate: Record<string, unknown>) => boolean,
): WorkspaceProbeStateV1 {
  try {
    const candidate = readContextService(ctx, name)
    if (candidate === undefined) return 'missing'
    if (!isRecord(candidate)) return 'contract_mismatch'
    return guard(candidate) ? 'available' : 'contract_mismatch'
  } catch {
    return 'missing'
  }
}

function corePaneProbeState(coreProbe: CorePaneHostProbeLikeV1): WorkspaceProbeStateV1 {
  if (coreProbe.missing.includes('host') || coreProbe.missing.includes('workspaceLayout')) return 'missing'
  if (coreProbe.missing.includes(PANE_CORE_HOST_CONTRACT)) return 'contract_mismatch'
  return 'available'
}

function slotProbeState(coreProbe: CorePaneHostProbeLikeV1, slot: 'shell.workspace.right' | 'shell.workspace.bottom'): WorkspaceProbeStateV1 {
  if (coreProbe.missing.includes('host') || coreProbe.missing.includes('slots')) return 'missing'
  return coreProbe.missing.includes(slot) ? 'missing' : 'available'
}

const PROBE_STATES: readonly WorkspaceProbeStateV1[] = ['available', 'missing', 'contract_mismatch']

/**
 * Collects one probe set from the client context. Every read is a local
 * structural guard — no RPC, no polling, no fabrication. `overrides` lets an
 * owner with first-hand hot-plug knowledge supply authoritative states.
 */
export function probeWorkspaceSeams(
  ctx: Pick<ClientContext, 'get'>,
  coreProbe: CorePaneHostProbeLikeV1,
  overrides?: Partial<WorkspaceSeamProbeSetV1>,
): WorkspaceSeamProbeSetV1 {
  const probes: Record<WorkspaceSeamIdV1, WorkspaceProbeStateV1> = {
    'workspace.core-pane.v1': corePaneProbeState(coreProbe),
    'shell.workspace.right': slotProbeState(coreProbe, 'shell.workspace.right'),
    'shell.workspace.bottom': slotProbeState(coreProbe, 'shell.workspace.bottom'),
    'command-surface': guardContextService(ctx, COMMAND_SURFACE_CONTEXT_KEY, candidate => typeof candidate['list'] === 'function'),
    'terminal-host-v2': guardContextService(ctx, TERMINAL_HOST_CONTEXT_KEY, candidate =>
      candidate['capability'] === 'terminal-host' && typeof candidate['attachTerminal'] === 'function'),
    'preview-resource-v1': guardContextService(ctx, PREVIEW_RESOURCE_CONTEXT_KEY, candidate =>
      Array.isArray(candidate['capabilities'])
      && (candidate['capabilities'] as readonly unknown[]).includes(PREVIEW_RESOURCE_CAPABILITY)
      && typeof candidate['openPreview'] === 'function'
      && typeof candidate['readPreview'] === 'function'
      && typeof candidate['releasePreview'] === 'function'),
    'artifact-intent-official': guardContextService(ctx, ARTIFACT_INTENT_CONTEXT_KEY, candidate =>
      Array.isArray(candidate['capabilities'])
      && (candidate['capabilities'] as readonly unknown[]).includes(ARTIFACT_INTENT_CAPABILITY)),
  }
  if (overrides !== undefined) {
    for (const seam of WORKSPACE_SEAM_IDS) {
      const override = overrides[seam]
      if (override !== undefined && PROBE_STATES.includes(override)) probes[seam] = override
    }
  }
  return probes
}

export const CAPABILITY_MATRIX_EVIDENCE_SCHEMA = 'pane-workbench.capability-matrix.v1' as const

export const CAPABILITY_MATRIX_EVIDENCE_KINDS = [
  'tier_resolved',
  'disabled_reason_shown',
  'unlock_hint_clicked',
] as const

export type CapabilityMatrixEvidenceKindV1 = (typeof CAPABILITY_MATRIX_EVIDENCE_KINDS)[number]

export interface CapabilityMatrixEvidenceRecordV1 {
  readonly schema: typeof CAPABILITY_MATRIX_EVIDENCE_SCHEMA
  readonly kind: CapabilityMatrixEvidenceKindV1
  readonly tier?: 0 | 1 | 2
  readonly seamCategory?: string
  readonly reasonCategory?: string
}

/** Fixed categorical maps: evidence carries categories, never free text or seam internals. */
export const WORKSPACE_SEAM_CATEGORY: Readonly<Record<WorkspaceSeamIdV1, string>> = {
  'workspace.core-pane.v1': 'workspace_core_pane',
  'shell.workspace.right': 'workspace_slot_right',
  'shell.workspace.bottom': 'workspace_slot_bottom',
  'command-surface': 'command_surface',
  'terminal-host-v2': 'terminal_host',
  'preview-resource-v1': 'preview_resource',
  'artifact-intent-official': 'artifact_intent_official',
}

export const WORKSPACE_REASON_CATEGORY: Readonly<Record<WorkspaceDisabledReasonKey, string>> = {
  'reason.workspaceSeamMissing': 'workspace_seam_missing',
  'reason.contractMismatch': 'contract_mismatch',
  'reason.commandSurfaceMissing': 'command_surface_missing',
  'reason.geometryTier0': 'geometry_tier0',
  'reason.terminalSeamMissing': 'terminal_seam_missing',
  'reason.previewSeamMissing': 'preview_seam_missing',
  'reason.artifactSeamMissing': 'artifact_seam_missing',
  'reason.handoffTargetMissing': 'handoff_target_missing',
  'reason.handoffExpired': 'handoff_expired',
  'reason.handoffConsumed': 'handoff_consumed',
  'reason.presetWriteDenied': 'preset_write_denied',
}

const UNSAFE = /(?:prompt|token|secret|password|authorization|cookie|https?:\/\/|file:\/\/|\/etc\/|-----BEGIN)/i

/** Redacted diagnostic evidence. Categories only — mirrors the drama evidence contract. */
export function recordCapabilityMatrixEvidence(input: {
  readonly kind: CapabilityMatrixEvidenceKindV1
  readonly tier?: 0 | 1 | 2
  readonly seam?: WorkspaceSeamIdV1
  readonly reason?: WorkspaceDisabledReasonKey
}): CapabilityMatrixEvidenceRecordV1 | undefined {
  if (!CAPABILITY_MATRIX_EVIDENCE_KINDS.includes(input.kind)) return undefined
  if (input.tier !== undefined && (input.tier !== 0 && input.tier !== 1 && input.tier !== 2)) return undefined
  if (input.seam !== undefined && !WORKSPACE_SEAM_IDS.includes(input.seam)) return undefined
  if (input.reason !== undefined && WORKSPACE_REASON_CATEGORY[input.reason] === undefined) return undefined
  return {
    schema: CAPABILITY_MATRIX_EVIDENCE_SCHEMA,
    kind: input.kind,
    ...(input.tier === undefined ? {} : { tier: input.tier }),
    ...(input.seam === undefined ? {} : { seamCategory: WORKSPACE_SEAM_CATEGORY[input.seam] }),
    ...(input.reason === undefined ? {} : { reasonCategory: WORKSPACE_REASON_CATEGORY[input.reason] }),
  }
}

export function isRedactedCapabilityMatrixEvidence(value: unknown): value is CapabilityMatrixEvidenceRecordV1 {
  if (value === null || typeof value !== 'object') return false
  const record = value as Partial<CapabilityMatrixEvidenceRecordV1>
  if (record.schema !== CAPABILITY_MATRIX_EVIDENCE_SCHEMA) return false
  if (typeof record.kind !== 'string' || !CAPABILITY_MATRIX_EVIDENCE_KINDS.includes(record.kind as CapabilityMatrixEvidenceKindV1)) return false
  if (UNSAFE.test(JSON.stringify(value))) return false
  return true
}

export const WORKSPACE_CAPABILITY_MATRIX_SCHEMA = 'workspace-capability-matrix.v1' as const

export interface WorkspaceCapabilityRowV1 {
  readonly seam: WorkspaceSeamIdV1
  readonly state: WorkspaceProbeStateV1
  readonly reasonKey?: WorkspaceDisabledReasonKey
  readonly unlockAnchor: string
}

/** Restricted projection: tier, probe booleans, reason keys, doc anchors. No paths, URLs, or content. */
export interface WorkspaceCapabilityMatrixV1 {
  readonly schema: typeof WORKSPACE_CAPABILITY_MATRIX_SCHEMA
  readonly tier: 0 | 1 | 2
  readonly rows: readonly WorkspaceCapabilityRowV1[]
}

export function projectCapabilityMatrix(tier: WorkspaceExperienceTierV1): WorkspaceCapabilityMatrixV1 {
  return {
    schema: WORKSPACE_CAPABILITY_MATRIX_SCHEMA,
    tier: tier.tier,
    rows: WORKSPACE_SEAM_IDS.map(seam => ({
      seam,
      state: tier.probes[seam],
      ...(tier.reasons[seam] === undefined ? {} : { reasonKey: tier.reasons[seam] }),
      unlockAnchor: WORKSPACE_SEAM_UNLOCK_ANCHORS[seam],
    })),
  }
}

export interface ExperienceTierTrackerV1 {
  /** Session-cached snapshot. Never re-probes while the cache is valid. */
  getSnapshot(): WorkspaceExperienceTierV1
  subscribe(listener: () => void): () => void
  /** Hot-plug / owner-version invalidation: re-probe, re-resolve, broadcast on change. */
  invalidate(): WorkspaceExperienceTierV1
  dispose(): void
}

function sameTierSnapshot(left: WorkspaceExperienceTierV1, right: WorkspaceExperienceTierV1): boolean {
  if (left.tier !== right.tier) return false
  for (const seam of WORKSPACE_SEAM_IDS) {
    if (left.probes[seam] !== right.probes[seam]) return false
    if (left.reasons[seam] !== right.reasons[seam]) return false
  }
  return true
}

export function createExperienceTierTracker(input: {
  readonly probe: () => WorkspaceSeamProbeSetV1
  readonly onEvidence?: (record: CapabilityMatrixEvidenceRecordV1) => void
}): ExperienceTierTrackerV1 {
  const listeners = new Set<() => void>()
  let cached: WorkspaceExperienceTierV1 | undefined
  let disposed = false
  const emitTierEvidence = (snapshot: WorkspaceExperienceTierV1, previous: WorkspaceExperienceTierV1 | undefined): void => {
    if (input.onEvidence === undefined) return
    if (previous !== undefined && previous.tier === snapshot.tier) return
    const record = recordCapabilityMatrixEvidence({ kind: 'tier_resolved', tier: snapshot.tier })
    if (record !== undefined) input.onEvidence(record)
  }
  const resolve = (): WorkspaceExperienceTierV1 => {
    const previous = cached
    const next = resolveExperienceTier(input.probe())
    cached = next
    emitTierEvidence(next, previous)
    return next
  }
  const notify = (): void => {
    for (const listener of listeners) {
      try { listener() } catch { /* a tier subscriber cannot block invalidation */ }
    }
  }
  return {
    getSnapshot: () => cached ?? resolve(),
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    invalidate: () => {
      if (disposed) {
        cached = cached ?? resolveExperienceTier(input.probe())
        return cached
      }
      const previous = cached
      const next = resolve()
      if (previous === undefined || !sameTierSnapshot(previous, next)) notify()
      return next
    },
    dispose: () => {
      disposed = true
      listeners.clear()
    },
  }
}
