/**
 * Client-side pane-link bus — the EMITTING half of the professional-pane
 * selection linkage (dsh-screenplay-production-continuity-v1 task 3.2 选择联动).
 *
 * The consuming contracts live in `pane-selection.ts` (fail-closed handoff /
 * adoption decoders, per-source sequence gate, projectRef fence). This module
 * is the single wiring point professional panes publish through:
 *
 * - the bus OWNS envelope construction: emitters pass plain fields and never
 *   hand-assemble schema ids, sequence numbers, or timestamps, so the wire
 *   contract cannot drift per emitter;
 * - emission is fail-closed and total: an input that violates the same ref /
 *   source / projectRef patterns the consumer decodes is rejected whole and
 *   consumes NO sequence number (a rejected emission can never wedge the
 *   per-source stream);
 * - the per-source monotonic sequence is assigned at the bus — the one place
 *   that serializes a source's entries — mirroring the consumer's gate;
 * - disposal fences everything: after `dispose()` emissions return false and
 *   dispatch nothing, and subscriptions are released;
 * - the bus carries no domain state: entries are dispatched synchronously to
 *   the current listener set and never buffered, replayed, or retried. A
 *   workbench that is not mounted simply observes nothing (fail-closed at the
 *   consumer), exactly like a dropped late delivery.
 *
 * Cross-pane transport is the cordis client service registry: the drama client
 * plugin provides the bus under `PIPELINE_PANE_LINK_SERVICE`, and independent
 * panes (the Creator Studio Scaena 镜头表 pane) resolve it duck-typed from
 * their own context at view-mount time — the same cross-plugin pattern the
 * Creator Studio client already uses for `dramaDirector`.
 *
 * @module @yeisme/dsh-client-ui-ai-drama-director/client/pipeline
 */

import {
  PIPELINE_CANDIDATE_ADOPTION_SCHEMA,
  PIPELINE_PANE_SELECTION_HANDOFF_SCHEMA,
  PIPELINE_PANE_SELECTION_KINDS,
  PIPELINE_PANE_SELECTION_SOURCES,
  type PipelinePaneSelectionKindV1,
  type PipelinePaneSelectionSourceV1,
} from './pane-selection.js'

/** Cordis service key under which the drama client plugin provides the bus. */
export const PIPELINE_PANE_LINK_SERVICE = 'pipelinePaneLink' as const

/** Maximum sequence the bus will ever assign (stays inside the consumer's safe-integer gate). */
const MAX_SEQ = 1e12 - 1
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/ -]{0,159}$/u
const OWNER_KIND_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/ -]{0,39}$/u

/** Emission input for one selection handoff; the bus builds the wire envelope. */
export interface PaneLinkHandoffEmitInputV1 {
  readonly source: PipelinePaneSelectionSourceV1
  readonly projectRef: string
  readonly kind: PipelinePaneSelectionKindV1
  readonly ref: string
}

/** Emission input for one candidate adoption; the bus builds the wire envelope. */
export interface PaneLinkAdoptionEmitInputV1 {
  readonly source: PipelinePaneSelectionSourceV1
  readonly projectRef: string
  readonly candidateRef: string
  readonly adoptedVersion: string
  readonly adoptedForShotRef?: string
  readonly artifact?: {
    readonly owner: string
    readonly kind: string
    readonly ref: string
    readonly version: string
    readonly mediaType?: string
    readonly title?: string
  }
}

/**
 * Structural face of the bus as independent panes consume it (duck-typed from
 * the cordis service registry; mirrors the two emit inputs above).
 */
export interface PipelinePaneLinkBusV1 {
  /** Returns true when a contract-valid handoff was dispatched. */
  emitPaneSelectionHandoff(input: PaneLinkHandoffEmitInputV1): boolean
  /** Returns true when a contract-valid adoption was dispatched. */
  emitCandidateAdoption(input: PaneLinkAdoptionEmitInputV1): boolean
  /** Listener seam for the workbench controller; returns an unsubscribe. */
  subscribe(listener: (entry: unknown) => void): () => void
}

function isSafeRef(value: string): boolean {
  return REF_PATTERN.test(value)
}

/** Same fail-closed field checks the consumer decoder applies, evaluated BEFORE a sequence is consumed. */
function validateCommon(source: PipelinePaneSelectionSourceV1, projectRef: string): boolean {
  if (!(PIPELINE_PANE_SELECTION_SOURCES as readonly string[]).includes(source)) return false
  if (!isSafeRef(projectRef)) return false
  return true
}

/**
 * In-memory pane-link bus. One instance lives for the drama client plugin's
 * lifetime; the workbench controller subscribes on mount and unsubscribes on
 * dispose, so remounts re-subscribe cleanly (session-local by construction —
 * entries are never buffered for a future consumer).
 */
export class PipelinePaneLinkBus implements PipelinePaneLinkBusV1 {
  private readonly listeners = new Set<(entry: unknown) => void>()
  private readonly sequences = new Map<PipelinePaneSelectionSourceV1, number>()
  private disposed = false

  /** Next strictly-increasing sequence for one source; the bus is the single serialization point. */
  private nextSeq(source: PipelinePaneSelectionSourceV1): number | undefined {
    const last = this.sequences.get(source) ?? 0
    // Sequence ceiling: the consumer gate rejects anything ≥ 1e12, so the bus
    // stops emitting (whole, without wraparound) instead of publishing an
    // entry that could never apply.
    if (last + 1 >= MAX_SEQ) return undefined
    this.sequences.set(source, last + 1)
    return last + 1
  }

  emitPaneSelectionHandoff(input: PaneLinkHandoffEmitInputV1): boolean {
    if (this.disposed || input === null || typeof input !== 'object') return false
    if (!validateCommon(input.source, input.projectRef)) return false
    if (!(PIPELINE_PANE_SELECTION_KINDS as readonly string[]).includes(input.kind)) return false
    if (!isSafeRef(input.ref)) return false
    const seq = this.nextSeq(input.source)
    if (seq === undefined) return false
    const entry = Object.freeze({
      schema: PIPELINE_PANE_SELECTION_HANDOFF_SCHEMA,
      source: input.source,
      projectRef: input.projectRef,
      seq,
      issuedAt: Date.now(),
      selection: Object.freeze({ kind: input.kind, ref: input.ref }),
    })
    this.dispatch(entry)
    return true
  }

  emitCandidateAdoption(input: PaneLinkAdoptionEmitInputV1): boolean {
    if (this.disposed || input === null || typeof input !== 'object') return false
    if (!validateCommon(input.source, input.projectRef)) return false
    if (!isSafeRef(input.candidateRef)) return false
    if (!VERSION_PATTERN.test(input.adoptedVersion)) return false
    if (input.adoptedForShotRef !== undefined && !isSafeRef(input.adoptedForShotRef)) return false
    if (input.artifact !== undefined) {
      const artifact = input.artifact
      // Bounded opaque strings only, mirroring the consumer's artifact decoder.
      if (!OWNER_KIND_PATTERN.test(artifact.owner) || !OWNER_KIND_PATTERN.test(artifact.kind)) return false
      if (!isSafeRef(artifact.ref) || !isSafeRef(artifact.version)) return false
      if (artifact.mediaType !== undefined && !VERSION_PATTERN.test(artifact.mediaType)) return false
      if (artifact.title !== undefined && (typeof artifact.title !== 'string' || artifact.title.length === 0 || artifact.title.length > 160)) return false
    }
    const seq = this.nextSeq(input.source)
    if (seq === undefined) return false
    const entry = Object.freeze({
      schema: PIPELINE_CANDIDATE_ADOPTION_SCHEMA,
      source: input.source,
      projectRef: input.projectRef,
      seq,
      issuedAt: Date.now(),
      candidateRef: input.candidateRef,
      adoptedVersion: input.adoptedVersion,
      ...(input.adoptedForShotRef === undefined ? {} : { adoptedForShotRef: input.adoptedForShotRef }),
      ...(input.artifact === undefined ? {} : { artifact: Object.freeze({ ...input.artifact }) }),
    })
    this.dispatch(entry)
    return true
  }

  subscribe(listener: (entry: unknown) => void): () => void {
    if (this.disposed) return () => {}
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Disposal fence: emissions stop dispatching and consume no sequences. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.listeners.clear()
  }

  private dispatch(entry: unknown): void {
    for (const listener of [...this.listeners]) listener(entry)
  }
}

/** Creates the bus the drama client plugin provides under `PIPELINE_PANE_LINK_SERVICE`. */
export function createPipelinePaneLinkBus(): PipelinePaneLinkBus {
  return new PipelinePaneLinkBus()
}

/** Structural probe for the pane-link bus service resolved from a client context. */
export function isPipelinePaneLinkBus(value: unknown): value is PipelinePaneLinkBusV1 {
  return value !== null && typeof value === 'object'
    && typeof (value as PipelinePaneLinkBusV1).emitPaneSelectionHandoff === 'function'
    && typeof (value as PipelinePaneLinkBusV1).emitCandidateAdoption === 'function'
    && typeof (value as PipelinePaneLinkBusV1).subscribe === 'function'
}
