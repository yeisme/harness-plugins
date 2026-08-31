## ADDED Requirements

### Requirement: Ordo Team Pane SHALL consume the collaboration projection
Ordo Team Pane SHALL 从 Harness Host 的 versioned safe projection 获取 Team Profile、Delivery、task 双状态、role binding、Room、Activity、surface control、allowed actions 与 receipts。Client MUST 不读取 Ordo files、spawn CLI、连接 broker 或持久化 domain ledger。

#### Scenario: Pane loads a Delivery
- **WHEN** Host 返回 valid `OrdoTeamCollaborationProjectionV1`
- **THEN** Pane SHALL 渲染 owner facts/actions/freshness；unknown optional fields MAY 被忽略，schema major mismatch MUST 显示 typed incompatible state

### Requirement: Pane mutations SHALL use server-authored actions only
Pane SHALL 只渲染 Host 转发的 owner action descriptors，并在 dispatch 时提交 action id、canonical input、context revision、target revision、preview/approval refs 与 idempotency key。Client MUST 不构造本地 scheduler commands 或 optimistic owner state。

#### Scenario: Handoff succeeds
- **WHEN** Host 返回 handoff receipt 和随后 event
- **THEN** Pane SHALL 以 event/snapshot 更新 assignee/handoff history；receipt 前 MUST 保持 pending，不得先行显示完成

### Requirement: Room and Activity SHALL remain separate client surfaces
Pane SHALL 提供 Room messages/replies/promotions 与 immutable Activity facts 的独立 tabs/regions，并 SHALL 显示交叉 links。Runtime transcript、tool output 或 reasoning MUST 不自动出现在两者。

#### Scenario: User promotes a Room message
- **WHEN** message 有 owner-authored Promote action
- **THEN** Pane SHALL 打开 typed target flow，并在 receipt 后显示 promotion/activity links，原 message MUST 保持 immutable

### Requirement: Completion SHALL respect the Ordo boundary
Pane SHALL 只在 owner projection 包含 accepted delivery receipt 和 required integration facts 时显示 complete。它 MUST 不暴露 target merge、push 或 deploy action，也不得把 `execution_state=completed` 解释为 Delivery complete。

#### Scenario: Tasks are completed but candidates are pending
- **WHEN** 所有 task execution completed 但至少一个 delivery state 为 candidate
- **THEN** Pane SHALL 显示 awaiting acceptance，complete CTA/status MUST 不出现

