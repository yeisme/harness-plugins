# Worker Production Dependency Checker 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `5.0b2b2a` 已实现纯 Go production dependency checker：

- PostgreSQL schema readiness 与 DB-time availability 分离判断；
- operation registry 与 typed step registry expected/observed digest equality；
- service identity 与 delegation authority required probes；
- scheduler、executor、outbox、reconcile 按启用 role 选择 required probe；
- Owner capability optional probe，只产生 capability-scoped degraded；
- nil probe、unknown role、duplicate component、unsafe version/reason/digest fail-closed；
- 外部 raw error 只映射为稳定 safe reason，不进入 readiness payload；
- checker 不连接真实外部依赖，不提供静态 production success fallback。

实现位置：

```text
service/internal/workers/dependencies/checker.go
service/internal/workers/dependencies/checker_test.go
```

## 2. 已冻结 reason

Required dependency reason：

```text
database_unavailable
database_time_unavailable
operation_registry_unavailable
operation_registry_mismatch
step_registry_unavailable
step_registry_mismatch
service_identity_unavailable
delegation_unavailable
queue_unavailable
executor_unavailable
outbox_unavailable
reconcile_unavailable
```

Owner capability 使用调用方提供的 safe typed reason，例如 `owner_unavailable`；checker 不透传 URL、DSN、token、SQL error 或 provider payload。

## 3. 验证

```bash
task worker:production-dependencies:test
task test:worker-production-dependencies:component
CGO_ENABLED=0 go vet ./service/internal/workers/dependencies
openspec validate workbench-spatial-workflow-automation-r4 --strict
```

Component evidence：

```text
temp/integration-test-runs/20260720175134-e777714d-4e2f-457f-8612-078f88fc0127/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

## 4. 未完成边界

本基线不代表 worker production-ready。后续仍必须完成：

- `5.0b2b2b` managed PostgreSQL 与 registration metadata 命令装配；
- `5.0b2b2c1` 已交付 canonical operation snapshot；`5.0b2b2c2` 仍需 canonical step snapshot 与 release binding；
- `5.0b2b2d` R1 workload identity 与 delegation provider；
- `5.0b2b2e` queue/outbox/reconcile repository probes 与真实恢复矩阵；
- `4.1b`、`4.3b2`、`4.3c` 真实 PostgreSQL evidence。

在这些条件完成前，worker 继续 claim-disabled，R5 不得纳入 production artifact set。
