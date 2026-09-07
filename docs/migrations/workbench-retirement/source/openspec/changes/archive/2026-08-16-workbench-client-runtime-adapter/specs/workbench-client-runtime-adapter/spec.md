## ADDED Requirements

### Requirement: Workbench SHALL own its client-runtime delivery boundary

Workbench SHALL 作为本 change 的产品、实现与验收主体。首个生产链路 SHALL 固定为 Workbench service 组合共享 broker、Aigora owner CLI 与 credentialctl；其他客户端 SHALL 只作为共享合同的独立消费者，不得进入 Workbench 的默认 adapter、运行时依赖或 first-support promotion gate。

#### Scenario: Another client implements the shared runtime contract

- **THEN** Workbench SHALL NOT 调用该客户端、依赖其进程或把其 fixture/evidence 当作 Workbench 生产证据
- **AND** Workbench 默认 fallback descriptor SHALL 只列出已经纳入自身 first-support 计划的 owner adapter

### Requirement: Workbench SHALL expose runtime through its existing authenticated service

Workbench SHALL 将只读 runtime 通过统一 `clientruntime.Source` 组合进现有 authenticated service，并通过 `WorkbenchClient.runtime` 消费；未来 mutation SHALL 注册到现有 Operation registry。Web 不得直连 broker/owner，各 transport handler 只负责协议转换，不得各自维护 runtime 状态或业务判断。

#### Scenario: Runtime descriptor parity

- **WHEN** `GetRuntimeDescriptor` 通过 SDK、HTTP、gRPC 或 JSON-RPC 调用
- **THEN** 四种 transport SHALL 返回语义等价的 `client_runtime.v0.1` projection
- **AND** schema、error 与 unknown enum behavior SHALL 通过 parity tests

#### Scenario: Browser lacks service token access

- **WHEN** Web runtime panel 加载或刷新
- **THEN** 它 SHALL 只调用已配置的 `WorkbenchClient.runtime`
- **AND** 不得读取 token file、连接 broker socket 或直连 owner URL

### Requirement: Runtime mutations SHALL pass unified admission gates

connection test、run、cancel、reconcile SHALL 经过 permission、cost、expected-version、idempotency、approval scope 与 resource budget gate。

#### Scenario: Approval scope is tampered

- **WHEN** caller 提交 approval 字段，或持久化 gate 不属于当前 task、未批准、缺 resolution timestamp、已超过 approval max age
- **THEN** operation SHALL 返回 `approval_scope_mismatch`
- **AND** 不得调用 broker/owner

#### Scenario: Approval is derived from Workbench authority

- **WHEN** connection test 的最终 Workbench gate 被批准并进入 dispatch
- **THEN** handler SHALL 从 trusted task 与同 task 的 approved gates 派生 broker approval ref、project/user、revision、idempotency、audience 与 expiry
- **AND** browser/caller SHALL NOT 提交 approval ref、approval audience 或 approval expiry

#### Scenario: Runtime revision changed

- **WHEN** approved adapter/binary/workspace/profile revision 与当前 descriptor 不同
- **THEN** operation SHALL 返回 `runtime_changed`
- **AND** 用户必须重新 preflight/approve

#### Scenario: Outcome is unknown

- **WHEN** broker 可能已接受请求但 Workbench 未收到确定结果
- **THEN** attempt SHALL 标记 `unknown_accept`
- **AND** 系统 SHALL 只允许 reconcile，不得自动 retry

#### Scenario: Runtime handler binds trusted task scope

- **WHEN** a gated Workbench task reaches a fixed runtime handler
- **THEN** owner、adapter、action 与 operation type SHALL come only from registration, while project/user/revision/idempotency SHALL come only from the trusted task
- **AND** caller input SHALL be limited to a safe input ref and bounded flat resource limits

#### Scenario: Runtime input attempts scope or resource escalation

- **WHEN** input contains prompt、provider、credential、approval、process fields, unknown properties, partial limits or limits above the handler ceiling
- **THEN** the handler SHALL return a fixed denied result before invoking the broker
- **AND** submitted values SHALL NOT appear in task summary、receipt or error text

#### Scenario: Broker acceptance becomes uncertain

- **WHEN** start/cancel/reconcile transport fails after dispatch may have crossed the broker boundary
- **THEN** the handler SHALL return `unknown_accept`/reconcile guidance
- **AND** TaskService SHALL NOT schedule an automatic retry

#### Scenario: Connection test transport fails without a reconcile contract

- **WHEN** the fixed connection-test probe encounters a broker transport failure and no connection-test reconcile capability exists
- **THEN** the handler SHALL return a fixed terminal unavailable/failed result rather than `unknown_accept`
- **AND** Workbench SHALL NOT automatically retry the probe or claim that the connection succeeded
- **AND** a later user-initiated connection test SHALL be a new explicit Task/idempotency scope

#### Scenario: Owner lifecycle control is explicitly authorized

- **WHEN** an authenticated caller requests cancel or reconcile for a fixed persistent owner run
- **THEN** TaskService SHALL verify task version/state、approved same-task gates and the persisted safe input schema/digest
- **AND** it SHALL persist a fresh `AttemptCancel` or `AttemptReconcile` before calling the broker
- **AND** the lifecycle handler SHALL derive the short-lived broker approval ref/expiry from that persisted control attempt rather than caller input or an expired dispatch approval

#### Scenario: Fixed persistent run registration is available but not promoted

- **WHEN** Workbench builds the first Aigora persistent-run registration
- **THEN** it SHALL fix operation/owner/adapter/action as `workbench.runtime.aigora.generate`/`aigora`/`aigora.text`/`start`
- **AND** it SHALL explicitly declare safe replay、events、cancel and reconcile lifecycle capabilities
- **AND** `workbenchd` SHALL NOT add it to the production catalog until the dedicated feature flag、real owner binding and system evidence gates are complete
- **AND** enabling connection-test SHALL NOT implicitly enable generate

#### Scenario: Workbench explicitly enables the service-side Aigora generate catalog

- **WHEN** `WORKBENCH_RUNTIME_GENERATE_ENABLED` or `--client-runtime-generate-enabled` is explicitly true and the complete shared runtime configuration is present
- **THEN** `workbenchd` MAY register only the fixed `workbench.runtime.aigora.generate` operation independently of connection test
- **AND** default startup、incomplete runtime configuration、missing broker operations or missing gate authority SHALL keep registration absent or fail startup closed
- **AND** this service-side flag SHALL NOT by itself expose Web actions or start an unbounded event pump

#### Scenario: Running owner task starts one runtime-owned bounded event pump

- **WHEN** an event-capable generate task has persisted `running` state and a validated safe run ref
- **THEN** TaskService SHALL notify the runtime event supervisor only after the task mutation succeeds
- **AND** the supervisor SHALL start at most one bounded pump per task/run ref, SHALL use the persisted cursor/version, and SHALL never redispatch the owner operation
- **AND** Workbench shutdown SHALL cancel and wait for owned pumps before closing persistence

#### Scenario: Real Aigora generate reaches terminal through owner events

- **WHEN** an approved Workbench generate Task carries an Aigora-issued `input:vault:sha256:<digest>` and the independent generate flag is enabled
- **THEN** browser、Workbench and broker SHALL pass only the safe reference while Aigora leases the protected input and credential inside the owner process
- **AND** the broker SHALL reconcile only the already-authorized request and emit redacted accepted/running/terminal events with monotonic cursors
- **AND** a queued cancel SHALL complete through the canonical owner transaction without calling provider
- **AND** transient background reconciliation uncertainty SHALL be retried as observation without projecting a terminal unknown event

#### Scenario: Lifecycle approval attempt is invalid

- **WHEN** a lifecycle attempt has the wrong task、kind、status、unsafe ID、expired created-at or was not persisted before dispatch
- **THEN** the lifecycle handler SHALL fail closed before broker/owner invocation
- **AND** it SHALL NOT fabricate a gate、refresh an old gate timestamp or automatically retry

#### Scenario: Owner reconciliation claims are caller supplied

- **WHEN** caller input attempts to provide observed owner status or receipt ref for an owner runtime task
- **THEN** Workbench SHALL reject those claims and obtain lifecycle state only from the typed broker reconcile result/event stream
- **AND** existing synthetic/manual reconciliation MAY retain its current compatibility behavior

#### Scenario: Owner execution remains asynchronous

- **WHEN** an owner dispatch returns accepted/running、unknown acceptance、cancel requested or a terminal result
- **THEN** TaskService SHALL emit `task.accepted`、`task.unknown_accept`、`task.cancel_requested` or `task.completed` respectively
- **AND** a successful dispatch attempt SHALL NOT be represented as task completion while the owner lifecycle remains non-terminal
- **AND** any owner receipt SHALL contain only a validated safe reference

#### Scenario: Approved runtime task survives Workbench restart

- **WHEN** a fixed runtime operation is explicitly marked `PersistSafeInput` and its exact schema accepts only a safe input ref plus bounded numeric limits
- **THEN** TaskService SHALL persist only the canonical schema-validated input and SHALL revalidate its digest before dispatch after restart
- **AND** an unmarked owner operation, schema drift, digest mismatch, approval/provider/credential/process field or unsafe ref SHALL remain non-replayable and fail closed before broker dispatch

### Requirement: Credential secrets SHALL remain owner-side

Workbench Web、SDK、service 与共享 broker SHALL 不 Resolve、存储、记录或返回 credential secret；只有 owning adapter 可以使用 scoped credential grant。

#### Scenario: BYOK operation is requested

- **WHEN** runtime operation 引用 `credential_ref`
- **THEN** Workbench SHALL 只转发 secret-free ref 与 scoped context
- **AND** owner adapter SHALL 校验 operation/audience/project/user/revision/expiry 后在 owner process 内 resolve

#### Scenario: Broker claims credential access

- **WHEN** broker/service identity 被用作 credential grant consumer/audience
- **THEN** credential owner SHALL 拒绝请求
- **AND** runtime operation SHALL 返回 redacted credential scope error

### Requirement: Runtime events and receipts SHALL be replayable and redacted

runtime event SHALL 使用单调 cursor、stable type、task/attempt/receipt refs；receipt SHALL 只保存安全摘要和 evidence refs。

#### Scenario: Event stream reconnects

- **WHEN** consumer 使用 last cursor 重连
- **THEN** service SHALL 去重并继续投影后续事件
- **AND** cursor expiry SHALL 返回 `cursor_expired`/`reconcile_required`

#### Scenario: Runtime event checkpoint is persisted atomically

- **WHEN** TaskService accepts the next typed event for a registered event-capable owner run
- **THEN** it SHALL atomically persist task version、runtime run ref、cursor、sequence and the redacted Task event
- **AND** an optional safe receipt/evidence ref SHALL use the existing Receipt/Artifact stores without persisting raw event payload
- **AND** the internal checkpoint fields SHALL NOT change the public Task transport shape before Phase B promotion

#### Scenario: Runtime event is replayed or has a gap

- **WHEN** an event repeats the exact persisted sequence+cursor
- **THEN** TaskService SHALL return the current Task without another state mutation or duplicate receipt/evidence
- **WHEN** run ref drifts、sequence is old、the same sequence uses another cursor or sequence is not exactly the next value
- **THEN** TaskService SHALL fail closed with reconcile guidance and SHALL NOT advance the checkpoint

#### Scenario: Typed event session is pumped into TaskService

- **WHEN** an explicitly wired event-capable task starts a bounded event pump
- **THEN** the pump SHALL resume from the persisted run ref/cursor and pass only typed `core.OwnerEvent` projections to TaskService with the current task version
- **AND** it SHALL update its expected version from each successful projection and stop on terminal/rejected outcome or EOF
- **AND** cursor repair failure、sink conflict/gap or max-event exhaustion SHALL stop the pump without retrying the owner operation
- **AND** the bridge alone SHALL NOT register a transport route、background supervisor or browser action

#### Scenario: Workbench restarts while a generate task is running

- **WHEN** workbenchd starts with the explicit generate flag and GORM contains a fixed Aigora generate task in `running` with a validated run ref and persisted cursor
- **THEN** runtime SHALL resume one bounded event pump from that cursor without redispatching the owner operation
- **AND** terminal、missing-run-ref、other-operation tasks SHALL not be recovered
- **AND** recovery above the configured bound SHALL fail startup closed rather than silently omit tasks or create unbounded goroutines

#### Scenario: Independent event source consumes broker SDK

- **WHEN** Workbench event source receives a typed broker event iterator
- **THEN** it SHALL project only run ref、sequence、cursor、allowlisted type、stable code、safe ref 与 progress
- **AND** it SHALL map cursor expiry/invalid to stable repair errors without exposing raw SSE、token、stdout/stderr or provider payload

#### Scenario: Event capability is not wired

- **WHEN** the configured broker client does not implement the typed event SDK or registry/transport promotion is incomplete
- **THEN** Workbench SHALL return a gated/unavailable event error
- **AND** it SHALL NOT register a browser action or fabricate an event stream

#### Scenario: Provider output contains a secret sentinel

- **WHEN** adapter stdout/stderr/provider payload 含测试 sentinel
- **THEN** event、receipt、日志和 integration evidence SHALL 完全不持久化该 sentinel
- **AND** redactor failure SHALL fail closed

### Requirement: Unimplemented broker capabilities SHALL remain disabled

阶段 A 可以发布 descriptor/readiness，但 connection test、run/event/cancel/reconcile 在 broker与 owner adapter证据完成前 SHALL unavailable。

#### Scenario: Shared broker is absent

- **WHEN** Workbench service 启动但 broker endpoint/socket 未配置或不可用
- **THEN** descriptor/readiness SHALL 诚实报告 `shared_broker_unavailable`
- **AND** Task/Design/Owner surfaces SHALL 继续可用

#### Scenario: Connection test is promoted independently

- **WHEN** explicit Workbench connection-test feature flag is enabled、fixed `aigora.text` capability is advertised、current broker revision is available and the operation is registered
- **THEN** SDK/Web MAY submit `workbench.runtime.aigora.connection_test` through the ordinary Task API and existing gate review
- **AND** missing flag、capability、revision or gate authority SHALL keep the action hidden or fail closed before broker dispatch

#### Scenario: Real Workbench connection task reaches Aigora owner CLI

- **WHEN** Workbench提交固定Aigora connection task，且同Task的permission与cost gate均已持久化批准
- **THEN** workbenchd SHALL通过真实broker与显式Aigora connection-only owner CLI调用一次provider probe
- **AND** Aigora SHALL使用credentialctl current readiness revision和owner-side scoped grant解析credential
- **AND** terminal ready receipt SHALL使Workbench Task进入`succeeded`
- **AND** secret、Authorization、provider body、provider URL与private config path SHALL NOT进入Workbench、broker、owner output或integration evidence

#### Scenario: Typed generate canary remains hidden by default

- **WHEN** SDK exposes typed generate、cancel、reconcile and event methods by composing the existing Task contract
- **THEN** runtime input SHALL be reduced to a validated `inputRef` and an optional complete bounded-limit tuple before transport
- **AND** Web SHALL render the generate canary only when its independent Web flag、fixed Aigora descriptor、ready revision、generate/events/cancel/reconcile capabilities and owner mutation/events/permission/cost registry contract all agree
- **AND** the default build、a missing capability or contract drift SHALL keep the action absent without affecting connection test

#### Scenario: Workbench consumes the shared browser-safe runtime client module

- **WHEN** SDK evaluates connection-test or generate availability, or normalizes generate input
- **THEN** it SHALL delegate revision safety、mode state、lifecycle operation completeness and input allowlisting to `@yeisme/client-runtime/client-module`
- **AND** it SHALL intersect descriptor and readiness capabilities before delegation
- **AND** Workbench-specific fixed owner/adapter、registry、permission、cost and project-mode gates SHALL remain additional mandatory constraints
- **AND** an unsafe unnormalized revision、unknown capability、partial/degraded/disabled state or partial resource-limit tuple SHALL fail closed before transport

### Requirement: Workbench SHALL provide one unified Local CLI and BYOK capability center

Workbench SHALL 在 Connections 中提供单一 `Local CLI & BYOK` 产品入口，按固定 owner adapter 与 mode 展示 readiness、稳定 diagnostic、生命周期 capability、安全 remediation 与经过 Workbench admission 的动作。该入口 SHALL 只消费 `WorkbenchClient.runtime` 与现有 Task catalog，不得成为 credential、provider 或 CLI process 的新 owner。

#### Scenario: User inspects Local CLI and BYOK readiness

- **WHEN** runtime descriptor 与 per-mode readiness 已加载
- **THEN** 页面 SHALL 同时展示 adapter、mode、state、diagnostic 与 connection/generate/events/cancel/reconcile capability 状态
- **AND** unavailable mode SHALL 给出安全 remediation 且不渲染虚假可执行动作

#### Scenario: Generate remains a canary

- **WHEN** Aigora BYOK readiness 已 ready 但独立 Web generate canary flag 未启用
- **THEN** 页面 SHALL 明确说明 generation 尚未晋级
- **AND** generate 按钮 SHALL 不存在，connection test 与只读 readiness SHALL 不受影响

#### Scenario: Browser receives an unknown capability

- **WHEN** descriptor/readiness 出现当前 UI 不认识的 capability id
- **THEN** 页面 SHALL 使用稳定的不可用标签展示该项
- **AND** 不得根据 unknown id 构造按钮、命令、provider 设置或 mutation request
