/**
 * Safe projection 元数据合同（G18 §6，自 31 包重复形状收口）。
 * 生产方可以收窄取值，但不得超出本合同的字段语义：
 * host 边界只向浏览器传 safe projection——opaque ref、有界摘要、版本、
 * freshness、evidence ref、server-authored action。
 */

/** 投影新鲜度三态（与 ui-pane-domain FoldState 等消费方取值一致） */
export type ProjectionFreshness = 'fresh' | 'stale' | 'unknown'

/** 投影元数据：随快照/事件携带的版本与水位信息，全部可选除 freshness */
export interface SafeProjectionMeta {
  readonly freshness: ProjectionFreshness
  /** 单调版本/代；缺省视为不可比较 */
  readonly version?: string
  /** 游标/序号；用于 gap 检测与 reconcile 判定 */
  readonly cursor?: string
}

/** 有界文本摘要：长度上限由生产方声明，消费方不得假定无界 */
export interface BoundedSummary {
  readonly text: string
  readonly truncated: boolean
}
