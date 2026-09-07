# R5 切片 C-2 制品集与容器目标 执行报告

日期：2026-08-27。范围：`tasks.md` 3.4b2b、3.4b3（含 b3a–b3c 嵌套链），共 6 项开放任务。切片出口标准（完整 artifact set 关闭 + approved builder 证明 + container build/smoke 对真实镜像通过 + digest 绑定进 manifest）**未达成**，切片保持 open；本报告逐项给出可勾选/不可勾选结论与证据。

## 逐项状态

| 任务 | 结论 | 原因与证据 |
| --- | --- | --- |
| 3.4b2b 关闭完整 production artifact set 与 approved builder 证明 | **不可勾选** | 硬依赖未满足：R5 1.1 open；R4 9.2b、R4 10.5 跨 release 硬依赖 open；工作区 dirty。`task build:reproducibility` 实测 `Status: Blocked / Reason: artifact_digest_mismatch`（run `20260827081904-5b2872c6-7e12-4c7c-aa83-3b8e8c9148d0`）；`task release:handoff:validate COMPONENT=workbench-worker ENV=integration` 实测 `Status: Partial, 1/6 ready, exit 5`。worker claim-disabled 与 approved builder digest 证据均缺。 |
| 3.4b3b2b 接入 stable v3 promotion authority 并签发 authorized container plan | **不可勾选** | 依赖 3.3a2（C-1，open）、3.4b2b（open）、3.4d2b2b5b3（C-5，open）全部未满足。按切片边界，promotion 状态机归 C-1，本切片未写任何 promotion authority 代码。本切片补上了消费侧 fail-closed 门禁：`container build` 拒绝任何 `build_authorized=false` 的 plan（`container_build_unauthorized`，exit 5）并拒绝人工提权（`container_plan_invalid`），即 Acceptance 负向路径中不依赖 promotion 状态机的部分。 |
| 3.4b3c 在批准 container engine/builder 执行真实 build 与 smoke | **不可勾选（已部分实现）** | 本环境 docker 客户端存在但 daemon 不可达，podman/buildah/nerdctl 不存在；按 Acceptance「Docker/Podman 缺失时保持 blocked，不能以 Dockerfile lint 替代」，真实 build/smoke/image 证据保持 blocked。已实现 fail-closed 入口（见下「实现清单」）。`sh scripts/container-smoke.sh worker` 实测 exit 2 `container engine daemon is unreachable`。 |
| 3.4b3b2 绑定 approved artifact manifest 与 container build inputs | **不可勾选** | b2a 已完成；b2b 阻塞（见上）。 |
| 3.4b3b 多目标镜像定义并绑定批准 production artifacts | **不可勾选** | b3b1 已完成；b3b2 阻塞。 |
| 3.4b3 container build/smoke 目标 | **不可勾选** | b3a 已完成；b3b/b3c 阻塞。`task container:contract:test` 通过（6/6）；`task container:build` 目标现已存在并 fail-closed；`task container:smoke` fail-closed blocked（无 daemon）。 |

## 实现清单（本切片新增/修改）

- `service/cmd/workbench-release/container_build.go`（新增）：`workbench.release.container.build` 投影。顺序门禁：复用 `validateContainerBuildPlanProjection` 重算全部绑定（drift/篡改/manifest 不匹配直接透传失败）→ 未授权 plan 返回 `container_build_unauthorized`（exit 5，blocked，不写证据）→ engine 二进制与 daemon 可达性探针（不可达返回 `container_engine_unavailable`，exit 2，blocked）→ 仅授权且 engine 可达时构建 api/worker/migration/web 四 target 并写 `workbench.container_image_build.v1alpha1` digest 证据（image tag 绑定 artifact digest 前缀，image ID 必须为 `sha256:` digest）。engine 输出不回显（只保留 exit status），plan 路径等 private path 不出现在输出（CLI 测试断言）。
- `service/cmd/workbench-release/container_build_test.go`（新增）：诊断 plan 阻断、人工提权拒绝、engine 探针 fail-closed、fake engine 四 target 编排与 digest 证据、engine 失败 fail-closed、CLI blocked envelope 与 private path 防泄漏、help 含 `container build`。
- `service/cmd/workbench-release/main.go`（修改）：注册 `container build` 子命令、`--engine`/`--context` flags 与 help 行。
- `Taskfile.yml`（修改）：新增 `container:build`（production:guard `EFFECT: plan`，默认 engine `docker`，证据默认 `temp/release/container-image-build.json`）、`container:build:test`、`test:container:component`。
- `tests/container-contract.test.ts`（修改）：新增「container build target is gated on an authorized plan and a reachable engine」合同测试。
- `scripts/container-smoke.sh`（修改）：engine 二进制存在后再探 daemon 可达性，不可达时 exit 2 并输出 `container engine daemon is unreachable`（此前会直接进入 `docker build` 并回显原始 daemon 错误）。
- `details/container-builder-readiness.md`（修改）：后续执行顺序第 4 步更新为「`task container:build` 已实现为 fail-closed 门禁；真实 authorized plan 运行仍未执行」。

## 验证命令与结果

- `bun test tests/container-contract.test.ts`：6 pass / 0 fail。
- `bun test tests/taskfile-docs-contract.test.ts tests/release-gates.test.ts tests/container-contract.test.ts`：15 pass / 0 fail。
- `bun run typecheck`：通过。
- `openspec validate workbench-production-ga-r5 --strict`：valid。
- `CGO_ENABLED=0 go test ./service/cmd/workbench-release -count=1`：ok（在 C-1 工作区可编译的窗口执行；见「并行冲突」）。
- `task container:build:test`：ok。
- `task test:container:component`：passed（run `20260827084226-32b884dd-b76b-4272-825d-9fcf34294494`）。
- `workbench-release container build`（缺 plan 输入）实测：exit 5，`container_plan_invalid`，未写证据文件。
- `task build:reproducibility`：failed，Blocked/`artifact_digest_mismatch`（run `20260827081904-5b2872c6-7e12-4c7c-aa83-3b8e8c9148d0`）。
- `task release:handoff:validate COMPONENT=workbench-worker ENV=integration`：Partial，1/6 ready，exit 5。
- `sh scripts/container-smoke.sh worker`：exit 2，`container engine daemon is unreachable`。

## 证据

- `temp/integration-test-runs/20260827084226-32b884dd-b76b-4272-825d-9fcf34294494/`：`task test:container:component` **passed**（exit 0，redactions 0，六件套齐全），内含 `task container:build:test` 全部用例通过。
- `temp/integration-test-runs/20260827081904-5b2872c6-7e12-4c7c-aa83-3b8e8c9148d0/`：build:reproducibility fail-closed 证据（failed，`artifact_digest_mismatch`）。
- `temp/integration-test-runs/20260827083207-599f3757-3ab4-4e70-8824-7dcb6672326b/`、`temp/integration-test-runs/20260827083240-8044e471-f6df-4d09-b714-c3a64c9f0197/`、`temp/integration-test-runs/20260827084025-9b7360bb-e127-49eb-83ea-6ab9f8f88a4e/`：早先三次 `test:container:component` 被证据运行器判为 `source changed while the evidence command was running`（failed）——并行代理在运行窗口内持续改 tracked 文件，属 environment/concurrent 失效而非产品失败；各 run 的 stdout.log 显示底层 go test 实际为 ok。第四次运行（上条）在并发静默窗口通过。

## 阻塞项与移交

1. **3.4b2b**：需 R5 1.1 关闭、R4 9.2b/10.5 跨 release handoff 到位、clean source、worker claim 启用与 approved builder digest 证据（外部/R4 owner）。
2. **3.4b3b2b**：需 C-1 的 3.3a2 authoritative advance core 与 C-5 的 3.4d2b2b5b3 stable v3 schema/handoff authority；届时 `container build` 的授权分支（当前仅有 fake-engine 单测覆盖）需以 stable v3 positive fixture + tamper/issuer/revocation/builder mismatch 矩阵验收。
3. **3.4b3c**：需批准的 container engine/builder 环境；到位后运行 `task container:build && task container:smoke && task test:container:component` 并产出 image component 六件套与 digest。
4. 切片关闭后按治理方案重跑 `bun scripts/execution-dag-snapshot.ts` 并刷新 `docs/operations/active-execution-dag.md`（本次未做：切片未关闭）。

## 边界与并行冲突说明

- 未编辑 `tasks.md`；未触碰 promotion 状态机实现（C-1 租约）。C-1 正在并行改 `service/cmd/workbench-release/promotion.go`/`promotion_advance.go`，其间该包两次短暂不可编译（`resolveProductionApproval`、`lastRevision` 未定义）；本切片的 Go 验证在 C-1 工作区可编译窗口重跑通过，另在剔除 C-1 在途文件的 scratch 副本中全量通过，两处结果一致。
- `docs/operations/active-execution-dag.md` 等其他代理持有文件未改动。
