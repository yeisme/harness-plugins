# Workflow reconcile core 基线

## 1. 结论

截至 2026-07-29，R4 `6.2` 已实现纯 `service/internal/workflows/reconcile` 核心。该核心消费 durable unknown handoff projection，通过同一 Owner、operation、Task、receipt、idempotency 与 contract identity执行只读 receipt/event/status lookup，收敛 accepted、rejected、terminal或继续 unknown；它不暴露 mutation dispatch接口，不注册 worker role，也不拥有 production bootstrap。

`5.2b4` 只需为 `Queue` 与 `Lookup` 提供 production adapter，并将 `Run` 包装成统一 engine lifecycle。当前任务不提前接入 worker command、role registry或Owner production connector，避免形成 `6.2 -> 5.2b4 -> 6.2` 循环依赖。

## 2. 查询与收敛顺序

每个 due handoff 固定执行：

```text
durable handoff
  -> receipt lookup
  -> event lookup after durable cursor
  -> status lookup after event window
  -> converge or durable checkpoint/dead-letter
```

- 所有 lookup请求保持原 `ReceiptRef`、`IdempotencyRef`、`OperationRef`、`TaskRef` 与 `ContractRef`；没有生成新 attempt或新 mutation key。
- receipt、event、status任一 observation的identity漂移都进入 `needs_contract`，不得采用不同 receipt或contract的terminal结果。
- event window之后再读 status，关闭“event catch-up完成后Owner刚好terminal”的response race；本轮仍未观察到terminal时只checkpoint，下一轮继续同一cursor之后的查询。
- 多个来源观察到冲突terminal truth时进入 `needs_operator`，不选择一个结果伪造成功或失败。
- accepted/running收敛为 `accepted`，由后续 workflow adapter决定合法 step transition；succeeded/rejected/failed/cancelled只在matched canonical truth出现时收敛。

## 3. Durable cursor、退避与deadline

`Queue` 合同持久化 handoff version、attempt count、event cursor、`NextAttemptAt`与deadline：

- unknown、Owner outage、timeout或未找到receipt只增加 bounded reconcile attempt并写 durable checkpoint；重启后的新 Service从已保存cursor和due time继续。
- backoff从 `InitialBackoff` 指数增长并硬限制于 `MaxBackoff`；`MaxAttempts`与handoff deadline任一先到即进入 `needs_operator` dead-letter。
- due time之前重复调用 `RunOnce`不会再次访问Owner，避免poll storm。
- cursor expiry进入 `needs_operator`，不得从空cursor重放或补造Owner event。
- tombstoned receipt进入 `needs_operator`；contract mismatch进入 `needs_contract`。

## 4. Per-Owner 并发与生命周期边界

- `BatchSize`限制单轮读取规模，`PerOwnerConcurrency`为每个Owner建立独立并发上限；一个Owner的队列不会占用其他Owner的并发配额。
- 每个handoff lookup受 `QueryTimeout`限制，Service loop使用显式poll interval，不包含tight loop或无界递归。
- `Run`在context取消时干净退出；`RunOnce`可由未来 reconcile engine控制启动、drain与readiness。
- core不依赖 worker supervisor、role config、bootstrap或production registry，且不启动脱离调用方生命周期的goroutine。

## 5. 故障矩阵

测试覆盖：

- `unknown_accept`保持unknown并写cursor/backoff checkpoint，零mutation replay；
- accepted/rejected/terminal canonical truth收敛；
- Service重启后从durable cursor继续；
- Owner outage按1s/2s bounded backoff推进并在attempt上限dead-letter，due前零额外lookup；
- receipt tombstone、contract mismatch、cursor expiry与冲突terminal truth分别进入operator/contract安全路径；
- event-response race由event后status query观察terminal；
- 同Owner并发不超过配置上限，不同Owner可并行；
- deadline到期时零Owner lookup并直接进入operator dead-letter；
- loop cancellation无goroutine hang。

## 6. 验证与证据

可重复命令：

```bash
task workflow:reconcile-core:test
task test:workflow-component SCENARIO=workflow-reconcile-core
```

Component evidence：

```text
temp/integration-test-runs/20260729024645-34449d88-8d31-483b-a527-0f88b710bec9/
status=passed
exit_code=0
redaction=enabled
total_redactions=0
```

证据包含 pure-Go unit、race detector与`go vet`；六件套、digest与redaction gate完整，未写入Owner payload、credential、private path、raw prompt或provider response。

## 7. 后续边界

- `5.2b4`：实现 production Queue/Lookup adapter、engine readiness/drain与bootstrap factory，不改变本核心的same-identity/no-replay语义。
- `6.3a`：消费Task/Gate/event等待合同，并在approval/revoke后重验authority；不得让wait goroutine长期占用execution lease。
- operator typed intervention、dead-letter list/requeue与生产runbook仍归`7.2`，不得用普通UI或数据库手改绕过。
