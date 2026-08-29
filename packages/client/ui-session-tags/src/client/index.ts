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

export { hasSessionGroupingsSeam, registerSessionTagsClient, resolveSessionOrganizationRemote } from './register.ts'
export {
  sessionTagsRemoteContribution,
} from './remote-contribution.ts'
export { sessionManagementRemoteContribution, sessionOrganizationRemoteContribution } from './organization-remote-contribution.ts'
export type { SessionOrganizationInvocationDescriptor } from './organization-remote-contribution.ts'
export type {
  SessionTagsInvocationDescriptor,
  SessionTagsRemoteContribution,
} from './remote-contribution.ts'
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
  MANAGE_ORGANIZATION_ACTION_ID,
  SESSION_FUNCTIONS_PROVIDER_ID,
  createSessionFunctionsProvider,
} from './organization-provider.ts'
export type { OrganizationSessionRef } from './organization-provider.ts'
export {
  SessionOrganizationController,
  createSessionOrganizationController,
} from './organization-controller.ts'
export type { SessionOrganizationControllerState } from './organization-controller.ts'
export { OrganizationEditorController } from './organization-editor.ts'
export type { OrganizationEditorState } from './organization-editor.ts'
export { OrganizationEditorOverlay } from './OrganizationEditorOverlay.tsx'
export type {
  BatchActionV1,
  BatchPlanV1,
  BatchReceiptV1,
  FunctionTypeV1,
  OrganizationFailureV1,
  OrganizationRuleV1,
  OrganizationScopeV1,
  SessionOrganizationAssignmentV1,
  SessionOrganizationRemoteFace,
  SessionOrganizationSnapshotV1,
  TagCatalogEntryV1,
} from './organization-wire.ts'
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
// cordis 的静态 inject 是硬依赖：缺任一 service 插件 entry 永久 pending，直接拖死
// web boot（"entry did not activate"）。因此静态白名单只声明官方 runtime 恒有服务：
// slots（overlay 注入）、sessions（会话快照）、remote（sessionTags Remote）。
// - 'sessionGroupings'（上游分组 seam，未进官方发布版）绝不静态声明：apply 时先 probe，
//   缺失则经动态 ctx.inject 晚绑定——seam 将来出现即自动注册，始终不出现则保持
//   诚实降级（零注册、零死按钮、无轮询）。若静态声明，官方 runtime 会永久 pending。
// - 'effect' 是 Context 方法而非 service：声明它等于等待一个永不存在的 service。
export const inject = ['slots', 'sessions', 'remote'] as const

/**
 * Mount the client face: capability-probe the grouping seam and register the
 * tags provider + editor overlay only when it exists. When the seam is not
 * present yet, schedule a dynamic injection so a later-provided seam still
 * registers (and an absent seam degrades honestly, forever, without polling).
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): () => void {
  void registerSessionTagsClient(ctx).then(registration => {
    if (registration.registered) return
    // 晚绑定（仅原生 cordis ctx）：seam 到位时 sub-fiber 触发注册；seam 消失时随服务卸载。
    // 浏览器 ModuleLoader 的 guard facade 未声明时访问 ctx.inject 会抛错，必须先 try 探测。
    let dynamicInject: ((services: readonly string[], body: (sub: ClientContext) => void) => unknown) | undefined
    try {
      const candidate = (ctx as { inject?: unknown }).inject
      if (typeof candidate === 'function') dynamicInject = candidate as typeof dynamicInject
    } catch {
      dynamicInject = undefined // guard facade 拒绝读取：浏览器侧依赖 apply 时探测即可
    }
    if (dynamicInject !== undefined) {
      dynamicInject(['sessionGroupings'], sub => void registerSessionTagsClient(sub))
    }
  })
  return () => {}
}
