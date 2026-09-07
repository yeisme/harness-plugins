# R5 Lane C-1（Promotion 状态机）切片报告

日期：2026-08-27。范围：`tasks.md` 3.3a2 / 3.3a / 3.3b / 3.3c / 3.3（编号以治理方案为准）。本文件只做索引与诚实结论；真实状态以 verification 命令与 release CLI 输出为准。**未编辑 `tasks.md`**，勾选由主代理统一收口。

## 实现清单（文件级）

- `service/cmd/workbench-release/promotion.go`（修改）：record schema 扩展为 additive `workbench.promotion_record.v1alpha2`（blockers/stage_evidence/transitions/applied_operations/paused/rollback_binding）；v1alpha1 诊断 record 禁止携带任何 authority 字段；v1alpha2 强制审计链不变量（draft 起链、transition table 逐跳合法、revision 消费唯一且最大值等于 record revision，同次 mutation 的 transition↔operation 允许共享一次 revision）；plan 增加 outstanding-plan 保护与 `--supersede-plan` 显式取代；planned transition 记录自身消耗的 revision。
- `service/cmd/workbench-release/promotion_advance.go`（新增，3.3a2/3.3a）：`promotion advance` 权威推进核心。plan→advance 两阶段（advance 必须消费匹配的 planned transition）；per-stage authority 表（integration/staging/canary←脱敏 evidence bundle，production_ready←签名 review decision，deploying←签名 production approval，production/rolled_back←签名 deployment receipt）；stable v3 之前一律 `manifest_upgrade_required`（exit 5）；幂等重放（response 丢失后同目标重试 no-op 成功）；pause 阻断 forward、放行 failed/rolled_back 安全方向；audit transition 追加 evidence/approval/receipt digest。
- `service/cmd/workbench-release/deployment_receipt.go`（新增，3.3b）：`workbench.production_approval.v1alpha1`、`workbench.deployment_receipt.v1alpha1`、`workbench.platform_trust_bundle.v1alpha1` schema；Ed25519 签名验证；trust digest 只能由 `WORKBENCH_PLATFORM_TRUST_BUNDLE_DIGEST` 环境变量钉住（CLI flag 不得覆盖）；receipt 绑定 environment/capability/promotion/tenant/artifact/manifest + approval digest 链；revision 防回退（approval 必须等于被批准 revision，receipt 不得早于 deploying 授权 revision）；planned/partial/deployed/failed/aborted/rolled_back/unknown 七态，partial 永不直达 production；`promotion resolve-deployment` 只读 resolver（测试证明零 mutation）。私钥只存在于测试内存。
- `service/cmd/workbench-release/promotion_control.go`（新增，3.3c）：`promotion pause|resume|abort|rollback-plan`。全部走 revision CAS + idempotency key（同 key 重试返回 `idempotent_replay` 且零副作用；跨操作复用同 key 报 `promotion_control_conflict`）；pause/abort/rollback-plan 强制 workflow drain digest 门（缺失 → `workflow_drain_required` exit 5）；abort 只追加审计、保留 receipt/evidence 引用（partial truth）；rollback 必须先 rollback-plan 绑定 current signed receipt + previous compatible artifact + compatibility digest，再由 advance 消费 `rolled_back` receipt 提交；诊断 record（v1alpha1 draft）上的控制操作全部拒绝。
- `service/cmd/workbench-release/main.go`（修改）：注册 6 个新子命令 + help 文本；usage 更新。
- `Taskfile.yml`（修改）：新增 `release:promotion:advance|resolve-deployment|pause|abort|rollback-plan` 五个目标，全部经 `production:guard`（advance/pause/abort/rollback-plan 为 `EFFECT=write`，resolve-deployment 为 `read`）。
- 测试：`promotion_advance_test.go`、`deployment_receipt_test.go`、`promotion_control_test.go`（新增），`promotion_test.go`（plan 签名适配），`tests/release-gates.test.ts`（新目标 discoverability 断言）。

## 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `CGO_ENABLED=0 go test ./service/cmd/workbench-release -count=1` | ok（含新增 advance/receipt/control 单测与并发 CAS 测试） |
| `CGO_ENABLED=1 go test -race ./service/cmd/workbench-release -count=1` | ok（4.4s） |
| `go vet ./service/cmd/workbench-release` | 通过 |
| `CGO_ENABLED=0 go test ./service/... -count=1` | 全部 ok（无 collateral 失败） |
| `task release:gates:test` | 23 pass / 0 fail |
| `bun test`（全量） | 714 pass / 0 fail |
| `bun run typecheck` | 通过 |
| `openspec validate workbench-production-ga-r5 --strict` | valid |
| `task production-targets:generate && task production-targets:validate` | registry 与当前 Taskfile/help digest 一致；exit 5 `production_targets_blocked` 为既有 program 状态（17 planned），非本切片引入 |
| `task release:promotion:dry-run ENV=integration` | **fail-closed**：`promotion_record_invalid` exit 2（无 CLI-authored record，因为 candidate manifest 当前无法真实生成——requirements/handoff 证据链属其他 lane，仍 blocked） |
| `task release:promotion:advance ENV=integration ...` / `task release:promotion:pause ...` | 均 fail-closed `promotion_record_invalid` exit 2，production:guard 接线正确 |
| `task release:handoff:validate ENV=integration` | **未通过（既有状态）**：exit 5 `handoff_incomplete`，1/6 ready；缺口为 handoff provider/consumer 证据（其他 lane/authority），非本切片引入 |

Component evidence 六件套：`temp/integration-test-runs/20260827091043-31a694a9-ff0d-450b-abaf-e23cd9364b0b/`（`task release:gates:test`，status=passed，exit 0，redaction total=0，0600 权限）。首次运行因并行代理写入工作树触发 runner 的 source-snapshot 保护而失败（`temp/integration-test-runs/20260827090856-643e477a-80ac-4ebf-93ce-ce25189af289/`，如实保留），重跑通过。

## 逐任务结论

### 3.3a2 authoritative advance core — 不可勾选

已实现：advance 核心、authority 表、CAS、审计链、幂等重放；负矩阵（alpha/stale/wrong environment/capability/artifact/self-authored 或未脱敏 evidence/authority drift/revision 冲突）全部有测试。
阻塞：Dependencies `3.4d2b2b5b3`（stable v3 schema/generator）未完成，`loadManifest` 尚不接受 `workbench.release_manifest.v3`，CLI 正路径在 manifest 门 fail-closed；soak/restore/review/handoff 的 stable stage authority 同属 C-5。正路径 component/system authority matrix 需等 C-5 落地后真实执行。

### 3.3a CLI-authored promotion record 与 CAS 状态机 — 不可勾选

已实现：v1alpha2 record、transition table、原子 create/update、并发单 winner（lock+CAS，测试 32 goroutine）、alpha→`manifest_upgrade_required`、CLI JSON/agent 输出与私有路径不泄漏测试。
阻塞：Verification 要求 `task release:promotion:dry-run ENV=integration` 真实通过；当前 manifest candidate 需要全部 requirements verified + 6/6 handoffs ready（真实证据缺口在其他 lane），dry-run 只能 fail-closed。Dependencies 含 3.3a2（见上）。

### 3.3b signed production approval 与 deployment receipt resolver — 不可勾选

已实现：三类 schema、签名/trust 解析、绑定链、七态映射、只读 resolver 命令；负矩阵测试覆盖 caller 自建 trust、wrong target、tamper、stale/future、revision regression、revoked key、role 混淆、partial→Production。
阻塞：硬依赖 `2.0b`（deployment platform 冻结）未完成——没有批准的 platform issuer/key/trust bundle 来源，真实 receipt 无法存在；adapter contract 只有 fixture 层证据。按治理原则"只有 fixture 一律投影 blocked"。

### 3.3c pause/abort/rollback plan 与 active-workflow 保护 — 不可勾选

已实现：pause/resume/abort/rollback-plan、CAS+幂等、drain 门、partial truth 保留、rollback 绑定链；单测覆盖幂等重放、key 冲突、无 drain fail-closed、无 binding/错误 artifact 的 rollback 拒绝。
阻塞：Dependencies 含 R4 workflow closeout（R4 `10.5` 仍 open）：workflow drain 目前只能 digest 钉扎，无权威 drain receipt 格式；"active workflow 先 pause claim/dispatch 并保留 lease/receipt/reconcile" 的 component/system 测试需要真实 workflow adapter 证据。

### 3.3 promotion 状态机与 approvals（父任务）— 不可勾选

依赖 3.3a–3.3c 全部关闭；acceptance"production transition 要求 external approval 与 signed deployed receipt"依赖 2.0b；`task release:promotion:dry-run ENV=staging` 与 3.3a 同一 manifest 缺口。

## 边界说明

- 治理方案 C-1 出口提到"状态迁移、幂等与失败路由有四传输 parity 测试"。promotion state 按 tasks.md 执行规则由 CLI 生成（CLI-local record，0600/原子替换），不经过 service 的 HTTP/gRPC/JSON-RPC/SDK 四传输；若主代理认定 promotion 需要成为 registry Operation 并做四传输 parity，需新增 service Operation，涉及 `service/internal/registry` 等其他平面的文件所有权，超出本切片范围，建议回到治理方案裁定。
- `release:handoff:validate` 未通过为既有 blocked 状态（1/6 ready），属 C-5/handoff 证据链，不是 C-1 回归。
