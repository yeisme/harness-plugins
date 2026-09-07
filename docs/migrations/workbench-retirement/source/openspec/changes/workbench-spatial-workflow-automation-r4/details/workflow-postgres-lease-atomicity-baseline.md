# Workflow PostgreSQL lease atomicity baseline

## 结论

Workflow lease repository 已在 disposable PostgreSQL 14 上证明两个独立数据库 pool 对同一 candidate 的原子 claim 语义。该证据关闭 4.3b2，但不替代 4.3c 的跨进程 crash、disconnect 与 clock-skew system fault matrix。

## 并发证明

- 两个 GORM/SQL pool 使用不同 PostgreSQL backend PID。
- 两个 worker 在调用 `ClaimWorkflowLease` 前通过 barrier 同步，不使用 sleep 制造假并发。
- 20 个独立 fixture 均得到一个 winner 与一个稳定 `workflow_lease: version conflict` loser。
- 每轮数据库事实均为 run version 不变、step 只推进一次、attempt/active lease 各一行，loser 的 attempt/lease ref 不存在。
- 测试由 30 秒总 deadline 约束，fixture cleanup 只删除随机 `workbench_test_` schema。

## Fencing 与恢复

- heartbeat 使用数据库时间推进 `lease_version` 与 expiry。
- expired reclaim 保留旧 lease history，写入 `expired_reclaim`，新 lease 使用更高 fence epoch。
- 旧 fence 后续 heartbeat 稳定返回 stale/released，不可重新获得写权限。
- repository 当前没有隐式 deadlock/serialization retry；正常锁竞争由行锁与 step CAS 收敛为 version conflict，其他数据库故障保持 repository unavailable。

## 证据

- `task workflow:lease:postgres:test`：exit 0。
- `CGO_ENABLED=1 go test -race ./service/internal/repository -run '^TestPostgresWorkflowLease' -count=5`：exit 0。
- 六件套：`temp/integration-test-runs/20260728081409-644e07d1-c761-4042-9163-d7158b601040/`。
- 证据目录/文件权限为 `0700`/`0600`，redaction gate 通过，无 DSN、credential 或 raw SQL 参数。
