/**
 * Opaque file reference recovery across remount (dsh-pane-workspace-followups-v1 1.2).
 *
 * After a refresh the pane workbench restores presentation state only — the
 * opaque resourceKey survives, the content binding does not. Recovery asks an
 * owner admission port to re-resolve each saved reference (existence,
 * permission, current version) and maps the answer onto the existing view:
 *
 * - same version → ready;
 * - newer version, clean buffer → stale with explicit reload actions;
 * - newer version, unsaved buffer → conflict decision (never auto-overwrite,
 *   never drop the buffer);
 * - missing/forbidden/unavailable → the pane keeps its placeholder with a
 *   bounded reason. No other file is opened as a substitute;
 * - admission face absent → deferred: the view is left untouched, honestly,
 *   instead of being marked fake-ready.
 *
 * The admission port is the owner increment this slice ships as a contract:
 * no released DSH build exposes a file inspection seam yet, so hosts bind it
 * when the seam lands and the panel degrades honestly until then.
 *
 * @module @yeisme/dsh-client-ui-pane-workbench/file-reopen
 */

import { decideFileLifecycle, type FileLifecycleDecisionV1 } from './file-lifecycle.js'
import type { PaneViewInstanceV1, PaneWorkspaceIntentV1 } from '../workspace.js'

/** View kinds recovered by default; matches DSH_FILE_PREVIEW_VIEW_KIND. */
export const FILE_REOPEN_DEFAULT_VIEW_KINDS: readonly string[] = ['file.preview']

export type FileReferenceAdmissionResultV1 =
  | { readonly ok: true; readonly version: string; readonly name?: string }
  | { readonly ok: false; readonly reason: 'missing' | 'forbidden' | 'unavailable'; readonly detail?: string }

/** Owner-side re-admission of an opaque file reference. */
export interface FileReferenceAdmissionV1 {
  resolveFileReference(request: { readonly ref: string; readonly version?: string }): Promise<FileReferenceAdmissionResultV1>
}

export type FileReopenOutcomeV1 =
  | { readonly kind: 'ready'; readonly viewId: string; readonly resourceKey: string; readonly version: string }
  | { readonly kind: 'stale'; readonly viewId: string; readonly resourceKey: string; readonly version: string; readonly lifecycle: FileLifecycleDecisionV1 }
  | { readonly kind: 'conflict'; readonly viewId: string; readonly resourceKey: string; readonly ownerVersion: string; readonly lifecycle: FileLifecycleDecisionV1 }
  | {
    readonly kind: 'unresolved'
    readonly viewId: string
    readonly resourceKey: string
    readonly reason: 'missing' | 'forbidden' | 'unavailable'
    readonly detail?: string
  }
  | { readonly kind: 'deferred'; readonly viewId: string; readonly resourceKey: string; readonly reason: 'admission_unavailable' }

const UNRESOLVED_DETAIL: Readonly<Record<'missing' | 'forbidden' | 'unavailable', string>> = {
  missing: 'the file no longer exists at the saved reference',
  forbidden: 'access to the saved reference was denied',
  unavailable: 'the owner admission is currently unavailable',
}

/** Pure decision for one restored view given an owner admission answer. */
export function recoverFileReferenceView(
  view: PaneViewInstanceV1,
  admission: FileReferenceAdmissionResultV1 | undefined,
): FileReopenOutcomeV1 {
  if (admission === undefined) {
    return { kind: 'deferred', viewId: view.id, resourceKey: view.resourceKey, reason: 'admission_unavailable' }
  }
  if (!admission.ok) {
    return {
      kind: 'unresolved',
      viewId: view.id,
      resourceKey: view.resourceKey,
      reason: admission.reason,
      ...(admission.detail === undefined ? {} : { detail: admission.detail.slice(0, 160) }),
    }
  }
  const lifecycle = decideFileLifecycle(
    { resourceKey: view.resourceKey, openedVersion: view.resourceVersion ?? '', dirty: view.dirty },
    { resourceKey: view.resourceKey, ownerVersion: admission.version },
  )
  if (lifecycle.status === 'conflict') {
    return { kind: 'conflict', viewId: view.id, resourceKey: view.resourceKey, ownerVersion: admission.version, lifecycle }
  }
  if (lifecycle.status === 'stale') {
    return { kind: 'stale', viewId: view.id, resourceKey: view.resourceKey, version: admission.version, lifecycle }
  }
  return { kind: 'ready', viewId: view.id, resourceKey: view.resourceKey, version: admission.version }
}

/**
 * Resolve every matching view through the admission port. Admission failures
 * (throws) degrade to `unavailable` instead of fake success.
 */
export async function recoverPaneFileReferenceViews(options: {
  readonly views: readonly PaneViewInstanceV1[]
  readonly admission: FileReferenceAdmissionV1 | undefined
  readonly kinds?: readonly string[]
}): Promise<readonly FileReopenOutcomeV1[]> {
  const kinds = options.kinds ?? FILE_REOPEN_DEFAULT_VIEW_KINDS
  const targets = options.views.filter(view => kinds.includes(view.kind))
  if (options.admission === undefined) {
    return targets.map(view => recoverFileReferenceView(view, undefined))
  }
  const admission = options.admission
  return Promise.all(targets.map(async view => recoverFileReferenceView(view, await admission
    .resolveFileReference({ ref: view.resourceKey, version: view.resourceVersion })
    .catch((): FileReferenceAdmissionResultV1 => ({ ok: false, reason: 'unavailable', detail: 'owner admission request failed' })))))
}

/**
 * Commit intent for one outcome. Recovery never swaps the resourceKey, never
 * clears `dirty`, and opens no substitute view; `deferred` commits nothing.
 */
export function fileReopenStatusIntent(outcome: FileReopenOutcomeV1): PaneWorkspaceIntentV1 | undefined {
  switch (outcome.kind) {
    case 'ready':
      return { type: 'set_view_status', viewId: outcome.viewId, status: 'ready', resourceVersion: outcome.version }
    case 'stale':
      return { type: 'set_view_status', viewId: outcome.viewId, status: 'stale', resourceVersion: outcome.version }
    case 'conflict':
      return {
        type: 'set_view_status',
        viewId: outcome.viewId,
        status: 'conflict',
        attention: true,
        // resourceVersion intentionally untouched: the buffer still holds the opened version.
        detail: 'owner version changed while this buffer has unsaved edits',
      }
    case 'unresolved':
      return {
        type: 'set_view_status',
        viewId: outcome.viewId,
        status: 'stale',
        attention: true,
        detail: `${outcome.reason}: ${outcome.detail ?? UNRESOLVED_DETAIL[outcome.reason]}`,
      }
    case 'deferred':
      return undefined
  }
}
