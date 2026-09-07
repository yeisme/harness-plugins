# Workflow claimer drain and unknown handoff baseline

## 结论

R4 `5.2b1c` 已冻结并实现 claimer drain 安全边界：未形成 dispatch intent 的 lease 在停止 heartbeat 后使用 current fence 写 `release_reason=drain`；一旦 durable dispatch intent 已形成或 mutation 可能已发送，Drain 永不 release lease，而是要求 `UnknownHandoffStore` 持久化 typed `pending_reconcile` handoff。该边界不依赖 `6.1a` 的具体 repository 实现，但 `6.1a` 必须实现这里冻结的 central workflow handoff contract。

## Dispatch state

`LeaseHandle` 维护受同一 lifecycle mutex 保护的单向状态：

```text
none -> intent_persisted -> maybe_sent
```

- `MarkDispatchIntent(intent_ref, idempotency_ref)` 只允许从 `none` 进入，两个 ref 必须为 safe ref。
- `MarkMaybeSent(receipt_ref?)` 只允许在 intent 已持久化后进入；receipt 可以未知，但若存在必须为 safe ref。
- duplicate、backward、unsafe 或 drain 后 transition 全部返回稳定 `invalid dispatch state`。
- Drain 与 dispatch transition 串行化，避免“检查为 pre-dispatch 后并发 send”的竞态。

## Pre-dispatch safe release

- Drain 先按 phase 取消 lease-scoped context并幂等归还 capacity，再等待 heartbeat owner停止；即使 heartbeat store忽略取消并导致 caller timeout，child context也已取消。
- `none` phase 使用最新 atomic fence调用 `ReleaseWorkflowLease(..., reason=drain)`。
- release transaction 同时将对应 `running` step CAS 回 `ready`、version 加一并写 DB-time `ready_at_db`，因此 scheduler restart 可立即重新发现；lease/attempt history不删除。
- stale/released/expired/not-found 表示 ownership 已消失，按已安全释放收敛；repository unavailable 返回稳定 `drain unavailable`，不泄露 provider detail。
- 成功 action 为 `released`；重复 Drain 返回同一 action，不重复 repository release。

## Unknown/reconcile handoff

central contract 位于 `service/internal/workflows/repository/handoff.go`：

- `UnknownHandoff` 固定包含 handoff、tenant/run/step/attempt refs，current full fence，dispatch intent ref，stable idempotency ref，可选 receipt ref，以及 `pending_reconcile` state。
- 全部字段严格 safe-ref/version 校验；不允许 payload、URL、path、credential、raw Owner response 或任意 map。
- handoff ref 由批准的 `IDSource` 生成，不由 tenant/run/step/user ref 拼接。
- 首次 persistence 失败会保留同一 pending handoff；重复 Drain 使用相同 handoff ref重试，避免生成多个 reconcile item。
- store确认持久化前，Drain不标记完成；store成功后 action固定为 `reconcile_handoff`。
- intent/maybe-sent 分支永不调用 `ReleaseWorkflowLease`，因此 restart/reclaim 不会自动重发可能已接受的 mutation。

## SIGTERM system proof

real PostgreSQL process scenario：

1. 独立 worker process 通过生产 claimer claim一个 no-side-effect step并启动 heartbeat；
2. parent 发送真实 `SIGTERM`；
3. worker 停止 heartbeat并执行 `DrainCoordinator`；
4. PostgreSQL lease row 写入 `released_at_db` 与 `release_reason=drain`；
5. 未创建 unknown handoff 文件；
6. 第二个 claim使用新 attempt与新 fence epoch立即成功；
7. history保留两条 lease且仅 successor active。

该场景连续 5 次通过，并在 race detector 下连续 3 次通过；不是直接调用 Drain 冒充 signal，也没有修改 lease expiry。

## 验证与证据

- `task worker:drain:test`：dispatch truth table、safe release、unknown handoff、stable retry identity、idempotent replay、blocked heartbeat timeout cancellation、20 轮 race与`go vet`通过。
- `WORKBENCH_TEST_POSTGRES_URL=... task test:workflow-claimer-drain:system`：真实 SIGTERM/PostgreSQL process gate通过。
- System evidence：`temp/integration-test-runs/20260728104725-9468d023-3032-48b4-8da2-ff64ce1cd7ee/`。
- Evidence `layer=system`、`status=passed`、`exit_code=0`、`total_redactions=0`，日志无 DSN、candidate refs、raw SQL 参数或 handoff payload。

## 后续边界

- `6.1a` 已在 send 前原子持久化 dispatch intent，并以现有 attempt+lease+Workflow event/outbox实现 durable `UnknownHandoffStore`，未新增 schema或改变 state/idempotency/no-release语义。
- `6.2` 消费 `pending_reconcile` handoff并查询 receipt/status/event，禁止新 mutation。
- `5.2b1d` 负责 production engine factory、role probe 和 scheduler/heartbeat/drain/restart完整 W2 process matrix。
