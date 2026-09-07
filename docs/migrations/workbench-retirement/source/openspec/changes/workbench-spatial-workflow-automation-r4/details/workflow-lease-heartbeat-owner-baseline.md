# Workflow lease heartbeat owner baseline

## 结论

R4 `5.2b1b` 已实现 per-lease heartbeat owner 与 lease-loss cancellation。Claim winner 的 `LeaseHandle` 现在持有 lease-scoped context、原子 lease snapshot、current fence、capacity reservation 和跨 owner 唯一 heartbeat token；executor 后续只能消费 context 与 `FenceForCommit`，不拥有 heartbeat goroutine。

## Lease handle

- `CurrentLease` 和 `CurrentFence` 通过读写锁返回一致 snapshot；heartbeat 成功只允许同 lease/tenant/run/step/attempt/worker/fence epoch/expected versions，并要求 lease version严格加一。
- `FenceForCommit` 在 lease context 已取消时返回稳定 cause；未取消时返回最新 fence。DB transaction 仍执行最终 fencing CAS，消除读取后再次失租的竞态。
- `ReleaseCapacity`、heartbeat loss 与 heartbeat Stop 共享幂等 release path，取消 context 并归还 global/tenant/Owner reservation。
- handle 上的 heartbeat token 保证即使创建两个 `HeartbeatOwner` 实例，同一 lease 也只能启动一个 heartbeat goroutine。

## Heartbeat owner

- config 强制 interval、request timeout、lease duration 和连续失败上限均为 bounded 值；request timeout 不得超过 interval，interval 必须小于 lease duration。
- 每轮使用当前 fence发起 `HeartbeatWorkflowLease`；成功后原子替换 lease snapshot并清零连续失败计数。
- stale fence、released、expired、not found 或 version conflict 立即以 `ErrLeaseLost` 取消 lease context。
- repository unavailable/其他失败达到配置阈值后以 `ErrHeartbeatUnavailable` 取消；循环串行执行，不重叠 heartbeat RPC。
- `Stop` 取消 heartbeat timer/context、等待 goroutine 退出，并保证返回后不再发起 heartbeat；caller timeout映射为稳定 shutdown timeout。

## Capacity 与 late result

- 每个 handle 在 claim 前已持有 capacity reservation，因此 active heartbeat 数不可能超过已验证的 global concurrency；duplicate owner token进一步保证“一 lease 一 heartbeat”。
- loss 会立即释放 reservation，防止 dead worker占用本地并发预算。
- real PostgreSQL fault matrix 证明 context loss 后旧 fence heartbeat和 terminal transition均被拒绝，step/event/outbox/dispatch保持零 late side effect。

## 验证

- controlled timer tests：success version推进、latest fence、immediate stale loss、三次 repository failure阈值、同 owner/跨 owner重复启动、Stop 前零 tick与 Stop 后零 heartbeat。
- `task worker:heartbeat:test`：focused tests、30 轮 race 与 `go vet` 通过。
- PostgreSQL system evidence：`temp/integration-test-runs/20260728103603-e27484dd-a5b2-40f0-a494-821e8a4b8d82/`。

## 后续边界

- `5.2b1c` 负责区分 dispatch intent 前 safe release 与 maybe-sent unknown/reconcile handoff。
- `5.2b1d` 负责 production scheduler factory、真实 role probe 和完整 W2 process matrix。
- 当前 heartbeat owner 不执行 executor业务，不授予 mutation authority。
