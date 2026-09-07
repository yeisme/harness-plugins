# workbench-ai-drama-review-inbox Specification

## Purpose
TBD - created by archiving change workbench-ai-drama-show-control-room-v1. Update Purpose after archive.
## Requirements
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

### Requirement: AI drama exceptions MUST render in the Spatial Review Lens
Candidate conflict、rights/cost gate、stale refs、unknown/partial settlement and repair proposals MUST render as bounded exception overlays and Review rows associated with their spatial safe refs. Ordinary success MUST remain in Creative Production or Run projection.

#### Scenario: Candidate conflict is selected on the surface
- **WHEN** the user selects a projected candidate conflict
- **THEN** the Review Lens MUST show server-authored comparison, target/version, impact, rights/cost/risk, reversibility and confirmation
- **AND** no accept/reject/repair control MAY be enabled without a current action descriptor

### Requirement: Review decisions MUST retain ProposalAuthority and Task receipts
Accept、reject and repair decisions from the Spatial Review Lens MUST use the existing ProposalAuthority/TaskService contract. Hover、focus、Lens open、Agent highlight and repeated input MUST NOT decide a proposal.

#### Scenario: Review descriptor expires while open
- **WHEN** the user submits a decision after descriptor expiry or target version drift
- **THEN** Workbench MUST reject the submission, reread the projection and require a new explicit confirmation
- **AND** MUST NOT reuse the stale decision as a mutation basis

