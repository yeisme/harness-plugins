/**
 * GenerationChangeSetLog — auditable, append-only generation change-set
 * recorder for the 3D Director workbench (dsh-3d-director-gltf-workbench-v1,
 * Group 2.3).
 *
 * Contract (pane-protocol GenerationChangeSetSchema):
 * - every record carries safe input refs, an operation summary, a patch digest,
 *   a status, and optional artifact/preview/rollback refs — never raw prompts,
 *   provider payloads, credentials, or paths;
 * - schema invariants are enforced on every write: `preview` requires a
 *   previewRef, `accepted` an artifactRef, `rolled_back` a rollbackRef, and the
 *   explained statuses failed/partial/stale/unknown require a bounded reason;
 * - status transitions follow a fixed map; terminal states never move and a
 *   failed/partial/stale/unknown change set is never auto-retried;
 * - accepting a change set commits a NEW scene revision through the store's
 *   conflict-fenced save (the store retains the previous committed revision in
 *   its history ring); rollback re-commits the retained revision as a new
 *   version and marks the change set rolled_back;
 * - the log only appends change sets and transitions their status; identity
 *   fields (changeSetRef, baseVersion, inputRefs, operationSummary,
 *   patchDigest) are frozen after record. This is not a scheduler, task
 *   ledger, or writer lease.
 *
 * Persistence rides the same single-open scene graph domain as the store
 * (table `changeSets`, key pattern [tenantRef, workspaceRef, projectRef,
 * sceneRef]); the log never opens the domain itself.
 *
 * @module @yeisme/dsh-3d-director-host/change-set
 */

import {
  GenerationChangeSetSchema,
  SceneGraphReadRequestSchema,
  type GenerationChangeSetStatus,
  type GenerationChangeSetV1,
  type ProjectCanvasScope,
  type SceneDocumentV1,
} from '@yeisme/dsh-pane-protocol'
import { parseScene3DChangeSetRow, type SceneGraphStore } from './scene-store.js'

const MAX_CHANGE_SETS_PER_SCENE = 256
const MAX_REASON = 240

/** Initial states a generation owner may record. Outcome states are only reachable through transitions. */
const RECORDABLE_STATUSES: readonly GenerationChangeSetStatus[] = ['pending', 'preview', 'failed', 'partial', 'stale', 'unknown']

/** Fixed transition map. Terminal states never move; nothing auto-retries. */
const TRANSITIONS: Readonly<Record<GenerationChangeSetStatus, readonly GenerationChangeSetStatus[]>> = {
  pending: ['preview', 'accepted', 'rejected', 'failed', 'partial', 'stale', 'unknown'],
  preview: ['accepted', 'rejected', 'failed', 'partial', 'stale', 'unknown'],
  accepted: ['rolled_back'],
  rejected: [],
  rolled_back: [],
  failed: [],
  partial: [],
  stale: [],
  unknown: [],
}

export interface Scene3DChangeSetSelector {
  readonly scope: ProjectCanvasScope
  readonly documentId: string
}

export type Scene3DChangeSetListResult =
  | { readonly status: 'ready'; readonly changeSets: readonly GenerationChangeSetV1[] }
  | { readonly status: 'invalid' | 'forbidden' | 'unavailable'; readonly reason?: string }

export type Scene3DChangeSetRecordResult =
  | { readonly status: 'recorded'; readonly changeSet: GenerationChangeSetV1 }
  | { readonly status: 'conflict'; readonly reason: string }
  | { readonly status: 'invalid' | 'forbidden' | 'unavailable'; readonly reason?: string }

export interface Scene3DChangeSetTransitionInput extends Scene3DChangeSetSelector {
  readonly changeSetRef: string
  readonly status: GenerationChangeSetStatus
  readonly reason?: string
  readonly artifactRef?: GenerationChangeSetV1['artifactRef']
  readonly previewRef?: string
  readonly rollbackRef?: string
}

export type Scene3DChangeSetTransitionResult =
  | { readonly status: 'updated'; readonly changeSet: GenerationChangeSetV1 }
  | { readonly status: 'invalid_transition'; readonly from: GenerationChangeSetStatus; readonly to: GenerationChangeSetStatus }
  | { readonly status: 'missing' }
  | { readonly status: 'invalid' | 'forbidden' | 'unavailable'; readonly reason?: string }

export interface Scene3DChangeSetAcceptInput extends Scene3DChangeSetSelector {
  readonly changeSetRef: string
  /** Idempotent save request id for the committed revision. */
  readonly requestId: string
  /** Resulting scene document; its version must equal the change set's baseVersion. */
  readonly document: SceneDocumentV1
  readonly artifactRef: NonNullable<GenerationChangeSetV1['artifactRef']>
}

export type Scene3DChangeSetAcceptResult =
  | { readonly status: 'accepted'; readonly changeSet: GenerationChangeSetV1; readonly version: number }
  | { readonly status: 'conflict'; readonly version: number }
  | { readonly status: 'not_applied'; readonly requestId: string }
  | { readonly status: 'invalid_transition'; readonly from: GenerationChangeSetStatus; readonly to: 'accepted' }
  | { readonly status: 'missing' }
  | { readonly status: 'invalid' | 'forbidden' | 'unavailable' | 'unknown'; readonly reason?: string }

export type Scene3DChangeSetRollbackResult =
  | { readonly status: 'rolled_back'; readonly changeSet: GenerationChangeSetV1; readonly version: number }
  | { readonly status: 'conflict'; readonly version: number }
  | { readonly status: 'invalid_transition'; readonly from: GenerationChangeSetStatus; readonly to: 'rolled_back' }
  | { readonly status: 'missing' }
  | { readonly status: 'revision_not_retained'; readonly version: number }
  | { readonly status: 'invalid' | 'forbidden' | 'unavailable' | 'unknown'; readonly reason?: string }

/** Opaque rollback pointer: `scene-revision:<documentId>@<version>`. */
export function sceneRevisionRef(documentId: string, version: number): string {
  return `scene-revision:${documentId}@${version}`
}

function parseSceneRevisionRef(ref: string): { readonly documentId: string; readonly version: number } | undefined {
  const match = /^scene-revision:([a-z0-9][a-z0-9._:/-]{0,119})@(\d+)$/i.exec(ref)
  if (match === null) return undefined
  const version = Number(match[2])
  if (!Number.isSafeInteger(version) || version < 1) return undefined
  return { documentId: match[1]!, version }
}

function boundedReason(text: string): string {
  const flattened = text.replace(/[\u0000-\u001F\u007F]+/gu, ' ').trim()
  const value = flattened.length > 0 ? flattened : 'unknown'
  return value.length <= MAX_REASON ? value : `${value.slice(0, MAX_REASON - 1)}…`
}

function selectorOf(input: unknown): Scene3DChangeSetSelector | undefined {
  const request = SceneGraphReadRequestSchema.safeParse(input)
  return request.success ? { scope: request.data.scope, documentId: request.data.documentId } : undefined
}

/**
 * Append-only generation change-set recorder over the scene graph store. All
 * persistence goes through the store's serialized, scope-fenced seam.
 */
export class GenerationChangeSetLog {
  private tail: Promise<void> = Promise.resolve()
  constructor(private readonly store: SceneGraphStore) {}

  async list(input: unknown): Promise<Scene3DChangeSetListResult> {
    const selector = selectorOf(input)
    if (selector === undefined) return { status: 'invalid' }
    if (this.store.contextFor(selector.scope) === undefined) return { status: 'forbidden' }
    try {
      const row = await this.store.readChangeSetRow(selector.scope, selector.documentId)
      const changeSets = row?.changeSets ?? []
      // Fail closed: a persisted entry that no longer crosses the contract degrades the whole listing.
      for (const entry of changeSets) {
        if (!GenerationChangeSetSchema.safeParse(entry).success) return { status: 'unavailable', reason: 'contract_mismatch' }
      }
      return { status: 'ready', changeSets }
    } catch { return { status: 'unavailable' } }
  }

  /** Append a new change set. Identity fields are frozen from this point on. */
  record(input: unknown): Promise<Scene3DChangeSetRecordResult> {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return Promise.resolve({ status: 'invalid' })
    const value = input as Record<string, unknown>
    const selector = selectorOf({ scope: value.scope, documentId: value.documentId })
    if (selector === undefined) return Promise.resolve({ status: 'invalid' })
    const parsed = GenerationChangeSetSchema.safeParse(value.changeSet)
    if (!parsed.success) return Promise.resolve({ status: 'invalid', reason: 'change_set_contract' })
    const changeSet = parsed.data
    if (changeSet.sceneRef !== selector.documentId) return Promise.resolve({ status: 'invalid', reason: 'scene_ref_mismatch' })
    if (!RECORDABLE_STATUSES.includes(changeSet.status)) return Promise.resolve({ status: 'invalid', reason: 'initial_status' })
    if (this.store.contextFor(selector.scope) === undefined) return Promise.resolve({ status: 'forbidden' })
    const work = this.tail.then(async (): Promise<Scene3DChangeSetRecordResult> => {
      try {
        const row = await this.store.readChangeSetRow(selector.scope, selector.documentId)
        const changeSets = [...(row?.changeSets ?? [])]
        if (changeSets.some(entry => entry.changeSetRef === changeSet.changeSetRef)) {
          return { status: 'conflict', reason: 'duplicate_change_set_ref' }
        }
        if (changeSets.length >= MAX_CHANGE_SETS_PER_SCENE) return { status: 'unavailable', reason: 'change_set_log_full' }
        changeSets.push(changeSet)
        await this.store.writeChangeSetRow(selector.scope, selector.documentId, parseScene3DChangeSetRow({ changeSets }))
        return { status: 'recorded', changeSet }
      } catch { return { status: 'unavailable' } }
    })
    this.tail = work.then(() => undefined, () => undefined)
    return work
  }

  /**
   * Move one change set along the fixed transition map, setting only status,
   * reason and outcome refs. Schema invariants (preview→previewRef,
   * accepted→artifactRef, rolled_back→rollbackRef, explained→reason) are
   * revalidated against the merged record before anything persists.
   */
  transition(input: Scene3DChangeSetTransitionInput): Promise<Scene3DChangeSetTransitionResult> {
    if (this.store.contextFor(input.scope) === undefined) return Promise.resolve({ status: 'forbidden' })
    const work = this.tail.then(async (): Promise<Scene3DChangeSetTransitionResult> => {
      try {
        const row = await this.store.readChangeSetRow(input.scope, input.documentId)
        const index = row?.changeSets.findIndex(entry => entry.changeSetRef === input.changeSetRef) ?? -1
        if (row === undefined || index < 0) return { status: 'missing' }
        const current = row.changeSets[index]!
        if (!TRANSITIONS[current.status].includes(input.status)) {
          return { status: 'invalid_transition', from: current.status, to: input.status }
        }
        const next = {
          ...current,
          status: input.status,
          ...(input.reason === undefined ? {} : { reason: boundedReason(input.reason) }),
          ...(input.artifactRef === undefined ? {} : { artifactRef: input.artifactRef }),
          ...(input.previewRef === undefined ? {} : { previewRef: input.previewRef }),
          ...(input.rollbackRef === undefined ? {} : { rollbackRef: input.rollbackRef }),
        }
        const parsed = GenerationChangeSetSchema.safeParse(next)
        if (!parsed.success) return { status: 'invalid', reason: 'change_set_contract' }
        const changeSets = row.changeSets.map((entry, position) => position === index ? parsed.data : entry)
        await this.store.writeChangeSetRow(input.scope, input.documentId, parseScene3DChangeSetRow({ changeSets }))
        return { status: 'updated', changeSet: parsed.data }
      } catch { return { status: 'unavailable' } }
    })
    this.tail = work.then(() => undefined, () => undefined)
    return work
  }

  /**
   * Accept a pending/preview change set: commit the resulting document as a
   * new scene revision through the store's conflict-fenced save, then mark the
   * change set accepted with its artifact ref and a rollback pointer at the
   * retained prior revision. A revision conflict freezes the change set in
   * place — no overwrite, no retry, no silent status rewrite.
   */
  async accept(input: Scene3DChangeSetAcceptInput): Promise<Scene3DChangeSetAcceptResult> {
    if (this.store.contextFor(input.scope) === undefined) return { status: 'forbidden' }
    if (input.document.id !== input.documentId || input.document.scope.workspaceRef !== input.scope.workspaceRef
      || input.document.scope.projectRef !== input.scope.projectRef) return { status: 'invalid', reason: 'document_scope_mismatch' }
    const listed = await this.list({ scope: input.scope, documentId: input.documentId })
    if (listed.status !== 'ready') return { status: listed.status }
    const changeSet = listed.changeSets.find(entry => entry.changeSetRef === input.changeSetRef)
    if (changeSet === undefined) return { status: 'missing' }
    if (!TRANSITIONS[changeSet.status].includes('accepted')) {
      return { status: 'invalid_transition', from: changeSet.status, to: 'accepted' }
    }
    if (input.document.version !== changeSet.baseVersion) {
      return { status: 'invalid', reason: 'base_version_mismatch' }
    }
    const saved = await this.store.save({ requestId: input.requestId, document: input.document })
    if (saved.status === 'saved' || saved.status === 'not_applied') {
      if (saved.status === 'not_applied') return { status: 'not_applied', requestId: saved.requestId }
      const transitioned = await this.transition({
        scope: input.scope,
        documentId: input.documentId,
        changeSetRef: input.changeSetRef,
        status: 'accepted',
        artifactRef: input.artifactRef,
        rollbackRef: sceneRevisionRef(input.documentId, changeSet.baseVersion),
      })
      if (transitioned.status !== 'updated') return { status: 'unknown', reason: 'accept_journal_unsettled' }
      return { status: 'accepted', changeSet: transitioned.changeSet, version: saved.version }
    }
    if (saved.status === 'conflict') return { status: 'conflict', version: saved.version }
    return { status: saved.status, ...(saved.status === 'invalid' ? { reason: 'save_contract' } : {}) }
  }

  /**
   * Roll back an accepted change set: re-commit the retained prior revision as
   * a new scene version (history is append-only; rollback never rewrites a
   * committed revision), then mark the change set rolled_back at the restored
   * revision. Rejected/failed change sets have nothing to roll back.
   */
  async rollback(input: Scene3DChangeSetSelector & { readonly changeSetRef: string; readonly requestId: string }): Promise<Scene3DChangeSetRollbackResult> {
    if (this.store.contextFor(input.scope) === undefined) return { status: 'forbidden' }
    const listed = await this.list({ scope: input.scope, documentId: input.documentId })
    if (listed.status !== 'ready') return { status: listed.status }
    const changeSet = listed.changeSets.find(entry => entry.changeSetRef === input.changeSetRef)
    if (changeSet === undefined) return { status: 'missing' }
    if (!TRANSITIONS[changeSet.status].includes('rolled_back')) {
      return { status: 'invalid_transition', from: changeSet.status, to: 'rolled_back' }
    }
    const pointer = changeSet.rollbackRef === undefined ? undefined : parseSceneRevisionRef(changeSet.rollbackRef)
    if (pointer === undefined || pointer.documentId !== input.documentId) return { status: 'invalid', reason: 'rollback_ref_contract' }
    const retained = await this.store.readVersion(input.scope, input.documentId, pointer.version)
    if (retained === undefined) return { status: 'revision_not_retained', version: pointer.version }
    const currentRead = await this.store.read({ scope: input.scope, documentId: input.documentId })
    if (currentRead.status !== 'ready') {
      return { status: currentRead.status === 'missing' ? 'missing' : currentRead.status === 'error' ? 'unavailable' : currentRead.status }
    }
    // Rollback is itself a base-fenced save: a concurrent writer conflicts instead of being overwritten.
    const restored: SceneDocumentV1 = { ...retained, version: currentRead.document.version }
    const saved = await this.store.save({ requestId: input.requestId, document: restored })
    if (saved.status === 'conflict') return { status: 'conflict', version: saved.version }
    if (saved.status !== 'saved') {
      return saved.status === 'not_applied'
        ? { status: 'unknown', reason: 'rollback_commit_unsettled' }
        : { status: saved.status, ...(saved.status === 'invalid' ? { reason: 'save_contract' } : {}) }
    }
    const transitioned = await this.transition({
      scope: input.scope,
      documentId: input.documentId,
      changeSetRef: input.changeSetRef,
      status: 'rolled_back',
      rollbackRef: sceneRevisionRef(input.documentId, saved.version),
    })
    if (transitioned.status !== 'updated') return { status: 'unknown', reason: 'rollback_journal_unsettled' }
    return { status: 'rolled_back', changeSet: transitioned.changeSet, version: saved.version }
  }
}
