# Workflow Migration Catalog 合同基线

## 1. 完成范围

截至 2026-07-21，R4 `4.1b1` 已冻结纯 Go migration catalog 与schema readiness分类合同：

- catalog按严格顺序固定`0001_task_control_plane`至`0015_task_idempotency_scope_v2`的version/checksum；
- 每个entry至少固定一个table/column/index required-object sentinel，为后续partial schema检查提供低成本直接证据；
- `CurrentMigrationCatalog`、constructor input、`Entries`和`Current`均深拷贝slice，调用方不能修改进程内canonical history；
- 当前binary支持范围固定为`min=max=0015_task_idempotency_scope_v2`，不使用字符串猜测未来兼容；
- schema observation按fail-closed precedence分类为`unavailable`、`ahead`、`checksum_mismatch`、`partial`、`behind`或`current`；
- only `current`可返回`ready=true`；fresh database明确为`behind`，不会被误认为可运行；
- `MigrationLocker`/`MigrationLock`与固定scope `workbench_schema_migrations`已冻结，后续`4.1b2`必须提供真实跨进程实现，不能用进程内mutex代签。

实现路径：

```text
service/internal/repository/migration_catalog.go
service/internal/repository/migration_catalog_test.go
Taskfile.yml
```

## 2. Catalog 不变量

`NewMigrationCatalog`拒绝：

- 空catalog；
- 非`NNNN_safe_name`格式version；
- 非小写`sha256:` digest；
- duplicate或非严格递增version；
- 无required-object sentinel的entry；
- unsafe table/column/index identifier；
- minimum/maximum不属于catalog或range反向。

当前required objects是每个migration的最小sentinel，不是完整schema manifest。`4.1b2`实现readiness inspector时必须同时检查catalog sentinel与当前`requiredSchemaModels`/批准index集合，不能把单一sentinel存在等同于完整schema。

## 3. Readiness 分类

固定优先级：

```text
dependency unavailable
  -> unknown future version / schema ahead
  -> known version checksum mismatch
  -> duplicate, missing middle, unknown historical version, missing object / partial
  -> exact historical prefix / behind
  -> exact complete history inside supported range / current
```

输出只包含stable reason、current version与observed version；不包含DSN、host、username、SQL、provider error、private path或migration参数。

## 4. TDD 与验证

测试先因缺少`CurrentMigrationCatalog`、descriptor、assessment和lock symbols编译失败；最小实现完成后通过：

```bash
task workflow:migration:contract:test
CGO_ENABLED=0 go test ./service/internal/repository -run 'MigrationCatalog|MigrationLockContract' -count=1
CGO_ENABLED=1 go test -race ./service/internal/repository -run 'MigrationCatalog|MigrationLockContract' -count=20
```

覆盖：

- 15个历史版本顺序与current metadata一致；
- constructor/return-value mutation isolation；
- invalid version/checksum/object/order/range；
- fresh/behind/current/ahead/checksum/partial/unavailable矩阵；
- stable migration lock scope与接口绑定。

## 5. 未完成边界

`4.1b1`不改变现有数据库，也不宣称真实PostgreSQL parity：

- `4.1b2a`已提供sequential per-entry transaction runner核心，但`ApplyMigrations`仍是latest-only `AutoMigrate`路径，历史snapshot与最终替换属于`4.1b2b-d`；
- catalog entry尚未绑定逐版本`apply(transaction)`函数；
- 尚无PostgreSQL advisory lock或等价跨进程lock provider；
- 尚未从真实数据库读取完整ledger/object observation；
- 尚未运行fresh/upgrade/interrupted/ahead/behind/pool-loss PostgreSQL矩阵；
- 当前环境没有`WORKBENCH_TEST_POSTGRES_URL`，无Docker/Podman可提供disposable PostgreSQL。

因此`4.1b`父任务保持未完成，managed runtime仍必须`production_authorized=false`且不得自动迁移或claim。
