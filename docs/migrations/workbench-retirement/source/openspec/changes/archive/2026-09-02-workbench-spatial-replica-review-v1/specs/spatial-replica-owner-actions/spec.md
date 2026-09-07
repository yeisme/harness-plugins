## ADDED Requirements

### Requirement: 所有 canonical mutation 必须来自 server-authored action descriptor

Workbench SHALL 只渲染 composition service 返回的 `SpatialReplicaActionDescriptorV1`。该 wrapper MUST 引用并复用既有共享 `ActionDescriptorV1` 的 action id、target Operation、availability、reason/recovery、descriptor revision 与 tenant/workspace scope，不得重定义或重类型既有 descriptor；wrapper 还 MUST 声明 binding ref、canonical owner、target ref、expected version、required capability、input schema、confirmation policy、idempotency scope、expiry 和 receipt/reconcile contract。Browser MUST NOT 自行拼接 owner endpoint、action type、availability 或权限。

#### Scenario: Current projection 提供 stage edit descriptor

- **WHEN** Scaena capability current 且 principal 对目标 stage 有 edit 权限
- **THEN** Workbench SHALL 仅在 base `ActionDescriptorV1` ready 且 spatial wrapper current/一致时按 typed input schema 呈现编辑入口
- **AND** submit SHALL 回到 Workbench server revalidation，而不是直连 Scaena

#### Scenario: Browser 构造未发布 action type

- **WHEN** client 提交不在 current descriptor set 中的 action
- **THEN** server SHALL fail closed 并返回 bounded `action_not_available`
- **AND** SHALL NOT 转发到任何 owner

#### Scenario: Spatial wrapper 与共享 descriptor 不一致

- **WHEN** wrapper 的 owner binding/target Operation 与其引用的 current `ActionDescriptorV1` 不一致或 descriptor revision 已过期
- **THEN** Workbench SHALL 将该 action 标为 stale/needs_contract 并禁用
- **AND** SHALL NOT 以 wrapper 创建第二套 availability 或 permission 判定

### Requirement: Action 必须按 canonical ownership 路由

Evidence observation/correction action SHALL 路由 Anatomia；proxy/keyframe/retarget/completion/review/freeze SHALL 路由 Scaena；screenplay mutation SHALL 路由 Auctra 已发布 contract；Agent 建议 SHALL 先进入 ProposalAuthority。Workbench TaskService MAY 负责执行状态与 receipt index，但 MUST NOT 重解释 domain payload 或接管 canonical state。

#### Scenario: 用户修正人物 mask 证据

- **WHEN** user 提交有效 evidence correction descriptor
- **THEN** TaskService SHALL 将 typed request 路由 Anatomia owner adapter
- **AND** Workbench SHALL 仅在 Anatomia receipt/projection 确认后显示 canonical change

#### Scenario: 用户批准 motion retarget

- **WHEN** user 提交 Scaena review descriptor
- **THEN** action SHALL 路由 Scaena 并保留 expected stage/motion version
- **AND** Anatomia evidence SHALL NOT 被该动作改写

### Requirement: Typed edit draft 必须保持 ephemeral 且可审查

Workbench SHALL 在 browser session 内保存未提交的 typed edit draft，并显示 target、base version、field diff、owner、validation 和 submission impact。Draft MUST NOT 写入 Workbench canonical DB；shot switch、Pane close、scope revoke、logout 或 navigation 时 MUST 提供 discard/cancel navigation 的明确处理。

#### Scenario: 用户带未提交 draft 切换 shot

- **WHEN** 当前 draft 非空且用户选择另一个 shot
- **THEN** Workbench SHALL 显示 navigation-away guard
- **AND** 只有用户明确 discard 后才可清理 draft 并切换

#### Scenario: Draft schema 已过期

- **WHEN** owner contract/input schema version 在提交前变化
- **THEN** Workbench SHALL 将 draft 标为 stale 并禁用 submit
- **AND** SHALL 保留可读 diff 供用户复制或重新开始

### Requirement: Action 执行必须验证 expected version 与 idempotency

每次 action submit MUST 携带 spatial binding ref、既有 action id/descriptor revision、target ref、expected owner version、idempotency key 和 principal/session context。Server SHALL 在 enqueue/forward 前重新加载并验证 wrapper、共享 descriptor 与 owner current state，并以 owner/task receipt 返回 accepted、rejected、conflict、duplicate 或 unknown。

#### Scenario: Expected version current

- **WHEN** action descriptor 未过期且 target owner version 等于 expected version
- **THEN** server SHALL 以唯一 idempotency key 接受或排队该 action
- **AND** SHALL 返回可跟踪 Task/owner receipt ref

#### Scenario: Expected version conflict

- **WHEN** owner current version 已不同于 descriptor expected version
- **THEN** server SHALL 拒绝或返回 conflict
- **AND** client SHALL refresh projection，不得覆盖 owner current state

### Requirement: Workbench 不得 optimistic 修改 canonical projection

Action submit 后，Workbench MAY 显示 local pending indicator 和 submitted diff，但 MUST 保留 last-confirmed owner projection。只有 current owner receipt/projection 证明新 version 后，client 才能把变化呈现为 canonical current/frozen。

#### Scenario: Scaena freeze 正在执行

- **WHEN** freeze Task 已 accepted 但 owner receipt 尚未确认 frozen version
- **THEN** Workbench SHALL 显示 pending 与 last-confirmed stage
- **AND** SHALL NOT 将 Inspector 的 Frozen 层提前更新

#### Scenario: Owner action rejected

- **WHEN** owner receipt 返回 rejected
- **THEN** Workbench SHALL 恢复 last-confirmed projection 并展示安全 reason/recovery
- **AND** SHALL NOT 留下看似成功的 local stage state

### Requirement: Duplicate pending action 必须被阻止或合并

Workbench SHALL 使用 descriptor/idempotency scope 与 current pending receipts 识别重复 action。相同 target、base version 和 semantic input 的 action 在未 terminal 前 MUST NOT 被重复排队；UI SHALL 显示现有 Task/receipt。

#### Scenario: 用户重复点击冻结

- **WHEN** 同一 stage/version 的等价 freeze action 已 pending
- **THEN** submit control SHALL 禁用或返回 existing Task
- **AND** SHALL NOT 创建第二个 owner mutation

### Requirement: Unknown accept 只能通过 reconcile 解决

Transport timeout、stream gap 或 response loss 后，Workbench MUST NOT 将 action 推断为成功或失败。它 SHALL 显示 `unknown_accept`，保留 idempotency key/Task ref，并仅通过 TaskService/owner receipt/current projection reconcile 到 terminal/current state。

#### Scenario: Owner 接收后连接中断

- **WHEN** Workbench 未收到 accept response 但 action 可能已到达 owner
- **THEN** UI SHALL 显示 unknown accept 并禁用等价重提
- **AND** reconcile SHALL 查询现有 idempotency/receipt，而不是生成新 mutation

#### Scenario: Reconcile 找到 committed owner version

- **WHEN** owner current projection 与 receipt 证明 action 已完成
- **THEN** Workbench SHALL 将 Task 更新为 succeeded 并加载 confirmed version
- **AND** SHALL 保留原 action/receipt lineage

### Requirement: Stale、revoked、permission 与 offline action 必须 fail closed

Action descriptor 过期、target stale、capability revoked、principal scope 缺失或 owner offline 时，Workbench SHALL 禁用 action 并展示 bounded cause/recovery。已经打开的 dialog 不得绕过重新验证。

#### Scenario: Dialog 打开后权限被撤销

- **WHEN** user 在 confirmation dialog 停留期间收到 capability revoked event
- **THEN** submit SHALL 被禁用
- **AND** server 即使收到旧请求也 SHALL 拒绝

### Requirement: Direct user action 与 Agent proposal 必须保持不同权限路径

明确允许的低风险 direct action MAY 在 user confirmation 后进入 TaskService；Agent 生成或高风险 mutation intent MUST 先创建 ProposalAuthority proposal，经过批准后才可执行。Proposal approval MUST NOT 直接改写 owner state，执行仍需 current descriptor、expected version 与 receipt。

#### Scenario: Agent 建议选择 completion candidate

- **WHEN** Agent 产生 completion selection intent
- **THEN** Workbench SHALL 创建可审阅 proposal，展示 evidence refs、diff、risk 与 owner target
- **AND** 只有 proposal approved 且 action revalidation 通过后才可 enqueue

### Requirement: Action receipt 不得宣称 Provider 或 production readiness

本 change 的 fixture、Task success、owner receipt 和 UI state SHALL 只证明 Workbench contract/action flow。除非对应 owner 发布独立 runtime、quality、rights 和 promotion evidence，Workbench MUST NOT 显示 Provider executed、replica video generated、production ready 或 one-to-one verified。

#### Scenario: Fixture freeze 流程通过

- **WHEN** local Scaena fixture 返回成功 freeze receipt
- **THEN** Workbench SHALL 标示为 fixture/contract validation
- **AND** SHALL NOT 将其描述为真实 Provider、真实人物复刻或生产晋级成功
