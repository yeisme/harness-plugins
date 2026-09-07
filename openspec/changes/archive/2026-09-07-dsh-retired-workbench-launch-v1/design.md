## Context

根 `retire-standalone-workbench-v1` 已确认删除目标。沿用既有 disabled/target_unavailable 结果，不新增协议字段。当前 launcher 与 handoff 两入口均阻止调用 remote，历史独立适配器仍用于兼容合同测试。

## Migration and Rollback

旧 API 保留可调用的显式不可用结果，用户可继续使用原 DSH Pane。新画布将提供独立本地 Pane 注册，不复用旧 URL/launchRef。回滚代码不等于恢复远程目标，必须有另行明确恢复决定。

## Validation

使用现有 Vitest 验证五种 intent、旧 handoff、V2/legacy 零调用，以及既有导演组件与入站合同回归。没有新增 React surface，不更改 DSH 视觉系统。
