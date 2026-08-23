/**
 * DSH Web session tags client plugin.
 *
 * Registers the `yeisme.session-tags` grouping provider and the tag editor
 * overlay when the upstream `ctx.sessionGroupings` seam exists; probes first
 * and degrades honestly (no provider, no slots, no DOM fallback) otherwise.
 *
 * @module @yeisme/dsh-client-ui-session-tags/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { registerSessionTagsClient } from './register.ts'

export { hasSessionGroupingsSeam, registerSessionTagsClient } from './register.ts'
export type {
  RegisterSessionTagsOptions,
  SessionGroupingsRegistryLike,
  SessionTagsRegistration,
} from './register.ts'
export type {
  SessionGroupingActionV1Alpha1,
  SessionGroupingGroupV1Alpha1,
  SessionGroupingProviderV1Alpha1,
  SessionGroupingSnapshotV1Alpha1,
} from './provider.ts'
export {
  SESSION_TAGS_PROVIDER_ID,
  MANAGE_TAGS_ACTION_ID,
  UNTAGGED_GROUP_ID,
  createSessionTagsProvider,
} from './provider.ts'
export type { SessionTagsProviderDeps, SessionTagsProviderLabels } from './provider.ts'
export {
  SessionTagsController,
  createSessionTagsController,
} from './controller.ts'
export type { SessionTagsControllerDeps, SessionTagsControllerState } from './controller.ts'
export {
  TagEditorController,
  createTagEditorController,
} from './editor.ts'
export type { TagEditorDeps, TagEditorState } from './editor.ts'
export { TagEditorOverlay, createTagEditorOverlayEntry, TAG_EDITOR_OVERLAY_LABELS_EN } from './TagEditorOverlay.tsx'
export type { TagEditorOverlayLabels, TagEditorOverlayProps } from './TagEditorOverlay.tsx'
export {
  MAX_TAG_BYTES,
  MAX_TAGS_PER_SESSION,
  normalizeTagText,
  normalizeTags,
  tagUtf8Bytes,
  validateNormalizedTag,
} from './tag-input.ts'
export type { NormalizeTagsResult, TagInvalidReason } from './tag-input.ts'
export type {
  SessionNotFoundFailureV1,
  SessionTagRowV1,
  SessionTagsFailureCode,
  SessionTagsListAnswerV1,
  SessionTagsListEntryV1,
  SessionTagsListOkV1,
  SessionTagsRemoteFace,
  SessionTagsSetAnswerV1,
  SessionTagsSetInputV1,
  StorageUnavailableFailureV1,
  TagsInvalidFailureV1,
  VersionConflictFailureV1,
} from './wire.ts'
export { SESSION_TAGS_FAILURE_CODES } from './wire.ts'
export { NS, en, zh, overlayLabelsFrom } from './locales.ts'
export type { SessionTagsKey } from './locales.ts'

export const name = 'client-ui-session-tags'
export const inject = ['slots'] as const

/**
 * Mount the client face: capability-probe the grouping seam and register the
 * tags provider + editor overlay only when it exists.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): () => void {
  registerSessionTagsClient(ctx)
  return () => {}
}
