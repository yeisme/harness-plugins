# Workflow lease fault system baseline

## 结论

R4 `4.3c` 已完成 real PostgreSQL lease fault system matrix。测试使用独立 worker test process、真实 PostgreSQL schema、真实 GORM repository 和可主动断开的本地 TCP-to-Unix-socket fault proxy，覆盖 worker clock skew、heartbeat loss、连接中断、进程 crash、DB-time expiry/reclaim、restart 与 old worker late write。SQLite、mock repository、直接修改 expiry 列和 parent context cancel 均未代签。

## Process 与 fault boundary

- 每个 worker 由当前 Go test binary 作为独立 OS process 启动，通过环境变量接收 isolated schema DSN 和安全 fixture facts；DSN 不进入 argv、stdout 或 evidence。
- worker 使用生产 `RandomIDSource`、capacity limiter、claimer `Processor` 和 `HeartbeatOwner`，不是 test-only heartbeat loop。
- fault proxy 接受 worker TCP connection，并转发到本机 PostgreSQL Unix socket；关闭 proxy 会同时关闭 listener 和所有活动连接，后续 heartbeat 只能得到真实 connection failure。
- crash scenario 使用 OS process kill，不调用 `Stop` 或主动取消 worker context。
- restart scenario 启动第二个独立 worker process，不在原进程内重建对象。

## Clock 与 expiry

- 两个场景分别给 worker 本地时间增加 `+24h` 和 `-24h`；claim/heartbeat request 不携带该时间。
- 测试断言 worker local timestamp 与 PostgreSQL `claimed_at_db` 至少相差 23 小时，但 active lease 仍拒绝竞争 claim。
- crash 或 heartbeat loss 后不修改 `expires_at_db`；测试持续读取真实 `DatabaseTime`，只有 DB time 达到 lease expiry 后才允许新 claim。
- reclaim 保留旧 lease row并写入 `expired_reclaim`，新 lease fence epoch 必须严格增加。

## Disconnect、loss 与 restart

- worker heartbeat request timeout 为 30ms，heartbeat interval 为 40ms，连续 repository failure 上限为 3。
- fault proxy 关闭后，旧 worker process 由生产 heartbeat owner 在连续失败阈值达到时以 `heartbeat_unavailable` 取消 lease-scoped context并退出。
- restart worker 只能在 DB-time expiry 后 claim；测试最终断言同一 run 只有一个未 release lease，旧 lease 已标记 `expired_reclaim`。
- test process receipt 由 worker 原子写入临时文件，仅包含 status、cause、worker timestamp 和低敏 fence/version摘要；不包含 DSN、tenant/run/step/lease refs、payload 或 raw SQL 参数。

## Late write fencing

每次 reclaim 后均重放旧 worker 的两类 late write：

- old fence heartbeat 必须返回 stale/released；
- old fence terminal `CommitWorkflowTransition` 必须返回 `workflow_workflow_repository: stale fence` 对应的稳定 fence error，并保持 step status/version 不变。

因此旧 worker result 不会创建 terminal state、event、outbox 或 Owner dispatch intent。

## 验证与证据

- `task workflow:lease-faults:postgres:test`：real-process matrix 连续 5 次通过，并以 race detector 连续 3 次覆盖 repository、proxy、heartbeat owner 与 helper process。
- `task worker:heartbeat:test`：heartbeat controlled-timer unit、30 轮 race 与 `go vet` 通过。
- System evidence：`temp/integration-test-runs/20260728103603-e27484dd-a5b2-40f0-a494-821e8a4b8d82/`。
- Evidence `layer=system`、`status=passed`、`exit_code=0`、`total_redactions=0`；正式命令为 `task workflow:lease-faults:postgres:test`。
- evidence runner 在失败时仍保留六件套并传播原 exit code；本次成功日志只包含 scenario 名称、pass 状态和 package timing。

## Handoff

- `5.2b1b` 可直接消费本矩阵已证明的错误分类：stale/released/expired/not-found 为立即 lease loss，连续 repository unavailable 为 bounded heartbeat loss。
- `5.2b1d` 可复用 independent process、fault proxy、DB-time wait、restart 和 late-fence assertion，扩展 scheduler factory/readiness/fairness/backpressure 矩阵。
- 本证据不授权 production claim，不改变 `production_authorized=false`。
