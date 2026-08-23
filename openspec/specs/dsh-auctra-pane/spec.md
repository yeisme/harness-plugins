# dsh-auctra-pane Specification

## Purpose
TBD - created by archiving change dsh-auctra-pane-v1. Update Purpose after archive.
## Requirements
### Requirement: Auctra Pane implementation SHALL be owned by Harness Plugins
DSH-specific Host bridge, Client view registration, action admission, bundle wiring, lifecycle, and conformance tests SHALL live in `agent/harness-plugins`. Auctra SHALL remain the canonical owner of project, text unit, candidate, review, version, and export state.

#### Scenario: Plugin integration changes
- **WHEN** the DSH Auctra Pane requires a UI, Host, profile, or compatibility change
- **THEN** that implementation SHALL be changed and verified in Harness Plugins
- **AND** the plugin SHALL consume Auctra owner contracts instead of copying Auctra state or business rules

### Requirement: Auctra Pane SHALL 只投影 owner 文本与审阅状态
Harness Plugins Host adapter SHALL 从 Auctra canonical project/material/outline/text unit/review 派生脱敏 snapshot。Pane MUST NOT 保存 canonical screenplay 或小说正文副本作为事实源。

#### Scenario: 打开审阅队列
- **WHEN** 用户打开授权项目的 Auctra Pane
- **THEN** Host SHALL 下发 unit ref、pending review 摘要、freshness 与 allowed_actions
- **AND** payload MUST NOT 含完整 candidate body、raw prompt 或凭据

### Requirement: Agent candidate MUST NOT 自动覆盖 canonical text
Create candidate MAY 产生 pending review item。Accept 或 partial accept SHALL 只通过 Auctra `review accept` / `review partial`（或等价 Service API）并返回 receipt。

#### Scenario: 超时不得当作 accept
- **WHEN** review action 超时或断线
- **THEN** Pane SHALL 保持 `unknown` 或 `reconcile_required`
- **AND** SHALL NOT 把 candidate 提升为 canonical

### Requirement: 跨 Pane handoff SHALL 使用 ArtifactRefV1
Scene 或 chapter 交给 Eikona/Sonora SHALL 只携带 owner/ref/version。目标 owner 重新执行权限与版本门。

#### Scenario: Scene handoff 到 Eikona
- **WHEN** 用户对已接受 scene 发起 handoff
- **THEN** intent 的 source.owner SHALL 为 `auctra`
- **AND** Auctra canonical text SHALL 保持不变
