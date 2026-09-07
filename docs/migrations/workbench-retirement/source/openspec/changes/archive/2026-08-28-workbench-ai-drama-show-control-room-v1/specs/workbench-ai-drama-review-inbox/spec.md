## ADDED Requirements

### Requirement: Review Inbox 必须异常优先

Review Inbox SHALL 只聚合需要人工决定的 candidate conflict、rights/cost gate、stale refs、unknown/partial settlement 和 repair proposal。普通成功状态 SHALL 留在 Show/Episode/Run projection，不得淹没待处理例外。

#### Scenario: 存在未知结算

- **WHEN** owner action 返回 unknown 或 partial
- **THEN** Review Inbox SHALL 显示原 idempotency identity、owner receipt ref、影响范围和 reconcile action
- **AND** SHALL 禁止自动重试 mutation

### Requirement: Review 决定必须显示影响与可逆性

每个 accept、reject 或 repair action SHALL 展示目标/version、候选差异、影响对象、risk/cost/rights、可逆性和 owner-authored confirmation。

#### Scenario: Descriptor 已过期

- **WHEN** 用户提交 review 时 action descriptor 已过期或 target version 漂移
- **THEN** Workbench SHALL 拒绝提交
- **AND** SHALL 重新读取 projection 并要求用户重新确认
