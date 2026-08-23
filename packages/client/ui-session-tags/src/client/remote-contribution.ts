/**
 * `sessionTags` Remote 的浏览器侧自挂 contribution。
 *
 * DSH Web 的 Client assembly 只挂载 in-box 生成命名空间（commands、goals…），
 * out-of-tree 插件的新命名空间必须自行经公开 API `ctx.remote.$mount()` 挂载：
 * Host 侧由 `TypertRemoteService` 的 source-mode discovery 动态绑定，无生成式
 * 白名单；Client 侧本文件提供与 Host wire 逐字段一致的严格 descriptor。
 *
 * 不引入 zod/typert 运行时依赖（ModuleLoader 单文件契约）：parse 以结构化
 * 校验实现，与 `@yeisme/dsh-session-tags-host` 的 wire 类型逐字段对齐
 * （bundle 层 sync 测试钉住两侧不漂移）。
 *
 * @module @yeisme/dsh-client-ui-session-tags/client/remote-contribution
 */

import type {
  SessionTagsListAnswerV1,
  SessionTagsSetAnswerV1,
  SessionTagsSetInputV1,
} from './wire.ts'

/** 与上游 `TypertSchema` 结构兼容的最小 parse 面。 */
interface MinimalSchema<Output> {
  parse(value: unknown): Output
}

/** 严格 codec（mode/typeSymbol/schema 与上游 `TypertCodec` 逐字段一致）。 */
interface StrictCodec {
  readonly mode: 'strict'
  readonly typeSymbol: string
  readonly schema: MinimalSchema<unknown>
}

/** 与上游 `InvocationDescriptor` 已消费字段的子集（direct 调用）。 */
export interface SessionTagsInvocationDescriptor {
  readonly id: string
  readonly service: 'sessionTags'
  readonly namespace: 'sessionTags'
  readonly method: 'list' | 'set'
  readonly invocation: { readonly kind: 'direct' }
  readonly parameters: readonly {
    readonly name: string
    readonly wire: string
    readonly source: 'json'
    readonly codec: StrictCodec
  }[]
  readonly result: StrictCodec
}

/** `$mount` 接受的 contribution 形状（package + descriptors）。 */
export interface SessionTagsRemoteContribution {
  readonly package: '@yeisme/dsh-session-tags-host'
  readonly descriptors: readonly SessionTagsInvocationDescriptor[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function expectString(value: unknown, field: string): void {
  if (typeof value !== 'string') throw new TypeError(`sessionTags wire: ${field} must be a string`)
}

function expectTagArray(value: unknown, field: string): void {
  if (!Array.isArray(value)) throw new TypeError(`sessionTags wire: ${field} must be an array`)
  for (const tag of value) expectString(tag, `${field}[]`)
}

/** list 应答：ok 时 specVersion + entries；否则 storage-unavailable。 */
const listAnswerSchema: MinimalSchema<SessionTagsListAnswerV1> = {
  parse(value: unknown): SessionTagsListAnswerV1 {
    if (!isRecord(value) || typeof value.ok !== 'boolean') {
      throw new TypeError('sessionTags.list answer: ok discriminator missing')
    }
    if (value.ok) {
      expectString(value.specVersion, 'specVersion')
      if (!Array.isArray(value.entries)) throw new TypeError('sessionTags.list answer: entries must be an array')
    } else if (value.code !== 'storage-unavailable') {
      throw new TypeError('sessionTags.list answer: unexpected failure code')
    }
    return value as unknown as SessionTagsListAnswerV1
  },
}

/** set 请求：sessionId + 完整目标 tags + ifVersion。 */
const setInputSchema: MinimalSchema<SessionTagsSetInputV1> = {
  parse(value: unknown): SessionTagsSetInputV1 {
    if (!isRecord(value)) throw new TypeError('sessionTags.set input: record required')
    expectString(value.sessionId, 'sessionId')
    expectTagArray(value.tags, 'tags')
    if (value.ifVersion !== null && typeof value.ifVersion !== 'string') {
      throw new TypeError('sessionTags.set input: ifVersion must be string|null')
    }
    return value as unknown as SessionTagsSetInputV1
  },
}

/** set 应答：ok 时行值；否则四个固定 failure code 之一。 */
const SET_FAILURE_CODES = new Set(['session-not-found', 'tags-invalid', 'version-conflict', 'storage-unavailable'])
const setAnswerSchema: MinimalSchema<SessionTagsSetAnswerV1> = {
  parse(value: unknown): SessionTagsSetAnswerV1 {
    if (!isRecord(value) || typeof value.ok !== 'boolean') {
      throw new TypeError('sessionTags.set answer: ok discriminator missing')
    }
    if (!value.ok && typeof value.code === 'string' && !SET_FAILURE_CODES.has(value.code)) {
      throw new TypeError('sessionTags.set answer: unexpected failure code')
    }
    return value as unknown as SessionTagsSetAnswerV1
  },
}

/**
 * 浏览器侧自挂的 `sessionTags` Remote contribution。
 * id 语义：`<owner-package>/<namespace>.<method>@<wire 版本>`，稳定不变。
 */
export const sessionTagsRemoteContribution: SessionTagsRemoteContribution = {
  package: '@yeisme/dsh-session-tags-host',
  descriptors: [
    {
      id: '@yeisme/dsh-session-tags-host/sessionTags.list@1',
      service: 'sessionTags',
      namespace: 'sessionTags',
      method: 'list',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'strict', typeSymbol: 'SessionTagsListAnswerV1', schema: listAnswerSchema },
    },
    {
      id: '@yeisme/dsh-session-tags-host/sessionTags.set@1',
      service: 'sessionTags',
      namespace: 'sessionTags',
      method: 'set',
      invocation: { kind: 'direct' },
      parameters: [
        { name: 'input', wire: 'input', source: 'json', codec: { mode: 'strict', typeSymbol: 'SessionTagsSetInputV1', schema: setInputSchema } },
      ],
      result: { mode: 'strict', typeSymbol: 'SessionTagsSetAnswerV1', schema: setAnswerSchema },
    },
  ],
}
