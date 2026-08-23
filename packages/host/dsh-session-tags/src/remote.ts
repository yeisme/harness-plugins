/**
 * `sessionTags` Typert Remote 服务面。
 *
 * 服务 key（wire namespace）固定为 `sessionTags`，方法 `list` / `set`。
 * Remote 层是薄封装：只做标记（@Remote）与转发，不持有业务状态——
 * 业务规则全部在 SessionTagsSidecar（单一权威），避免出现第二份 canonical store。
 * unknown/partial/失败结果原样返回给 Client，绝不自动重试。
 *
 * @module @yeisme/dsh-session-tags-host/remote
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService, remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { SESSION_TAGS_REMOTE_SERVICE_KEY, SESSION_TAGS_SPEC_VERSION } from './constants.ts'
import type { SessionTagsListOkV1, SessionTagsSetInputV1, SessionTagsSetOkV1 } from './wire.ts'
import type {
  SessionNotFoundFailureV1,
  StorageUnavailableFailureV1,
  TagsInvalidFailureV1,
  VersionConflictFailureV1,
} from './wire.ts'
import type { SessionTagsSidecar } from './service.ts'

/** list 的完整 wire 返回。 */
export type SessionTagsListWireResult =
  | SessionTagsListOkV1
  | StorageUnavailableFailureV1

/** set 的完整 wire 返回。 */
export type SessionTagsSetWireResult =
  | SessionTagsSetOkV1
  | SessionNotFoundFailureV1
  | TagsInvalidFailureV1
  | VersionConflictFailureV1
  | StorageUnavailableFailureV1

/**
 * 挂在 Cordis 服务表上的 sessionTags Remote 服务。
 * 构造即注册（TypertRemoteService 基类负责），随 owner fiber 卸载自动注销。
 */
export class SessionTagsRemoteService extends TypertRemoteService {
  private readonly sidecar: SessionTagsSidecar

  constructor(ctx: Context, sidecar: SessionTagsSidecar) {
    super(ctx, SESSION_TAGS_REMOTE_SERVICE_KEY)
    this.sidecar = sidecar
  }

  /** 当前有效行 + specVersion（stale 行不可见）。 */
  @Remote
  async list(): Promise<SessionTagsListWireResult> {
    const result = await this.sidecar.list()
    if (!result.ok) return { ok: false, code: result.code, message: result.message }
    return { ok: true, specVersion: SESSION_TAGS_SPEC_VERSION, entries: result.entries }
  }

  /** 完整目标值 + ifVersion 的 CAS 写入。 */
  @Remote
  async set(input: SessionTagsSetInputV1): Promise<SessionTagsSetWireResult> {
    return this.sidecar.set(input)
  }
}

/** Remote 方法标记快照（诊断/测试用：`sessionTags.list` / `sessionTags.set`）。 */
export function sessionTagsRemoteMarkers(service: SessionTagsRemoteService) {
  return remoteMethods(service)
}
