# Workflow Sequential Migration Engine Core 基线

## 1. 完成范围

截至 2026-07-21，R4 `4.1b2a` 已实现不绑定具体历史模型的sequential migration runner核心：

- `migrationPlan`要求catalog每个entry恰好对应一个顺序一致、descriptor完全一致、非空的apply function；
- 只接受exact historical prefix的`behind` observation；`current`直接no-op；`unavailable/ahead/checksum_mismatch/partial`全部零执行拒绝；
- 每个pending entry使用独立GORM transaction，apply成功后才在同一transaction写入ledger；
- ledger `applied_at`来自已有repository DB-time authority，不读取worker/process wall clock；
- 任一entry失败回滚该entry创建的object和ledger row，已提交前缀保留，下一次可从pending suffix恢复；
- 对外只返回`workbench_migration: invalid execution plan`、`schema is not upgradable`或`apply failed`，不透传SQL、DSN、provider error或private path；
- 当前runner未接入`GORMStore.ApplyMigrations`，因此不会改变现有local/managed数据库行为。

实现路径：

```text
service/internal/repository/migration_engine.go
service/internal/repository/migration_engine_test.go
Taskfile.yml
```

## 2. Transaction 与 Resume 不变量

固定执行模型：

```text
validated observation under future migration lock
  -> catalog assessment
  -> pending suffix
  -> transaction(entry N apply + DB-time ledger row)
  -> commit
  -> transaction(entry N+1 ...)
```

不同entry故意不放进一个大transaction：已经提交的additive migration是可恢复事实；后续entry失败时，下一次运行从完整ledger prefix继续，而不是回滚全部历史或要求人工删除current row。

runner假设observation是在未来`4.1b2d`跨进程lock内读取。当前核心不自行读取ledger、不创建lock，也不处理stale observation竞争；在真实接管前不得直接暴露给runtime。

## 3. TDD 与验证

测试先因缺少`migrationStep`、`migrationPlan`与`newMigrationPlan`编译失败；实现后通过真实SQLite/GORM transaction验证：

```bash
task workflow:migration-engine:core:test
CGO_ENABLED=0 go test ./service/internal/repository -run 'MigrationPlan|NewMigrationPlan' -count=1
CGO_ENABLED=1 go test -race ./service/internal/repository -run 'MigrationPlan|NewMigrationPlan' -count=20
```

覆盖：

- missing/duplicate/out-of-order/nil/drift apply plan拒绝；
- fresh两步顺序apply与DB-time ledger；
- 第二步创建object后失败时object与ledger均回滚；
- resume不重跑已提交第一步，只执行第二步；
- current no-op；
- unavailable、future、checksum drift、missing-prefix与missing-object均零apply。

## 4. 未完成边界

- `4.1b2b`已重建`0001..0004`历史snapshot，见`details/workflow-migration-early-snapshots-baseline.md`；
- `4.1b2c`仍需重建`0005..0015`历史snapshot；
- `4.1b2d`仍需读取真实ledger/object observation、实现跨进程lock、接管`ApplyMigrations`/`CheckReady`与`workbench-migrate`；
- 尚未证明SQLite与PostgreSQL DDL transaction差异、advisory lock或interrupted process恢复；
- 当前`ApplyMigrations`仍使用latest-only `AutoMigrate`，不能关闭`4.1b2`父任务或`4.1b`。

因此该核心只是后续历史migration实现的安全执行骨架，不构成真实PostgreSQL migration parity或生产授权。
