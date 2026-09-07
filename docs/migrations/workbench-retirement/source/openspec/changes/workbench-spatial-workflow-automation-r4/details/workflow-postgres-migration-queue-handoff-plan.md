# Workflow PostgreSQL Migration / Queue Repository 对接计划

## 1. 目的

本文冻结 R4 `4.1b → 4.2/4.3b2 → 5.1b → 5.1c → 5.1e → 5.2b1` 的真实 PostgreSQL 关键路径，避免继续用 SQLite、当前模型 `AutoMigrate` 或不存在的 Taskfile scenario target 代替生产证据。

目标不是“让一个 PostgreSQL 测试能通过”，而是建立以下可审计链路：

```text
immutable migration catalog
  -> managed migration command
  -> schema readiness/version window
  -> disposable PostgreSQL parity evidence
  -> additive ready queue projection
  -> bounded tenant-aware candidate query
  -> scheduler availability
  -> fenced claim loop
```

## 2. 当前事实与规格漂移

截至 2026-07-28：

- `4.1b1` immutable catalog、`4.1b2a` per-entry runner与`4.1b2b`早期`0001..0004` snapshots已实现；Board/task后期snapshot、真实lock/inspector与PostgreSQL parity仍由`4.1b2c-4.1b5`完成；
- 当前代码 schema 已推进至 `0018_workflow_ready_queue_projection`；`0017_workflow_outbox_lease_foundation` 保持冻结，后续 migration 不得复用 `0015..0018`；
- `ApplyMigrations`目前把当前全部 GORM models 一次性 `AutoMigrate`，ledger只验证当前版本行，不能证明完整历史 checksum、schema ahead、interrupted/resume或逐版本升级；
- `CheckReady`能发现当前版本缺失或当前 checksum mismatch，但尚未冻结 compatible schema range，也不能区分behind、ahead、partial与connection unavailable的stable reason；
- 现有`test:postgres`只覆盖通用repository integration，不能证明workflow fresh/upgrade/interrupted/readiness矩阵；
- OpenSpec曾引用`task test:workflow-component SCENARIO=...`，但当前 Taskfile没有该入口；新任务必须创建真实、可直接运行的target；
- 本轮已通过临时角色、一次性数据库与随机隔离 schema 在本机 PostgreSQL 14 签署 `0018` migration/projection evidence；测试结束后角色、database 与 schema 均清理。

## 3. Schema 版本与所有权

### 3.1 `4.1b`：认证 migration catalog current

`4.1b`负责把已有 migration 历史变成 immutable catalog，并在真实 PostgreSQL 证明；当前完整链已扩展至 `0018`：

- fresh database逐项应用到`0018`；
- approved `0017` predecessor升级到`0018`；
- 已提交migration可幂等resume，未提交migration不留下partial current row；
- 任一历史checksum drift、unknown ahead version、missing/partial required object均fail closed；
- managed runtime只执行`check`，只有显式migration job可以执行`up`。

### 3.2 `5.1b`：新增 `0018_workflow_ready_queue_projection`

`0018`只允许expand：

- `workflow_step_runs.ready_at_db` nullable；
- `workflow_step_runs.not_before_at_db` nullable；
- `workflow_step_runs.priority_class`带兼容default；
- bounded queue scan所需named index；
- DB-side backfill仅处理已有`ready`行，时间来源必须是数据库；
- 不drop/rename旧列，不把nullable立即收紧为`NOT NULL`。

旧binary必须能忽略新增列；rollback仅回退binary并保留`0018`结构。任何contract阶段的收紧另建后续migration，不塞入本次expand。

### 3.3 `5.1c`：只读 repository，不拥有migration

`5.1c`只读取`0018` projection，不创建表、列或index。候选query不得产生lease、attempt、cursor或step state副作用。

## 4. Migration Catalog 合同

catalog entry至少包含：

```text
version
checksum
apply(transaction)
required_objects
compatibility_min_app
compatibility_max_app
```

要求：

1. entry按版本严格递增且version/checksum唯一；
2. checksum来自冻结migration定义，不来自运行时数据库反射结果；
3. migration和ledger row在同一事务提交；PostgreSQL不支持事务化的操作必须单独设计resume marker，不得伪装原子；
4. `up`只前进，不执行destructive down；
5. `check`完全只读，返回stable class：`current`、`behind`、`ahead`、`checksum_mismatch`、`partial`、`unavailable`；
6. 错误不得回显DSN、host、用户名、SQL参数、private path或底层provider payload；
7. migration锁必须跨进程互斥并有bounded timeout；不得依赖进程内mutex证明唯一执行者。

## 5. PostgreSQL Harness 合同

正式入口必须创建以下真实命令：

```bash
WORKBENCH_TEST_POSTGRES_URL=... task workflow:schema:postgres:test
WORKBENCH_TEST_POSTGRES_URL=... task test:workflow-schema:postgres:component
WORKBENCH_TEST_POSTGRES_URL=... task workflow:queue:postgres:test
WORKBENCH_TEST_POSTGRES_URL=... task test:workflow-queue:postgres:component
```

规则：

- Taskfile用`requires.vars`在启动测试前阻断缺失DSN，官方target不得把Go test的`Skip`当成功；
- 每次运行使用唯一schema或唯一database，不复用开发数据库，不`DROP DATABASE`用户提供的非测试目标；
- harness在开始前验证database/session是测试授权目标，并在结束时清理自己创建的schema；
- 至少使用两个独立pool/connection证明并发，不用共享transaction制造“两个worker”；
- connection loss通过关闭独立pool、代理或批准的fault hook注入，不把context cancel冒充数据库断线；
- 六件套只记录scenario、版本、stable reason、对象计数、winner/loser计数、pool统计与redaction结果，不记录DSN或业务refs列表；
- 失败必须保留证据并返回原始非零退出码。

## 6. Ready Queue Projection 写入合同

所有进入或离开`ready`的central transition必须在同一事务维护projection：

| Transition | `ready_at_db` | `not_before_at_db` | `priority_class` |
| --- | --- | --- | --- |
| non-ready → ready | 首次进入时由DB time写入；同一ready epoch内不重置 | typed delay/retry gate决定，可空 | validated/default `normal` |
| ready → ready | 保持原`ready_at_db`，只允许显式策略更新not-before/priority | 可单调更新 | validated enum |
| ready → non-ready | 清空queue projection或使其不可被query命中 | 清空或保留历史列由migration contract固定 | 保留兼容值 |
| expired lease → ready | 新ready epoch使用reclaim事务的DB time | 根据retry policy设置 | 保持或显式重算 |

禁止：

- 使用Go `time.Now()`或`updated_at`推断ready顺序；
- 在transition事务提交后异步补写projection；
- 因缺`ready_at_db`回退为可claim；
- backfill后伪造原始历史ready时间。

## 7. Candidate Query 合同

query输入必须是validated bounds：

```text
QueueScanLimit <= 1024
TenantWindowLimit <= 64
PerTenantScanLimit <= 64
candidate fetch hard limit <= QueueScanLimit
```

query输出复用`service/internal/scheduler.Candidate`所需字段，但repository DTO不得依赖scheduler decision逻辑。固定语义：

1. 仅`step_state=ready`、run可执行、`ready_at_db IS NOT NULL`、`not_before_at_db <= database_now`；
2. active unexpired lease排除；expired lease只返回typed摘要，由claimer/reclaim合同决定后续动作；
3. tenant window与per-tenant cap在数据库侧生效，hot tenant不能填满全局窗口；
4. stable order至少包含tenant、priority、ready time、run ref、step run ref；最终跨tenant公平由`5.1d`完成；
5. 单次query、返回rows和内存分配均有硬上限；context cancel/timeout后pool `InUse=0`；
6. 不返回payload、credential、endpoint、private path或artifact body。

当前依赖的 GORM `v1.31.2` 已提供 generics preload `LimitPerRecord`。首选实现必须使用两阶段、固定查询数的 GORM 路径：先查询最多`TenantWindowLimit`个eligible tenant row，再用一个association preload对全部选中tenant执行`LimitPerRecord(PerTenantScanLimit)`；窗口SQL由GORM生成，应用代码不得手写`ROW_NUMBER()`、`SELECT`或identifier。若该API经真实PostgreSQL验证无法满足稳定排序/plan要求，必须回到OpenSpec重新设计projection，不得在实现阶段临时加入raw SQL。

## 8. 执行车道与交付物

| Lane | Owner | 输入 | 输出 | 可并行 |
| --- | --- | --- | --- | --- |
| PG-A migration contract | repository implementer | 当前0018 models/ledger | immutable catalog + readonly status | 与PG-B并行 |
| PG-B harness | integration implementer | evidence runner/DSN policy | isolated PostgreSQL harness + targets | 与PG-A并行 |
| PG-C parity | test owner | PG-A + PG-B | fresh/upgrade/fault证据 | 否 |
| Q-A projection | workflow repository implementer | 0018 contract + central transitions | additive migration + atomic writes | 4.2后 |
| Q-B query | queue repository implementer | Q-A + claim schema | GORM two-stage tenant window + bounded candidates | Q-A后 |
| Q-C runtime | scheduler/claimer implementer | Q-B + 5.1d | readiness + preclaim pipeline | Q-B后 |
| R5 handoff | release/test owners | Q-C system evidence | candidate-bound authority input | 最后 |

任何tracked-file writer的path lease必须互斥：migration/catalog与queue repository不得同时修改`service/internal/repository/gorm.go`或`workflow_models.go`。

PG-A内部必须继续按`4.1b2a-d`顺序：runner core不消费current models；`0001..0004`已完成，Board后期历史继续按`4.1b2c1`、`4.1b2c2`、`4.1b2c3`递进，避免current structs泄漏未来字段；只有full-chain checkpoint golden通过后，`4.1b2d`才能替换现有latest-only `ApplyMigrations`。

## 9. 验证矩阵

| Scenario | 直接证据 | 失败条件 |
| --- | --- | --- |
| missing DSN | Taskfile preflight non-zero | test skip/zero exit |
| fresh 0018 | 全catalog应用、current | 只检查table存在 |
| approved upgrade | 每个pending entry按序一次 | 直接AutoMigrate到latest |
| interrupted/resume | 无partial ledger/object，resume一次完成 | 重复副作用或手工修库 |
| checksum drift | `checksum_mismatch` | 自动覆盖checksum |
| schema ahead | `ahead`且runtime not-ready | 仍启动worker |
| schema behind | `behind`且runtime not-ready | runtime自动迁移 |
| connection loss | bounded timeout、pool恢复/关闭 | hang或连接泄漏 |
| 0018 backfill | ready rows使用DB-side timestamp | Go clock或历史伪造 |
| mixed old/new binary | old binary读写旧路径，新binary兼容 | rollback需drop列 |
| hot tenant | 其他tenant进入候选窗口 | 热tenant填满窗口 |
| query cancel | 原错误分类、`InUse=0` | goroutine/connection leak |
| query plan | named queue index/window evidence | seq scan成为默认且无基线 |

## 10. R5 对接出口

只有以下全部成立，R5 candidate-bound claim authority才可消费W2输出：

1. `4.1b1-4.1b5`真实PostgreSQL migration/readiness证据完成；
2. `4.3b2/4.3c`两pool claim/fence/fault证据完成；
3. `5.1b1-5.1b5`完成`0018`expand与mixed-version rollback证明；
4. `5.1c1-5.1c4`完成bounded query与plan/cancel证据；
5. `5.1e`和`5.2b1a-d`完成真实engine readiness、claim、heartbeat、drain与restart；
6. evidence均绑定同一artifact/schema/contract digest，且可由R5 manifest validator直接读取；
7. `production_authorized=false`继续保持，直到外部release/security/platform authority显式批准。
