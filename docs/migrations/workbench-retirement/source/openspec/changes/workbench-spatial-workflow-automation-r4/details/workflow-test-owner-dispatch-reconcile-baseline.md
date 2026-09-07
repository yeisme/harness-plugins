# Workflow test Owner dispatch/reconcile 基线

## 1. 结论

截至 2026-07-28，R4 `6.1b` 已实现一个显式 allowlisted、默认不进入 production registry 的 test Owner mutation contract，并完成 `accepted`、明确 `rejected_before_send`、429、5xx、connection reset、`unknown_accept`、crash-before-send 与 crash-after-send/no-duplicate system matrix。

该任务完成的是 Owner mutation dispatch 与 durable outcome/handoff 边界，不包含 `6.2` 的长期 receipt/status/event polling loop。任何未知响应都会把 Workflow step推进到 `reconciling`、attempt写为 `unknown_accept`并持久化 `pending_reconcile` handoff；后续 invocation只读取已有 intent并返回 reconcile required，绝不自动 redispatch。

## 2. Test Owner contract

- `workbench.test.owner_mutation` 仅能通过 `RegisterTestOwnerOperation` 显式注册；`RegisterSyntheticOperations` 与 production `RegisterOperations` 不包含该 operation。
- operation固定 `ModeOwner`、mutation、idempotency、safe persisted input、cancel/reconcile/events和唯一 `test-owner` project mode。
- schema只允许 safe `inputRef`，不接受 raw payload、URL、credential、token或 provider response。
- handler必须同时实现 execute/cancel/reconcile lifecycle合同；nil handler、非 allowlisted operation或错误 project mode fail closed。

## 3. Dispatch outcome transaction

gateway返回后，`OperationDispatchHandoff` 使用与 intent相同的 current fence提交第二个原子 transaction：

```text
accepted
  -> step running -> waiting_owner
  -> attempt accepted + task/receipt refs
  -> workflow receipt + event + outbox
  -> release execution lease

rejected_before_send
  -> step running -> failed
  -> attempt rejected
  -> event + outbox
  -> release execution lease

unknown_accept / 5xx / reset / outcome commit uncertainty
  -> step running -> reconciling
  -> attempt unknown_accept
  -> optional task/receipt refs
  -> pending_reconcile UnknownHandoff
  -> event + outbox
  -> release execution lease
```

- accepted必须提供 safe TaskRef和ReceiptRef；缺失或不安全引用按 unknown处理，不伪造 accepted。
- outcome exact replay同时核对 attempt metadata、receipt row、handoff projection、event与outbox；任一漂移返回 idempotency conflict。
- `UnknownHandoffStore` 不新增 schema，也不改写已签署的 `0018_workflow_ready_queue_projection`。它复用现有 attempt+lease+Workflow event/outbox，event固定 `workflow.dispatch.unknown_handoff`，通过 tenant/run/idempotency关联重建 typed handoff。
- handoff只包含 safe refs、current historical fence与 `pending_reconcile` state；不含 Owner原始响应或请求 payload。

## 4. Retry classification

`BoundedOperationGateway` 只重试 `retryable_rejected_before_send`：

- 总 attempt数硬限制为 `1..5`，Retry-After必须为正且不超过配置上限；
- 每次调用复制相同 canonical input，并保持完全相同的 idempotency key与request digest；
- 429/test Owner明确声明请求未被接受时，可在上限内重试；耗尽后收敛为 `rejected_before_send`；
- 5xx、connection reset、transport error或 `unknown_accept` 首次出现即停止，返回 unknown，调用次数固定为一；
- context取消/等待失败不继续调用 Owner。

该 bounded retry发生在同一次 durable intent之后，不创建新的 Workflow业务 mutation或新 idempotency key。

## 5. Task truth

`WorkflowTaskGateway` 现在读取 TaskService返回状态：

- Task `unknown_accept` 或 Owner-mode handler error映射为 gateway `unknown_accept`；
- Owner handler transport error在 `TaskService` 中写 `unknown_accept` 与 unknown attempt，不再写 false `failed`；
- submission Task/receipt可用于后续 `wait_task`/reconcile；Task accepted不等于 Owner terminal；
- pending permission/cost gate仍保持零 Owner执行，等待 durable gate resolution。

## 6. Crash/no-duplicate 证明

- crash-before-send：intent transaction失败时 test Owner调用次数为零；
- crash-after-send：Owner已执行但 outcome transaction失败时返回 reconcile required；第二次执行命中 durable intent replay，Owner总调用次数仍为一；
- unknown response：首次写 reconciling handoff，后续 invocation零 redispatch；
- TaskService自身也按 stable idempotency重放同一 Task，形成第二层 no-duplicate保护，但 Workflow不能依赖它替代 pre-send intent。

## 7. 验证与证据

可重复命令：

```bash
task workflow:dispatch-reconcile:test OWNER=test
task test:workflow-system SCENARIO=dispatch-reconcile OWNER=test
```

System evidence：

```text
temp/integration-test-runs/20260728133531-9f418dd7-d4e7-4778-bb89-13463ff12543/
status=passed
exit_code=0
redaction=enabled
total_redactions=0
```

证据覆盖相关 executor、workflow repository、GORM repository、TaskService/app与adapter packages 的 focused tests、race detector及 `go vet`。日志不含 raw Owner payload、credential、token、DSN或 private path。

## 8. 后续边界

- `6.2`：消费 `pending_reconcile` handoff，按同一 idempotency/receipt执行 bounded status/event/reconcile lookup并收敛 terminal或operator rescue；
- `6.3a`：实现 durable `wait_task`/approval/wait_event，不占用 executor lease；
- `5.2b4`：将 `6.2`核心包装为 supervisor-owned reconcile role engine；
- `5.2b0b`：production组合根接入真实 executor/outbox/reconcile factory前，test Owner不得被宣称为 production Owner capability。
