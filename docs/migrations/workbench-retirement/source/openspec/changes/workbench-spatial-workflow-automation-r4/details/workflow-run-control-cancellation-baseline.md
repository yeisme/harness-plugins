# Workflow pause、resume 与 cancellation 基线

## 1. 结论

截至 2026-07-29，R4 `7.1` 已实现 versioned/audited Run pause、freshly validated resume、durable cancellation intent、accepted Owner cancellation reconcile与worker-side target aggregation。暂停后的Run不会进入ready queue；取消中的Run只进入 `cancelling` 或 `reconciling`，仅在明确 `cancellation_settled` 且external truth不再unknown时进入 `cancelled`。

当前实现冻结provider-neutral consumer contract与no-duplicate语义。R1/R2 production authority与Owner cancel/reconcile handoff尚未完成时，production factory必须保持对应capability为 `needs_contract`；测试不使用fixture结果冒充真实Owner取消成功。

## 2. Pause 与 claim gate

`control.Service.Pause` 只允许当前version的 `running/waiting -> paused` CAS transition，并原子写入event/outbox：

```text
workflow.run.paused
event:workflow-control:<stable digest>
outbox:workflow-control:<stable digest>
actor safe ref
```

同一version并发pause只有一个winner；重复读取已paused状态返回replay，不重复写event。既有GORM ready queue仅选择 `RunRunning`，因此paused/cancelling/reconciling Run不会产生新claim；已持有lease的执行与receipt truth不被伪造终止。

## 3. Resume fresh validation

Resume只允许 `paused -> running/waiting`：

- 每次调用都通过 `ResumeValidator` 重新验证当前authority、definition/capability与恢复条件；
- validator deny/revoke/outage时不提交transition；
- snapshot存在durable waiting step时恢复为 `waiting`，否则恢复为 `running`；
- expected version不匹配直接返回version conflict，stale resume不能覆盖并发pause/cancel。

## 4. Cancel truth

Cancel command携带safe `command_ref`并生成稳定event/outbox identity：

- pending Run只有在local cancellation truth已settled且无external unknown时可直接cancelled；
- running/waiting/paused Run先进入 `cancelling`；
- accepted或unknown Owner target返回typed Task/receipt safe refs，交由Cancellation worker处理；
- external outcome unknown时 `cancelling -> reconciling`，不得直接cancelled；
- `reconciling -> cancelled` 必须携带safe evidence ref并声明settled；
- 未settled且非unknown的冲突进入 `needs_intervention`，不改写Owner truth。

## 5. Durable cancellation intent

`CancellationCoordinator` 为每个accepted/unknown target按tenant、run、command、step与Task派生稳定intent：

- intent写入后gateway最多发送一次；
- gateway accepted只表示cancel request accepted，状态为 `cancel_requested`，不是cancelled；
- timeout、invalid result或commit uncertainty进入 `reconciling`；
- restart读取既有intent后只调用reconciler，不重新调用cancel gateway；
- pending local target直接settled且零gateway；
- receipt/identity drift、unsafe ref与invalid settled result fail closed。

Worker aggregator只汇总 `all_settled`、`needs_reconcile` 与 `needs_intervention`，不把requested/unknown/rejected伪造成terminal cancellation。

## 6. 故障矩阵

测试覆盖：

- pause event/outbox/audit、duplicate replay与12路并发CAS单winner；
- resume fresh validation deny/allow、waiting target与version guard；
- pending settled/unsettled cancel；
- accepted/unknown target进入cancelling/reconciling并最终凭evidence cancelled；
- missing evidence、unsafe target与invalid snapshot拒绝；
- cancellation gateway accepted/rejected/unknown、send后commit failure、restart/no-duplicate；
- worker mixed settled/reconcile/intervention aggregation；
- paused Run从GORM ready queue排除。

## 7. 验证与证据

可重复命令：

```bash
task workflow:run-control:test
CGO_ENABLED=1 go test -race ./service/internal/workflows/service ./service/internal/workflows/control ./service/internal/scheduler ./service/internal/workers/... -count=1
task test:workflow-component SCENARIO=workflow-run-control
```

原任务文本中的 `go test ./service/internal/workers` 指向无Go文件的目录，Go会以setup failed退出；验收命令已更正为真实子包通配 `./service/internal/workers/...`，并显式加入新owner package `./service/internal/workflows/control`。

Component evidence：

```text
temp/integration-test-runs/20260729033016-2249c2f9-c221-4493-91ad-b2fcaac6ec6b/
status=passed
exit_code=0
redaction=enabled
total_redactions=0
```

证据包含focused tests、race detector、`go vet`、paused queue回归与标准六件套/digest/redaction gate；无credential、raw Owner payload、private path或chain-of-thought落盘。

## 8. Local runtime transport binding

2026-08-02 已将现有 `control.Service` 接入 local durable GORM runtime 的
pause/resume/cancel 子集：HTTP、JSON-RPC、gRPC 均读取同一 run、提交同一
`CommitTransition`，再从 repository 返回完整 `RunRecord` projection。
`task test:workflow-run-control-runtime:component` 的证据为
`temp/integration-test-runs/20260801200424-991a961c-94bf-48fa-92d3-42ae5d506ea5/`，
`status=passed`、`total_redactions=0`。该 slice 只适用于 local profile；managed
Identity/delegation 仍 fail-closed，`ReconcileRun`、run events/watch、PostgreSQL
restart 与 provider/production gates 仍未绑定。

当前 adapter 回归（2026-08-02 07:00）：新增 `WorkflowControlService` 的 shared
durable GORM state 与 control observability 复核通过，`task test:workflow-run-control-runtime:component`
证据为 `temp/integration-test-runs/20260802070019-84379472-b17f-4c4f-a1a6-6db2127d2dc7/`，
`status=passed`、`duration_ms=21671`、`redaction.total_redactions=0`。该证据只刷新
local pause/resume/cancel runtime binding，不替代 managed Identity、PostgreSQL/restart、
真实 Owner reconcile、R1/R2 或 production/browser gate。

## 9. 后续边界

- `0.1b/0.1c`：注入真实resume authority与Owner cancel/status/reconcile adapter前，production capability保持needs_contract。
- `7.2`：compensation使用独立authority/approval/idempotency/receipt，不复用cancel intent推断rollback。
- `7.3`：operator force actions与kill switch不得删除cancel intent；已发送cancel继续reconcile。
- `7.4`：Eikona canary必须验证pause/resume、cancel unknown、crash before/after send与rollback drain的真实receipt证据。
