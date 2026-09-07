# Workflow durable waits 与 approval 基线

## 1. 结论

截至 2026-07-29，R4 `6.3a` 已实现 `wait_task`、`approval` 与 `wait_event` 的纯 durable executor合同。三类executor每次执行只进行bounded snapshot/read与fresh authority revalidation，然后立即返回`output_ready`或带checkpoint/version/`ResumeAtDB`的`wait` command；它们不sleep、不占用lease执行goroutine，也不在内存中持有长期订阅。

当前实现冻结consumer-side Task/Gate/event adapter接口与safe typed input/output。R1/R3 production handoff在`0.1b/0.1e`完成前，production factory必须保持对应capability为`needs_contract`，不得把test reader或fixture注册为available。

## 2. wait_task truth

`wait_task` 每次先以`task.read`重新验证tenant/resource authority，再读取同一Task与operation snapshot：

- Task succeeded/partial/failed/cancelled返回`task_terminal` safe output，不把accepted/running伪造成terminal；
- pending Gate返回durable `task_gate_pending` checkpoint；
- `unknown_accept`返回`task_reconciling` checkpoint，由`6.2` receipt/status/event reconcile继续收敛；
- denied/expired Gate返回对应canonical gate outcome，stale/revoked Gate进入intervention；
- deadline到期但Task仍非terminal时进入intervention，不伪造Task failed/cancelled；
- snapshot必须匹配Task ref、operation ref、version、safe receipt/cursor。

## 3. Approval Gate binding

`service/internal/approvals` 新增Gate expectation/binding权威评估：

```text
gate_ref
expected_gate_version
definition_digest
input_digest
authority_version
expires_at / deadline
```

- approved只有在Gate version、definition/input digests、authority version全部匹配，且dispatch-time authority仍allowed/not-revoked时才返回`approval_confirmed`；
- version drift、input/definition drift、authority rotation/revoke、explicit stale/revoked均返回`approval_stale` intervention；
- pending Gate返回durable `approval_pending` checkpoint；
- denied与expired采用canonical Gate truth；duplicate/out-of-order source event继续由既有Approval projection幂等合同处理；
- Gate receipt只作为safe evidence ref，不包含decision payload、actor secret或raw reason。

## 4. wait_event cursor 与 retention gap

`wait_event` input绑定tenant、source ref、event type、target ref、exact expected version、cursor、deadline与bounded `poll_interval_ms`：

- reader只返回typed safe EventWindow；匹配event需要source/type/target/version全部一致；
- 无匹配event时保存source返回的next cursor并返回`event_pending` checkpoint；restart后的executor从input cursor继续；
- retention gap返回`event_resync_required` intervention，并保留floor cursor，不从空cursor补造历史event；
- deadline到期返回`event_wait_deadline_exceeded` intervention；
- contract-invalid event/window返回安全intervention/error，不将任意event body写入output。

## 5. Typed executor framework

`RegisterDurableWaitExecutors` 只注册canonical registry中的：

- `workbench.wait_task.v1`
- `workbench.approval.v1`
- `workbench.wait_event.v1`

Inputs/outputs使用snake_case JSON字段与稳定schema refs。等待command使用safe cursor或由step kind/resource ref派生的稳定checkpoint ref，checkpoint version单调递增；complete/intervention output只包含state、reason、safe refs、version与cursor。重复注册fail closed。

## 6. 故障矩阵

测试覆盖：

- Task terminal/gate/reconcile/deadline与authority revoke；
- Approval pending/approved/denied/expired、Gate version/input digest drift与authority revoke；
- duplicate/out-of-order/gap Approval projection；
- Event match/pending/timeout/retention gap/restart cursor；
- event gap不返回伪造EventRef；
- executor返回durable wait command而非阻塞；
- 每次Task/Gate/event执行均调用fresh authority checker；
- canonical descriptor注册与duplicate registration拒绝。

## 7. 验证与证据

可重复命令：

```bash
task workflow:durable-waits:test
task test:workflow-component SCENARIO=workflow-durable-waits
```

Component evidence：

```text
temp/integration-test-runs/20260729030640-088adc25-1176-47ae-b5c3-2de54ed4dbbf/
status=passed
exit_code=0
redaction=enabled
total_redactions=0
```

证据包含pure-Go tests、race detector、`go vet`与六件套/digest/redaction gate；无Task payload、approval decision body、event raw body、credential、private path或provider error落盘。

## 8. 后续边界

- `0.1b/0.1e`：接收真实Identity/Task/Gate/event contract range、digest与provider evidence后，production adapter才可标记available。
- `6.3b`：Delivery child Task/receipt复用同一wait/reconcile truth，不直连Owner。
- `5.2b0b`：真实executor factory注入Task/Gate/event readers与authority checker；缺任一依赖时selected executor role必须startup fail closed。
