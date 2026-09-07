# Workflow typed executor pool 基线

## 结论

R4 `5.2b2` 已实现 bounded typed executor worker pool 与 fence-bound completion handoff。该 pool 是真实 `executor` role engine：消费 lease-scoped handle，通过独立 `ExecutionSource` 加载 typed `executors.Request`，复用 `Framework` 执行 canonical descriptor，最终只向 `CompletionHandoff` 交付 current fence 与 `domain.ExecutionCommand`。它不依赖 terminal repository、不直接更新 run/step/attempt，也不调用 Owner mutation。

## 输入与所有权

- `LeaseExecution` 只暴露 lease context、current candidate、current lease 与 `FenceForCommit()`；`claimer.LeaseHandle` 以 additive 方法实现该合同。
- `ExecutionSource` 是 workflow service command boundary 的读取侧接口。pool 只传 candidate/lease typed facts，不传 environment、credential、endpoint 或任意 repository handle。
- source 返回的 request 必须与 lease 的 tenant/run/step-run/attempt 和 candidate step type完全一致；drift、空 timeout或已丢失 lease均在 framework执行前拒绝。
- 每个 lease ref在 queue/active期间只能出现一次，避免同 attempt共享可变执行状态。

## Bounded pool

- worker count与 queue size在构造时硬校验；worker count不超过 worker全局并发上限，queue size不超过 bounded scan上限。
- `Submit` 使用 bounded buffered queue；满载返回稳定 `backpressure`，不阻塞 scheduler goroutine，不创建额外 goroutine。
- `inFlight` map覆盖 queued与active lease，duplicate返回稳定 `duplicate lease`。
- `PoolSnapshot` 仅暴露 running/draining、worker/pending数量与 completed/failed聚合，不记录 tenant/run/step/lease refs。
- `Pool` 实现 `workerengines.Engine` 的 `Role/Start/CheckReady/Drain/Stop`合同，role固定为`executor`。

## 执行与 fence handoff

```text
LeaseExecution
  -> ExecutionSource.LoadExecution
  -> Framework.Execute(typed descriptor + bounded timeout)
  -> LeaseExecution.FenceForCommit
  -> CompletionHandoff.AcceptExecutionCommand
```

- framework继续负责 strict JSON、canonical registry/schema/digest、timeout ceiling、checkpoint、panic isolation与typed output编码。
- pool在每次执行外再设置 request timeout，并捕获 source/framework/handoff panic，单次panic不会杀死worker goroutine或supervisor。
- framework返回后重新读取 current fence；completion包含 tenant/run/step/attempt refs、完整 fence和 domain command。
- handoff之后的 central completion boundary必须再次以DB truth验证fence并完成transaction；pool本身没有 terminal commit能力。
- heartbeat在执行期间更新 lease version时，handoff使用最新可见 fence；若 lease context已取消或 `FenceForCommit`失败，结果直接丢弃且零handoff。

## Drain、timeout 与 restart

- `Drain`先原子拒绝新 submit并取消pool context，再调用 framework drain取消active typed execution；queued work只做本地清理，不执行、不handoff。
- lost/stale lease、timeout、executor error、panic、source error、invalid request、invalid command与handoff failure均计入failed聚合，绝不伪造 terminal state。
- `Stop`等待全部worker和pending item退出；重复 Drain/Stop幂等。
- checkpoint/restart由 durable `ExecutionSource`在新pool实例加载 checkpoint ref/version；pool不在内存中伪造恢复状态。

## 验证与证据

- `task test:workflow-component SCENARIO=worker-executor-pool`
- 覆盖 bounded concurrency、queue backpressure、duplicate lease、真实 typed framework dispatch、current fence handoff、lease loss、timeout、panic、drain、post-drain reject、checkpoint restart与 claimer handle合同。
- Component evidence：`temp/integration-test-runs/20260728113300-a4d8d359-d2f2-4581-a59a-1ba44a554110/`
- Evidence `status=passed`、`exit_code=0`、redaction enabled、`total_redactions=0`；20轮 race与`go vet`通过。

## 后续边界

- `5.2b0b` 负责将 scheduler handle flow、executor pool及其他role factory接入 production worker组合根；本任务不提前开启混合role claim。
- `5.3`/后续 workflow service负责实现真实 `ExecutionSource`和 fence-bound `CompletionHandoff`；不得把 terminal repository写入pool。
- `6.1a/b` 才能增加 durable dispatch intent与 allowlisted mutation executor；当前 safe local executors仍限定 no-side-effect step。
