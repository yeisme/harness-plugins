# dsh-sonora-pane Specification

## Purpose
TBD - created by archiving change dsh-sonora-pane-v1. Update Purpose after archive.
## Requirements
### Requirement: Sonora Pane implementation SHALL be owned by Harness Plugins
DSH-specific Host bridge, Client view registration, action admission, bundle wiring, lifecycle, and conformance tests SHALL live in `agent/harness-plugins`. Sonora SHALL remain the canonical owner of job, take, rights, cost, review, and receipt state.

#### Scenario: Plugin integration changes
- **WHEN** the DSH Sonora Pane requires a UI, Host, profile, or compatibility change
- **THEN** that implementation SHALL be changed and verified in Harness Plugins
- **AND** the plugin SHALL consume Sonora owner contracts instead of copying Sonora state or business rules

### Requirement: Sonora Pane SHALL 只投影 owner job 与 take 状态
Harness Plugins Host adapter SHALL 从 Sonora canonical job/take/review/rights/cost 派生脱敏 snapshot。投影 MUST NOT 成为第二音频账本。SSE SHALL 仅作带 cursor 的通知，权威状态 MUST 通过读接口修复。

#### Scenario: Take list 打开
- **WHEN** 用户打开授权工作区的 Sonora Pane
- **THEN** Host SHALL 下发 take ref、status、duration、freshness、allowed_actions
- **AND** payload MUST NOT 含音频字节、凭据、raw SSE 或绝对路径

### Requirement: Render 与 accept SHALL 经过 approval 与 receipt
Render、review take、accept、export SHALL 使用 Sonora owner action。缺 cost/rights 预览时 MUST 禁用 mutation。

#### Scenario: 无 rights 预览
- **WHEN** owner 未返回 rights/cost descriptor
- **THEN** Pane SHALL 显示 `approval_required` 或 `contract_mismatch`
- **AND** SHALL NOT 本地推断可渲染

### Requirement: 事件恢复 SHALL 禁止轮询
首次打开 Host SHALL 读取 snapshot，之后 MUST 只消费 push event。gap 或过期 cursor SHALL 进入 `reconcile_required`。客户端 MUST NOT 轮询。

#### Scenario: SSE 断线
- **WHEN** 连接丢失
- **THEN** Pane SHALL 显示 `offline` 或 `stale` 并在重连后重读 snapshot
- **AND** SHALL NOT 使用 `setInterval` refetch
