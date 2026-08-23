/**
 * Host 插件装配：storageDomain + sessionPersistence → sessionTags Remote。
 *
 * 装配顺序与生命周期（不变量）：
 * 1. `ctx.storageDomain.open(sessionTagsDomainSpec)` 打开插件自有 domain；
 *    domain 名由 facility 保证单开，重复 open 以 `already-open` fail loud。
 * 2. 表端口与身份端口都是纯转发适配器：表端口直接映射 KvTable 的
 *    get/entries/put/delete；身份端口只做 metadata-only 读取
 *    （persistence.list()），绝不加载 SessionEvent 日志。
 * 3. `SessionTagsRemoteService` 构造即注册到 Cordis 服务表并绑定 Typert
 *    Gateway namespace `sessionTags`；服务随 owner fiber 卸载自动注销。
 * 4. domain 关闭挂在 ctx.effect disposer 上：插件卸载时先让 Remote 随
 *    fiber 注销，再关 domain（drain 写入链后释放 backend unit），
 *    保证不泄漏 open domain。
 *
 * @module @yeisme/dsh-session-tags-host/plugin
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
// Type-only：拉入 sessionPersistence 的 Context 声明合并（无运行时依赖）。
import type {} from '@deepseek-ai/dsh-session-persistence'
import { sessionTagsDomainSpec, type SessionTagsDomainSpec } from './domain.ts'
import { SessionTagsRemoteService } from './remote.ts'
import { SessionTagsSidecar, type SessionTagsTablePort, type SessionIdentityPort } from './service.ts'
import type { SessionTagSessionIdentityV1 } from './wire.ts'

/** Cordis 插件名。 */
export const name = 'dsh-session-tags-host'

/** 依赖的公开 DSH 服务：storage domain 设施 + Session persistence。 */
export const inject = ['storageDomain', 'sessionPersistence'] as const

/** 打开后 sessions 表的句柄形状（`Domain<SessionTagsDomainSpec>` 的投影）。 */
export type SessionTagsDomainHandle = Domain<SessionTagsDomainSpec>

/**
 * 把打开的 domain 的 sessions 表适配为 sidecar 表端口。
 * 纯转发：durability-before-memory 与写入串行化由 storage-domain 保证，
 * 本适配器不缓存任何行副本。
 */
export function createStorageDomainTablePort(domain: SessionTagsDomainHandle): SessionTagsTablePort {
  const table = domain.table('sessions')
  return {
    get: key => table.get(key),
    entries: () => table.entries(),
    put: (key, row) => table.put(key, row),
    delete: key => table.delete(key),
  }
}

/** 公开 sessionPersistence 的 metadata-only 形状（只用到 list()）。 */
export interface SessionPersistenceListFace {
  list(signal?: AbortSignal): Promise<readonly {
    readonly id: string
    readonly createdAt: number
    readonly cwd?: string
  }[]>
}

/**
 * 把公开 sessionPersistence 适配为身份端口。
 * 只调用 metadata-only 的 `list()`（Header 读取，无日志加载）；
 * epoch-ms createdAt 统一折叠为 ISO 字符串再绑定到 sidecar 行。
 */
export function createPersistenceIdentityPort(
  persistence: SessionPersistenceListFace,
): SessionIdentityPort {
  return {
    async inspectIdentity(sessionId) {
      const headers = await persistence.list()
      const header = headers.find(h => h.id === sessionId)
      if (header === undefined) return undefined
      const identity: SessionTagSessionIdentityV1 = {
        createdAt: new Date(header.createdAt).toISOString(),
        ...(header.cwd === undefined ? {} : { cwd: header.cwd }),
      }
      return identity
    },
  }
}

/** mount 结果：Remote 服务 + domain 释放。 */
export interface MountedSessionTags {
  readonly remote: SessionTagsRemoteService
  readonly sidecar: SessionTagsSidecar
  readonly dispose: () => Promise<void>
}

/** 打开 domain 并装配 sidecar + Remote（apply 的可测试内核）。 */
export async function mountSessionTags(ctx: Context): Promise<MountedSessionTags> {
  const domain = await ctx.storageDomain.open(sessionTagsDomainSpec)
  const sidecar = new SessionTagsSidecar({
    table: createStorageDomainTablePort(domain),
    identity: createPersistenceIdentityPort(ctx.sessionPersistence as SessionPersistenceListFace),
  })
  const remote = new SessionTagsRemoteService(ctx, sidecar)
  return {
    remote,
    sidecar,
    dispose: () => domain.close(),
  }
}

/** Host 插件入口：mount 并把 domain 关闭挂到插件卸载。 */
export async function apply(ctx: Context): Promise<void> {
  const mounted = await mountSessionTags(ctx)
  ctx.effect(() => () => {
    void mounted.dispose()
  }, 'dsh-session-tags-host: close storage domain')
}
