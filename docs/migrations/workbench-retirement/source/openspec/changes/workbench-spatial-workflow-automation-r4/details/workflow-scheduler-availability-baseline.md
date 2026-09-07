# Workflow scheduler availability baseline

## 结论

R4 `5.1e` 已实现 supervisor-compatible scheduler scan engine。Engine 持续消费真实 `CandidateReader`、scheduler evaluator 与 current policy snapshot，生成 queue availability 和低基数 decision 聚合；它不创建 claim、attempt、lease 或 execution goroutine。`5.2b1` 将在此 readiness 前置条件之后接入 claimer/heartbeat。

## Lifecycle

- `Start` 先执行一次同步 bounded scan，再启动单一 ticker loop；启动失败、未启动、draining、stopped 均不得 ready。
- `Drain` 先原子撤销 readiness 并取消后续 scan；`Stop` 幂等取消 loop。
- reader 即使忽略 cancellation，Drain/Stop 也按 caller context 返回 `workflow_scheduler_engine: shutdown timeout`，不无限阻塞 supervisor。
- Engine 实现 `workers/engines.Engine`，role 固定为 `scheduler`；supervisor role probe 直接反映同一实例的 failure/recovery。

## Readiness

`CheckReady` 仅在下列事实同时成立时成功：

- engine 正在 running 且未 draining；
- 最近一次真实 repository scan 成功，并保存非零 database time；
- local monotonic freshness 未超过配置窗口；
- scan latency 未超过 hard threshold；
- bounded candidate count 未超过 hard backlog threshold；
- repository candidate、workflow contract、step registry 与 policy snapshot 均 current；
- global kill 未启用。

empty queue 是 ready。Repository/DB 错误映射为稳定 `scan unavailable`，恢复后下一次真实 scan 自动恢复 readiness。Contract drift、backlog、latency、stale 与 global policy disabled 使用独立稳定错误，不透传 provider/DSN/SQL detail。

## Degraded projection

- decision reason 只按 stable English reason 聚合计数。
- unsupported、not-claimable、executor unavailable、capability kill 与 Owner kill 不降低整个 scheduler role；只在固定 canonical `StepType -> reason` map 标记局部 degraded。
- availability snapshot 不包含 tenant/run/step/lease/Owner/capability refs、payload、credential、endpoint 或 private path。
- global contract/policy failure才使 role not-ready；tenant/definition/Owner 局部策略不误伤无关 step type。

## 验证

- `task scheduler:availability:test`：empty queue、真实 GORM scan、scan failure/recovery、freshness、latency、backlog、contract drift、unsupported/Owner local degradation、supervisor probe、drain/stop deadline 与 10 轮 race 全部通过。
- `CGO_ENABLED=1 go test -race ./service/internal/scheduler ./service/internal/workflows/repository -count=1`：R4 `5.1` 总门禁通过。
- disposable PostgreSQL 14：empty queue ready、关闭真实 pool 后 not-ready、重连恢复、drain 撤销 readiness、最终 pool idle。

## Evidence

- 最终 PostgreSQL 六件套：`temp/integration-test-runs/20260728095853-c1d3c335-31b4-412e-a4ea-7a823b8ee1a6/`。
- evidence 绑定 `0018_workflow_ready_queue_projection` 与 checksum，`status=passed`、`exit_code=0`、redaction passed。
- 日志不包含 DSN、credential、candidate refs、decision input、raw SQL 参数或 provider payload。

## 后续边界

- `5.2b1` 负责把 allow decision 接入 atomic claim、heartbeat、lease-loss cancellation 与 drain-safe release。
- `5.2b0b` 负责将 scheduler/executor/outbox/reconcile 四类真实 factory 接入 production worker 组合根。
- 当前 scan engine 不声称 claim authority，也不改变 `production_authorized=false`。
