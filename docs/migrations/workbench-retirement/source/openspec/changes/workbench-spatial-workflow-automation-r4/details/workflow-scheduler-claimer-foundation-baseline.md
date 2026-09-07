# Workflow scheduler claimer foundation baseline

## 结论

R4 `5.2b1a` 已完成 scheduler engine 到 atomic lease claim 的 bounded foundation。实现复用 `5.1c` 的真实 ready queue、`5.1d` 的 evaluator/capacity limiter、`5.1e` 的 supervisor-compatible engine 和 `4.3b1` 的 `ClaimWorkflowLease`，只把明确 `allow` 的 candidate 转换为 claim request，并将 winner 交付为 lease-scoped handle。当前切片不启动 executor、heartbeat 或 Owner mutation。

## 单循环与退避

- `Engine.Start` 先同步执行一次 bounded scan，再由一个受 supervisor 生命周期约束的 loop 串行执行后续 scan；processor 最大并发为一，不创建并行 retry goroutine。
- scan timer 和 jitter 可在测试中注入。生产 jitter 为 `[delay, delay + 10%]` 的上界抖动，并始终被 `MaxBackoff` 截断。
- repository/claim unavailable 使用指数退避，达到上界后不再增长；任一成功轮次将基础间隔重置为 `ScanInterval`。
- controlled timer 单元测试直接推进失败与恢复，不依赖 `time.Sleep` 猜测 backoff；纯函数测试覆盖 backoff 和 jitter 的最小值、增长、重置与最大边界。
- `Drain` 先撤销 scheduler readiness 并取消 loop，后续不再扫描或创建 claim；caller deadline 继续由 engine lifecycle 合同约束。

## Pre-claim gates

每个 candidate 按固定顺序执行下列门禁：

1. scheduler decision 必须为 `allow/claim_allowed/executor`，无效 candidate 或 unsupported/mutation decision 直接 `rejected`；
2. claim authority 必须批准；生产默认提供的 `DisabledAuthority` 永远拒绝，未提供 unrestricted production authority；
3. global、tenant、Owner capacity 必须在 repository call 前成功预留；失败或 queue 已满时零 claim；
4. lease/attempt ref 由 `IDSource` 生成并通过 safe-ref 校验；生产 `RandomIDSource` 使用随机 UUID，拒绝未知 kind，不拼接 tenant/run/step/user ref；
5. 仅在上述事实全部成立后调用一次 `ClaimWorkflowLease`。

任何门禁失败均不创建 attempt、lease 或 running step。Claim 失败和无效返回都会幂等归还 capacity；成功 handle 只有在 consumer 明确 `ReleaseCapacity` 后归还 reservation 并取消 lease-scoped context。

## Atomic mapping 与竞争分类

- `Decision` 到 `ClaimRequest` 的映射固定携带 tenant/run/step、expected run/step version、next attempt sequence、executor attempt kind、worker ref 和 validated lease duration。
- `ErrLeaseUnavailable` 与 `ErrVersionConflict` 归类为正常 `contended`，同一 stale candidate 不重试。
- `ErrRepositoryUnavailable` 只返回稳定 `workflow_claimer: unavailable`，不透传 DSN、SQL 或 provider detail，并通知 engine 进入 bounded backoff。
- 其他拒绝或返回 lease shape 与 request 不一致时 fail closed，不交付 handle。
- `LoopProcessor` 在 claim 前检查 bounded handle queue 空间；单一 producer 合同确保 queue full 时零新 claim，避免 claim 成功后才发现本地无消费容量。

## 真实状态验证

SQLite/GORM integration 使用真实 workflow schema、ready projection、scheduler evaluator、capacity limiter、claimer、handle queue 和 engine：

- ready step 被一次真实 scan 消费；
- repository 原子提交一个 attempt 和一个 lease；
- step 从 `ready` 转为 `running`，version 从 `3` 增至 `4`；
- lease handle 对应同一 step/lease；
- `Drain` 后等待多个 scan interval，attempt count 仍为一；
- 最后显式释放 handle capacity 并停止 engine。

该验证不是仅检查 mock call count；它断言真实 GORM 持久化状态与输出 handle。PostgreSQL two-worker、heartbeat、reclaim、late-commit 和 process signal 矩阵分别属于 `5.2b1b`、`5.2b1c`、`5.2b1d`，本切片不提前声称完成。

## 验证与证据

- `task worker:claimer:test`：聚焦 unit/integration、10 轮 race 和 `go vet` 全部通过。
- 覆盖 authority/capacity/queue/decision gate 零 claim、safe random ID、exact request mapping、正常竞争不重试、repository outage、bounded batch、controlled timer backoff/recovery、critical gate 跳过 processor、真实 GORM atomic state 和 drain 后零新 attempt。
- 六件套证据：`temp/integration-test-runs/20260728101800-8d161c79-f158-443a-b1b4-23a70d05a54a/`。
- Evidence `status=passed`、`exit_code=0`、`layer=component`、`total_redactions=0`，命令为 `task worker:claimer:test`。

## 安全边界

- claim authority 默认关闭；本切片不授予 production claim authority，也不改变 `production_authorized=false`。
- claimer 只交付 lease-scoped handle，不执行 descriptor、Owner API、terminal commit、heartbeat 或 reconcile。
- snapshot 只保留低基数 outcome count，不记录 candidate/tenant/run/step/lease refs。
- `5.2b1` 已在 heartbeat、drain-safe release/unknown handoff、production factory 和 disposable PostgreSQL W2 system matrix 全部完成后关闭；完整结论见 `workflow-scheduler-factory-w2-baseline.md`。
