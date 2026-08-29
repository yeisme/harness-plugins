/**
 * @yeisme/dsh-session-tags-host.
 *
 * Plugin-owned Session tags sidecar. Canonical rows live in the public
 * storage-domain `yeisme_session_tags_v1`; the Typert Remote namespace
 * `sessionTags` exposes `list`/`set` with full-target + `ifVersion` CAS.
 * The sidecar never touches SessionEvent logs, Workspace state, or
 * browser storage, and never changes Session recency.
 *
 * 入口分层：
 * - `./wire`    ：跨 Host/Client 的 wire 合同类型（specVersion '1.0'）。
 * - `./tags`    ：V1 标签模型（NFKC/trim、12×64bytes、控制字符拒绝）。
 * - `./domain`  ：storage-domain 声明（sessions 表）。
 * - `./service` ：行级 CAS + 生命周期身份校验的 sidecar 核心。
 * - `./remote`  ：`sessionTags` Typert Remote 服务面。
 * - `./plugin`  ：Cordis 插件装配（storageDomain + sessionPersistence）。
 *
 * @module @yeisme/dsh-session-tags-host
 */

import {
  SESSION_TAGS_CAPABILITY,
  SESSION_TAGS_DOMAIN,
  SESSION_TAGS_HOST_VERSION,
} from './constants.ts'
import type { SessionTagRowV1, SessionTagSessionIdentityV1 } from './wire.ts'
import type { SessionTagsSidecar } from './service.ts'

export {
  SESSION_TAGS_CAPABILITY,
  SESSION_TAGS_DOMAIN,
  SESSION_TAGS_HOST_VERSION,
  SESSION_TAGS_REMOTE_SERVICE_KEY,
  SESSION_TAGS_SPEC_VERSION,
  SESSION_ORGANIZATION_ADMIN_TTL_MS,
  SESSION_ORGANIZATION_AUTO_CONFIDENCE,
  SESSION_ORGANIZATION_BATCH_RETENTION_MS,
  SESSION_ORGANIZATION_DOMAIN,
  SESSION_ORGANIZATION_REMOTE_SERVICE_KEY,
  SESSION_ORGANIZATION_SPEC_VERSION,
} from './constants.ts'

export type {
  AssignmentSourceV1,
  BatchActionV1,
  BatchItemReceiptV1,
  BatchItemStatusV1,
  BatchPlanV1,
  BatchReceiptV1,
  BatchTargetV1,
  ClassificationCandidateV1,
  ClassificationStatusV1,
  FunctionTypeV1,
  OrganizationFailureV1,
  OrganizationRuleActionV1,
  OrganizationRuleConditionV1,
  OrganizationRuleV1,
  OrganizationScopeV1,
  PutFunctionTypeInputV1,
  PutRuleInputV1,
  PutTagCatalogInputV1,
  SessionOrganizationAssignmentV1,
  SessionOrganizationSnapshotV1,
  SetAssignmentInputV1,
  TagCatalogEntryV1,
} from './organization-wire.ts'

export {
  TemporaryAdminGate,
  applyClassificationPolicy,
  defaultFunctionTypes,
  evaluateOrganizationRules,
} from './organization.ts'
export type {
  ClassificationPolicyInput,
  ClassificationPolicyResult,
  RuleEvaluationV1,
  RuleSubjectV1,
} from './organization.ts'

export {
  assignmentSchema,
  batchReceiptSchema,
  functionTypeSchema,
  organizationRuleSchema,
  sessionOrganizationDomainSpec,
  tagCatalogEntrySchema,
} from './organization-domain.ts'
export type { SessionOrganizationDomainSpec } from './organization-domain.ts'

export { SessionOrganizationSidecar } from './organization-service.ts'
export type {
  OrganizationClassifierPort,
  OrganizationTablePort,
  SessionLifecyclePort,
  SessionOrganizationSidecarDeps,
  SessionOrganizationStorePort,
} from './organization-service.ts'

export {
  SessionOrganizationRemoteService,
  sessionOrganizationRemoteMarkers,
} from './organization-remote.ts'

export type {
  SessionTagRowV1,
  SessionTagSessionIdentityV1,
  SessionTagsListEntryV1,
  SessionTagsListOkV1,
  SessionTagsSetInputV1,
  SessionTagsSetOkV1,
  SessionNotFoundFailureV1,
  StorageUnavailableFailureV1,
  TagsInvalidFailureV1,
  VersionConflictFailureV1,
} from './wire.ts'
export { SESSION_TAGS_FAILURE_CODES } from './wire.ts'
export type { SessionTagsFailureCode } from './wire.ts'

export {
  MAX_TAGS_PER_SESSION,
  MAX_TAG_BYTES,
  normalizeTagText,
  normalizeTags,
  tagUtf8Bytes,
  tagsMaterialEqual,
  validateNormalizedTag,
} from './tags.ts'
export type { NormalizeTagsResult, TagInvalidReason } from './tags.ts'

export { sessionTagsDomainSpec, sessionTagRowSchema } from './domain.ts'
export type { SessionId, SessionTagsDomainSpec } from './domain.ts'

export {
  createSessionTagsSidecar,
  SessionTagsSidecar,
} from './service.ts'
export type {
  SessionIdentityPort,
  SessionTagsFailure,
  SessionTagsListOk,
  SessionTagsListResult,
  SessionTagsSetOk,
  SessionTagsSidecarDeps,
  SessionTagsTablePort,
} from './service.ts'

export {
  SessionTagsRemoteService,
  sessionTagsRemoteMarkers,
} from './remote.ts'
export type {
  SessionTagsListWireResult,
  SessionTagsSetWireResult,
} from './remote.ts'

export {
  apply,
  createPersistenceIdentityPort,
  createOrganizationStorePort,
  createStorageDomainTablePort,
  inject,
  mountSessionTags,
  name,
} from './plugin.ts'
export type {
  MountedSessionTags,
  SessionOrganizationDomainHandle,
  SessionPersistenceListFace,
  SessionTagsDomainHandle,
} from './plugin.ts'

/**
 * 后续 3.2/3.3 接到公开 `ctx.storageDomain.open(...)` 的构造参数。
 * 3.1 形状保留：只携带 domain 名，不代表已打开的表句柄。
 */
export interface SessionTagsStorageDomainSeam {
  readonly domain: typeof SESSION_TAGS_DOMAIN
}

/**
 * 后续 3.2 接到公开 session-persistence 身份校验的构造参数。
 * 只检查 Session 是否存在且生命周期仍匹配；不得加载或追加 SessionEvent。
 */
export interface SessionTagsPersistenceSeam {
  inspectIdentity(sessionId: string): Promise<SessionTagSessionIdentityV1 | undefined>
}

/**
 * Typed seams for storage-domain / persistence / Typert wiring.
 * Constructor args only — this package does not call live DSH services.
 */
export interface SessionTagsHostSeamsV1 {
  readonly storageDomain?: SessionTagsStorageDomainSeam
  readonly sessionPersistence?: SessionTagsPersistenceSeam
  /** 已装配的 sidecar 核心（3.2/3.3 起可注入；缺省时 host face 不产生标签）。 */
  readonly sidecar?: SessionTagsSidecar
}

export interface SessionTagsHostV1 {
  readonly version: typeof SESSION_TAGS_HOST_VERSION
  readonly capability: typeof SESSION_TAGS_CAPABILITY
  readonly domain: typeof SESSION_TAGS_DOMAIN
  /** Returns currently known sidecar rows. An unwired host never invents tags. */
  listRows(): Promise<readonly SessionTagRowV1[]>
}

/** Wrap optional seams as a versioned `SessionTagsHostV1`. */
export function createSessionTagsHost(seams: SessionTagsHostSeamsV1 = {}): SessionTagsHostV1 {
  return {
    version: SESSION_TAGS_HOST_VERSION,
    capability: SESSION_TAGS_CAPABILITY,
    domain: SESSION_TAGS_DOMAIN,
    async listRows() {
      // 未接线（没有 sidecar 核心）时必须保持“零标签、零探测”：
      // 不得读取 persistence，也不得伪造行。
      if (seams.sidecar === undefined) {
        void seams.storageDomain
        void seams.sessionPersistence
        return Object.freeze([])
      }
      const result = await seams.sidecar.list()
      if (!result.ok) throw new Error(result.message)
      return result.entries.map(entry => entry.row)
    },
  }
}

/** Placeholder host used until domain table/CAS and Remote are implemented. */
export function createSessionTagsHostPlaceholder(
  seams: SessionTagsHostSeamsV1 = {},
): SessionTagsHostV1 {
  return createSessionTagsHost(seams)
}

/** Runtime guard for an owner-provided Session tags host. */
export function isSessionTagsHostV1(value: unknown): value is SessionTagsHostV1 {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<SessionTagsHostV1>
  return candidate.version === SESSION_TAGS_HOST_VERSION
    && candidate.capability === SESSION_TAGS_CAPABILITY
    && candidate.domain === SESSION_TAGS_DOMAIN
    && typeof candidate.listRows === 'function'
}
