# Spatial Board GORM Schema / Migration 实施基线

## 1. 完成范围

截至 2026-07-21，R4 已建立 Board 持久化 schema foundation，并按 `0005` spatial、`0006` transaction、`0007` graph outcome、`0008` template lifecycle、`0009` template binding、`0010` template application outcome、`0011` viewport query indexes、`0012` event retention、`0013` outbox lease、`0014` projection index逐步additive演进。全部旧版本均保留为可升级历史记录。

```text
historical_version=0005_board_spatial_foundation
historical_checksum=sha256:4665c4e3eadf69ead172e32f6cb7f2bbfd6ce49e7d481ca54d93a53d40154511
transaction_version=0006_board_transaction_foundation
transaction_checksum=sha256:9223bcf8fb21180f8af64d616f0ffa22177351fe9cb6f875de595da811b0d556
outcome_version=0007_board_mutation_outcome_foundation
outcome_checksum=sha256:3e8e53350f94a782ffc7d8cfe3fe3acfa48abad3000ba992bc5f5d1adf5651da
template_lifecycle_version=0008_board_template_lifecycle_foundation
template_lifecycle_checksum=sha256:a2cf68829cdd67203ef940e5761debd5c02bfba0cfa25d2c0970a7877c02a618
template_binding_version=0009_board_template_binding_foundation
template_binding_checksum=sha256:96bb6b785ab8a968329e95d098fb2c3dd5541460ad27feccd5d6c5a867703a1f
template_application_version=0010_board_template_application_outcome_foundation
template_application_checksum=sha256:4c37aaee50ec296c6cde93587b7a31b81db3a59d29e13e3999ad4eba97d712a6
viewport_index_version=0011_board_viewport_query_indexes
viewport_index_checksum=sha256:c12fca86074b3ad017c95458e4f9d642fed6248db6976105279d03a7ae87171c
current_version=0014_board_projection_index_foundation
current_checksum=sha256:f90682da01f94908463092fe99516a1abf2b56ce5b541367591e7c24d76ded76
```

新增 11 张规范化 GORM 表：

```text
boards
board_revisions
board_nodes
board_groups
board_edges
board_templates
board_template_versions
board_template_placeholders
board_template_nodes
board_template_groups
board_template_edges
```

schema 覆盖 tenant/workspace/board scope、revision、state/tombstone、type registry digest、safe target ref/type/version、integer geometry/bounds、allowlisted style/label token、workflow binding safe ref、template checksum/version、idempotency digest/request digest、audit ref 与数据库时间字段。

实现资产：

```text
service/internal/repository/board_models.go
service/internal/repository/board_schema_test.go
service/internal/repository/gorm.go
service/internal/repository/gorm_test.go
service/internal/repository/workflow_schema_test.go
Taskfile.yml
```

## 2. Schema 边界

- Board graph 与 template 使用规范化 typed columns；没有任意 JSON、metadata、provider payload 或 raw content column。
- 每张 Board 表都含 `tenant_ref`；node/group/edge/template children 使用 tenant + owner ref + local ref/version 复合唯一索引。
- `board_revisions` 固定 board revision sequence、idempotency digest、request digest、actor audit ref 与 event ref；原始 idempotency key 不落库，为后续 transaction/outbox service 提供原子记录基础。
- node target 只保存 safe `target_type` / `target_ref` / `target_version`，不建立 Owner table foreign key，不级联删除 canonical target。
- schema 不定义 `ON DELETE CASCADE`；Board tombstone/delete 语义由后续 application service 的显式 typed command 控制。
- template body 拆为 immutable version + placeholder/node/group/edge 子表，不用 opaque blob 绕过 sanitizer 与 relation matrix；当前 lifecycle header、mutation ledger与typed historical outcome独立保存。
- `idx_board_node_viewport_v2`固定tenant/Board/state/x/y/node ref稳定keyset；type/group变体与source/target edge索引由`0011` additive migration建立。`0010 -> 0011`测试确认已有node不被替换。
- `0012`新增`board_event_retention`，用tenant/Board复合主键保存generation与earliest sequence；Board create在canonical transaction中初始化generation 1，`0011 -> 0012`保留已有Board/event sequence。
- `0013`为`board_outbox`新增lease owner、token digest、expiry、safe error code与独立`idx_board_outbox_lease_expiry`；`0012 -> 0013`保留已有outbox/event且不持久化原始lease token或raw error。
- `0014`新增non-content `board_node_projection_index`与revision/registry watermark；`0013 -> 0014`保留已有Board/event/outbox，且结构审计禁止Owner内容与principal授权决策列。

## 3. Migration 与 Managed Runtime

- `requiredSchemaModels()` 已包含 Board tables，因此 readiness 会拒绝缺失 Board schema 的数据库。
- `ApplyMigrations()` 在同一 GORM transaction 中检查当前 version/checksum，再执行 additive migration 并记录 migration history。
- 从 `0004_workflow_runtime_foundation` 升级会保留旧 migration row 并追加 `0005`。
- checksum mismatch 在任何 Board table 重建前失败；测试确认失败 migration 不补回已删除的 table。
- `SchemaPolicyExternalMigration` 打开数据库时不会创建 Board table；managed runtime 仍必须通过独立 `workbench-migrate` 执行 migration。
- Workflow schema 测试改为验证版本不早于 `0004`，避免把全局 additive migration 永久锁死在旧版本。

## 4. 验证与证据

```bash
task board:schema:test
task test:board-schema:component
CGO_ENABLED=0 go test ./service/internal/boards/... ./service/internal/repository ./service/cmd/workbench-migrate -count=1
CGO_ENABLED=1 go test -race ./service/internal/repository -run 'BoardSchema|BoardMigration' -count=10
```

`board:schema:test` 使用临时目录执行真实命令，不触碰默认本地数据库：

```bash
task db:migrate DB_PROFILE=local DB_DATA_PATH=<temporary>/workbench.db
task db:migrate:check DB_PROFILE=local DB_DATA_PATH=<temporary>/workbench.db
```

结果：fresh、`0004 -> 0005` upgrade、external-policy、named index、tenant-bound safe columns、no-cascade、checksum fail-before-mutation、repository full regression、vet、10 次 race 与 CLI migrate/check 全部通过。

Component evidence：

```text
temp/integration-test-runs/20260720212815-784131ce-ea70-4dad-b43b-167029c025da/
status=passed
exit_code=0
redaction=enabled
```

## 5. PostgreSQL 与未完成边界

- `TestPostgresRepositoryIntegration` 在配置 `WORKBENCH_TEST_POSTGRES_URL` 时会检查全部 Board tables 与 revision/viewport/edge/template 关键索引；本轮环境未配置 PostgreSQL，因此不声明 live PostgreSQL 证据。
- 本任务只交付 schema/migration，不交付 Board repository CRUD、transaction CAS、outbox/event 或 viewport query。
- `2.2` 仍需实现 authority/idempotency/expected revision 下的原子 graph mutation 与 typed undo。
- `2.3` 仍需实现 bounded viewport/LOD query、cursor 与 10k benchmark。
- `2.4` 已完成event list、outbox/watch本地链路与projection index；仍需当前principal真实Owner resolver、Owner change reconciler、managed transport与PostgreSQL promotion。
- production GA 仍必须补充真实 PostgreSQL fresh/upgrade/restart/rollback 与连接资源证据；SQLite component 不能替代该门禁。
