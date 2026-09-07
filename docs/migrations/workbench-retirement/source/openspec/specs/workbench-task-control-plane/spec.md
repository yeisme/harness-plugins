# workbench-task-control-plane Specification

## Purpose
TBD - created by archiving change yeisme-workbench-foundation. Update Purpose after archive.
## Requirements
### Requirement: Workbench SHALL 提供统一的 v1alpha1 远程任务控制面

`WorkbenchTaskService` SHALL 使用纯 Go 实现，并以 GORM repository 和 pure-Go SQLite 保存安全控制面投影；正常构建和测试 SHALL 支持 `CGO_ENABLED=0`。Web SHALL 使用 React 19、TypeScript、Bun，并仅通过 TypeScript `WorkbenchTaskClient` 访问服务。合同 SHALL 同时定义 Protocol Buffers 和 JSON Schema，并将同一语义投影为 REST+SSE、gRPC 和独立 JSON-RPC 2.0；JSON-RPC SHALL NOT 是 MCP。

#### Scenario: 本机客户端选择传输
- **WHEN** SDK 调用任一 v1alpha1 方法
- **THEN** 它 SHALL 通过 REST、gRPC 或 JSON-RPC 调用同一 Go core
- **AND** SHALL 返回相同的字段、枚举、错误、幂等和 cursor 语义。

### Requirement: 服务 SHALL 维护受限的任务实体和状态

服务 SHALL 维护 `Operation`、`Task`、`Attempt`、`Event`、`Artifact`、`Receipt` 和 `Gate`。Task status SHALL 仅为 `awaiting_permission`、`awaiting_cost_confirmation`、`queued`、`running`、`retry_wait`、`cancel_requested`、`unknown_accept`、`succeeded`、`partial`、`failed` 或 `cancelled`；终态 SHALL 仅为 `succeeded`、`partial`、`failed`、`cancelled`。服务 SHALL 只保存安全 refs、脱敏摘要、版本和本服务 receipt，且 SHALL NOT 保存 canonical owner state、artifact blob、credential、private path、raw prompt、provider payload 或完整思维链。

#### Scenario: 部分完成保留可恢复结果
- **WHEN** owner 返回部分成功
- **THEN** 服务 SHALL 将 Task 转为 `partial` 并保留成功 Attempt、Artifact 和 Receipt refs
- **AND** retry SHALL 仅针对未完成部分，而不是重放已成功 owner mutation。

### Requirement: mutation SHALL 使用限定的幂等与版本预条件

`SubmitTask` 的 idempotency scope SHALL 为已验证 principal 的 `(caller_scope, workspace_id, project_id, operation_type, idempotency_key)`。服务 SHALL 先按 Operation 的 canonical JSON Schema 验证 input、canonicalize JSON 并自行计算 request digest；客户端提供的 digest SHALL NOT 改变判定。同一范围相同 server-computed digest 的请求 SHALL 返回原有 Task 和 Receipt；同 key 但 digest 不同的请求 SHALL 返回 `idempotency_conflict`。`ResolveGate`、`CancelTask`、`RetryTask` 和 `ReconcileUnknownAccept` SHALL 要求 `expected_task_version`。调用 owner mutation 的 Operation SHALL 同时要求可验证的 `expected_owner_version` 或稳定 owner revision/ref；冲突 SHALL 返回当前安全投影，且不得覆盖 owner state。

#### Scenario: 过期版本请求控制动作
- **WHEN** 客户端以过期 `expected_task_version` 请求取消、重试、gate resolution 或 reconciliation
- **THEN** 服务 SHALL 返回 `task_version_conflict` 与当前 Task 安全投影
- **AND** SHALL NOT 创建 Attempt、改变 Gate 或转移 Task status。

### Requirement: `unknown_accept` SHALL 先对账再恢复

当 dispatch 或 cancel 的网络接受结果无法确定时，服务 SHALL 转为 `unknown_accept` 并创建可查询 Receipt/Event。服务 SHALL 使用原始 request key、owner receipt ref 或批准的 owner status lookup 通过 `ReconcileUnknownAccept` 对账；它 SHALL NOT 自动重发提交或取消请求。对账可确定性地转为 `running`、`succeeded`、`partial`、`failed` 或 `cancelled`。

#### Scenario: dispatch 超时且 owner 实际已接受
- **WHEN** owner dispatch 超时，但之后可用 request key 查询到已接受 receipt
- **THEN** `ReconcileUnknownAccept` SHALL 关联该 receipt 并转为 owner 实际状态
- **AND** SHALL NOT 创建第二次 owner mutation。

### Requirement: 取消与重试 SHALL 保持真实的 owner 结果

`CancelTask` SHALL 在已 dispatch 的任务上创建 cancel Attempt 并转为 `cancel_requested`；只有 owner 明确确认取消或可靠 lookup 证实取消后才可转为 `cancelled`。`RetryTask` SHALL 仅允许 `failed` 或 `partial` Task，先创建 `retry_wait` 和新的 Attempt，再按 gate 重新排队；它 SHALL NOT 重试 `unknown_accept`。source Task、retry Attempt、child Task、Gate、Receipt 与 Event SHALL 在单一 repository transaction 中原子写入，失败时不得留下部分 retry 投影。

#### Scenario: owner 未确认取消
- **WHEN** 用户取消运行中的 Task 且 owner acknowledgement 尚未到达
- **THEN** 服务 SHALL 返回 `cancel_requested`
- **AND** UI/SDK SHALL NOT 将该 Task 解释为 `cancelled`。

### Requirement: 四种传输 SHALL 具备完整方法对等性

每个 sealed Operation 和下列方法 SHALL 同时在 TypeScript SDK、HTTP、gRPC 与 JSON-RPC 可达：`ListOperations`、`GetOperation`、`SubmitTask`、`GetTask`、`ListTasks`、`CancelTask`、`RetryTask`、`ReconcileUnknownAccept`、`GetGate`、`ListGates`、`ResolveGate`、`GetAttempt`、`ListAttempts`、`ListEvents`、`WatchTaskEvents`、`GetArtifact`、`ListArtifacts`、`GetReceipt`、`ListReceipts`。REST 的 `WatchTaskEvents` SHALL 使用 SSE；其他调用面 SHALL 提供等价 cursor/replay 语义。

#### Scenario: watcher 以 cursor 重连
- **WHEN** 客户端用 `(task_id, event_sequence)` cursor 重连 `WatchTaskEvents`
- **THEN** 服务 SHALL 重放后续严格递增 Event 或明确返回 cursor 已过期
- **AND** 四种调用面 SHALL 观察到同序列的安全 Event。

### Requirement: sealed Operation registry SHALL 自动投影全部调用面

registry SHALL 仅在 Operation 同时具有稳定类型、handler、Protobuf/JSON Schema、输入验证、gate evaluator、adapter route、错误映射和 conformance fixture 时 seal。每个 sealed Operation SHALL 自动成为 SDK、HTTP、gRPC、JSON-RPC 的可调用目标；任何缺失投影 SHALL 使注册、启动或 contract validation 失败。registry SHALL 从同一 canonical schema 生成每个 `schemaRef` 与 catalog digest，调用面 SHALL 返回彼此配对的 digest/schema。transport SHALL NOT 定义 operation-specific handler，且只可执行认证、解码、编码及共享 `TaskService` 调用。

#### Scenario: registry entry 缺失 cost gate
- **WHEN** 一个 Operation 缺少所需 gate evaluator 或 schema
- **THEN** registry SHALL 拒绝将它 seal 或服务 SHALL 拒绝启动
- **AND** 它 SHALL NOT 仅在某一 transport 中被局部暴露。

### Requirement: owner adapter SHALL fail closed 并限制初始操作

Scaena adapter SHALL 仅调用 Scaena production facade；`comic-drama-production` SHALL NOT 由 Workbench 直连 Auctra、Eikona、Ordo 或 Sonora 完成 mutation。Auctra adapter SHALL 仅调用批准的 public local bridge 或稳定 service contract；Eikona adapter SHALL 仅调用 typed `/api/v1`。缺少 handler/schema/gates、owner 不可达、contract mismatch、缺权限、无法 lookup 或取消合同时，adapter SHALL 产生安全 `unavailable`、`contract_mismatch` 或 Gate/失败投影，且 SHALL NOT 伪造成功或访问 owner 私有状态。

初始无 owner 修改即可实现的 Operation SHALL 仅为 `workbench.synthetic.echo`、`workbench.synthetic.gated_echo`、`workbench.owner.unavailable`，并且 SHALL 标注 `synthetic` 或 `unavailable`，不得作为真实 owner integration 或产品晋级证据。

#### Scenario: Auctra mutation 合同尚未批准
- **WHEN** Auctra adapter 收到未在 allowlist 中的 mutation 请求
- **THEN** 它 SHALL 返回可查询的 `unavailable` Task/Receipt 或 Gate
- **AND** SHALL NOT 解析 human CLI output、读取 `.auctra` 私有文件或执行 shell fallback。

### Requirement: component、integration 与 e2e SHALL 保留脱敏运行证据

每个 component、integration、system 或 e2e 入口 SHALL 为每次运行创建 `temp/integration-test-runs/<run-id>/`，其中至少包含 `summary.json`、`command.txt`、`stdout.log`、`stderr.log`、`env.json` 和 `artifacts/`。失败运行也 SHALL 保留证据并返回原退出码。所有证据 SHALL 脱敏 secrets、tokens、Authorization、raw prompts、provider payload、private tool arguments、private paths 和完整思维链。

#### Scenario: 跨传输 integration 失败
- **WHEN** SDK、HTTP、gRPC 或 JSON-RPC conformance 入口失败
- **THEN** 运行 SHALL 写入所需 evidence 文件并保留原测试退出码
- **AND** 证据 SHALL 足以定位 transport parity 差异而不泄露敏感内容。

### Requirement: runtime SHALL 仅接受 private local-session

runtime SHALL 仅绑定 loopback IP，并以 local-session bearer token 验证 HTTP、SSE、JSON-RPC 与 gRPC。token、SQLite database 与 sidecar SHALL 位于当前用户拥有、非 symlink 的私有路径；目录权限 SHALL 为 `0700`，文件权限 SHALL 为 `0600`。服务 SHALL NOT 宣称 LAN、public remote、cloud 或多租户支持。

#### Scenario: 非 loopback 或无效 local-session
- **WHEN** 启动参数使用非 loopback 地址，或请求不带有效 bearer token
- **THEN** runtime SHALL 拒绝启动或请求
- **AND** SHALL NOT 降级为匿名、LAN 或远程身份认证。

### Requirement: Eikona facade MUST 分离 read projection 与 sealed mutation

Workbench Eikona integration MUST 使用 typed read projection 获取 instance、project、workflow、run、event、review、asset、handoff 与 diagnostics；mutation 只有在 Operation 具备稳定 schema、handler、gate、adapter route、stable errors、receipt/reconcile 与 conformance fixture 后才能 seal。UI 构造 operation name MUST NOT 被视为 operation 已可用。

#### Scenario: UI 引用了未注册的 Eikona operation
- **WHEN** 客户端请求一个未被 registry seal 的 Eikona mutation
- **THEN** Workbench MUST 返回 typed planned/unavailable/contract mismatch posture
- **AND** MUST NOT 调用 shell fallback、owner 私有 API 或生成成功 receipt。

### Requirement: Eikona facade MUST 保持 transport 与 authority parity

同一 Eikona operation 或 read projection 在 SDK、HTTP、gRPC 与 JSON-RPC 上 MUST 保持 schema、capability、project scope、permission、expected version、idempotency、stable error、event cursor 与 receipt 语义一致。浏览器 BFF MUST 去除浏览器 credential 并只代理到静态配置的 Workbench backend。

#### Scenario: Eikona mutation exact retry
- **WHEN** 同一 project、operation、expected version、payload digest 与 idempotency key 经不同 transport 重放
- **THEN** 所有 transport MUST 返回同一 authoritative receipt/disposition
- **AND** changed payload MUST 返回 typed conflict，不得重复 side effect。

### Requirement: Eikona capability descriptor MUST 驱动客户端动作分类

Workbench MUST 为每个 Eikona 客户端动作提供 stable action id、classification、required role/scope、contract range、retryability、fallback command（如批准）、next action 与 safe reason。Descriptor MUST NOT 包含 secret、absolute path、signed URL、raw prompt 或 owner payload。

#### Scenario: owner offline
- **WHEN** Eikona owner 或批准 adapter 不可达
- **THEN** descriptor/read projection MUST 标记 offline/unavailable 并提供安全诊断或修复动作
- **AND** Workbench MUST 保留 cached identity 与最后 receipt，不得伪造删除或完成。
