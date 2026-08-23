/**
 * 与上游 ui-workspace 既有行为的兼容边界（task 1.3 钉住）。
 *
 * DSH 的 `SessionGroupBy` 内建值是 `workspace` 与 `flat`（持久化于
 * `dsh.workspace.view.v5`）。本插件承诺 additive：不 shadow、不复用、
 * 不重命名这两个字面量；外部 provider 的选择键一律走 `provider:` 前缀
 * 命名空间（上游 seam 的浏览器侧约定）。上游 PR 的 staging 测试在
 * DSH 仓内直接 pin 这两个值的既有行为；本文件把“我们依赖的边界”
 * 固化在本仓合同测试里。
 *
 * @module @yeisme/dsh-client-ui-session-tags/client/compat
 */

/** 上游内建分组值（冻结边界：任何变化都是 breaking，需要新 OpenSpec）。 */
export const BUILTIN_SESSION_GROUP_BY = Object.freeze(['workspace', 'flat'] as const)

/** 外部 provider 选择键前缀（与内建值域可区分）。 */
export const EXTERNAL_GROUP_BY_PREFIX = 'provider:' as const

/** 判定一个分组选择值是否属于外部 provider 命名空间。 */
export function isExternalGroupByValue(value: string): boolean {
  return value.startsWith(EXTERNAL_GROUP_BY_PREFIX)
}
