# Workflow emit_delivery 与 receipt handoff 基线

## 1. 结论

截至 2026-07-29，R4 `6.3b` 已实现 `workbench.emit_delivery.v1` 的 durable emit intent、provider-neutral Delivery adapter、typed executor 与 child Task/parent receipt handoff。首次发送前必须完成 fresh dispatch-time authority revalidation，并在 durable intent 创建后只使用同一 `idempotency_ref`；发送结果不确定、进程重启或持久化提交不确定时只进入 reconcile，不直接再次 emit。

当前实现冻结 R4 consumer-side contract 与 no-duplicate 语义。R3 production Delivery handoff `0.1e` 尚未完成，因此 production factory仍须把真实 Delivery capability保持为 `needs_contract`；本任务不声明真实 Owner、PostgreSQL或 production adapter 已接通。

## 2. Durable emit intent

`service/internal/delivery.Emitter` 使用以下稳定身份创建 intent：

```text
tenant_ref
workspace_ref
delivery_ref
idempotency_ref
```

Intent 同时绑定 `expected_version`、manifest safe ref/digest/version与 `authority_version`。同一稳定身份若出现manifest、version或authority drift，返回 idempotency conflict，不生成新 idempotency key。

- 首次调用先读取已有 intent，再进行 fresh authority revalidation；撤权、版本变化或不允许时不创建 intent、不调用gateway。
- intent状态为 `dispatching` 或 `unknown_accept` 时只调用 reconcile；即使之后撤权，也允许既有已发送操作继续收敛truth。
- `accepted` 必须同时具有 safe child Task ref与parent receipt ref；`rejected`为明确terminal结果。
- gateway timeout、invalid result或 intent commit uncertainty保持 `unknown_accept`，不得推断success或重新发送。
- reconcile结果不合法或包含unsafe ref时继续保持unknown，不写入private path、artifact/blob或raw provider payload。

## 3. Provider-neutral adapter

`service/internal/adapters.DeliveryGateway` 只转发typed Delivery command字段：tenant/workspace/delivery refs、expected version、manifest safe ref/digest/version、idempotency ref与authority version。

Adapter不暴露 `Owner()` 方法，不接受raw JSON/bytes、artifact、blob或path字段，也不解析provider-specific payload。Transport error映射为 `unknown_accept`；不安全的child Task/receipt ref被清空并fail closed。

## 4. Typed executor

`RegisterDeliveryExecutor` 只注册canonical `workbench.emit_delivery.v1` descriptor：

- accepted/rejected返回 `output_ready`，output仅含resolution、emit state、intent ref、child Task ref、parent receipt ref、version与replayed标志；
- authority denied/revoked返回intervention output，不触发gateway；
- dispatching/unknown返回durable `wait` command，checkpoint ref固定为intent ref，checkpoint version单调递增；
- parent receipt仅作为safe evidence ref；executor不持有长期goroutine、不sleep、不自动redispatch。

## 5. 故障矩阵

测试覆盖：

- accepted、rejected与unknown gateway outcomes；
- unknown replay与进程重启使用同一intent/idempotency，只reconcile且gateway调用次数保持一次；
- 新请求撤权时零intent、零gateway；既有unknown intent在撤权后仍可reconcile为accepted；
- send后commit失败返回reconcile required，恢复后不重复emit；
- unsafe manifest、unsafe child ref、identity drift与invalid reconcile accepted结果fail closed；
- typed executor stable checkpoint、receipt evidence、duplicate registration拒绝；
- adapter contract无direct Owner API、raw payload、artifact/blob/private path。

## 6. 验证与证据

可重复命令：

```bash
task workflow:emit-delivery:test
CGO_ENABLED=1 go test -race ./service/internal/workers/executors ./service/internal/delivery ./service/internal/adapters/... -count=1
task test:workflow-component SCENARIO=workflow-emit-delivery
```

Component evidence：

```text
temp/integration-test-runs/20260729032003-6c8cd203-9a92-43b5-867d-4dcb6cd27fc6/
status=passed
exit_code=0
redaction=enabled
total_redactions=0
```

证据包含focused tests、race detector、`go vet`与标准六件套/digest/redaction gate；无credential、raw manifest、provider payload、private path或chain-of-thought落盘。

## 7. 后续边界

- `0.1e`：接收 R3 real Delivery contract range/digest、child receipt/status/event cursor、tombstone与rollback evidence后，production adapter才可标记available。
- `5.2b0b`：production executor factory必须注入真实 durable IntentStore、Delivery gateway、reconciler与authority checker；缺任一依赖时startup fail closed。
- `7.1/7.3`：pause/cancel/kill switch不得删除既有intent或阻断已发送Delivery继续reconcile。
- `7.4`：真实Eikona canary需使用test tenant、真实receipt/status/event与rollback drain，不得用fixture冒充production handoff。
