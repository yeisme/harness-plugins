# Workflow PostgreSQL migration parity baseline

## 结论

Workbench migration engine 已在 disposable PostgreSQL 14 上完成 current `0018_workflow_ready_queue_projection` 的真实数据库签署。SQLite 只保留本地单元覆盖，不参与本次 PostgreSQL promotion 判断。

## Harness 边界

- 官方入口为 `task workflow:schema:postgres:test` 与 `task test:workflow-schema:postgres:component`。
- `WORKBENCH_TEST_POSTGRES_URL` 缺失时 Task preflight 非零退出，不进入 Go test。
- 测试必须同时设置内部 guard `WORKBENCH_POSTGRES_TEST_TARGET=disposable`；非法 scheme、空 database 或非 disposable guard 均 fail closed。
- 每个测试生成 `workbench_test_<random>` schema，并使用两个独立 GORM/SQL pool；cleanup 只允许删除该前缀 schema。

## 覆盖矩阵

- fresh database 顺序应用完整 ledger，并由第二 pool 验证 readiness。
- 从冻结 `0017` predecessor 升级至 current，ledger 数量与顺序保持一致。
- 在 `0017` 后制造跨表同名 `0018` index conflict，migration 内 sentinel 验证失败且不写 ledger；移除冲突后只恢复 pending suffix。
- 历史 checksum drift、unknown ahead 与 required object 缺失均返回稳定 reason，`CheckReady` 与 `ApplyMigrations` 均 fail closed。
- 已关闭 pool 可重建恢复；真实 backend termination、context cancellation 与 query timeout 均有 bounded return，最终 pool `InUse=0`。

## 证据

- current `0018` 成功运行：`temp/integration-test-runs/20260728091451-eeb7acad-b6b7-44a9-b916-025a987e0351/`
- `0017` 基线运行：`temp/integration-test-runs/20260728084354-c6dc719b-bfa7-4a07-842a-d7d20bc8351e/`
- 故障运行：`temp/integration-test-runs/20260728080012-f18a7835-76ba-4bfd-ba7b-3d427ea9362c/`
- 两次运行均保留原 exit code，目录权限为 `0700`、文件权限为 `0600`，redaction gate 通过且未记录 DSN、credential 或 raw SQL 参数。
- 真实 PostgreSQL race gate：`CGO_ENABLED=1 go test -race ./service/internal/repository -run '^TestPostgresWorkflow(SchemaHarness|MigrationParity)' -count=1`，exit 0。
