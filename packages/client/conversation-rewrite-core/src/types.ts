/**
 * Host-neutral conversation rewrite V2 类型。
 *
 * 这些类型是 Web 与 TUI 共享的最小事实投影：Session 身份、generation、
 * 消息/文本内容、turn/end 边界、能力与派生 target。core 只比较 opaque key，
 * 不解析其内部结构；数组输入一律视为 immutable，内部排序前先复制。
 *
 * @module @yeisme/dsh-client-ui-conversation-rewrite-core
 */

/** 消息种类：user/steering 是可改写的 prompt，assistant 是 Retry 的寻址锚点。 */
export type RewriteMessageKindV2 = 'user' | 'steering' | 'assistant'

/**
 * 内容块：全部为 `text` 时才可改写；出现任何非 text 块（附件/图片/未知类型）
 * 整条消息即 not-text，不拼接 caption 或未知字段。
 */
export type RewriteContentPartV2 =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: string; readonly [key: string]: unknown }

/** adapter 提供的稳定消息投影；`key` 为 opaque identity，core 只比较/返回。 */
export interface RewriteMessageV2 {
  readonly key: string
  readonly kind: RewriteMessageKindV2
  readonly seq: number
  readonly messageId?: string
  readonly content: readonly RewriteContentPartV2[]
  /** false 表示消息尚未定稿（仍在生成/排队），不能作为稳定改写目标。 */
  readonly completed: boolean
}

/** 当前 Session 的最小投影；adapter 负责从各自 owner 数据归一化。 */
export interface RewriteConversationSnapshotV2 {
  readonly sessionId: string
  readonly generation: number
  readonly running: boolean
  readonly removed: boolean
  readonly messages: readonly RewriteMessageV2[]
  /** 已完成的 turn/end 事件 seq 列表（无需排序，core 内部复制后排序）。 */
  readonly turnEnds: readonly number[]
}

/** owner 能力：`forkBeforeMessage` 缺席时首轮改写 fail closed。 */
export interface RewriteCapabilitiesV2 {
  readonly forkBeforeMessage: boolean
}

/** Edit = 修改历史 prompt；Retry = 未修改重发（TUI 未修改提交亦传 retry）。 */
export type RewriteKindV2 = 'edit' | 'retry'

/**
 * 稳定禁用原因：前五个与 Web V1 完全同义；
 * V2 新增 stale / stable-boundary-unavailable / settlement-pending 仅在 V2 API 暴露。
 */
export type RewriteDisableReasonV2 =
  | 'not-found'
  | 'not-text'
  | 'running'
  | 'first-round'
  | 'removed'
  | 'stale'
  | 'stable-boundary-unavailable'
  | 'settlement-pending'

/** 派生目标：一切字段由 boundary 决定，controller 只消费不再推导。 */
export interface RewriteTargetV2 {
  readonly kind: RewriteKindV2
  /** 稳定 target key（UI 行/操作标识），由 boundary 生成。 */
  readonly key: string
  readonly sourceSessionId: string
  readonly sourceGeneration: number
  /** 被改写的 prompt 消息 key。 */
  readonly messageKey: string
  /** 被改写的 prompt 消息 seq；首轮 forkBeforeMessage 也使用该 seq。 */
  readonly messageSeq: number
  /** prompt 之前最近的 turn/end；null 表示首轮（依赖 forkBeforeMessage）。 */
  readonly boundarySeq: number | null
  /** 新 child 中要发送的文本（原样或已编辑）。 */
  readonly text: string
}

export type RewriteDecisionV2 =
  | { readonly ok: true; readonly target: RewriteTargetV2 }
  | { readonly ok: false; readonly reason: RewriteDisableReasonV2 }
