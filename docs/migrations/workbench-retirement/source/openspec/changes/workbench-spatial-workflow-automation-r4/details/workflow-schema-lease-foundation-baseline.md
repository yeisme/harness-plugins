# Workflow Schema 与 Lease Foundation 实施基线

## 1. 完成范围

截至 2026-07-20，R4 已完成：

- `4.1a` additive workflow GORM schema `0004_workflow_runtime_foundation`；
- `4.3a` lease/fencing deterministic domain与数据库时间权威；
- fresh SQLite migration、`0003_layout_v3_foundation`→`0004` additive upgrade、migration history和checksum readiness；
- managed/external migration打开数据库时不创建workflow schema；
- workflow表、关键composite unique/index与敏感列禁入测试；
- `task workflow:schema:test`和`task test:workflow-schema:component`。

当前未实现PostgreSQL原子claim、heartbeat CAS、expiry/reclaim或任何scheduler/dispatch；这些能力仍由`4.1b`、`4.3b-4.3c`阻断。

## 2. Schema

本基线实现时的schema metadata（历史切片，不代表当前repository tip）：

```text
version=0004_workflow_runtime_foundation
checksum=sha256:e2939da3bd2ba3c5bcb6932cbf32a17be11068e8b09bcebd096e7e81a74fead5
```

截至 2026-07-21，repository tip 已前进到`0015_task_idempotency_scope_v2`。真实PostgreSQL migration parity先由`4.1b`认证`0001..0015` catalog，ready queue projection使用后续`0016_workflow_ready_queue_projection`；详见`details/workflow-postgres-migration-queue-handoff-plan.md`。

新增表：

```text
workflow_definitions
workflow_definition_versions
workflow_steps
workflow_edges
workflow_runs
workflow_step_runs
workflow_attempts
workflow_leases
workflow_worker_instances
workflow_gates
workflow_receipts
workflow_events
workflow_outbox
workflow_dead_letters
workflow_interventions
workflow_cursors
```

Schema只保存typed state、safe refs、digest、version、status、DB timestamp、receipt/evidence ref和bounded counters；禁止prompt、raw payload、credential、secret、private path、artifact blob、content/body字段。Fencing持久化列使用`fence_epoch`，避免与credential token语义混淆。

## 3. Lease不变量

Lease domain要求：

- lease、tenant、run、step-run、attempt和worker均为opaque safe ref；
- `fence_epoch`、lease version、expected run/step version均非零；
- claimed、heartbeat、expiry、released时间均来自DB-time语义，且顺序严格；
- released lease不可继续write；
- worker、epoch、lease/run/step version任一不匹配均返回`ErrStaleFence`；
- expiry判断接收明确database timestamp，不读取worker wall clock。

## 4. DB-time SQL例外

GORM没有跨SQLite/PostgreSQL获取数据库当前时间的typed builder。`GORMStore.DatabaseTime`只在repository内部执行固定语句：

```sql
SELECT CURRENT_TIMESTAMP AS current_time
```

该语句无参数、无identifier拼接、无用户输入，只用于数据库时间权威；返回值按SQLite/PostgreSQL常见格式解析并统一为UTC。该例外不授权`4.3b`直接手写claim SQL。

## 5. 验证与证据

通过命令：

```bash
task workflow:schema:test
task test:workflow-schema:component
CGO_ENABLED=1 go test -race ./service/internal/repository ./service/internal/workflows/domain -count=1
openspec validate workbench-spatial-workflow-automation-r4 --strict
```

Component evidence：

```text
temp/integration-test-runs/20260720172429-5c8d0150-9155-4bb2-a762-d04c12cc44a3/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

## 6. 下一阻塞

1. `4.1b1-4.1b5`：真实PostgreSQL immutable catalog、fresh/approved upgrade/interrupted/checksum/schema ahead/behind/pool evidence。
2. `4.3b2`：真实PostgreSQL two-worker atomic claim、heartbeat CAS与reclaim证明；本地`4.3b1`见`workflow-lease-repository-baseline.md`。
3. `4.3c`：两个worker、crash、clock skew、DB disconnect与late commit fault matrix。
4. `5.0b2`：使用`CheckReady`、`DatabaseTime`、registry/identity和worker registration形成真实readiness。

R5 `3.4b2b`继续blocked，当前schema与lease domain不能替代真实worker candidate。
