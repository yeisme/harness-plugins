# Worker Managed Bootstrap 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `5.0b2b2b1` 已实现 managed worker bootstrap 合同：

- 只构造 `DriverPostgres + SchemaPolicyExternalMigration` database config；
- release/source/artifact/step-registry/roles registration metadata 在数据库连接前校验；
- roles digest 对 role 顺序不敏感并由 bootstrap 内部确定性计算；
- GORM store 同时作为 DB readiness、DB time、registration lifecycle repository；
- production dependency checker 与 `WithManagedLifecycle` option 在同一 assembly 中生成；
- bootstrap 中途失败会关闭已打开 store，`Close` 幂等；
- identity、delegation 或启用 role provider 缺失时 assembly 可创建但 readiness fail-closed；
- opener error 仅返回稳定 bootstrap error，不透传 DSN 或数据库 raw error。

实现位置：

```text
service/internal/workers/bootstrap/bootstrap.go
service/internal/workers/bootstrap/bootstrap_test.go
```

## 2. 验证

```bash
task worker:bootstrap:test
task test:worker-bootstrap:component
CGO_ENABLED=0 go vet ./service/internal/workers/bootstrap
```

Component evidence：

```text
temp/integration-test-runs/20260720175643-60193754-e730-4f71-a24c-450a8a85e0d5/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

最新本地 managed-boundary 聚合（2026-08-02）将 bootstrap、authority readiness、dependency checker、registration、lifecycle、engine supervisor 与 bootstrap race/vet/smoke 串成同一条组件证据路径：

```text
task test:worker-managed-boundary:component
```

聚合证据为 `temp/integration-test-runs/20260802005650-755dde2c-6e58-40e7-9ec5-fc3a7d7f92bc/`，`status=passed`、`exit_code=0`、`redaction.total_redactions=0`；其组成证据为 `temp/integration-test-runs/20260802005200-6bd57b31-eb77-4ff3-8a01-f032d5826499/`、`temp/integration-test-runs/20260802005227-be381c4c-d3af-4dd0-96e5-732b2a6952b5/`、`temp/integration-test-runs/20260802005252-225afa6a-4ad5-4225-bf04-293e4dad9b76/`、`temp/integration-test-runs/20260802005333-0a2e1919-3d17-4b04-b647-ebaf99cc8fc0/`、`temp/integration-test-runs/20260802005359-1df11f6a-4b75-4a83-9375-dfc7cd8e2cff/`，均为 `status=passed` 且 `redaction.total_redactions=0`。这些仍是本地组件边界证据；真实 PostgreSQL startup/restart/drain、R0/R1 provider handoff 与 production command 接线仍未完成。

## 3. Worker container profile 本地 smoke（2026-08-02）

新增 `task container:smoke PROFILE=worker`，先重新构建当前 dirty source 的
`dist/release`，再用 Docker `worker` target 执行边界 smoke。运行约束为
non-root image user、`read-only` root filesystem、`cap-drop=ALL`、
`no-new-privileges`、`network=none` 与显式只读 registry mounts；缺少可用
PostgreSQL 时要求 worker 在监听前返回稳定 `bootstrap_failed`，stdout 为空，
stderr 不含 DSN placeholder、registry private path 或 raw error。

脱敏 component evidence：

```text
task test:container-smoke:component
temp/integration-test-runs/20260802150605-7d4d609a-ebbf-45d4-98cf-aaa671315bc3/
status=passed
duration_ms=16481
redaction.total_redactions=0
```

该证据只闭合当前 worker image 的本地装配、非 root/read-only 与 fail-closed
启动边界；仍不证明 PostgreSQL ready、独立 outbox/reconcile worker、真实
SIGTERM drain/restart、Identity/R1、Owner/R2 或 production candidate。

## 4. 未完成边界

该 assembly 尚未接入 `service/cmd/workbench-worker`，也未执行真实 PostgreSQL startup/restart/drain。原因不是保留 demo 路径，而是 command 仍缺 R0 canonical registry metadata source 与 R1 workload identity/delegation provider。

后续 `5.0b2b2b2` 必须：

- 从批准的 release manifest/config service 读取 metadata，禁止手写或仅靠任意 env digest；
- 注入 R0/R1 provider 和 role probes；
- command shutdown 顺序为 runtime drain → lifecycle shutdown receipt → DB pool close；
- 用真实 PostgreSQL 验证 schema ahead/behind、checksum mismatch、disconnect/reconnect、restart 与 SIGTERM；
- 保持 W0 claim-disabled smoke 作为 process contract test，但生产 candidate 必须走 managed bootstrap。
