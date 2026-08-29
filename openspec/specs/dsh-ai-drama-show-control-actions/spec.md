# dsh-ai-drama-show-control-actions Specification

## Purpose
Define explicit, version-fenced, preview-before-submit show-control mutations and owner-authored settlement.

## Requirements

### Requirement: Show Control mutations SHALL be preview-before-submit
context switch、batch review、repair、generate 和 delivery mutation MUST 先通过 `previewAction` 取得 owner-issued descriptor，再以同一 descriptor/version/idempotency 提交。

#### Scenario: Batch review preview is fresh
- **WHEN** 用户选择不超过 100 个显式 review targets 并请求 preview
- **THEN** owner SHALL 返回有 expiry、preview digest、target versions、risk 和 confirmation 的 descriptor，Client SHALL 在确认前不 dispatch

### Requirement: Batch targets SHALL be explicit and version-fenced
Client MUST NOT 提交 query/filter 作为动态目标；每个目标必须是当前已加载的 ref/version，任一漂移 SHALL 使整个 preview 失效。

#### Scenario: One target changes after preview
- **WHEN** 任一目标 version 在 submit 前变化
- **THEN** owner SHALL 返回 reconcile_required，插件 MUST NOT 部分执行或以新 idempotency key 自动重试

### Requirement: Action settlement SHALL remain owner-authored
Host SHALL 返回 owner receipt 或 explicit unknown/reconcile state；插件不得创建批量 ledger、伪造完成状态或替换 writer。

#### Scenario: Dispatch times out
- **WHEN** settlement 无法确认
- **THEN** Client SHALL 显示 unknown、禁用重复提交并要求读取新 owner snapshot
