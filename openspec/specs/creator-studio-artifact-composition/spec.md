# creator-studio-artifact-composition Specification

## Purpose
TBD - created by archiving change dsh-creator-studio-v1. Update Purpose after archive.
## Requirements
### Requirement: Pane artifact intents SHALL dispatch deterministically

Pane runtime SHALL 支持 open、compare、attach_context、transform、handoff 和 link intent。它 SHALL 按 handler priority 与注册顺序选择第一个匹配 handler；没有 handler、handler 异常或非法 receipt SHALL 返回 fail-closed receipt，并且 MUST NOT 自动调用第二个 handler。

#### Scenario: Multiple handlers support the same intent
- **WHEN** 两个 handler 都声明 handoff intent
- **THEN** runtime SHALL 只调用排序最高的第一个 handler，并返回其 receipt

#### Scenario: Selected handler throws
- **WHEN** 已选 handler 在 settlement 前后抛出异常
- **THEN** runtime SHALL 返回 unknown/reconcile receipt，并且 MUST NOT fallback 到下一个 handler

### Requirement: Cross-owner composition SHALL exchange artifact refs, not domain objects

跨 owner intent SHALL 携带版本化 artifact ref、目标 owner/pane、完整 context 和 idempotency key。Client MUST NOT 复制 provider payload、absolute path、credential、raw prompt 或整个领域对象到目标插件。

#### Scenario: Pinax attaches context to Scaena
- **WHEN** 用户从 Pinax 资源触发 attach_context intent 到 Scaena
- **THEN** target owner SHALL 只收到 Pinax artifact ref 与当前 server-authored action values

### Requirement: Action forms SHALL be generated from server-authored descriptors

Client SHALL 根据当前 descriptor 渲染 text、textarea、number、select、multiselect、boolean 和 artifact_ref 字段，以及 risk、cost、rights、confirmation 与 expiry。缺少必填字段、owner 非 fresh/ready、descriptor 过期或 compact medium/high risk 时提交 SHALL 被禁用。

#### Scenario: Confirmation is required
- **WHEN** descriptor confirmation 为 confirm 或 approval
- **THEN** Client SHALL 在用户显式确认预览前禁用提交，并在 approval 情况下将最终决策留给 owner receipt

#### Scenario: Descriptor becomes stale
- **WHEN** owner snapshot ref/version 改变或 descriptor expiry 到期
- **THEN** Client SHALL 清空当前表单选择或禁用提交，并要求刷新/reconcile

### Requirement: Action input values SHALL remain ephemeral

表单 values SHALL 仅保存在当前 React 视图局部状态，并只在一次 Remote request 中传输。Controller store、Pane persistence、receipt、日志和测试证据 MUST NOT 保存 raw prompt、provider payload 或 private tool arguments。

#### Scenario: User submits a creative action
- **WHEN** Client 调用 Creator Studio dispatch
- **THEN** store snapshot SHALL 只记录 pending descriptor ref 与安全 receipt，不记录提交 values

### Requirement: Artifact handoff SHALL respect target owner readiness and risk

低风险、无需确认的 handoff MAY 在目标 owner fresh/ready 且发布匹配 descriptor 时直接提交。中高风险、需要确认、字段不完整或目标 owner 不可用的 handoff SHALL 打开目标工作区并返回 approval/reconcile receipt，而不是猜测参数或直接调用 provider。

#### Scenario: Low-risk handoff is fully described
- **WHEN** target owner fresh/ready，descriptor risk 为 low、confirmation 为 none，且 artifact ref 满足所有字段
- **THEN** Client SHALL 通过统一 Creator dispatch 提交一次，并显示 owner receipt

#### Scenario: Handoff requires additional fields
- **WHEN** target descriptor 含有 artifact intent 无法满足的必填字段
- **THEN** Client SHALL 打开目标 owner workspace 并返回 `handoff_fields_required` reconcile receipt

### Requirement: Unknown and partial outcomes SHALL preserve owner truth

`unknown`、`partial`、`cancel_unknown` 和 `reconcile_required` SHALL 作为一等状态显示。Client MUST NOT 将它们改写为 completed/failed，也 MUST NOT 因轮询或 intent fallback 自动重新提交 mutation。

#### Scenario: Owner returns unknown settlement
- **WHEN** dispatch receipt 为 unknown
- **THEN** UI SHALL 显示 receipt/reconcile reason，保持动作输入已提交的事实，并等待 owner 对账或显式新请求

