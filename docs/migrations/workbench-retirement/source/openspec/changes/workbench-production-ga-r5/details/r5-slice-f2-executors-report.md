# R5 Slice F-2 Executors 执行报告（6.0b1/b2/b3 执行器切片）

日期：2026-08-28。范围：把 `r5-slice-f2-report.md` §6 建议 2 落地为可执行代码——以既有合同层（`TenantExportPlan`/`TenantExportManifest`、`DeletionRecord`、`GenerationPurgeRecord`，均在 `service/internal/lifecycle/`）为**唯一权威输入**实现三个执行器，不发明第二状态系统。写入租约：`service/internal/lifecycle/`（新文件为主）、`service/internal/workitems/`（读取阻断最小接线）、`service/internal/repository/`（行级导出/generation purge 查询助手新文件）、本报告。

## 1. 总结

- 三个执行器全部落地并带真实存储（SQLite 全量迁移 schema）与合同层双重测试：**导出执行器**（6.0b1 行级导出）、**读取阻断执行点**（6.0b2 查询层接线）、**generation purge 执行器**（6.0b3 派生类清理）。全部为消费合同层的只读/只删实现，不推进状态推导逻辑。
- **6.0b1–6.0b5 维持不勾选建议**：五项的 Verification 均为 `task data-lifecycle:system ENV=staging`，该 target 仍不存在（本轮纪律禁止改 `Taskfile.yml`）；实现就绪 ≠ staging evidence。本轮完成的是上一报告 §6.2 阻塞项 2 的 repository/service 执行点部分。
- 6.0a3 语义仍未冻结：hold 类目保持 `purge_blocked_hold` fail closed；deletion record 在当前语义下仍不可能标 completed——执行器如实消费该语义，不提供绕过。

## 2. 交付清单（文件级）

### 导出执行器（6.0b1）

- `service/internal/repository/lifecycle_rows.go`（新增）：行级导出助手。三种行范围（tenant 直查 / parent 经父表键关联 / global 无租户目录表）的注册表覆盖 canonical catalog 全部绑定表，缺表即 fail closed；`ExportLifecycleClassRows` 只读迭代一个类目在租户边界内的全部行（参数化查询、行数预算、表名字典序稳定回调）；无 INSERT/UPDATE/DELETE。
- `service/internal/lifecycle/executor_export.go`（新增）：`ExportTenantRows`。流程：`ValidateTenantExportPlan` → load inventory + `ContainsOwnerPayload` 硬断言（fail closed）→ 幂等 manifest 路径检查（同 PlanRef 重放 / 异 PlanRef 冲突均拒绝）→ 逐类目：non-export 类目出现既有数据文件即拒绝；export 类目写**每类一个 JSONL**（O_EXCL、有界：单表 50k/总 200k/单文件 16MiB，超界失败且不落部分文件）→ `RecordTenantExportManifest` → `ValidateTenantExportManifest` 复核。零行类目不落空文件（0 字节文件会被合同 checksum 拒绝），如实归 unknown_pending，可 reconcile。
- `service/internal/lifecycle/executor_export_test.go`（新增）：有界 JSONL per class、manifest_only 数据文件拒绝、幂等/plan 绑定、失败不落部分产物、零行 unknown 不伪造 complete。

### 读取阻断执行点（6.0b2）

- `service/internal/lifecycle/executor_blocking.go`（新增）：`EvaluateDeletionReadBlock`——读取阻断唯一判定入口，只消费 `DeletionRecord` 权威标记：tombstoned/hold_blocked/owner_contract_pending 阻断；purged/retained_audit 不阻断（审计 truth 不被误杀）；未知状态 fail closed 阻断；record 未覆盖类目（`ErrDeletionRecordClassCoverage`）fail closed。不改写 record（推进只经 `ApplyDeletionPurge`）。
- `service/internal/workitems/service/lifecycle_gate.go`（新增）：查询层最小接线（**接线位置**：`Service.lifecycle` 门）。阻断/漂移/源错误一律投影为 `workitems.ErrNotFound`——与既有跨租户先例同值同标识（`ports.go` 的 `ErrNotFound`），不泄漏存在性。
- `service/internal/workitems/service/service.go`（修改，additive）：`Get`/`List` 在 authorize 之后调用门；`WithLifecycleGate` Option；nil 门 = 既有行为完全不变。
- `service/internal/workitems/service/project_query.go`（修改，additive）：`QueryProjectWorkItems` 同构阻断。
- 测试：`executor_blocking_test.go`（tombstone 阻断、retained_audit 不阻断、hold 仍阻断、覆盖漂移 fail closed、purged 不阻断、源错误语义）、`lifecycle_gate_test.go`（Get/List/ProjectQuery 阻断返回 not_found、无 record 放行、源错误 fail closed、nil 门不变）。

### Generation purge 执行器（6.0b3）

- `service/internal/repository/lifecycle_generation.go`（新增）：`PurgeGenerationClass` 按类目删除租户边界内派生行 + `CountGenerationClass` 同口径验证计数。registry 覆盖六个 `rebuildable_generation` 类目（agent_session/board×2/identity/locale/daily projection）在 canonical catalog 的全部绑定表，缺表 fail closed；rebuild_parent（locale preview entries）经父表键推导；无租户列的共享消费光标（identity_event_cursors）登记但**租户级 purge 跳过**（不触碰其他租户的流位置）；只产生 DELETE/COUNT，参数绑定无注入面。
- `service/internal/lifecycle/executor_generation.go`（新增）：`ExecuteGenerationPurge`——`ValidateGenerationPurgeRecord` 合同校验（伪造/单调破坏/跨租户重放/非派生类混入 fail closed）→ 逐类目 purge → 同口径计数复核（范围内残留 ≠ 0 即失败，绝不高估完成）→ record O_EXCL 落盘（重放要求 digest+代次一致，漂移 fail closed）。幂等：行已删除后重放 0 删除、`Changed=false`。`AuthorizeGenerationAccess` 薄封装保持"≤ 水位一律拒绝"语义。
- 测试：`executor_generation_test.go`（按类目清理且不触碰他租户、幂等重放 unchanged、record 漂移/篡改/跨租户 fail closed、清理不完整必须报错、purge 后 `generation-access-check` 语义）、`lifecycle_generation_store_test.go`（registry↔catalog 覆盖断言、真实 SQLite schema 上的租户边界精确删除 + 幂等 0 删除、六个派生类目全表真实 DELETE 有效、未知类目/非法边界 fail closed）。

## 3. 合同对齐点（执行器 ↔ 合同层）

| 合同类型 | 执行器消费方式 |
| --- | --- |
| `TenantExportPlan` | `ValidateTenantExportPlan` 为唯一类目/策略来源；export 类目才允许数据文件 |
| `TenantExportManifest` | 只经 `RecordTenantExportManifest` 落盘，`ValidateTenantExportManifest` 事后复核；unknown 如实保留 |
| `ContainsOwnerPayload` | 导出前对 inventory 硬断言，非 false 即 fail closed |
| `DeletionRecord` | 只经 `DeletionRecordSource` 只读消费；推进仍只经 `ApplyDeletionPurge`；门不改写 |
| `GenerationPurgeRecord` | `ValidateGenerationPurgeRecord` 重绑 inventory + digest 复核；代次边界/类目集合全部来自 record |
| `AuthorizeDerivedGenerationAccess` | purge 后读取授权语义不变：≤ 水位拒绝、未覆盖类拒绝 |
| `production` candidate | 三执行器均沿合同层拒绝，无本地放行路径 |

## 4. 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `gofmt -l`（本片全部新/改文件） | 干净（无输出） |
| `go vet ./service/internal/lifecycle/ ./service/internal/repository/ ./service/internal/workitems/...` | 通过 |
| `CGO_ENABLED=0 go test ./service/internal/lifecycle/ -count=1` | ok（3.0s；含三执行器合同级 + 负测） |
| `CGO_ENABLED=0 go test ./service/internal/workitems/... -count=1` | ok（domain + service 全绿；gate 6 用例通过） |
| `CGO_ENABLED=1 go test -race ./service/internal/lifecycle/ -count=1` | ok（14.1s） |
| `CGO_ENABLED=0 go test ./service/internal/repository/ -run "Lifecycle\|PurgeGeneration\|GenerationPurge\|ExportLifecycle" -count=1` | ok（1.4s；行导出 + generation purge 真实 SQLite schema 集成） |
| `WORKBENCH_TEST_POSTGRES_URL=postgres://workbench@127.0.0.1:15440/postgres`（可选 PG） | **未执行**：本开发容器无 docker daemon、15440 无监听（connection refused），PG14 实例不可达。属环境缺失，非产品失败；PG-gated 测试未因本片改动产生新失败面 |

注：`gofmt -l` 对 `service/internal/workitems/service/handler.go`、`service/internal/repository/migration_project_replacement.go`、`project_postgres_integration_test.go`、`project_query_capacity_test.go`、`project_schema_store.go` 有输出——均为**非本片文件**（他人 in-flight 或既有状态），未触碰。

## 5. 未尽事项与原因

1. **6.0b1–6.0b5 不勾选**：Verification `task data-lifecycle:system ENV=staging` target 不存在（Taskfile 禁改）；staging 环境/联合门/独立验收未产生。本片交付实现就绪，不冒充 system evidence。
2. **读取阻断仅覆盖 workitem 普通读取面**（Get/List/QueryProjectWorkItems，`workitem_metadata` 类目）：任务面写路径阻断、board/project/identity 等其他类目的查询面接线属其他 owning component 的同构接线（模式已由 `LifecycleGate` 给出）；本轮租约限制 workitems 改动为"最小接线"。
3. **6.0b4 retention/backup expiry**：依赖 6.0a3 未冻结语义与 managed backup authority，维持上一报告结论不变。
4. **CLI 面**：`workbench-lifecycle` 未新增执行器子命令（租约为"新文件为主"）；执行器当前为库形态，CLI/daemon 接线建议随 system gate target 一并设计。
5. **Component/system evidence run**：未跑 `bun scripts/test-evidence/run.ts`（禁用）；租约内验证全部通过。

## 6. 建议汇总

- 勾选建议：**6.0b1–6.0b5 全部保持不勾选**（理由同 §5.1）。
- 代码位置：三执行器 + 测试见 §2；workitems 接线精确位置为 `service/internal/workitems/service/service.go`（`Service.lifecycle` 字段 + `WithLifecycleGate` + `Get`/`List` 调用点）与 `project_query.go`（`QueryProjectWorkItems` 调用点），门实现在 `lifecycle_gate.go`。

## 7. 阻断面扩展（后续会话追加）

F2 执行器报告之后，6.0b2 读取阻断从 workitem 读面扩展到 board 读面、asset 读面与 search 命中面。判定逻辑收敛为共享合同层，各域只做接线与错误投影，语义与既有跨租户 not_found 先例同值同标识。

### 7.1 共享门提取（不改判定语义）

判定唯一来源下沉到零依赖子包，规避 `lifecycle → repository → boards` 的导入环；`lifecycle` 仍是唯一权威，全部经 alias/一行委托保持既有引用可编译：

- `service/internal/lifecycle/lifecyclecontract/contract.go`（新增）：`DeletionEntry`/`DeletionRecord`/`DeletionBlockDecision`/`DeletionRecordSource`、入口状态常量、`ErrDeletionRecordClassCoverage`，以及纯函数 `EvaluateReadBlock`（tombstoned/hold_blocked/owner_contract_pending/未知阻断；purged/retained_audit 放行；无 record 放行；覆盖漂移 fail closed）。JSON 形状与 canonical digest 输入逐字节不变（有 parity 测试锁定）。
- `service/internal/lifecycle/readgate/gate.go`（新增）：共享 `Gate`——`NewGate(source, evaluate, blockedErr)`（任一参数 nil 返回 nil 门 = 行为不变）；`CheckReadBlock`/`CheckReadBlockErr`：`os.ErrNotExist`（无进行中的删除）放行；源错误/覆盖漂移/阻断判定一律返回 `blockedErr`（fail closed）。
- `service/internal/lifecycle/executor_blocking.go`（修改）：`EvaluateDeletionReadBlock` 委托 `lifecyclecontract.EvaluateReadBlock`；`ReadBlockGate(source, blocked)` 适配器构造共享门。`execution_delete.go` 的 `DeletionEntry`/`DeletionRecord` 变为类型别名（同名同 JSON 同 digest；方法改自由函数）。
- `service/internal/workitems/service/lifecycle_gate.go`（重构，零行为变化）：`LifecycleGate = readgate.Gate` 别名 + 自由函数 `checkReadBlock`（alias 不能挂方法）；4 个调用点机械替换，workitems 全量测试绿。

### 7.2 Board 读面接线（`service/internal/boards/`）

`ServiceConfig.LifecycleDeletionRecords` 注入 `DeletionRecordSource`；`board_lifecycle_gate.go`（新增）绑定 canonical 类目 `board_metadata` + `board_event_outbox`，阻断投影 `boards.ErrNotFound`（既有跨租户先例）。接线位置（全部 authorize 之后、store 访问之前；undo history 在能力探测之前——阻断面不因 store 能力缺失而提前暴露不同错误）：

| 入口 | 文件 |
| --- | --- |
| `GetBoard` | read_service.go |
| `ListBoards` | board_list_service.go |
| `GetNode` / `ListNodes` | node_read_service.go |
| `GetGroup` / `ListGroups` / `GetEdge` / `ListEdges` | graph_read_service.go |
| `QueryViewport` | viewport_service.go |
| `GetTemplate` / `ListTemplates` | template_read_service.go |
| `GetUndoHistory` / `ListUndoHistory` | undo_history_service.go |
| `ListBoardEvents` | event_list_service.go |
| `WatchBoardEvents` | watch_service.go |

投影索引类目（viewport/graph 缓存等派生视图）不独立绑定：派生可见性跟随 `board_metadata`，避免双重判定漂移。

### 7.3 Asset 读面 + Search 命中面接线

- `service/internal/assets/service/lifecycle_gate.go`（新增）：新增稳定 `ErrNotFound`（asset 域此前无此先例错误）；绑定 `asset_metadata`（**前瞻命名**：asset 表尚不在 canonical inventory，真实 record 会因覆盖漂移 fail closed——删除推进中的数据绝不因 inventory 未登记而可见，方向保守并注释）。接线：`Get`/`List` 阻断 → `ErrNotFound`；`Search` 阻断 → 返回空页 `nil`（只过滤命中，不报错、不改索引）。门仅经 `WithLifecycleGate` 显式注入。
- `service/internal/search/service/lifecycle_gate.go`（新增）：Search 命中面绑定同一 `asset_metadata`（search 索引是 asset 投影的派生可搜索视图，不独立放行）。`Search` 阻断/源错误/覆盖漂移 → 返回空命中 `nil` 错误（`Generation: "initial"`、`IndexStatus: "ready"`）；**只过滤返回面，绝不改写索引行**（索引推进只经 projection worker / generation purge）。接线位置：`service.go` 的 `SearchService.Search`，repo 访问之前；`WithLifecycleGate` 链式注入。

### 7.4 测试

- `service/internal/boards/board_lifecycle_gate_test.go`（新增，10 用例全绿）：tombstoned 阻断覆盖 15 个读入口投影 `ErrNotFound`；hold_blocked 仍阻断；purged/retained_audit 放行；无 record（`os.ErrNotExist`）放行；nil 门行为不变；源错误 fail closed；跨租户不误伤。
- `service/internal/assets/service/lifecycle_gate_test.go`（新增，10 用例全绿）：Get/List 阻断；Search 过滤为空不报错；retained_audit/purged 放行；无 record 放行；nil 门不变；源错误 fail closed；跨租户不误伤；未阻断 search 正常透传。
- `service/internal/search/service/lifecycle_gate_test.go`（新增，5 用例全绿，真实 SQLite 索引）：tombstoned → 命中过滤为空且**索引行原样保留**（直接查 repo 验证未触碰）；源错误过滤不泄漏；retained_audit 命中照常；跨租户不误伤；nil 门行为不变。
- 既有测试回归：lifecycle / boards / assets / search / workitems 五套件全绿（见 §7.5）。

### 7.5 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `gofmt -l`（lifecycle / boards / assets / search / workitems 全部新改文件） | 干净（无输出） |
| `go vet ./internal/lifecycle/... ./internal/boards/... ./internal/assets/... ./internal/search/... ./internal/workitems/...` | 通过 |
| `CGO_ENABLED=0 go test ./internal/lifecycle/ -count=1` | ok（2.9s；含 contract parity + gate adapter parity） |
| `CGO_ENABLED=0 go test ./internal/boards/... -count=1` | ok（root + query/registry/resolver 全绿；gate 10 用例通过） |
| `CGO_ENABLED=0 go test ./internal/assets/... ./internal/search/... -count=1` | ok（8 包全绿；asset gate 10 用例 + search gate 5 用例通过） |
| `CGO_ENABLED=0 go test ./internal/workitems/... -count=1` | ok（重构零回归） |
| PG（`WORKBENCH_TEST_POSTGRES_URL=postgres://workbench@127.0.0.1:15440/postgres`） | 本片无新增 PG-gated 用例；assets/search repository 在 PG 环境下同样 ok |

### 7.6 剩余未接线面

1. **运行时/daemon 注入**：`boards`/`assets`/`search` 的门当前为构造/Option 注入，`service/internal/runtime/**`、`service/cmd/**` 尚未把真实 `DeletionRecordSource` 接到这三个域（租约禁改）；不注入 = nil 门 = 既有行为，生产启用需 runtime 接线（对齐 workitems 的接法）。
2. **任务面写路径阻断**：workitem/board/asset 的写路径（create/update/delete）尚无删除 tombstone 阻断——6.0b2 合同语义为读面阻断，写面阻断属后续切片。
3. **其他类目查询面**：project/identity/locale/workflow/mission-brief 等类目的查询面未接线；模式（共享门 + 域错误投影）已就绪，属同构扩展。
4. **asset 类目登记**：`asset_metadata` 为前瞻命名，canonical inventory 增补 asset 类目后，真实 record 即可在 asset/search 面生效（当前真实 record 在该面 fail closed，保守方向）。

## 8. 写路径与剩余面

### 8.0 本节范围

读面阻断（§7）落地后，本切片完成三件事：**写路径阻断**（purge 正确性合同）、
**剩余类目查询面接线**（§7.6-3 的同构扩展）、**asset 类目登记**（§7.6-4 的收口）。
共享判定层全部复用 §7.1 的 `readgate.Gate`（注入不同 EvaluateFunc 与域错误投影），
零判定实现重复；nil 门 = 既有行为完全不变的原则贯穿全部接线。

### 8.1 写路径阻断（共享合同层）

- `service/internal/lifecycle/lifecyclecontract/contract.go`：新增写阻断判定
  纯函数 `EvaluateWriteBlock` + `deletionEntryBlocksWrite` + 常量
  `DeletionRecordStatusCompleted`。**判定语义与读面刻意不同**：
  - 读面按「类目 entry 状态」判可见性（purged/retained_audit 放行）；
  - 写面按「record 是否活跃」判窗口：**任何非 purged/非 retained_audit 的 entry
    即阻断**；即便 entries 全部终态，只要 `Status != completed` 仍阻断（record
    与 inventory 漂移 fail closed）。语义依据：active deletion（tombstone 与
    purge 推进之间）期间对 Workbench-owned 行的写入会在 purge 扫描之后留下
    **影子行**，purge 永远扫不到——破坏 6.0b2 purge 正确性。写面宁严勿漏；
  - `retained_audit` 在读面放行（审计 truth 可见）但在写面**仍阻断**：审计
    truth 不物理删除不代表可继续写入（防绕过；类目推进经 `retain_audit_truth`
    的 purge 通道）。
- `service/internal/lifecycle/readgate/gate.go`：新增 `CheckWriteBlock` /
  `CheckWriteBlockErr`（nil 门放行不变）；包注释扩展为读写共用门。
- `service/internal/lifecycle/executor_blocking.go`：新增
  `EvaluateDeletionWriteBlock`（contract 纯函数的唯一导出门面）与
  `WriteBlockGate(source, blocked)` 构造适配。
- `service/internal/lifecycle/execution_delete.go`：
  `DeletionStatusCompleted = lifecyclecontract.DeletionRecordStatusCompleted`（alias）。
- `service/internal/lifecycle/readgate_parity_test.go`：新增
  `TestEvaluateDeletionWriteBlockPurgeWindow`（nil 放行；全 tombstoned 阻断；
  in_progress 阻断；status 漂移 fail closed；全 purged + completed 放行——
  注释说明真实 inventory 含 hold 类目（purge_blocked_hold 非终态，6.0a3 未
  冻结），completed record 必然携带显式 entries 覆盖；retained_audit 仍阻断
  写入）。

### 8.2 写路径阻断（域接线）

错误投影选择各域**写语义先例**（与读面 not_found 刻意不同）：写面对 active
deletion 的拒绝是「写入冲突/拒绝」语义，读面投影是「不泄漏存在性」语义。

| 域 | 门构造 | 阻断投影 | 接线位置（canonical 写入口） |
| --- | --- | --- | --- |
| workitems | `workitems/service/lifecycle_gate.go`: `NewLifecycleWriteGate` → `lifecycle.WriteBlockGate` | `workitems.ErrPermissionDenied`（授权语义：删除进行中的租户不再接受 canonical 写入） | `service.go`: Create/Update/Transition/Assign/AddDependency/RemoveDependency/UpsertAcceptance/AddLink/RemoveLink/Archive（各 authorize 之后、store 写之前）；`batch.go`: BatchUpdate（幂等 replay 检查之后——replay 不产生新 canonical 写，放行；新 application 阻断） |
| boards | `boards/board_lifecycle_gate.go`: `newBoardWriteGate`（合同层 `EvaluateWriteBlock` 直注入） | `domain.DomainError{Code: domain.ErrorTombstoned}`（board 域既有 tombstone 写语义：CheckExpectedRevision/validateActiveBoard 同值；租户级删除是同一语义的租户边界推广，transport 错误映射无需新增分支） | `service.go`: CreateBoard/RenameBoard/TombstoneBoard；`graph_service.go`: `beginGraphMutation`（单一漏斗覆盖 11 个 graph 突变 + undo restore 重放路径）；`template_service.go`: CreateTemplateDraft/transitionTemplate；`template_apply_service.go`: ApplyTemplate；`template_revert_service.go`: RevertTemplateApplication；`undo_executor_service.go`: UndoBoardMutation（undo 重放经 beginGraphMutation 被同一门覆盖） |
| search 索引 | `search/service/lifecycle_gate.go`: `newSearchWriteGate` | `ErrIndexWriteBlocked`（稳定 conflict sentinel；消费方按 errors.Is 处理，不与命中过滤语义混淆） | `service.go`: UpsertIndexEntry（projection outbox consumer 入口）/TombstoneIndexEntry（revoke 清理入口）/SetGeneration（rebuild readiness 入口）——active deletion 期间的索引推进会在 purge 扫描后留下影子命中/影子状态行 |
| asset 投影 | `assets/projection/worker/worker.go`: `WithDeletionGate` Option + `checkWriteBlock` 方法 | `ErrTenantDeletionInProgress`（`store.go` 新增稳定 conflict sentinel；consumer 以 errors.Is 识别并暂停 source 消费，不重试伪造成功） | `worker.go`: Apply（投影事务写 state+cursor+outbox）/Rebuild（snapshot fence 写入）/Revoke（authority tombstone 写入）——租户删除是比 source revoke 更强的删除权威，写面让位 |

事件/committed window sink（`boards/events/**`）按租约未触碰；workitems/boards
写入口的 authorize → gate → store 次序保持不变（gate 不替代授权，只叠加
租户删除窗口约束）。

### 8.3 剩余类目查询面接线（§7.6-3 收口）

逐类目对照 canonical inventory（`service/internal/lifecycle/inventory.go`）
核对普通读取面的归属后接线；全部复用共享门 + `EvaluateReadBlock`，阻断投影
为各域跨租户 not_found 先例（同值同标识，不泄漏存在性），fail closed 覆盖
源错误与覆盖漂移：

| 域 | 门文件（新增） | 绑定类目 | 接线读取面 |
| --- | --- | --- | --- |
| projects | `projects/service/project_lifecycle_gate.go` | `project_workspace_metadata` / `project_event_index` / `project_event_outbox` | GetWorkspace / ListWorkspaces / GetDataset / ListDatasets / GetView（ViewQuery 复用）/ ListViews / UpdateView·ArchiveView（先读当前行的 composition 面）/ ListEvents / Watch（订阅建立时判定；订阅期复用 watchAuthority 失权复核节拍，不在轮询热路径加门开销） |
| locale | `locale/locale_lifecycle_gate.go` | `locale_projection` | GetOverlay（GetBundle 的 overlay 合成复用同一入口，同被门覆盖）；base bundle 为进程内 canonical catalog（无租户行存）不做阻断 |
| workflows | `workflows/service/workflow_lifecycle_gate.go` | `workflow_definitions` / `workflow_runtime_state` | GetDefinition / GetRun（WatchRunEvents 订阅存在性检查复用）/ ListDefinitions / ListRuns / ListRunEvents |
| missionbrief | `missionbrief/service/brief_lifecycle_gate.go` | `mission_brief_metadata` / `mission_brief_event_index` | GetBrief / LatestBrief / ListBriefs / ListItems / ListEvents（recheck 之后、store 之前） |
| delivery（daily_projection） | `delivery/service/delivery_lifecycle_gate.go` | `daily_projection` | DispatchDelivery 先读投影行的入口（`ErrNotFoundWrapper` 包装 `delivery.ErrNotFound`，同值语义）；GetDelivery 的其余读取消费方经投影 consumer，不经服务入口 |
| agent session | `agent/agent_session_lifecycle_gate.go` | `agent_session_projection` / `agent_session_presentation` | ListSessions / ListTurns / GetSessionSummary / ListSessionWorkspaceSummaries（在投影 rebuild 协调之前判定，避免删除期触发重建写入）/ GetAgentSessionPresentation |

测试（新增，全绿）：

- `projects/service/project_lifecycle_gate_test.go`（5 用例）：Get/List 阻断
  → `projects.ErrNotFound`；GetDataset 阻断；nil 门行为不变；源错误 fail closed。
- `locale/locale_lifecycle_gate_test.go`（3 用例）：GetOverlay 阻断；nil 门
  不变；源错误 fail closed。
- `workflows/service/workflow_lifecycle_gate_test.go`（5 用例）：GetDefinition/
  ListRuns 阻断；nil 门不变；源错误 fail closed；**跨租户 record 不误伤**。
- `missionbrief/service/brief_lifecycle_gate_test.go`（4 用例）：ListBriefs/
  GetBrief 阻断；nil 门不变；源错误 fail closed。
- `delivery/service/delivery_lifecycle_gate_test.go`（4 用例）：Dispatch 阻断
  → `delivery.ErrNotFound`；nil 门不变；源错误 fail closed；跨租户不误伤。
- `agent/agent_session_lifecycle_gate_test.go`（4 用例）：ListSessions/
  GetSessionSummary 阻断；nil 门不变；源错误 fail closed。
- `assets/projection/worker/worker_lifecycle_gate_test.go`（6 用例）：Apply/
  Rebuild/Revoke 阻断 → `ErrTenantDeletionInProgress`；nil 门行为不变；
  **purged+completed 放行**；源错误 fail closed。

### 8.4 asset 类目登记（§7.6-4 收口）

`service/internal/lifecycle/inventory.go`：`canonicalDataClasses` 新增

```text
stored("asset_metadata", "owner:workbench-asset", "gorm_repository",
  "store:asset-metadata", "operational_metadata", "bounded_operational",
  "tenant_export", "tombstone_then_purge", "scoped_signed_hold", "managed_expiry")
```

- 各维度选择依据：safe projection metadata（asset_entry_projection /
  asset_search_index / asset_search_generation；无 bytes/raw payload）→
  `operational_metadata`/`bounded_operational`；Owner canonical payload 不在
  Workbench → `tenant_export`；tombstone 终态清 title/summary/digest（只留
  reason + version + opaque ref）→ `tombstone_then_purge`；legal hold 语义与
  workitem/board 一致 → `scoped_signed_hold`/`managed_expiry`；
- **刻意不用 `rebuildable_generation`**（尽管 asset 投影是可重建派生态）：
  generation purge 通道依赖 `lifecycleGenerationPurges` 注册表，asset 表不在
  其中，`ExecuteGenerationPurge` 对该类目 fail closed。登记为
  `tombstone_then_purge` 与既有 asset 读取门（绑定 `asset_metadata`）的阻断
  窗口一致，不改变任何推进语义；
- asset 表为 additive 独立迁移（不在 `requiredSchemaModels`），因此不在
  `LifecycleStoreCatalog` 内；登记走 inventory 侧，无需 repository catalog
  变更（catalog 交叉校验只校验 catalog 内绑定，类目缺 binding 时 fallback
  `StoreBindings = [StoreRef]`）。§7.3 的「前瞻命名」由此转为真实生效：真实
  deletion record 现已覆盖 `asset_metadata`，asset 读面 + search 命中面 +
  asset 写面在该租户的删除窗口内按合同阻断。

### 8.5 未接面清单（含原因）

| 面 | 处置 | 原因 |
| --- | --- | --- |
| projects/locale/workflows/missionbrief/delivery mutation 写面 | 未接 | 本切片写阻断合同范围为 workitems/boards/assets/search 四个 planes 的 canonical 写入口（任务书）；上表各域突变面属后续同构扩展（模式已就绪：`WriteBlockGate` + 域写语义错误） |
| activity/inbox/approval 查询面（daily_projection 其余三面） | 未接 | 读路径经 `operations.ReadHandler`（registry.Handler 适配层）+ 域级 store 直读，无独立服务入口可挂门；`operations/**` 不在本片租约内。daily_projection 类目已随 delivery 面验证绑定有效性 |
| layout / navigation / CLI（`cli_command_intents`/`cli_agent_execution_grants`）/ worker registration / task planes（`task_metadata`/`task_attempts`/`task_event_index`/`safe_artifact_refs`/`transport_receipts`）查询面 | 未接 | CLI 意图/grant/worker registration 为短窗口操作型类目（`retention_purge` + 15min 过期），无跨删除窗口存续的普通读取面；task plane 读面在 CLI/Task 控制面层（`service/internal/cli/**`、registry handler），本片租约不含；其类目阻断语义已由 record 层覆盖（record 活跃即整租户窗口） |
| identity 查询面（`identity_audit`/`identity_projection`） | 未接 | `service/internal/identity/**` 租约禁改 |
| retain_audit_truth 类目（`schema_migration_history`/`workflow_receipt_refs`/`transport_receipts`） | 无需接线 | 审计 truth 类目无普通读取面（只在审计/回执通道消费）；读面合同本就不阻断 retained_audit |
| owner_canonical_payload_boundary / backup_artifacts / support_diagnostics / evidence_bundles | 无需接线 | external boundary / managed provider / filesystem 支撑类目，无 Workbench 普通查询面 |
| 运行时注入（runtime/cmd 把真实 `DeletionRecordSource` 接到本片新增的域门） | 未接 | `service/internal/runtime/**`、`service/cmd/**` 租约禁改（同 §7.6-1）；全部门为构造/Option 注入，nil = 行为不变，生产启用只需 runtime 侧统一接线 |

### 8.6 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `gofmt -l`（service/ 全树） | 干净（无输出） |
| `go vet`（lifecycle / workitems / boards / assets / search / projects / locale / workflows / missionbrief / delivery / agent 全部改动包） | 通过 |
| `CGO_ENABLED=0 go test ./internal/lifecycle/... ./internal/workitems/... ./internal/boards/... ./internal/assets/... ./internal/search/... -count=1` | ok（20 包全绿，零回归） |
| `CGO_ENABLED=0 go test ./internal/projects/... ./internal/locale/... ./internal/workflows/... ./internal/missionbrief/... ./internal/delivery/... ./internal/agent/ -count=1` | ok（全部通过；新增 31 用例全绿） |
| `CGO_ENABLED=1 go test -race ./internal/lifecycle/... -count=1` | ok（15.4s） |
| PG（`WORKBENCH_TEST_POSTGRES_URL=postgres://workbench@127.0.0.1:15440/postgres`）lifecycle + projects/service + boards | ok |
