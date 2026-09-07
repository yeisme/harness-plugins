# R5 Slice F-2 Lifecycle 执行链执行报告

日期：2026-08-27。范围：`openspec/changes/workbench-production-ga-r5/tasks.md` 的 6.0b1–6.0b5，共 5 项开放任务。切片定义见 `details/r5-open-slice-governance-plan.md` §4；本片写入租约：`service/internal/lifecycle/` 与 `service/cmd/workbench-lifecycle/`。

## 1. 总结

- 5 项任务**无一可勾选**：5 项的 Verification 均为 `task data-lifecycle:system ENV=staging`，该 Taskfile target **尚不存在**，且本轮任务纪律禁止修改 `Taskfile.yml`；system gate 还需要 staging 等价环境与（6.0b4）4.3 restore verifier、（6.0b5）6.0b1–b4 全部完成后的跨存储联合门。本地合同层不得代替 system evidence。
- 本地可交付部分已做实：6.0b1 export plan/manifest 合同、6.0b2 delete/tombstone/purge 确定性状态机、6.0b3 generation purge 与旧索引授权阻断，全部带 fail-closed 负测，CGO_ENABLED=0/1 + race 全绿。
- 未实现 6.0a3 的 retention/hold 语义（外部未冻结）：凡 `legal_hold_policy` 要求 scoped/provider hold 的类目，purge 一律 `purge_blocked_hold` fail closed；`provider_receipt_required` 的 backup 类目不本地删除。deletion record 因此**永远不可能在当前语义下标 completed**——这是对"未完成 purge 不标 completed"与"不伪造"的直接编码。

## 2. 逐项结论

| 任务 | 结论 | 本地已交付 | 不可勾选原因 |
| --- | --- | --- | --- |
| 6.0b1 export | open | `TenantExportPlan`/`TenantExportManifest` 合同：每 data class 按 export_policy 落到 export/manifest_only/excluded；完整性（每类恰好一条）、有界性、租户/candidate/environment 隔离、`ContainsOwnerPayload` 硬断言 fail closed；manifest 绑定导出目录真实 sha256 checksum；manifest_only/excluded 类目出现数据文件即拒绝；缺失文件只记 unknown 且只能经 reconcile 收敛（终态 entry 不可改写）；CLI `export-plan-generate/-validate`、`export-manifest-record/-validate/-reconcile` | Verification target 不存在；真实 DB 行级导出执行器在 repository 层（本片租约外）；staging system evidence 未产生 |
| 6.0b2 delete/tombstone | open | `DeletionRecord` 状态机：绑定 action=delete request（request_ref+idempotency key）；所有 Workbench-owned 类目先 tombstoned；purge 为确定性推进（`retain_audit_truth`→retained_audit；hold 类目→purge_blocked_hold；其余→purged）；`ApplyDeletionPurge` 幂等（无变化原样返回不写盘）且状态只前进不后退；`ValidateDeletionRecord` 确定性重建——伪造 completed、手改 entry 状态、跨 request/tenant 全部 fail closed；CLI `deletion-record-create`、`deletion-purge-apply`、`deletion-record-validate` | "立即阻止普通读取"的执行点是 repository/service 查询层（本片租约外），record 层只提供权威标记；legal hold 阻断依赖 6.0a3 语义冻结（外部）；system evidence 未产生 |
| 6.0b3 generation 清理 | open | `GenerationPurgeRecord`：只覆盖 `rebuildable_generation` 派生类，非派生类混入即漂移拒绝；generation 单调链（`--previous` 强制不回退）；`AuthorizeDerivedGenerationAccess` 实现"旧索引不可授权访问"（≤水位拒绝、未覆盖类拒绝）；CLI `generation-purge-generate/-validate`、`generation-access-check` | 派生投影的实际重建与"DB truth 与派生物 reconcile"的执行在各 owning component（本片租约外）；system fault matrix evidence 未产生 |
| 6.0b4 retention/backup expiry | open | —（未实现任何未冻结语义，防伪造） | Dependencies 6.0a3 open（hold/backup expiry 语义冻结属外部 privacy/security + managed DB + Owner provider）；4.3 restore verifier 与 managed backup authority 外部；"backup 只由 managed authority 证明 expiry"禁止本地文件冒充 provider receipt |
| 6.0b5 joint system gate | open | — | Dependencies 6.0b1–6.0b4 均未关闭；需 frozen candidate + staging 环境 + `task data-lifecycle:system` target + privacy/security/DB owners 联合验收；fixture-only 被 Failure recheck 明确禁止 |

## 3. 实现清单（本片代码改动）

- `service/internal/lifecycle/execution_export.go`（新增）：6.0b1 export plan/manifest 合同与 reconcile；`writeNewExecutionAsset`（O_EXCL 0600 共享写入）。
- `service/internal/lifecycle/execution_delete.go`（新增）：6.0b2 deletion record 状态机 + 6.0b3 generation purge record 与派生访问授权。
- `service/internal/lifecycle/execution_export_test.go`（新增）：完整性/有界性/租户隔离/checksum 漂移/unknown reconcile/禁止类目出现数据文件/symlink artifact 负测。
- `service/internal/lifecycle/execution_delete_test.go`（新增）：tombstone→purge 推进、hold fail-closed、幂等重放、伪造 completed/手改 entry/跨 request 负测、generation 单调链与访问授权、strict load 拒收手写 JSON。
- `service/cmd/workbench-lifecycle/main.go`（修改）：11 个新子命令接线 + help/usage 更新；输出合同（summary/JSON envelope/agent key=value/explain）与既有命令一致，不暴露私有路径。
- `service/cmd/workbench-lifecycle/main_test.go`（修改，additive）：export/deletion/generation 三条 CLI 全链路测试 + fail-closed 用例；help 合同锁定新命令与 flag。
- `service/internal/lifecycle/lifecycle_request.go`（gofmt 对齐，仅空白；该文件 HEAD 即未过 gofmt，顺手对齐使 `gofmt -l` 干净，无行为变化）。

## 4. 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `gofmt -l service/internal/lifecycle service/cmd/workbench-lifecycle` | 干净（无输出） |
| `go vet ./service/internal/lifecycle/ ./service/cmd/workbench-lifecycle/` | 通过 |
| `CGO_ENABLED=0 go test ./service/internal/repository ./service/internal/lifecycle ./service/cmd/workbench-lifecycle -count=1` | ok（repository 39.6s / lifecycle 3.9s / CLI 0.7s） |
| `CGO_ENABLED=1 go test -race ./service/internal/lifecycle ./service/cmd/workbench-lifecycle -count=1` | ok（lifecycle 11.4s / CLI 2.6s） |
| `task data-lifecycle:inventory:test`（上述三包 go test + `bun test tests/lifecycle-inventory.test.ts`） | 全绿（bun 2 pass / 0 fail，36 assertions） |
| `task test:data-lifecycle-inventory:component` | 见下方 run 记录 |

component evidence run 记录（runner 带 source-snapshot fail-closed 门）：

- run-id `20260827155519-8949d309-fe43-46c6-a68b-8005f213e744`：failed（非产品原因）。底层 `task data-lifecycle:inventory:test` 全部通过（go 三包 ok、bun 2 pass / 0 fail），但 runner 在运行期间检测到 tracked 文件被并行代理写入，触发 `source changed while the evidence command was running`。分类：`concurrent`。失败六件套（summary/command/stdout/stderr/env/digest/receipt/redaction，redaction 0 泄漏）留盘未改写。
- run-id `20260827155637-a035e09d-1abc-47a3-be16-41a12dd8db19`：同上，`source changed` 再次触发。分类：`concurrent`。
- 按本轮纪律重试不超过两次，已停止；需在无并发写入的稳定窗口重跑 `task test:data-lifecycle-inventory:component` 取得 passed 六件套。

## 5. 与既有合同的一致性核对

- 未改 tasks.md、未改 Taskfile.yml、未触碰其他平面文件；`tests/lifecycle-inventory.test.ts` 未改且仍全绿（既有 Taskfile target 集合断言不受影响）。
- 新资产全部 CLI 生成（canonical digest + O_EXCL 0600 + `DisallowUnknownFields` strict load），caller 手写 JSON 不被接受；`production` candidate 在 plan/record 两侧均被拒绝；CLI 输出保持 `production_authorized=false`，JSON/agent 输出不暴露私有路径（有测试断言）。
- 未生成任何 receipt/trust/authority 资产；export manifest 的 unknown 状态如实保留，不得自动重试为 complete。

## 6. 阻塞项与升级路径

1. **`task data-lifecycle:system` target 缺失**（6.0b1–6.0b5 共同 Verification）：需 Taskfile 所有者在后续窗口新增 system gate target（本片被明确禁止修改 Taskfile.yml）；建议 target 串联 export→delete→tombstone→generation purge→retention/backup 核验并走 evidence runner。
2. **repository/service 执行点**（6.0b1 行级导出、6.0b2 读取阻断、6.0b3 派生重建）：在本片租约外，需对应平面代理以本片的 plan/record 为权威输入接执行器。
3. **6.0a3 语义冻结**（6.0b2 hold purge、6.0b4）：外部 privacy/security + managed DB + Owner provider owners；冻结前 hold 类目保持 `purge_blocked_hold`。
4. **4.3 restore verifier / managed backup authority**（6.0b4）与 **staging 联合门**（6.0b5）：外部环境与独立验收。
5. **component evidence run**：两次 attempt 均被 `source changed`（并行代理 tracked 写入）阻断，分类 `concurrent`（run-id 见 §4）；需在稳定窗口重跑 `task test:data-lifecycle-inventory:component` 取得 passed 六件套。

## 7. 诚实性声明

本片未勾选任何 checkbox、未修改 `tasks.md`/`Taskfile.yml`、未实现未冻结的 hold/retention/backup expiry 语义、未以本地文件冒充 provider receipt；deletion record 在当前冻结状态下不可能输出 `completed`，所有 CLI 保持 `production_authorized=false`。
