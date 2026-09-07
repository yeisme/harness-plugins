# Workflow Lease Repository 实施基线

## 1. 当前完成范围

截至 2026-07-20，R4 `4.3b1`已实现：

- run与step expected-version检查；
- DB-time claim、heartbeat、expiry、reclaim与release；
- attempt、step CAS与lease在同一GORM transaction写入；
- active lease拒绝、expired lease保留history并写`expired_reclaim`；
- monotonic `fence_epoch`、lease version、worker/run/step fence检查；
- heartbeat与release使用完整CAS条件；
- duplicate attempt或持久化冲突时rollback attempt/step/lease；
- released lease不可heartbeat，step/run version变化返回stale fence；
- attempt kind仅允许`executor`或`reconcile`；
- SQLite并发屏障压力确保不会产生两个winner或loser残留行。

当前实现不声称已经证明PostgreSQL row-lock语义。`4.3b2`和`4.3c`仍需真实PostgreSQL evidence。

## 2. Transaction顺序

```text
DB time
  -> lock/check run expected version + running
  -> lock/check step expected version + attempt sequence
  -> inspect latest lease by fence epoch
  -> reject active lease or mark expired history released
  -> validate step state
  -> create attempt
  -> CAS step ready/running -> running + version increment
  -> create new lease with next fence epoch
  -> commit
```

任一步失败均rollback。Claim不接收worker wall clock，不删除lease history，不生成Owner mutation或dispatch intent。

## 3. Heartbeat与release

Heartbeat：

- lock lease；
- 验证tenant、worker、lease ref、fence epoch、lease version；
- 使用DB time判断expiry；
- 验证run/step仍为lease记录的expected version；
- CAS更新heartbeat、expiry和lease version。

Release：

- 只允许`drain`、`claim_abandoned`和内部`expired_reclaim` reason；
- 使用与heartbeat相同的fence/version检查；
- 写`released_at_db`与reason，不删除lease/attempt history；
- 对pre-dispatch安全release，在同一transaction将对应`running` step CAS回`ready`、version加一并写DB-time ready projection，使restart可立即重新claim；若step CAS失败，lease release一并rollback。

## 4. SQLite并发证据边界

本地测试使用shared-memory SQLite、多个连接和并发barrier，重复20次验证：

- success恰好一个；
- 另一方只能返回lease unavailable、version conflict或repository unavailable；
- lease总数和attempt总数均为1；
- race detector无数据竞争。

该证据只证明应用transaction不会接受双winner，不替代PostgreSQL `FOR UPDATE`/row-lock、deadlock、disconnect与真实并发语义。

## 5. 验证命令

```bash
task workflow:lease:test
task test:workflow-lease:component
CGO_ENABLED=0 go test -p 1 ./service/cmd/... ./service/internal/... -count=1
openspec validate workbench-spatial-workflow-automation-r4 --strict
```

Component evidence：

```text
temp/integration-test-runs/20260720172431-5a3cab48-0bc3-4661-9425-71f77aad1867/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

## 6. PostgreSQL阻塞

当前环境：

```text
WORKBENCH_TEST_POSTGRES_URL=not_configured
postgres=missing
initdb=missing
pg_ctl=missing
docker=missing
podman=missing
psql=available
```

因此不得关闭：

- `4.1b` real PostgreSQL migration/readiness parity；
- `4.3b2` two-worker atomic claim；
- `4.3c` crash/clock/DB-disconnect fault matrix。

后续可由外部测试DSN、CI service container或批准的PostgreSQL runner提供证据；不得用SQLite结果代签。
