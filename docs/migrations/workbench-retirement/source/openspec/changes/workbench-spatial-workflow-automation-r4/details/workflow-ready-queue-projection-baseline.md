# Workflow ready queue projection baseline

## 结论

R4 `5.1b` 已完成 additive `0018_workflow_ready_queue_projection`、数据库时间回填、central transition 原子维护与 mixed-version rollback-binary 兼容验证。缺少 `ready_at_db` 的 ready row 不具备后续 queue claim 资格；旧 binary 可继续读取和更新旧字段，但不得删除或重写 projection 列。

## Migration 合同

- current version：`0018_workflow_ready_queue_projection`。
- checksum：`sha256:93ab44a639ed9243babdf3f2e8161195697ea5e0a819c7c9de5e1cac4568814e`。
- additive fields：nullable `ready_at_db`、nullable `not_before_at_db`、defaulted `priority_class=normal`。
- named index：`idx_workflow_ready_queue`，按 tenant、status、priority、ready time、not-before time、run 与 step-run stable key 排列。
- `0004_workflow_runtime_foundation` 使用 frozen step-run model，不泄漏 `0018` 字段或 index。

## Backfill 与 transition

- `0017 → 0018` 只回填 `status=ready AND ready_at_db IS NULL` 的历史行，批次上限为 256，时间来自数据库事务。
- 重复执行 migration 不改变已建立的 ready epoch；non-ready row 不获得伪造的 ready time。
- non-ready→ready 在 state/event/outbox 同一事务写入新的 DB ready epoch、priority 与 not-before。
- 同 event replay 保持 ready epoch；ready→non-ready 在同一事务清空 ready/not-before 并恢复 normal priority。
- expired lease→ready 先以 fence/CAS 和 DB expiry 验证释放旧 lease，再建立新的 ready epoch。

## Mixed-version

- current binary 对 `0017` 返回 schema behind/not-ready，不静默运行。
- expand-first 应用 `0018` 后，旧 `0017` model 可读取并更新旧字段。
- 旧 model 的兼容 `AutoMigrate` 模拟不会删除 projection 列/index，也不会重写 ready epoch；managed runtime 本身仍禁止执行 migration。
- rollback 仅回退 binary，保留 `0018` 列、index 与 ledger，不执行 destructive down。

## 验证与证据

- 聚焦与 race：`task workflow:queue-projection:test`，包含 migration、typed contract、transition、expired lease recovery 与 10 轮 race，exit 0。
- PostgreSQL：`task workflow:queue-projection:postgres:test`，覆盖 fresh current、`0017 → 0018`、interrupted/resume、checksum/ahead/partial、backfill/idempotency、mixed binary、transition lifecycle、cancel/pool recovery。
- 六件套 evidence：`temp/integration-test-runs/20260728091451-eeb7acad-b6b7-44a9-b916-025a987e0351/`。
- evidence `status=passed`、`exit_code=0`、redaction passed，并在 stdout 绑定 version/checksum；未记录 DSN、credential、provider payload、private path 或 raw SQL 参数。
