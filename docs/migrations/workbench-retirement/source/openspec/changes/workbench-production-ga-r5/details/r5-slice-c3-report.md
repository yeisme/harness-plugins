# R5 Lane C-3（SBOM/供应链目标）切片报告

日期：2026-08-27。范围：`tasks.md` 3.4b4 五条嵌套链共 30 个开放任务（b4b2a–e、b4b4a–f、b4c1–4、b4d1–4、b4e1–4 及各级父任务）。本切片租约：`service/cmd/workbench-release/`（含 main.go）。未触碰 `service/internal/diagnostics/`（C-4 平面）、`tasks.md`、`Taskfile.yml`（新 target 见文末建议）。本文件只做索引与诚实结论；真实状态以 verification 命令与 release CLI 输出为准。

## 环境事实（决定本轮边界）

- `syft`、`skopeo`、`oras` 可用；`docker` CLI 存在但 **daemon 不可达**（`docker info` 失败）；无 `grype`/`trivy`/`cosign`/批准 signer。
- registry 网络不可达：`skopeo inspect docker://gcr.io/distroless/static-debian12@sha256:f5b4…` 在 ping 阶段 EOF。
- 因此 image 真实构建/pull/scan/sign（SC2-1/SC2-2/SC3-x/SC4-1）一律 fail-closed 留 open；本地只交付不依赖外部 provider 的 consumer 工作（SC2-3，handoff 文档明确「真实provider输入在joint阶段验证」）。

## 实现清单（文件级）

- `service/cmd/workbench-release/image_supply_chain.go`（新增，3.4b4c4 consumer 半 / SC2-3）：
  - provider-authored `workbench.image_inventory.v1alpha1` strict loader：unknown field 拒绝；恰好四个 canonical target（api/worker/migration/web，不重复不缺失）；image/config/layer/base 全部 sha256 digest；layer digest 有序唯一且有界；repository ref 只允许 host 段 `:`（host:port），path 段出现 `:` 即视为 tag，fail-closed；`@`/scheme/query/credential 词全部拒绝；platform 限定 linux+amd64/arm64；invocation/receipt/retention 只接受 safe opaque ref。
  - `loadImageSBOM`：Syft CycloneDX 1.6，`metadata.component` 必须 `type=container` 且 name/version 精确等于 inventory 声明的 repository+image/base digest；无 file component、无 private host path（复用 `containsPrivateSBOMValue`）、Syft tool identity 校验、16MiB 上限。
  - CLI-authored `workbench.image_supply_chain_report.v1alpha1`：绑定 inventory digest、container plan digest（CLI 从 plan 文件重算，`loadContainerBuildPlan` 全量复验）、builder comparison digest（`loadBuilderComparisonReport`）、artifact authority（`resolveArtifactAuthority` + `verifyContainerArtifactRoot` 精确树）、artifact SBOM digest（复用 C-5 同款 `loadArtifactSupplyChainReport` loader）；每个 distinct base identity 恰好匹配一份自描述 base SBOM，孤儿/重复/冲突 base 输入全部拒绝；target 输出固定 canonical 顺序。
  - 固定 `status=diagnostic`、`production_authorized=false`、`provider_joint_complete=false`；canonical blockers = `advisory_scan_missing`、`artifact_image_signature_missing`、`image_provider_joint_missing`、`stable_supply_chain_authority_missing`，任一 image/base 组件无 license 追加 `license_policy_incomplete`；strict loader 重算 blockers，人工提权（改 status/flag/清 blockers）拒绝。
  - 投影 `planImageSupplyChainProjection`/`validateImageSupplyChainProjection`：plan 写 O_EXCL 0600 report；validate 对全部输入重算并逐字段比对（`reflect.DeepEqual`，GeneratedAt 除外），漂移/篡改 exit 5 `image_supply_chain_report_invalid`。
  - **CLI flag 不接受任何 caller-provided image/base digest**：`--image-sbom <target>=<path>`（自定义 flag type，未知/重复 target 拒绝）与 `--base-sbom <path>`（重复 flag），expected digest 全部来自已验证文件。
- `service/cmd/workbench-release/main.go`（修改，仅 supply-chain case 与 help）：注册 `image-plan`/`image-validate` 子命令与新 flags；usage 与 printHelp 同步。
- `service/cmd/workbench-release/image_supply_chain_test.go`（新增）：正路径（plan 诊断态 exit 5 + validate 重验通过 + base SBOM 按 base identity 共享断言）、CLI `--json` envelope 冒烟、负向矩阵——tag identity、unknown inventory field、缺 target SBOM、孤儿/重复/缺 base SBOM、private path、file component、report 人工提权、SBOM 篡改、artifact 绑定漂移、未来 created_at、unlicensed 组件触发 license blocker、flag type 拒绝。

## 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `CGO_ENABLED=0 go test ./service/cmd/workbench-release -count=1` | ok（含 9 个新 Image 测试） |
| `CGO_ENABLED=1 go test -race ./service/cmd/workbench-release -count=1` | ok（7.6s） |
| `go vet ./service/cmd/workbench-release` | 通过 |
| `CGO_ENABLED=0 go test ./service/... -count=1` | 全部 ok，无失败 |
| `bun test tests/supply-chain-contract.test.ts` | 3 pass / 0 fail |
| `workbench-release supply-chain image-plan --environment integration --json`（缺输入冒烟） | fail-closed `image_supply_chain_input_invalid` exit 2，envelope 形状正确 |
| component evidence（`bun scripts/test-evidence/run.ts --layer component --project client/yeisme-workbench -- env CGO_ENABLED=0 go test ./service/cmd/workbench-release -run 'SupplyChain\|Image' -count=1 -v`） | **passed**，exit 0，redaction total=0，run-id `20260827155140-30459c15-893f-4351-b11b-fd0db2bb1f26`（六件套齐全，0600） |
| `openspec validate workbench-production-ga-r5 --strict` | valid（含本报告写入后） |

本轮 evidence runner 一次通过，未触发 source-snapshot「source changed」阻断；如后续并行窗口复跑被阻断，按 concurrent 分类处理。

## 逐任务结论（30 项）

### 可本地推进项

- **3.4b4c4 实现image inventory/SBOM consumer并完成joint — 不可勾选（consumer 半完成，joint 阻塞）**。consumer 部分（SC2-3：strict inventory/SBOM validator + CLI-authored image report + unit/race/component evidence）已完成并验证，acceptance 中「unknown field、missing target、wrong image/base/layer/artifact/plan/SBOM、manual elevation 阻断」均有测试覆盖。剩余阻塞：joint（SC2-4）需真实 provider inventory 与 `task supply-chain:image:verify` integration evidence——registry/daemon 不可用 + SC2-0/2-1/2-2 未成立；且新 Taskfile target 未落地（本切片禁改 Taskfile.yml）。

### 外部依赖阻塞项（本地不可实现，保持 open，无证据不勾选）

- **3.4b4 / 3.4b4b / 3.4b4c / 3.4b4d / 3.4b4e（父任务）**：均依赖各自子链全部完成，当前均不可勾选。
- **3.4b4b2（含 b2a–b2e）**：provider 决策（b2a 需 deployment/registry/KMS owner 到位）、provider 仓库 adapter（b2b，paths 在 provider repository，非本租约）、signed runner policy（b2c）、KMS/Ed25519 signer 与 managed trust（b2d）、两个隔离 builder 独立签收（b2e）全部为 provider/security/KMS 外部工作面；本环境无 KMS/registry/CI provider，fail-closed 留 open。
- **3.4b4b4（含 b4a–b4f）**：staging managed anchors、真实 cross-builder comparison、Unknown/reconcile、key overlap、revoke/replay、故障回滚六环全部需 provider sandbox 与 staging；无环境，留 open。
- **3.4b4c1**：image builder/registry/SBOM profile 批准属 decision owner；且依赖 3.4b4b4。留 open。
- **3.4b4c2 / 3.4b4c3**：四目标 image 构建发布与 image/base SBOM 真实生成需批准的 container builder 与可达 registry；本机 daemon 不可达、gcr.io ping EOF，已实测确认不可用，留 open。
- **3.4b4d1**：scanner/DB/license/advisory policy 批准属 dependency/security decision owner；当前环境无 Grype/Trivy，按 handoff「scanner 缺失不得解释为 pass」，留 open。
- **3.4b4d2**：scanner adapter 与 signed scan receipt 的 paths 为 scanner provider 侧（adapter/receipt/trust/**redaction**/tests），其中 redaction 平面属 C-4 租约；非本切片工作面，未触碰。
- **3.4b4d3 / 3.4b4d4**：完整 scan 与 exception lifecycle、独立签收，需真实 scanner+DB 与独立 approver，留 open。
- **3.4b4e1**：OCI signing/trust profile 未批准——signature format 与 identity 约束未冻结，verify receipt 合同无真源；留 open。
- **3.4b4e2**：签名与发布需批准 signer + registry referrer；环境缺失，留 open。
- **3.4b4e3（signature consumer）**：**合同未冻结，主动不实现**。tasks.md 写明其 Dependencies 为「3.4b4e2 schema/trust 冻结」；handoff §6.3 只描述 verify receipt 语义、未给合同名与字段。在 profile 未定的情况下自行发明 verifier schema 属于伪造无合同能力，违反 fail-closed 原则。
- **3.4b4e4（stable aggregator）**：`workbench.stable_supply_chain_authority.v1alpha1` 需聚合 scan/exception/signature verify receipt 的 digest/freshness/revocation，而这些上游 receipt 合同均未冻结（b4d2/b4e3 阻塞）；当前实现的 image report 已是其未来输入之一。留 open，避免反向发明上游合同。

### 与 C-5 supply_chain section 的对接

C-5 的 `manifestSupplyChain`（`manifest_stable.go`）消费 `loadArtifactSupplyChainReport` 的诊断 report 并把 blockers 压入 manifest；本切片 image report 复用同一 loader 绑定 artifact SBOM digest，作为 stable aggregator（3.4b4e4）的未来直接输入，未改动 C-5 的任何文件或合同。

## 建议的 Taskfile 新 target（本切片禁改 Taskfile.yml，交由主代理/后续切片落地）

```yaml
task supply-chain:image:plan    # workbench-release supply-chain image-plan ...
task supply-chain:image:verify  # workbench-release supply-chain image-validate ...（handoff §9 既定名）
task test:supply-chain-image:component  # test-evidence runner 包装 supply-chain image go test（本轮 evidence 即用此形态直跑）
```

## 边界与并行冲突说明

- **文件租约**：只新增/修改 `image_supply_chain.go`、`image_supply_chain_test.go`、`main.go`（supply-chain case + help）与本报告。`manifest.go`/`promotion.go`/`container_*.go`/`deployment_receipt.go` 等同目录其他改动均为 C-1/C-2/C-5 代理在先的在制品，未触碰；`service/internal/diagnostics/`（C-4）零接触。
- **dist 副产物**：为 CLI 冒烟重建了 `dist/workbench-release`（git 忽略，非 tracked 变更）。
- **设计取舍（需主代理知晓）**：① image report 不强制「三个 Go target 共享同一 base digest」——handoff §4.1 原文为「如果…可以复用」，consumer 只要求每个 inventory 声明的 distinct base 有唯一匹配 SBOM 且无孤儿输入；② inventory 的 `joint_evidence_digest` 只做 digest 形状校验，joint 真相由 SC2-4 真实执行背书，diagnostic report 的 `image_provider_joint_missing` blocker 保证其不被误认为已完成；③ `CreatedAt` 仅拒绝未来时间，freshness 窗口留给 stable aggregator（SC4-3）统一执行。
