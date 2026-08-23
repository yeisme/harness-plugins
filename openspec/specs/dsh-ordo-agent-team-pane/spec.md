# dsh-ordo-agent-team-pane Specification

## Purpose
TBD - created by archiving change dsh-ordo-agent-team-pane-v1. Update Purpose after archive.
## Requirements
### Requirement: Ordo Team Pane implementation SHALL be owned by Harness Plugins
DSH-specific Host bridge, Client view registration, action admission, bundle wiring, lifecycle, and conformance tests SHALL live in `agent/harness-plugins`. Ordo SHALL remain the canonical owner of run, DAG, task, session, attempt, lease, approval, verification, and evidence state.

#### Scenario: Plugin integration changes
- **WHEN** the DSH Ordo Team Pane requires a UI, Host, profile, or compatibility change
- **THEN** that implementation SHALL be changed and verified in Harness Plugins
- **AND** the plugin SHALL consume Ordo owner contracts instead of copying scheduler state or business rules

### Requirement: Ordo Team Pane SHALL 只投影 canonical scheduler
Harness Plugins Host adapter SHALL 从 Ordo run/task/session/attempt/lease/approval/verification/evidence 派生 snapshot。客户端 MUST NOT 计算 runnable task、MUST NOT 释放 lease、MUST NOT 把 timeout 解释为 worker stopped。

#### Scenario: 观察 DAG
- **WHEN** 用户打开一个 Ordo run
- **THEN** Pane SHALL 显示 owner 提供的 DAG 节点、边、status 与 freshness
- **AND** SHALL NOT 本地重算依赖就绪

### Requirement: Subagent 与 Ordo SHALL 保持分离
Subagent Pane SHALL 只含当前 DSH session 的 descendant。Ordo Pane SHALL 只含完整 team run。任一 UI MUST NOT 复制对方状态树。Deep-link MAY 打开另一 Pane，但 MUST NOT 改变 canonical run。

#### Scenario: Deep-link 到 session child
- **WHEN** 用户从 Ordo task 打开相关 DSH session
- **THEN** 系统 SHALL 打开 Subagent 或 session view
- **AND** Ordo run 状态 SHALL 保持不变

### Requirement: Mutation SHALL 仅使用 owner-authored actions
Approve、reconcile 或其他动作 SHALL 带 preview 与 receipt。未开放的 launch/cancel/redispatch SHALL 返回 `not_available`。

#### Scenario: 未开放 launch
- **WHEN** 客户端提交 run launch
- **THEN** owner SHALL 拒绝或标记 not_available
- **AND** 客户端 SHALL NOT 伪造 queued 状态
