import { createElement, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'

/** Versioned browser handoff used by selection and workbench surfaces. */
export const COMPOSER_REFERENCE_ADD_TO_MAIN_EVENT = 'dsh-composer-reference:add-to-main' as const
/** Receipt emitted after the workbench accepts or rejects one handoff. */
export const COMPOSER_REFERENCE_ADD_TO_MAIN_RESULT_EVENT = 'dsh-composer-reference:add-to-main-result' as const
/** Versioned host insertion seam; only the desktop workbench emits it. */
export const COMPOSER_REFERENCE_HOST_INSERT_EVENT = 'dsh-composer-reference:insert' as const
/** Capability query used to keep an absent upstream seam visibly unavailable. */
export const COMPOSER_REFERENCE_HOST_PROBE_EVENT = 'dsh-composer-reference:probe' as const
/** Host insertion receipt consumed by the desktop-workbench bridge. */
export const COMPOSER_REFERENCE_HOST_INSERT_RESULT_EVENT = 'dsh-composer-reference:insert-result' as const
/** User-facing row removal request emitted by the compact reference dock. */
export const COMPOSER_REFERENCE_REMOVE_FROM_MAIN_EVENT = 'dsh-composer-reference:remove-from-main' as const
/** Row removal receipt emitted after the Host editor acknowledges the mutation. */
export const COMPOSER_REFERENCE_REMOVE_FROM_MAIN_RESULT_EVENT = 'dsh-composer-reference:remove-from-main-result' as const
/** Host-only removal seam bridged by the desktop bundle. */
export const COMPOSER_REFERENCE_HOST_REMOVE_EVENT = 'dsh-composer-reference:remove' as const
/** Host-only removal receipt. */
export const COMPOSER_REFERENCE_HOST_REMOVE_RESULT_EVENT = 'dsh-composer-reference:remove-result' as const
export const COMPOSER_REFERENCE_PROTOCOL_VERSION = 1 as const
export const COMPOSER_REFERENCE_BRIDGE_CONTEXT_KEY = 'composerReferenceBridge' as const
export const COMPOSER_REFERENCE_CATALOG_CONTEXT_KEY = 'composerReferenceCatalog' as const

export type ComposerReferenceKindV2 =
  | 'file'
  | 'directory'
  | 'selection'
  | 'message'
  | 'terminal'
  | 'image'
  | 'image-region'
  | 'agent'
  | 'skill'
  | 'tool'

export type ComposerReferenceIntentV2 = 'content' | 'collaborator' | 'guidance' | 'capability'
export type ComposerReferenceFreshnessV2 = 'fresh' | 'stale' | 'frozen' | 'unavailable'

/** Main-conversation identity captured by the source surface, never inferred from DOM focus. */
export interface ComposerReferenceTargetV2 {
  readonly workspaceId: string
  readonly conversationId: string
  readonly draftRevision?: number
  readonly title?: string
  readonly caret?: { readonly start: number; readonly end: number }
}

/** Safe source projection; `ref` remains owner-scoped and preview contains no raw payload. */
export interface ComposerReferenceV2 {
  readonly id: string
  readonly kind: ComposerReferenceKindV2
  readonly intent: ComposerReferenceIntentV2
  readonly owner: string
  readonly ref: string
  readonly version: string
  readonly label: string
  readonly scope: string
  readonly digest: string
  readonly freshness: ComposerReferenceFreshnessV2
  readonly unavailableReason?: string
  readonly preview?: string
  readonly window?: { readonly start: number; readonly end: number }
  readonly region?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
}

/** Additive feature probe flags; absent means the host cannot confirm the seam. */
export interface ComposerReferenceBridgeFeaturesV1 {
  /** Host activates the target conversation and focuses the composer after insert. */
  readonly activation?: boolean
  /** Host owns an explicit conversation picker / creation entry (chooseTarget). */
  readonly chooseTarget?: boolean
}

export interface ComposerReferenceBridgeSnapshotV1 {
  readonly available: boolean
  readonly reason?: string
  readonly target?: ComposerReferenceTargetV2
  /** Authoritative references currently present in the target Host editor. */
  readonly references?: readonly ComposerReferenceV2[]
  /** Additive seam probes; consumers gate entries on `=== true` and degrade honestly otherwise. */
  readonly features?: ComposerReferenceBridgeFeaturesV1
}

export interface ComposerReferenceSelectionSourceV1 {
  readonly owner: string
  readonly ref: string
  readonly version: string
  readonly scope: string
  readonly window: { readonly start: number; readonly end: number }
}

/** Result of an explicit host-owned target pick; cancelled creates nothing. */
export type ComposerReferenceChooseTargetResultV1 =
  | { readonly status: 'selected'; readonly target: ComposerReferenceTargetV2 }
  | { readonly status: 'cancelled' }
  | { readonly status: 'unavailable'; readonly reason: string }

/** Live host bridge consumed structurally by the selection-annotation plugin. */
export interface ComposerReferenceBridgeV1 {
  snapshot(): ComposerReferenceBridgeSnapshotV1
  subscribe(listener: () => void): () => void
  resolveSelection(input: {
    readonly anchor: { readonly quoteDigest: string }
    readonly context: { readonly kind: string; readonly source: string }
    readonly quote: string
    readonly source: ComposerReferenceSelectionSourceV1
  }): Promise<{ readonly status: 'available'; readonly reference: ComposerReferenceV2 } | { readonly status: 'unavailable'; readonly reason: string }>
  /** Host-owned picker / conversation creation; the plugin never builds a session list. */
  chooseTarget?(signal?: AbortSignal): Promise<ComposerReferenceChooseTargetResultV1>
}

export interface ComposerReferenceCatalogCandidateV1 {
  readonly name: string
  readonly description?: string
  readonly section: string
  readonly reference: ComposerReferenceV2
}

/** Optional owner catalog joined by the upstream @ source at query time. */
export interface ComposerReferenceCatalogV1 {
  list(target: ComposerReferenceTargetV2, query: string, signal: AbortSignal): Promise<readonly ComposerReferenceCatalogCandidateV1[]>
}

/** Ask-with-reference request: host activates the target and focuses the composer after insert. */
export interface ComposerReferenceActivationV1 {
  readonly focus: 'composer'
}

export interface ComposerReferenceAddToMainDetailV1 {
  readonly version: typeof COMPOSER_REFERENCE_PROTOCOL_VERSION
  readonly requestId?: string
  readonly target: ComposerReferenceTargetV2
  readonly reference: ComposerReferenceV2
  readonly activation?: ComposerReferenceActivationV1
}

export interface ComposerReferenceAddToMainResultV1 {
  readonly version: typeof COMPOSER_REFERENCE_PROTOCOL_VERSION
  readonly requestId?: string
  readonly target: ComposerReferenceTargetV2
  readonly ok: boolean
  readonly reason?: string
  /** Present only when the host confirmed (true) or denied (false) composer activation. */
  readonly activated?: boolean
}

export interface ComposerReferenceHostInsertDetailV1 {
  readonly version: typeof COMPOSER_REFERENCE_PROTOCOL_VERSION
  readonly requestId: string
  readonly target: ComposerReferenceTargetV2
  readonly reference: ComposerReferenceV2
  readonly activation?: ComposerReferenceActivationV1
}

export interface ComposerReferenceHostInsertResultV1 {
  readonly version: typeof COMPOSER_REFERENCE_PROTOCOL_VERSION
  readonly requestId: string
  readonly target: ComposerReferenceTargetV2
  readonly ok: boolean
  readonly reason?: string
  readonly activated?: boolean
}

export interface ComposerReferenceRemoveFromMainDetailV1 {
  readonly version: typeof COMPOSER_REFERENCE_PROTOCOL_VERSION
  readonly requestId: string
  readonly target: ComposerReferenceTargetV2
  readonly referenceId: string
}

export type ComposerReferenceRemoveFromMainResultV1 = ComposerReferenceRemoveFromMainDetailV1 & {
  readonly ok: boolean
  readonly reason?: string
}

export type ComposerReferenceHostRemoveDetailV1 = ComposerReferenceRemoveFromMainDetailV1
export type ComposerReferenceHostRemoveResultV1 = ComposerReferenceRemoveFromMainResultV1

export interface ComposerReferenceDraftV2 {
  readonly target: ComposerReferenceTargetV2
  readonly revision: number
  readonly references: readonly ComposerReferenceV2[]
  readonly prepared?: {
    readonly submissionId: string
    readonly referenceIds: readonly string[]
  }
}

export interface ComposerReferenceDraftSnapshotV2 {
  readonly activeTarget?: ComposerReferenceTargetV2
  readonly drafts: readonly ComposerReferenceDraftV2[]
  readonly hostAvailable: boolean
  readonly hostReason?: string
}

function targetKey(target: ComposerReferenceTargetV2): string {
  return `${target.workspaceId}\u0000${target.conversationId}`
}

function targetEqual(left: ComposerReferenceTargetV2, right: ComposerReferenceTargetV2): boolean {
  return left.workspaceId === right.workspaceId && left.conversationId === right.conversationId
}

function isUsable(reference: ComposerReferenceV2): boolean {
  return reference.freshness === 'fresh' || reference.freshness === 'frozen'
}

/** Exact owner-issued attachment identity; distinct windows/regions never collapse. */
function referenceIdentity(reference: ComposerReferenceV2): string {
  return JSON.stringify({
    id: reference.id,
    owner: reference.owner,
    ref: reference.ref,
    kind: reference.kind,
    intent: reference.intent,
    version: reference.version,
    scope: reference.scope,
    digest: reference.digest,
    window: reference.window ?? null,
    region: reference.region ?? null,
  })
}

/** Conversation-scoped drafts with explicit prepare/ack handling. */
export class ComposerReferenceDraftControllerV2 {
  private readonly drafts = new Map<string, ComposerReferenceDraftV2>()
  private readonly listeners = new Set<() => void>()
  private activeTarget: ComposerReferenceTargetV2 | undefined
  private hostAvailable = false
  private hostReason = 'structured conversation insert capability is unavailable'

  snapshot(): ComposerReferenceDraftSnapshotV2 {
    return {
      ...(this.activeTarget === undefined ? {} : { activeTarget: this.activeTarget }),
      drafts: [...this.drafts.values()],
      hostAvailable: this.hostAvailable,
      ...(this.hostAvailable ? {} : { hostReason: this.hostReason }),
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  setHostAvailability(available: boolean, reason?: string): void {
    const nextReason = available ? '' : (reason ?? 'structured conversation insert capability is unavailable')
    const clearActiveTarget = !available && this.activeTarget !== undefined
    if (this.hostAvailable === available && this.hostReason === nextReason && !clearActiveTarget) return
    this.hostAvailable = available
    this.hostReason = nextReason
    if (!available) this.activeTarget = undefined
    this.publish()
  }

  admit(reference: ComposerReferenceV2): { readonly ok: boolean; readonly reason?: string } {
    if (!this.hostAvailable) return { ok: false, reason: this.hostReason }
    if (!isUsable(reference)) return { ok: false, reason: reference.unavailableReason ?? 'reference is unavailable; refresh or remove it before sending' }
    return { ok: true }
  }

  insert(target: ComposerReferenceTargetV2, reference: ComposerReferenceV2): { readonly ok: boolean; readonly reason?: string } {
    const admission = this.admit(reference)
    if (!admission.ok) return admission
    const key = targetKey(target)
    const current = this.drafts.get(key) ?? { target, revision: 0, references: [] }
    const identity = referenceIdentity(reference)
    const existing = current.references.find(item => referenceIdentity(item) === identity)
    const references = existing === undefined ? [...current.references, reference] : current.references.map(item => item.id === existing.id ? reference : item)
    this.drafts.set(key, { target, revision: current.revision + 1, references, ...(current.prepared === undefined ? {} : { prepared: current.prepared }) })
    this.activeTarget = target
    this.publish()
    return { ok: true }
  }

  /** Replace one draft from the Host editor's authoritative occurrence projection. */
  replace(target: ComposerReferenceTargetV2, references: readonly ComposerReferenceV2[]): void {
    const unique: ComposerReferenceV2[] = []
    const seen = new Set<string>()
    for (const reference of references) {
      const identity = referenceIdentity(reference)
      if (seen.has(identity)) continue
      seen.add(identity)
      unique.push(reference)
    }
    const key = targetKey(target)
    const current = this.drafts.get(key)
    const activeChanged = this.activeTarget === undefined || !targetEqual(this.activeTarget, target)
    const unchanged = current !== undefined
      && current.references.length === unique.length
      && current.references.every((item, index) => referenceIdentity(item) === referenceIdentity(unique[index]!))
      && current.target.draftRevision === target.draftRevision
      && current.target.title === target.title
    this.activeTarget = target
    if (unchanged) {
      if (activeChanged) this.publish()
      return
    }
    this.drafts.set(key, { target, revision: (current?.revision ?? 0) + 1, references: unique })
    this.publish()
  }

  remove(target: ComposerReferenceTargetV2, referenceId: string): void {
    const key = targetKey(target)
    const current = this.drafts.get(key)
    if (current === undefined) return
    this.drafts.set(key, { ...current, revision: current.revision + 1, references: current.references.filter(item => item.id !== referenceId) })
    this.activeTarget = target
    this.publish()
  }

  markStale(target: ComposerReferenceTargetV2, referenceId: string, reason: string): void {
    const key = targetKey(target)
    const current = this.drafts.get(key)
    if (current === undefined) return
    this.drafts.set(key, {
      ...current,
      revision: current.revision + 1,
      references: current.references.map(item => item.id === referenceId ? { ...item, freshness: 'stale', unavailableReason: reason } : item),
    })
    this.publish()
  }

  prepare(target: ComposerReferenceTargetV2, submissionId: string): { readonly ok: boolean; readonly reason?: string; readonly references?: readonly ComposerReferenceV2[] } {
    const current = this.drafts.get(targetKey(target))
    if (current === undefined) return { ok: true, references: [] }
    const blocked = current.references.find(item => !isUsable(item))
    if (blocked !== undefined) return { ok: false, reason: blocked.unavailableReason ?? 'reference is stale; refresh or remove it before sending' }
    const references = current.references.map(item => ({ ...item, freshness: 'frozen' as const }))
    this.drafts.set(targetKey(target), { ...current, revision: current.revision + 1, references, prepared: { submissionId, referenceIds: references.map(item => item.id) } })
    this.publish()
    return { ok: true, references }
  }

  acknowledge(target: ComposerReferenceTargetV2, submissionId: string): void {
    const key = targetKey(target)
    const current = this.drafts.get(key)
    if (current?.prepared?.submissionId !== submissionId) return
    const submitted = new Set(current.prepared.referenceIds)
    this.drafts.set(key, { ...current, revision: current.revision + 1, references: current.references.filter(item => !submitted.has(item.id)) })
    this.publish()
  }

  reject(target: ComposerReferenceTargetV2, submissionId: string): void {
    const key = targetKey(target)
    const current = this.drafts.get(key)
    if (current?.prepared?.submissionId !== submissionId) return
    this.drafts.set(key, {
      ...current,
      revision: current.revision + 1,
      references: current.references.map(item => item.freshness === 'frozen' ? { ...item, freshness: 'fresh' } : item),
      prepared: undefined,
    })
    this.publish()
  }

  draftFor(target: ComposerReferenceTargetV2): ComposerReferenceDraftV2 | undefined {
    return this.drafts.get(targetKey(target))
  }

  private publish(): void {
    for (const listener of this.listeners) listener()
  }
}

let sharedController: ComposerReferenceDraftControllerV2 | undefined
let removalSequence = 0

/** @returns the one browser projection controller; records remain target-scoped. */
export function getComposerReferenceDraftControllerV2(): ComposerReferenceDraftControllerV2 {
  sharedController ??= new ComposerReferenceDraftControllerV2()
  return sharedController
}

/** Compact list and preview projection for the active explicit target. */
export function ComposerReferenceDraftDockV2({
  controller = getComposerReferenceDraftControllerV2(),
}: {
  readonly controller?: ComposerReferenceDraftControllerV2
}): ReactNode {
  const [snapshot, setSnapshot] = useState(() => controller.snapshot())
  useEffect(() => controller.subscribe(() => setSnapshot(controller.snapshot())), [controller])
  const draft = useMemo(() => snapshot.activeTarget === undefined
    ? undefined
    : snapshot.drafts.find(item => targetEqual(item.target, snapshot.activeTarget!)), [snapshot])
  if (draft === undefined || draft.references.length === 0) return null
  return createElement('details', { className: 'pwr-composer-reference-draft-dock', 'data-composer-reference-draft-v2': 'true', 'aria-label': '对话引用' },
    createElement('summary', null, `引用 ${draft.references.length} · 目标：${draft.target.title ?? draft.target.conversationId}`),
    createElement('ul', null, ...draft.references.map(reference => createElement('li', { key: reference.id, 'data-reference-kind': reference.kind, 'data-reference-freshness': reference.freshness },
      createElement('span', null, `${reference.label} · ${reference.intent}`),
      reference.preview === undefined ? null : createElement('span', { className: 'pwr-reference-preview' }, reference.preview),
      reference.freshness === 'stale' || reference.freshness === 'unavailable'
        ? createElement('span', { role: 'status' }, reference.unavailableReason ?? '引用不可用')
        : null,
      createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', 'aria-label': `从对话移除 ${reference.label}`, onClick: () => {
        if (typeof window === 'undefined') return
        removalSequence += 1
        window.dispatchEvent(new CustomEvent(COMPOSER_REFERENCE_REMOVE_FROM_MAIN_EVENT, { detail: {
          version: COMPOSER_REFERENCE_PROTOCOL_VERSION,
          requestId: `reference-remove-${removalSequence}`,
          target: draft.target,
          referenceId: reference.id,
        } satisfies ComposerReferenceRemoveFromMainDetailV1 }))
      } }, '移除'),
    ))),
  )
}
