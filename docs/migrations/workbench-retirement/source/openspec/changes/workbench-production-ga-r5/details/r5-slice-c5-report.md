# R5 Lane C-5（stable v3 manifest schema）切片报告

日期：2026-08-27。范围：主代理指派的 C-5 硬依赖子切片——`tasks.md` 3.4d2b2b5b3 的 **stable v3 schema/generator/validator 与 alpha migration**（`manifest` 平面 + Taskfile manifest 目标）。C-5 其余 authority 适配器任务（3.4d2b2b1b2 / 3.4d2b2b2b / 3.4d2b2b3 / 3.4d2b2b4 / 3.4d2b2b5）不在本切片租约内，未触碰。本文件只做索引与诚实结论；真实状态以 verification 命令与 release CLI 输出为准。**未编辑 `tasks.md`**，勾选由主代理统一收口。

## 实现清单（文件级）

- `service/cmd/workbench-release/manifest_stable.go`（新增）：stable v3 三个 required section 的 schema 与 resolver——
  - `manifestHandoffAuthority`：registry digest/revision + 每个 canonical handoff 的 provider/consumer/integration/rollback 四门独立 owner/digest 摘要（不只保留聚合计数），从已验证的 CLI-authored handoff registry 派生，任一 package 未四门 ready 即 fail-closed；
  - `manifestSupplyChain`：绑定 `workbench.supply_chain_artifact_report.v1alpha1` 诊断报告（复用 C-3 的严格 loader，不改其合同），校验 environment/artifact/artifact-report 绑定与 freshness（`MaxSupplyChainAge`）；**report blockers 原样进入 section，非零即把 manifest 压回 `blocked`**——当前 provider 未完成时 v3 candidate 不可达，符合 freeze matrix 的 No-Go 规则；
  - `manifestDeploymentContract`：绑定 env-pinned（`WORKBENCH_PLATFORM_TRUST_BUNDLE_DIGEST`）platform trust bundle，确定性选出 approval/deployment 两 role 在生成时刻有效的 active key 及其 expiry；无有效 key、digest 漂移、revoked 均 fail-closed；**不记录任何 deployed 状态**（deployment truth 仍属 3.3b/平台 receipt）。
  - 三个 `completeManifest*` 形状校验与三个 `sameManifest*` 相等性函数。
- `service/cmd/workbench-release/manifest.go`（修改）：
  - 新常量 `manifestSpecVersionV3 = "workbench.release_manifest.v3"`（与 promotion.go 既有 `promotionStableManifestSpec` 字符串一致，C-1/C-2 文件零改动）；
  - `releaseManifest` 新增三个 `omitempty` section 字段；`manifestSourceOptions` 新增 `StableBaseManifest/SupplyChainReport/DeploymentTrustBundle/DeploymentTrustDigest/MaxSupplyChainAge`；
  - `buildManifest` 新增 stable 升级段：要求 v3alpha6 candidate base（`--stable-base-manifest`，`sameManifestInputs` 全等校验）+ 三类 authority 齐备才升级 v3——**stable 只能由 CLI 从 authority 重生，alpha 原地改版本不可能**（新 section required 且 digest 必然变化）；
  - `loadManifest` 接受 v3：required 全集 = artifact + restore（v3 强制 restore authority）+ openspec_capability + review + slo + runtime_registries + handoff_authority + supply_chain + deployment_contract；旧版本携带任一 stable-only section 即拒绝；unknown fields 由 `loadStructuredJSON` 的 `DisallowUnknownFields` 拒绝；version window 保持 v2/v3alpha1–6 只读诊断可读；
  - generate/validate 投影新增 `stable_source_invalid`（exit 5）错误映射；`manifestProjection` 新增三个 section 的 digest 级 data keys；`sameManifestInputs` 覆盖新 section（validate 重建比对可捕获 authority 漂移/key 过期）。
- `service/cmd/workbench-release/main.go`（修改，仅 manifest 命令块与 help）：`manifest generate|validate` 新增 `--stable-base-manifest`、`--supply-chain-report`、`--deployment-trust-bundle`、`--max-supply-chain-age` flags（trust digest 只能由 env 钉住，CLI flag 不得覆盖）；help 用法行与 `WORKBENCH_PLATFORM_TRUST_BUNDLE_DIGEST` 说明同步。
- `Taskfile.yml`（修改，仅 `release:manifest:generate` / `release:manifest:validate` 两个目标）：新增 `STABLE_BASE_MANIFEST` / `SUPPLY_CHAIN_REPORT` / `DEPLOYMENT_TRUST_BUNDLE` / `MAX_SUPPLY_CHAIN_AGE` 变量透传。
- `service/cmd/workbench-release/manifest_stable_test.go`（新增）：
  - generator 正路径：完整 alpha6 链 + 三类 authority → 生成 v3，因 supply-chain 诊断 blockers 保持 `blocked` 并透传 blocker IDs；loadManifest/inspect/validate 行为断言；
  - fail-closed 矩阵：partial options、缺 base、alpha5 base（version window 外）、caller 替换 trust digest、revoked platform key、stale supply-chain report、异 artifact report 全部 `errStableSourceInvalid`；投影层 `stable_source_invalid` exit 5；
  - golden v3 candidate（形状合法、supply-chain 零 blocker，代表 provider 齐备后的真实 CLI 输出）：
    - **C-1 正路径解锁**：`promotion init/plan/validate/advance` 全过，`advance` 到 integration 成功（`authoritative`），不再返回 `manifest_upgrade_required`；
    - **C-2 授权分支解锁**：`container plan` 生成 `status=planned, build_authorized=true` 且 `container validate` 重验通过；
  - 兼容矩阵：v2/v3alpha1 旧版本仍可读；alpha relabel（删 section 改版本号）、v3 缺任一 required section（8 节逐一）、alpha6 携带 stable section、unknown top-level field、supply-chain/handoff 绑定 digest 漂移全部拒绝；
  - canonical digest：同输入两次生成逐字节一致（`fileDigest` 相等 + `sameManifestInputs`）。

## 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `CGO_ENABLED=0 go test ./service/cmd/workbench-release -count=1` | ok（含 6 个新 StableV3 测试） |
| `CGO_ENABLED=1 go test -race ./service/cmd/workbench-release -count=1` | ok（5.0s） |
| `go vet ./service/cmd/workbench-release` | 通过 |
| `CGO_ENABLED=0 go test ./service/... -count=1` | 全部 ok（无 collateral 失败） |
| `bun test tests/release-gates.test.ts tests/release-state.test.ts tests/container-contract.test.ts tests/taskfile-docs-contract.test.ts` | 16 pass / 0 fail |
| `bun test`（全量 728 tests / 124 files） | 0 fail（两次独立运行均 exit 0；更早一次后台运行出现 1 fail，未抓到失败名，见「并行冲突」） |
| `bun run typecheck` | 通过 |
| `openspec validate workbench-production-ga-r5 --strict` | valid |
| `workbench-release manifest generate --stable-base-manifest ...`（CLI 冒烟） | flag 接线正确，缺 artifact authority 时 fail-closed `artifact_source_invalid` exit 5 |

Component evidence 六件套：`temp/integration-test-runs/20260827103041-b32dba35-359f-40ad-ae10-9f2e765b620f/`（`task test:release-gates:component`，内含 `task release:gates:test` 全量通过；status=passed，exit 0，redaction total=0，文件 0600）。

## 逐任务结论

### 3.4d2b2b5b3 实现 stable v3 schema/generator/validator 与 alpha migration — 不可勾选（实现完成，acceptance 部分未达成）

已实现：schema（三个 required section + 聚合）、generator（CLI 从 authority 重生，禁止 alpha 改版本）、validator（loadManifest v3 + 形状/绑定/漂移拒绝）、alpha migration 路径（v3alpha6 candidate base + `sameManifestInputs`）、golden/兼容矩阵/race/vet 验证。

阻塞（按 tasks.md 原文逐项）：
- Dependencies `3.4d2b2b5b2`（收敛外部 authority providers）仍 open：supply-chain provider（WP-SV3-G2–G4）、已批准 deployment platform（SV3-H）、独立 handoff 签收（SV3-F）均未到位。
- Expected「首个真实 `workbench.release_manifest.v3` candidate」**当前不可产出且不应产出**：现有 supply-chain report 合同只允许诊断态（canonical blockers 非空），generator 正确地保持 `blocked`；freeze matrix 规定任一 authority partial/blocked 即 No-Go。
- Verification 中的 component evidence 已产出（上表）；system 层 evidence 需真实 staging 窗口，属后续切片。

### 3.3a2（C-1 authoritative advance core）— 不可勾选，但本切片已移除其 schema 阻塞

C-1 报告中的阻塞「`loadManifest` 尚不接受 v3」已解除：golden 测试证明合法 v3 candidate 通过 `promotion validate`（exit 0）与 `advance`（authoritative 推进成功）。`promotion.go` 的 `promotionStableManifestSpec` 门零改动即放行。剩余阻塞（真实 v3 candidate 生成、stage-specific soak/restore/review/handoff authority）属 C-5 其余任务与外部 provider。

### 3.4b3b2b（C-2 authorized container plan）— 不可勾选，但授权分支已可放行合法 v3

golden 测试证明 `container plan` 对合法 v3 candidate 生成 `build_authorized=true` 的 planned plan 且 `container validate` 重验通过；`container_plan.go` 零改动。剩余阻塞：3.3a2 真实执行、3.4b2b（artifact set + approved builder）、真实 handoff authority。

### 3.4d2b2b5b（冻结 stable v3 聚合与旧 alpha 迁移，父任务）— 不可勾选

依赖 b3（本切片，见上）与 b4（platform preflight 联通，未开始）。

### C-5 其余任务（3.4d2b2b1b2 / 3.4d2b2b2b / 3.4d2b2b3×3 / 3.4d2b2b4×5 / 3.4d2b2b5×5）— 不在本切片范围

按主代理租约划分未触碰，状态不变。

## 边界与并行冲突说明

- **文件租约**：只改了 `manifest.go` / `manifest_stable.go`（新）/ `manifest_stable_test.go`（新）/ `main.go` manifest 块与 help / `Taskfile.yml` 两个 manifest 目标 / 本报告。`promotion*.go`、`container_*.go`、`deployment_receipt.go`、`supply_chain.go`、`handoff_writer.go` 等 C-1/C-2/C-3 平面文件零改动（golden 测试只消费其包内 helper）。
- **设计取舍（需主代理知晓）**：① v3 强制 restore authority（对齐 3.4d2b2b2b acceptance「manifest v3 candidate 强制 restore authority」），alpha 链中 restore 可选的宽松性不带入 stable；② supply-chain blockers 非零 → v3 只能 `blocked`，即「schema 就绪 ≠ candidate 可达」，候选生成等 WP-SV3-G/H provider；③ deployment_contract 只绑 trust/issuer/active key + expiry，platform 选定（SV3-H）后如需 platform ID/adapter 版本属 additive optional 扩展或下一 major。
- **并发 flake**：`task release:gates:test` 中 `release-state.test.ts` 内嵌的 evidence runner（`bun --version` 包装运行）两次因 `source changed while the evidence command was running` 失败（run `20260827102328-14d9acbb-…`、`20260827102804-15e5219a-…`，如实保留）——并行代理在运行窗口写 tracked 文件触发 runner 的 source-snapshot 保护，属 concurrent/environment 类失败，非本切片引入；同一命令随后在静默窗口多次通过（含 component 证据运行内的一次全量通过）。全量 `bun test` 一次后台运行出现 1 fail 但未捕获失败测试名，随后两次完整重跑均 0 fail。
- 治理节奏第 2 条（重跑 `bun scripts/execution-dag-snapshot.ts` 刷新 DAG）未执行：本切片未关闭任何 tasks.md 条目，无 unblock 事件需要投影。
