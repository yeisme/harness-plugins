## ADDED Requirements

### Requirement: Workflow definitions MUST be versioned immutable DAGs

Published WorkflowDefinition version MUST 不可变、带checksum并固定typed input/output、step/edge、capability/scope、quota/cost、timeout/retry/approval policy；run MUST pin具体version。

#### Scenario: 修改 published definition
- **WHEN** 用户编辑已发布definition
- **THEN** 系统 MUST 创建新draft/version
- **AND** 现有run MUST 继续使用原version/checksum

#### Scenario: Definition含cycle或未知step
- **WHEN** publish validation发现cycle、任意script/URL或unsupported step type
- **THEN** publish MUST 被拒绝
- **AND** 不得创建可运行version

### Requirement: Workflow step types MUST be allowlisted and bounded

Runtime MUST 只执行批准的typed step：read_projection、condition、submit_operation、wait_task、approval、wait_event、delay、emit_delivery；MUST 禁止arbitrary shell/script/dynamic network和unbounded loop。

#### Scenario: Condition expression访问未声明数据
- **WHEN** expression引用未在safe input/step output schema中的字段或超过复杂度
- **THEN** validation/execution MUST fail-closed
- **AND** MUST 不读取Owner raw payload、credential或进程环境

### Requirement: Run and step state transitions MUST be centralized

WorkflowRun/Step transition MUST 由集中WorkflowService验证并持久化event/outbox；worker、transport和repository MUST NOT 直接写terminal state。

#### Scenario: Step success
- **WHEN** Task/Owner receipt和输出schema验证成功
- **THEN** service MUST 原子写step succeeded、safe outputs/evidence refs和后续ready steps
- **AND** duplicate completion event MUST 幂等

#### Scenario: Invalid transition
- **WHEN** paused/cancelled/terminal step收到不允许的running/success写入
- **THEN** service MUST 拒绝stale transition/fencing token
- **AND** 当前state/version MUST 保持不变

### Requirement: Scheduler and workers MUST use leases and fencing

Ready step MUST 通过原子claim获得lease、attempt、expiry和fencing token；heartbeat、expiry/reclaim和所有state write/dispatch intent MUST 验证有效fencing token。

#### Scenario: Worker crashes after claim
- **WHEN** worker在dispatch前崩溃且lease过期
- **THEN** 其他worker MAY reclaim同一步骤
- **AND** 旧worker恢复后的write/dispatch MUST 被fencing拒绝

#### Scenario: Worker crashes after dispatch intent
- **WHEN** durable intent已写但Owner响应未知时进程崩溃
- **THEN** reclaim worker MUST 先查询Task/receipt/status并进入reconcile
- **AND** MUST 不生成新idempotency key自动重发

#### Scenario: Lease expires while old worker is still running
- **WHEN** heartbeat丢失且其他worker使用DB time reclaim同一步骤
- **THEN** 原worker后续state write、output commit、dispatch intent或Owner dispatch MUST 被stale fencing token拒绝
- **AND** reclaim MUST 保留原attempt、dispatch intent、receipt与external truth，不得以删除lease重置事实

#### Scenario: Worker clock differs from database clock
- **WHEN** worker wall clock发生跳变或多个worker存在clock skew
- **THEN** claim、heartbeat、expiry与reclaim MUST 仅以数据库时间和持久化version决定
- **AND** clock skew MUST NOT 产生双claim、双commit或提前reclaim

### Requirement: Worker process lifecycle MUST be independently operable

Production workflow execution MUST 使用独立pure-Go `workbench-worker` process/profile；worker MUST 在任何claim前完成config、migration、registry、service identity、contract range、DB time与queue safety检查，并区分process health、claim readiness与per-Owner degraded capability。

#### Scenario: Worker starts before required migration
- **WHEN** PostgreSQL migration version/checksum不在worker supported range
- **THEN** process health MAY 为healthy但readiness MUST 为false且 MUST 零claim
- **AND** diagnostics MUST 只返回safe reason/version range，不得AutoMigrate或回退SQLite

#### Scenario: One Owner is unavailable
- **WHEN** 一个Owner operation的capability/status/event/reconcile依赖不可用
- **THEN** 仅该Owner operation/capability MUST degraded并停止新dispatch
- **AND** 无关read/local steps与其他Owner operation MAY 继续，已发送mutation MUST 继续reconcile

#### Scenario: Worker receives termination signal
- **WHEN** worker收到SIGTERM或typed drain command
- **THEN** readiness MUST 变为false并立即停止新claim，同时在bounded grace period内完成安全阶段或持久化unknown/reconcile交接
- **AND** 已发送或可能已发送的mutation MUST NOT 被伪造为failed/cancelled

#### Scenario: Worker process is killed without drain
- **WHEN** worker在dispatch intent写入后被SIGKILL
- **THEN** lease expiry/reclaim MUST 使新worker按原idempotency/receipt/status恢复reconcile
- **AND** 系统 MUST 证明无自动redispatch和无旧worker late commit

### Requirement: Owner mutations MUST use stable idempotency and reconcile

每个submit_operation step MUST 使用稳定idempotency key、Task/Gate、Owner receipt/status/event；未知接受 MUST 进入`reconciling`并禁止自动重放。

#### Scenario: Network reset after mutation send
- **WHEN** connector已发送mutation但未收到确定响应
- **THEN** step/run MUST 进入unknown_accept/reconciling
- **AND** reconcile MUST 使用原idempotency/receipt/status，不得创建新mutation

#### Scenario: Explicit retryable rejection
- **WHEN** Owner明确证明未接受且返回contract允许的retryable错误
- **THEN** runtime MAY 按bounded backoff重试同一逻辑attempt/idempotency
- **AND** attempts/decision MUST 可审计并受quota限制

### Requirement: Approval and authority MUST be fresh at dispatch

高风险step MUST 在dispatch时重新验证R1 actor/tenant/membership/policy、R2 capability、cost/quota和Gate；approval MUST 绑定definition/step/input digest、authority version与expiry。

#### Scenario: Membership revoked after approval
- **WHEN** approval完成后actor membership被撤销或policy/input/version变化
- **THEN** gate MUST 视为stale且step MUST fail-closed/重新审批
- **AND** 已发送mutation只按receipt reconcile

### Requirement: Pause, resume, and cancel MUST preserve external truth

Pause MUST 阻止新claim/未发送dispatch；resume MUST 重验definition/authority/capability/quota；cancel MUST 不把Owner未确认的工作伪造为cancelled。

#### Scenario: Cancel waiting Owner step
- **WHEN** run cancel时Owner operation已接受
- **THEN** runtime只有在Owner声明cancel capability时才请求取消
- **AND** 未确认结果 MUST 保持cancelling/waiting/reconciling

#### Scenario: Resume after long pause
- **WHEN** paused run恢复且approval/capability/membership已过期
- **THEN** affected steps MUST 返回waiting approval/needs_contract/permission error
- **AND** MUST 不沿用旧allowed action直接dispatch

### Requirement: Compensation MUST be explicit and independently authorized

Runtime MUST NOT 自动推断通用rollback；compensation binding必须由definition显式声明、固定operation registry/schema digest、由Owner capability支持，并重新执行permission/approval/idempotency/receipt/reconcile。

#### Scenario: Compensation fails
- **WHEN**原step成功但显式compensation mutation失败/unknown
- **THEN** run MUST 进入`needs_intervention`并记录typed compensation failure/intervention evidence
- **AND** MUST 不改写原step真实成功状态或伪造rollback完成

### Requirement: Workflow capability availability MUST reflect the complete dependency chain

Workflow publish/start/dispatch/operator capability MUST 根据真实service binding、PostgreSQL schema/readiness、step与operation registry、worker role、R1 authority和Owner receipt/reconcile依赖返回`unavailable`、`needs_contract`、`degraded`或`available`；process health、route注册、UI存在或fixture通过 MUST NOT 单独产生`available`。

Dependency diagnostic MUST 只包含allowlisted `dependencyId`、capability、state、reason code、required/observed contract version range、required/observed `sha256:` digest、server observed time与bounded evidence refs；MUST NOT 包含endpoint、issuer URL、JWKS/schema body、credential source value、Owner/provider raw error、tenant/member title、private path或SQL。API、worker readiness与Web MUST 消费同一由CLI/application service生成并校验的capability snapshot。

#### Scenario: Transport registered before WorkflowService is bound
- **WHEN** HTTP、gRPC或JSON-RPC descriptor存在但真实WorkflowService/repository尚未绑定
- **THEN** 所有transport MUST 返回一致的稳定`unavailable`
- **AND** UI MUST 隐藏或禁用执行入口且不得以本地state模拟成功

#### Scenario: One Owner reconcile dependency is degraded
- **WHEN** 特定Owner operation的status/event/reconcile probe失败
- **THEN** 该operation的新dispatch MUST 停止并显示`degraded`
- **AND** 其他无关step MAY继续，已发送operation MUST 继续bounded reconcile

#### Scenario: Dependency snapshot contract or digest drifts
- **WHEN** API、worker或Web观察到required dependency ahead/behind、digest mismatch、缺evidence或未知reason code
- **THEN** 对应capability MUST fail-closed为`needs_contract`或`unavailable`
- **AND** Web MUST NOT override snapshot，诊断 MUST 不回显raw probe error或endpoint

### Requirement: Durable outbox and events MUST support recovery

Workflow state mutation MUST 与outbox event在同一事务写入；publisher/consumer MUST 使用source-local sequence/cursor幂等恢复，并只保存safe refs/version/state/receipt/evidence。

#### Scenario: Event publisher outage
- **WHEN** DB transaction成功但publisher暂时离线
- **THEN** outbox MUST 保留待发布event并在恢复后按序推进
- **AND** API/worker MUST 不因未发布event重复业务mutation

### Requirement: Workflow panes MUST support fullscreen, safe preview, and canonical recovery

Definition、Run、Step与Operations Pane MUST 支持docked、expanded、fullscreen与restore，并在切换时保持canonical subscription cursor、焦点、权限和mutation idempotency；文件/制品预览 MUST 只消费R3 safe refs与批准的same-origin或短期授权projection，禁止definition动态URL/private path。

#### Scenario: Run Pane enters fullscreen during event streaming
- **WHEN** 用户在Run事件持续到达时进入或退出fullscreen
- **THEN** Pane MUST 保持同一source cursor并去重重复event，退出后恢复原layout与focus
- **AND** MUST 不因remount重复pause/cancel/reconcile command

#### Scenario: Preview authorization expires
- **WHEN** fullscreen artifact/file preview期间授权失效或target被撤销
- **THEN** preview MUST 清除敏感内容并显示permission rescue状态
- **AND** MUST 不持久化授权URL、private path、object URL或缓存内容到layout state

#### Scenario: Event retention gap while Pane is suspended
- **WHEN** Pane恢复时source cursor已超出retention
- **THEN** UI MUST 显示resync状态并重新读取canonical Run/Step snapshot
- **AND** MUST 不补造缺失事件或根据旧timeline推断terminal state

### Requirement: Operator controls and kill switches MUST be typed and audited

Operator MUST 通过强授权typed command查看/暂停/恢复/取消/reconcile/dead-letter处理；kill switch MUST 可按全局、tenant、definition、capability、Owner operation分层，禁止手改DB伪造状态。

#### Scenario: Disable Owner operation
- **WHEN** operator启用特定Owner operation kill switch
- **THEN** 新step claim/dispatch MUST 停止并显示明确reason
- **AND** 已发送mutation MUST 继续receipt/reconcile，不得丢弃

#### Scenario: Unauthorized intervention
- **WHEN**普通用户尝试requeue/force-resolve/dead-letter操作
- **THEN** service MUST 返回permission denied并审计尝试
- **AND** run/step/lease MUST 不改变

### Requirement: Execution MUST enforce quota, cost, and fairness

Runtime MUST 限制每definition/run/tenant的steps、fan-out、parallelism、duration、attempts、wait、bytes、events、Owner calls和estimated cost，并执行tenant/Owner公平并发。

#### Scenario: Run exceeds cost or fan-out
- **WHEN**下一step会超过批准budget/parallelism/fan-out
- **THEN** run MUST pause/wait approval/fail按policy处理
- **AND** MUST 不静默扩容或继续dispatch

#### Scenario: Hot tenant competes with another tenant
- **WHEN**一个tenant持续产生超过bounded scan window的ready steps，且另一个tenant存在可执行step
- **THEN** scheduler MUST 使用per-tenant bounded candidate window与确定性公平排序，使另一tenant在配置的公平窗口内获得claim机会
- **AND** scheduler MUST NOT 通过无界scan、随机map顺序、动态提高concurrency或worker wall clock实现表面公平

#### Scenario: Capacity is exhausted before claim
- **WHEN**global、tenant或Owner/capability concurrency token已耗尽
- **THEN** scheduler MUST 在创建lease/attempt前返回stable transient decision并保留ready truth
- **AND** capacity恢复后 MUST 重新评估current version、contract、policy和kill switch，不得复用stale allow decision

### Requirement: Workflow readiness MUST reflect queue and worker safety

API、scheduler、worker readiness MUST 分别检查schema/registry/policy、queue/outbox/reconcile cursor、supported contract、service identity、lease heartbeat；单个Owner offline只降相关capability。

#### Scenario: Worker contract mismatch
- **WHEN** worker不支持run pinned definition/step contract version
- **THEN** worker MUST 不claim该step且workflow capability MUST degraded/not-ready
- **AND** diagnostics MUST 返回safe version/reason/evidence ref，不泄露payload/credential

#### Scenario: Queue pressure exceeds configured budget
- **WHEN** ready queue、outbox或reconcile backlog超过bounded scan/concurrency/lag阈值
- **THEN** scheduler/worker MUST 施加backpressure、公平限制或对应capability not-ready
- **AND** MUST NOT 启动无界goroutine、无界scan、静默提升concurrency或丢弃待reconcile事实

#### Scenario: Scheduler dependency fails during scan
- **WHEN**DB time、queue scan、registry、claim authority或worker contract在运行中失效
- **THEN** scheduler role readiness MUST 在freshness预算内变为false并停止新claim
- **AND** 恢复后 MUST 重新读取数据库与current snapshots，旧candidate/decision MUST NOT 直接恢复执行

#### Scenario: Worker drains with leased work
- **WHEN**worker开始drain且同时存在in-flight claim或active lease
- **THEN** scheduler MUST 先撤销新claim readiness并等待bounded in-flight claim结束
- **AND** dispatch intent前 MAY 以safe drain reason释放lease；已发送或可能发送的mutation MUST 进入unknown/reconcile handoff而不得释放后重发

### Requirement: Workflow contracts and evidence MUST prove fault recovery

Definition/Run/Step/Lease/Approval/Intervention/Receipt/Event operations MUST 保持four-transport parity，并通过worker crash、DB/network/Owner failure、revoke、approval race、kill switch与rollback evidence。

#### Scenario: Fault-injection system run
- **WHEN** disposable PostgreSQL、worker、TaskService与真实test Owner执行批准failure matrix
- **THEN** 每个run MUST 收敛到真实waiting/reconciling/succeeded/failed/cancelled状态且不重复mutation
- **AND** evidence MUST 包含contract/definition/policy digest、attempt/receipt safe refs、命令/日志/环境/ artifacts与redaction status
