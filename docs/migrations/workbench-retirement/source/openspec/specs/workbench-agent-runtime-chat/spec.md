# workbench-agent-runtime-chat Specification

## Purpose
Define the safe Task-backed Agent turn, derived-session, proposal, event, reconciliation, storage, and reference-runtime contract consumed by the Agent-first Workbench.

## Requirements

### Requirement: Workbench SHALL model an agent chat turn as a Task on a sealed Operation

Workbench SHALL 把每个 agent chat turn 提交为 sealed Operation `workbench.agent.turn.submit.v1` 的 Task，经既有 `TaskService` 路由并继承 permission、cost、expected-version、idempotency 与 approval gate。该 Operation SHALL 声明 `Mutation=true`、`PersistSafeInput=true`、`SupportsEvents=true`、`SupportsStreaming=true`、`SupportsCancel=true`、`SupportsReconcile=true` 与四 transport projection。Task input SHALL 只持久化 `sessionRef`、`turnIntentRef`、safe `contextRefs` 与有界资源限额；prompt、provider payload、chain-of-thought SHALL NOT 进入 Task。

#### Scenario: 浏览器提交一个 chat turn

- **WHEN** 浏览器经 `WorkbenchClient.agent.submitTurn` 提交一个 chat turn
- **THEN** Workbench SHALL 创建 `operationType = workbench.agent.turn.submit.v1` 的 Task，只持久化 safe ref
- **AND** SHALL 按既有 `TaskService` gate 顺序流转，SHALL NOT 存储原始 prompt、provider payload 或 chain-of-thought

#### Scenario: turn 进入 unknown_accept

- **WHEN** dispatch transport 不确定 owner 是否已接受
- **THEN** Task SHALL 进入 `unknown_accept` 并发 `turn.unknown_accept` event
- **AND** 恢复 SHALL 只经显式 reconcile，SHALL NOT 自动重试

#### Scenario: turn 被取消

- **WHEN** 用户对 running turn 发起 cancel
- **THEN** Task SHALL 经既有 cancel 路径流转到 `cancelled` 并发 `turn.cancelled` event
- **AND** SHALL NOT 伪造 `succeeded` 或绕过 gate

#### Scenario: turn input 携带越权字段

- **WHEN** input 含 prompt、provider、credential、approval、process 字段、未知属性或超限资源额度
- **THEN** handler SHALL 在 dispatch 前返回固定 denied 结果
- **AND** 越权值 SHALL NOT 出现在 task summary、receipt 或 error text

### Requirement: Agent sessions SHALL be a derived grouping of turn Tasks

Agent session SHALL 是共享同一 opaque `sessionRef` 的 turn Task 的只读聚合，SHALL NOT 携带独立状态、gate 或 receipt。`WorkbenchAgentClient.listTurns` SHALL 按 session 过滤、按创建时间有序返回 turn Task 的 safe status。服务端 SHALL NOT 允许直接 mutation session 元数据。

#### Scenario: 列出一个 session 的 turn

- **WHEN** client 调用 `listTurns({ sessionRef })`
- **THEN** 服务端 SHALL 返回该 session 全部 turn Task 的当前 safe status
- **AND** SHALL NOT 返回 prompt、provider payload 或跨租户数据

#### Scenario: session 跨重启恢复

- **WHEN** workbenchd 重启后 client 查询既有 session
- **THEN** session 视图 SHALL 从持久化的 turn Task 重新派生
- **AND** SHALL NOT 依赖独立 session 状态存储或伪造缺失的 turn

### Requirement: Tool proposals SHALL carry no execution authority

Agent SHALL 把工具调用作为 turn Task 上的 `tool.proposal.waiting_approval` event 发出，payload 仅含 `proposalId`、`toolId`、`inputRef`、`expectedOwnerVersion`，SHALL NOT 含 raw payload、credential 或 private path。执行一个 proposal SHALL 需经既有 sealed Operation `orbit.proposal.accept` 单独提交一个 Task，该 Task 在全 gate 控制下创建指向目标 owner operation 的 typed command Task。Agent SHALL NOT 直接调用目标 owner operation。

#### Scenario: agent 提议一个 mutation

- **WHEN** agent 对 `episode.create` 发出 `tool.proposal.waiting_approval` event
- **THEN** UI SHALL 把 proposal 渲染为 pending 且 SHALL NOT 执行它
- **AND** 只有用户经 `orbit.proposal.accept` 接受后才 SHALL 创建指向目标 operation 的新 Task

#### Scenario: proposal 目标 operation 未 sealed

- **WHEN** agent 提议一个 `targetOperationType` 不在 registry 的 tool
- **THEN** proposal SHALL 渲染为 `needs_contract` 且 SHALL NOT 可执行
- **AND** `orbit.proposal.accept` SHALL 返回 `unavailable` 并附 safe diagnostic

#### Scenario: proposal 被跨 task 伪造

- **WHEN** caller 提交的 accept input 携带不属于当前 turn Task 或不存在 `proposalId` 的回链
- **THEN** Workbench SHALL 在 dispatch 前 fail closed
- **AND** SHALL NOT 创建目标 operation Task 或刷新任何 gate timestamp

### Requirement: Tool availability SHALL be projected from the registry and owner readiness

每个 tool descriptor SHALL 携带 `availability ∈ {ready, needs_contract, permission_required}`，由「目标 Operation 是否在 registry sealed + agent adapter `RuntimeReadiness.state` 是否 ready + 目标 gate 是否可满足」派生。descriptor SHALL NOT 含 credential、provider payload 或绝对路径。

#### Scenario: 目标 operation sealed 且 adapter ready

- **WHEN** `episode.create` 的目标 operation 已 sealed 且 agent adapter readiness 为 `ready`
- **THEN** tool descriptor SHALL 报告 `availability = permission_required`
- **AND** UI SHALL 启用 Prepare

#### Scenario: adapter degraded

- **WHEN** agent adapter readiness 为 `degraded`
- **THEN** 全部 mutation tool SHALL 报告 `needs_contract` 或 `permission_required` 并展示 diagnostic
- **AND** UI SHALL 保留 chat composer 但禁用 Prepare，SHALL NOT 渲染虚假可执行动作

#### Scenario: 浏览器收到未知 tool

- **WHEN** catalog 出现当前 UI 不认识的 tool id
- **THEN** UI SHALL 用稳定不可用标签展示
- **AND** SHALL NOT 据未知 id 构造按钮、命令或 mutation request

### Requirement: Turn event streaming SHALL reuse the existing SSE pattern with sequence resume

Agent SHALL 把 turn event 作为 turn Task 上的 typed `core.Event` 流式发出。HTTP transport SHALL 经既有 `GET /v1alpha1/tasks/{id}/events/watch` SSE 端点以 `id:`/`event:`/`data:` frame 投影；client SHALL 经 `Last-Event-ID`/`afterSequence` resume。JSON-RPC SHALL 经既有 `/rpc/stream` 复用同一 cursor 语义；gRPC SHALL 经既有 `WatchTaskEvents` server stream。

#### Scenario: client 在 turn 中途重连

- **WHEN** client 以 `Last-Event-ID: 42` 重连
- **THEN** 服务端 SHALL 从 durable event log 回放 sequence 43+ 且去重
- **AND** SHALL NOT 回放 provider payload、prompt 或 chain-of-thought

#### Scenario: event 跨四 transport parity

- **WHEN** 同一 turn 经 SDK、HTTP、gRPC、JSON-RPC 观测
- **THEN** 四 transport SHALL 返回语义等价的 event 序列、cursor 与 error 行为
- **AND** 未知 event type SHALL fail closed，SHALL NOT 映射为成功

### Requirement: Agent reconcile SHALL be the only unknown_accept recovery and SHALL NOT replay

Agent adapter SHALL NOT 自动重试 `unknown_accept` 的 turn。用户 SHALL 经既有 `ReconcileUnknownAccept` 调用 adapter 的 Reconcile 生命周期钩子，该钩子 SHALL NOT 创建第二次 dispatch、SHALL NOT 重放 prompt 或已发 event，且 MAY 按既有状态机流转到 running/succeeded/partial/failed/cancelled。

#### Scenario: reconcile 成功

- **WHEN** 用户对 `unknown_accept` turn 点 Reconcile
- **THEN** Workbench SHALL 以新持久化的 `AttemptReconcile` 调用 adapter Reconcile
- **AND** SHALL 按 owner-observed outcome 流转，永不自动重试或二次 dispatch

### Requirement: Chat storage SHALL be safe-summary-only

Workbench SHALL 只持久化 task 元数据、attempt、event index、safe ref、transport receipt summary 与 redacted evidence ref。Workbench SHALL NOT 持久化 prompt、provider payload、chain-of-thought、tool raw argument（仅其 safe ref 形态）、credential 或 private path。持久化 safe input SHALL 通过既有 `validatePersistSafeInputValue` 校验。

#### Scenario: redactor 失败

- **WHEN** redactor 或 schema validator 对 turn input 失败
- **THEN** Task SHALL fail closed 并返回 typed error
- **AND** SHALL NOT 持久化该 unsafe input

#### Scenario: provider output 含 secret sentinel

- **WHEN** adapter 输出含测试 sentinel（authorization/secret/private_path/provider_payload/prompt）
- **THEN** event、receipt、日志与 integration evidence SHALL 完全不持久化该 sentinel
- **AND** redactor 失败 SHALL fail closed

### Requirement: The reference agent runtime SHALL be development-only and default-off

Workbench 提供的确定性 reference agent runtime adapter SHALL 仅用于 dev/test，SHALL 经显式 flag（默认 false）启用，SHALL NOT 在生产 catalog 默认暴露，且 SHALL 在 display name 明确标注为 reference/dev。当 flag 关闭时，agent catalog、descriptor 与 `/agent` runtime 状态 SHALL 与本 change 之前完全一致。

#### Scenario: flag 默认关闭

- **WHEN** `workbenchd` 以默认配置启动
- **THEN** reference adapter SHALL NOT 注册，descriptor SHALL NOT 列出 `ownerId:"pi"`
- **AND** 既有 `/overview`、`/workspace`、`/studio` 与 catalog SHALL 不受影响

#### Scenario: flag 显式开启

- **WHEN** `WORKBENCH_AGENT_REFERENCE_ADAPTER_ENABLED=1` 启动
- **THEN** descriptor SHALL 列出 `ownerId:"pi"` reference adapter，`/agent` runtime SHALL 诚实显示 ready
- **AND** adapter SHALL 只发确定性 proposal，SHALL NOT 调用任何真实 owner operation 或 provider

#### Scenario: reference turn 事件流为固定 6 阶段 / 8 事件序列

- **WHEN** reference adapter 处理一个正常 turn
- **THEN** 事件流 SHALL 按序发出 `turn.thinking`、`tool.call.start:read_context`、`tool.call.end:read_context`、`tool.call.start:search_index`、`tool.call.end:search_index`、`turn.segment`、`tool.proposal.waiting_approval:episode.create`、`turn.succeeded`（前 7 个为 run.progress，末位为 run.terminal）
- **AND** 事件间 SHALL 使用确定性固定时延作为 dev 拟真节奏（无随机；如 thinking 后 300ms、工具 start→end 500ms，常量注明于源码），使持久化事件的 createdAtUnixMs 呈现真实阶段耗时
- **AND** 拟真时延 SHALL 可被 ctx cancel 或 stream Close 立即中断，关闭路径悬挂 SHALL NOT 超过一个 sleep 周期
