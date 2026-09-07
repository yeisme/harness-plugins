# Workflow Contract 交付矩阵

## 1. 目的

本矩阵把 R4 Workflow contract 从一个不可并行的大任务拆成稳定词汇、Proto/JSON Schema、TypeScript SDK 和 canonical step snapshot 四层。任何 executor、scheduler、UI 或 release artifact 都只能消费这些合同，不能自行增加 state、step、error 或任意 payload 字段。

## 2. 版本与兼容规则

```text
workflow contract: workbench.workflow.v1alpha1
step snapshot:     workbench.workflow_step_registry.v1
```

- additive 变更只能增加 optional field、enum value 或新 versioned step descriptor；不得复用旧字段号或改变既有语义。
- published definition 固定 contract version、definition checksum 和 step snapshot digest。
- worker 注册支持的 contract min/max 与 step snapshot digest；不兼容时零 claim。
- JSON/Proto/SDK 字段保持同一语义；transport 不持有独立状态机。

## 3. 核心资源

| 资源 | 必须字段 | 明确禁止 |
| --- | --- | --- |
| Definition | safe ref、tenant/workspace、version、status、contract version、step snapshot digest、input/output schema refs、steps、edges、policy refs、checksum、audit refs | script、URL、credential、raw prompt、provider payload |
| StepDefinition | step ref、type、version、typed input binding、output schema ref、timeout/retry/authority/cost policy refs | arbitrary map、dynamic module、shell/env access |
| Run | run ref、definition ref/version/checksum、tenant、state、expected version、trigger/idempotency refs、timestamps | mutable definition body、credential |
| StepRun | run/step refs、state、expected version、attempt count、lease/receipt/gate/cursor/evidence refs | Owner raw response、terminal override |
| Attempt | attempt ref/number/kind、fence epoch、dispatch/idempotency/receipt refs、safe outcome | request/response body、token |
| Lease | lease/worker refs、fence epoch、DB-time claim/heartbeat/expiry/release、expected versions | worker wall clock authority |
| Gate | gate ref、action/scope/policy/input digest、membership version、state/expiry/decision refs | reviewer credential、free-form policy |
| Receipt | receipt ref、source/type/status/version/observed time/evidence refs | raw provider receipt |
| Event | source-local sequence、type、resource ref/version、safe summary、occurred/observed time | global exactly-once claim、payload dump |
| Intervention | typed action、operator scope、target/version、reason code、audit/evidence refs | DB patch、free-form force success |

## 4. 首版 Step Registry

| type | side effect | authority | retry | durable wait | output |
| --- | --- | --- | --- | --- | --- |
| `workbench.read_projection.v1` | no | read scope | bounded read retry | no | typed safe projection |
| `workbench.condition.v1` | no | declared inputs only | none | no | typed branch decision |
| `workbench.submit_operation.v1` | yes | operation permission + delegation | pre-send/rejected only | receipt/reconcile | Task/receipt refs |
| `workbench.wait_task.v1` | no new mutation | Task visibility | cursor reconnect | yes | terminal/gate/reconcile snapshot |
| `workbench.approval.v1` | human decision | action/scope/membership version | none | yes | decision/gate refs |
| `workbench.wait_event.v1` | no | event source/type/ref | cursor reconnect | yes | typed event projection |
| `workbench.delay.v1` | no | none | none | DB-time timer | fired-at DB time |
| `workbench.emit_delivery.v1` | yes | delivery permission + delegation | receipt contract only | receipt/reconcile | manifest/child receipt refs |

每个 canonical descriptor 必须包含：type、contract version、input schema ref、output schema ref、side-effect class、authority action、retry class、idempotency policy、timeout upper bound、cost weight class、receipt/reconcile requirement、adapter/Owner contract range。任一字段为空都不能进入 snapshot。

## 5. 状态枚举

Definition：

```text
draft, published, deprecated
```

Run：

```text
pending, running, waiting, paused, cancelling, reconciling,
succeeded, failed, cancelled, needs_intervention
```

Step：

```text
pending, ready, leased, running, waiting_approval, waiting_owner,
reconciling, paused, succeeded, failed, skipped, cancelled
```

Attempt outcome：

```text
pending, accepted, rejected, retryable_rejected, unknown_accept,
reconciling, succeeded, failed, superseded
```

状态迁移由 WorkflowService/domain state machine 唯一拥有。Worker、transport、repository 只能提交 typed command 或执行 CAS persistence，不能直接写 terminal state。

## 6. 命令、查询与事件

首版 command：

```text
definition.create_draft
definition.update_draft
definition.publish
definition.deprecate
run.start
run.pause
run.resume
run.cancel
run.reconcile
intervention.requeue
intervention.force_fail_reconciled_only
```

首版 query：

```text
definition.get/list/validate/diff
run.get/list
step.get/list
attempt.list
gate.get/list
receipt.get/list
event.list/watch
operations.readiness/queue/lease/outbox/reconcile
```

事件至少包含 definition、run、step、attempt、gate、receipt、intervention state change；每个事件带 source-local sequence 与资源 expected version，consumer 必须容忍重复和重连。

## 7. 稳定错误

```text
workflow_invalid_contract
workflow_invalid_definition
workflow_cycle_detected
workflow_step_unsupported
workflow_schema_mismatch
workflow_version_conflict
workflow_not_authorized
workflow_gate_required
workflow_gate_stale
workflow_lease_conflict
workflow_fence_stale
workflow_receipt_unknown
workflow_reconcile_required
workflow_dependency_unavailable
workflow_quota_exceeded
workflow_needs_intervention
```

错误 detail 只能使用 safe refs、expected/observed version、reason code 和 evidence ref；不包含 SQL、URL、credential、Owner body 或原始 input。

`workflow_dependency_unavailable` 只表示 Workflow runtime 已绑定、但
`ReconcileRun` 所需的 external-truth/receipt adapter 尚未绑定；HTTP 返回
503，JSON-RPC 使用 `-32013`，gRPC 使用 `Unavailable`，typed SDK 保留同一
stable code。完全未绑定的 Workflow runtime 继续返回
`workflow_unavailable`。该错误不得创建 run、attempt、receipt 或 event。

## 8. 原子交付与验证

### 1.2a：词汇冻结

- 更新规范、设计和此矩阵，使 step/state/error 只有一套名称。
- 使用搜索测试阻止旧 `workbench.read.v1`、`owner_operation`、`transform`、`compensation` 被当首版 executor step。

### 1.2b：Proto 与 JSON Schema

- 新建 `api/proto/workbench/workflow/v1alpha1/workflow.proto`。
- 由 schema-export CLI 生成 `api/schema/workbench/workflow/v1alpha1/workflow.schema.json`。
- Proto map 只用于受控 metadata allowlist；typed step input/output 不使用 raw map。

### 1.2c：SDK 模型与 transport contract

- 新建 workflow models/client，保持 HTTP/gRPC/JSON-RPC 字段和错误一致。
- 添加 round-trip、unknown enum、unsafe field、pagination/cursor 测试。

### 1.2d：Canonical Step Snapshot

- 从 `1.2b/1.2c` 生成 descriptor 和 digest，不复制 schema。
- snapshot 由 CLI/application service 生成并绑定 release manifest。
- API publish validator、scheduler、worker、Web designer 读取同一 digest。

验证入口：

```bash
task workflow:contract:generate
task workflow:contract:check
task test:workflow-contract:component
```

生成或校验失败、snapshot digest drift、任一空 schema ref 或旧 step name 出现时，`1.2d` 与 `5.0b2b2c2` 均不得关闭。
