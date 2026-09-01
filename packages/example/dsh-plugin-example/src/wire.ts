/**
 * host→client wire 投影形状（源合同：packages/sdk/dsh-plugin-contracts projection.ts）。
 *
 * 生产方可以收窄取值（本示例 freshness 只用 fresh/unknown 两态），但不得超出
 * 合同的字段语义：host 边界只向浏览器传 safe projection——有界摘要、
 * 新鲜度与版本；不传凭据、raw URL、绝对路径或任意 fetch 面板。
 */

/** 投影元数据（SafeProjectionMeta 的收窄消费） */
export interface ExampleProjectionMeta {
  /** 首次观察前 unknown，之后 fresh */
  readonly freshness: 'fresh' | 'unknown'
  /** 单调代；未观察过则缺省 */
  readonly version?: string
}

/** 有界文本摘要：长度上限由生产方声明，消费方不得假定无界 */
export interface ExampleBoundedSummary {
  readonly text: string
  readonly truncated: boolean
}

/** 示例面板可见的唯一快照形状 */
export interface ExampleWireSnapshot {
  readonly meta: ExampleProjectionMeta
  readonly summary: ExampleBoundedSummary
}
