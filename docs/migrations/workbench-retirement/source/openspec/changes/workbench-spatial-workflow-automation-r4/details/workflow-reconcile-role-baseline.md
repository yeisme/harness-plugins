# Workflow reconcile role loop 基线

## 1. 结论

截至 2026-07-29，R4 `5.2b4` 已将 `6.2` 的 reconcile core包装为符合通用 `workers/engines.Engine` 合同的 `reconcile.Engine`。该 role拥有独立 `Start/CheckReady/Drain/Stop` 生命周期、bounded poll/backoff、backlog/lag/cursor/dead-letter readiness snapshot，并保持 core 的same receipt/idempotency、unknown不redispatch与per-Owner并发边界。

本任务不接入 `workbench-worker` production组合根。`5.2b0b` 负责从冻结配置构造真实 `Queue`、`Lookup`、`StatusReader`与该 Engine，并交由统一 supervisor启动；未选择reconcile role时不得创建该loop。

## 2. Engine 生命周期

- `Role()`固定返回`reconcile`，并以编译期断言满足通用`workers/engines.Engine`接口。
- `Start`先同步执行一次真实 reconcile cycle与status probe；startup context超时会取消in-flight cycle、关闭done channel并保持not-ready。
- 后台loop只由一个受控context拥有，每轮结束后使用`PollInterval`或失败时bounded exponential backoff调度下一轮。
- `Drain`先把state改为draining使readiness立即撤销，再取消当前cycle并等待done；重复Drain/Stop幂等，不启动新cycle。
- `Stop`只在drain完成后进入stopped；没有脱离supervisor生命周期的goroutine。

## 3. Backlog、lag与cursor readiness

production adapter必须通过`WorkflowReconcileStatus`提供：

- 数据库当前时间；
- pending reconcile backlog；
- oldest pending time与lag；
- durable reconcile cursor sequence；
- dead-letter总数与cursor更新时间。

Engine snapshot只记录聚合指标，不记录tenant/run/step/receipt/idempotency safe refs：

```text
ready / reason
backlog / lag
cursor_sequence / dead_letters
cycles / consecutive_failures
last_cycle_at / last_success_at / current_backoff
```

`PendingCount > MaxBacklog`、`Lag > MaxLag`、status invalid/unavailable或success freshness过期均fail closed。Owner response loss/outage仍由core写durable checkpoint，Engine不会创建mutation；持续outage最终通过backlog/lag或dead-letter指标暴露，而不会丢弃handoff。

## 4. 故障与恢复矩阵

role与core联合测试覆盖：

- healthy startup、cursor/dead-letter snapshot与reconcile role identity；
- backlog、lag与freshness失效；
- cycle outage触发bounded backoff，恢复后backoff与consecutive failures归零；
- in-flight cycle在drain时被context取消，drain后零新增cycle；
- restart使用相同durable backlog source重新执行，不清空pending truth；
- startup timeout保持not-ready；
- `6.2` response loss、unknown_accept、Owner outage、restart、tombstone、cursor expiry、event-response race与dead-letter矩阵继续在同一gate执行。

## 5. 角色隔离边界

- reconcile Engine只返回本role readiness，不调用scheduler、executor或outbox生命周期。
- 一个Owner outage由core的per-Owner semaphore与durable checkpoint隔离，不改变其他Owner identity或创建全局mutation retry。
- 通用 supervisor可独立观察reconcile probe；是否将该role degraded映射为process readiness由`5.2b0b`与dependency checker决定，core/role不得自行注册worker或监听端口。

## 6. 验证与证据

可重复命令：

```bash
task workflow:reconcile-role:test
task test:workflow-component SCENARIO=worker-reconcile-role
```

Component evidence：

```text
temp/integration-test-runs/20260729025322-e6243e53-17aa-4a87-96fb-b1fb4d02546c/
status=passed
exit_code=0
redaction=enabled
total_redactions=0
```

证据包含pure-Go tests、race detector、`go vet`与完整六件套/digest/redaction gate。输出只有包测试摘要，不含Owner payload、receipt identity、credential、endpoint、private path或provider error。

## 7. 后续边界

- `5.2b0b`：构造真实GORM-backed queue/status与Task/Owner lookup adapter，按selected roles接入production supervisor和dependency checker。
- `5.2b`：在scheduler/executor/outbox/reconcile四个真实engine factory均接入后才能关闭父任务。
- `7.2`：实现operator dead-letter list/requeue/force-fail typed command；当前role只产出安全聚合与dead-letter target，不提供数据库手改捷径。
