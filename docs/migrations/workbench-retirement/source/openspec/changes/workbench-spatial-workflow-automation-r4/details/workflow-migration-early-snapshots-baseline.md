# Workflow Migration `0001..0004` Snapshot 基线

## 1. 完成范围

截至 2026-07-21，R4 `4.1b2b` 已重建并冻结早期migration apply snapshots：

| Version | Authoritative source | 只新增 |
| --- | --- | --- |
| `0001_task_control_plane` | Git初始commit `4634f58` 的Task GORM模型 | migration ledger、Task/Gate/Attempt/Event/Artifact/Receipt基础表与初始idempotency index |
| `0002_runtime_event_checkpoint` | 现有`0001→0002` upgrade test | `runtime_run_ref`、`runtime_event_cursor`、`runtime_event_sequence` |
| `0003_layout_v3_foundation` | 现有layout migration models/tests | layout profile/revision/preset/event表 |
| `0004_workflow_runtime_foundation` | R4 workflow schema baseline/tests | workflow definition/run/step/attempt/lease/worker/gate/receipt/event/outbox/dead-letter/intervention/cursor表 |

`migration0001TaskModel`按初始commit复制历史shape，不使用current `taskModel`；`migration0002TaskModel`只增加runtime checkpoint，仍不包含后续tenant/authority/0015字段。

实现路径：

```text
service/internal/repository/migration_snapshots_early.go
service/internal/repository/migration_snapshots_early_test.go
```

## 2. Checkpoint 不变量

- `0001`不存在runtime checkpoint、layout、workflow、Board或tenant/authority字段；
- `0002`只新增三个runtime checkpoint字段；
- `0003`新增四张layout表，但仍无workflow/Board；
- `0004`新增完整workflow foundation，但仍无Board及后续task authority字段；
- 每个checkpoint ledger必须是catalog exact prefix，version/checksum顺序一致；
- `0001`已有Task row升级到`0004`后workspace/project/operation等旧数据保持不变，新增runtime字段采用零值；
- 所有apply函数只使用GORM `AutoMigrate`批准snapshot/models，无raw SQL或destructive down。

## 3. TDD 与验证

测试先因缺少`migration0001TaskModel`、`migration0002TaskModel`与`earlyMigrationSteps`编译失败；实现后通过：

```bash
task workflow:migration-snapshots:early:test
CGO_ENABLED=0 go test ./service/internal/repository -run 'EarlyMigrationSnapshots' -count=1
CGO_ENABLED=1 go test -race ./service/internal/repository -run 'EarlyMigrationSnapshots' -count=20
```

测试直接从fresh database逐步执行到每个checkpoint，不依赖“先创建current schema再drop未来列”的旧模拟方式。

## 4. 未完成边界

- `4.1b2c`仍需重建`0005..0015` Board/task snapshots；
- `4.1b2d`尚未将早期steps和后期steps组成production plan，也未替换`ApplyMigrations`；
- 当前snapshot只在focused test中执行，不影响local/managed runtime；
- 尚未在真实PostgreSQL验证DDL transaction、index命名和type mapping parity。

因此早期历史已可审计，但`4.1b2`与`4.1b`仍保持未完成。
