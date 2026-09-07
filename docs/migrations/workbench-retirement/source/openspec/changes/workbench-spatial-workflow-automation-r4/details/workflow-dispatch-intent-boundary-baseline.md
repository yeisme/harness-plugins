# Workflow durable dispatch-intent boundary 基线

## 1. 结论

截至 2026-07-28，R4 `6.1a` 已冻结 `submit_operation` 从 typed executor 到 Task/Gate gateway 的 send-before-intent 边界。任何 side-effecting step 从 `leased` 进入 `running` 前都必须先提交 fence-bound durable dispatch intent；intent、step CAS、attempt dispatch metadata、Workflow event 与 outbox 在同一事务写入，事务未成功时 gateway 调用次数为零。

该基线不宣称 Owner 已完成、Task 已终态或 reconcile 已可用。Task submission accepted 仅表示 Task/Gate command 已由现有 `TaskService` 接受；若 Task 仍在 permission/cost gate，Owner handler 不会执行。Owner response、receipt/status/event 收敛与 production role wiring 分别属于 `6.1b`、`6.2` 和 `5.2b0b`。

## 2. Typed command 与敏感数据边界

- `submit_operation` executor 只输出 operation/workspace/project/input safe refs、input digest、expected Owner version、authority version、audience、delegation safe ref/digest 与 gate safe ref/digest；不输出 credential、delegation token、raw Owner payload或 provider response。
- `OperationPayloadSource` 在 handoff 阶段按 `InputRef` 重新加载 canonical JSON，并在内存中重新计算 `sha256`；digest drift、空 payload或超限 payload在 intent 前 fail closed。
- R2 operation snapshot必须命中相同 operation，且 operation必须是 mutation、要求 idempotency、project mode兼容并且 contract可用；不从运行时注册表读取可变 handler或 raw manifest。
- `FreshDispatchGuard` 固定按 authority → capability → approval 顺序执行。authority request显式携带 tenant/workspace/project/operation、authority version、audience与delegation digest；原始 token不会进入 intent、Task request、event、outbox或日志。
- permission/cost operation必须提供成对的 gate ref/digest；approval expiry、revoke、capability drift和 authority denial均在 intent前停止。

## 3. Durable intent 与 fencing

```text
typed Completion
  -> current DB fence/state
  -> canonical payload digest
  -> fresh authority/capability/approval
  -> atomic dispatch intent transaction
       step leased -> running
       attempt running -> dispatching
       stable idempotency + request digest + operation ref
       workflow.step.dispatch_intent event
       pending workflow outbox
  -> TaskService gateway
```

- `LoadDispatchState` 使用数据库时间验证 lease未释放、未过期，并逐项匹配 worker、epoch、lease version、run version、step version和 attempt ref。
- domain guard拒绝 mutation step在缺少 `DispatchIntentPersisted` fact时进入 `running`。
- GORM transaction先锁定 run/step/attempt并再次验证 current fence，再提交 step CAS、attempt dispatch metadata、event/outbox；任一写失败整笔回滚。
- attempt状态使用共享 `AttemptStatusDispatching` 常量，避免 repository 与 lease contract漂移。
- exact replay返回 `Idempotent=true`、`ReconcileRequired=true`；gateway不会再次调用。
- `UnknownHandoffStore` 已通过现有 attempt+lease+Workflow event/outbox实现 durable `pending_reconcile` projection；current schema保持已签署的 `0018_workflow_ready_queue_projection`，不新增未验证 migration。

## 4. Stable idempotency 与 retry classification

逻辑 dispatch identity 只由以下稳定事实计算：

```text
tenant_ref + run_ref + step_run_ref + operation_ref
```

它不包含 attempt ref、lease ref、worker ref或 fence版本，因此 restart/reclaim不会生成新的 Owner idempotency key。由该 identity 派生固定的 intent/event/outbox/idempotency refs；request digest绑定 typed prepared command，包括 input、authority、audience、delegation与gate digest。

- 首次 intent commit成功后才允许一次 gateway调用。
- 相同逻辑 identity的 exact replay或 reclaimed attempt只返回 reconcile required，零 redispatch；新 attempt保持未写入 dispatch metadata。
- 相同 key但 request digest、operation或固定 event/outbox identity漂移时返回 idempotency conflict。
- gateway明确 `rejected_before_send` 才分类为可拒绝；transport error、unknown accept、无效 task/receipt ref均进入 reconcile required，不能自动重发。
- crash-before-send由 durable intent replay恢复；crash-after-send与 Owner truth收敛由 `6.1b`/`6.2`继续实现。

## 5. Task/Gate adapter

`WorkflowTaskGateway` 只通过现有 `TaskService.SubmitTask` 创建或重放 Task，不直接调用 Owner connector。它从 context读取 principal，并在 managed principal下强制 tenant一致；tenant mismatch在 Task创建前返回 `rejected_before_send`。

- stable idempotency duplicate返回相同 Task/receipt，synthetic handler只执行一次；
- permission/cost operation创建 pending gates并保持 `awaiting_permission`，Owner handler调用次数为零；
- gateway成功返回的 `TaskRef`/`ReceiptRef`均为 safe ref；
- TaskService错误保守分类为 `unknown_accept`，因为 adapter不能证明 durable Task写入或 downstream dispatch是否发生；
- adapter不接收也不转发 delegation token，fresh authority checker只消费 safe ref/digest与调用上下文。

## 6. 验证与证据

可重复命令：

```bash
task workflow:dispatch-intent:test
task test:workflow-component SCENARIO=workflow-dispatch-intent
```

Component evidence：

```text
temp/integration-test-runs/20260728133630-33c343f4-ed4a-48db-b398-9ae3659e1b1d/
status=passed
exit_code=0
redaction=enabled
total_redactions=0
```

验证覆盖：

- domain：mutation `leased -> running` 必须已有 durable intent fact；
- repository：intent/step/attempt/event/outbox原子写、durable unknown handoff、exact replay、并发单 winner、stale/expired fence、digest冲突、reclaimed attempt稳定 identity；
- executor：intent-before-gateway调用顺序、crash-before-send零 gateway、unknown/replay零 redispatch、payload drift/revoke fail closed、audience/delegation显式传入 authority checker；
- Task/Gate：stable duplicate只执行一次、pending permission/cost gates零 Owner执行、tenant mismatch在 send前拒绝；
- race/static：相关 domain/repository/executor/app/adapter packages 的 race与 `go vet`通过。

## 7. 后续边界

- `6.1b`：增加 allowlisted synthetic/test Owner mutation harness，覆盖 accepted/rejected/429/5xx/reset、receipt/status/event和 crash-after-send；
- `6.2`：以相同 idempotency/receipt实现 bounded reconcile，不得通过重发 mutation猜测 Owner truth；
- `6.3a`：实现 durable `wait_task`/approval/wait_event，并在 gate resolution后再次执行 fresh authority验证；
- `5.2b0b`：将 executor pool、dispatch handoff与 Task gateway接入 production worker组合根；未完成前不得宣称 production mutation available。
