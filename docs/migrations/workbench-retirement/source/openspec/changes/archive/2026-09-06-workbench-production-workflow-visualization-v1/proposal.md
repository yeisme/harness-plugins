# Workbench Production Workflow Visualization V1

## Why

R4 已交付服务端 durable workflow runtime（definition/run/step、scheduler、worker）与 Project Automation 的 project→workflow binding，`/workflows` 控制面与 `/agent` Workflow Lens 也能可视化单个 definition 子图。但两条旗舰创作线仍没有「制作工作流」可视化：

- 漫剧：`show.workspace_projection.get` 已有 canonical 8 阶段轨，但 owner stage projection 未签约前 Show Home 只能渲染硬编码 `unknown`，且 task artifacts 只携带 safeRef+summary，阶段事实到不了浏览器；R4 运行与 Project Automation 绑定在生产面上不可见。
- 文本：Text Development Studio 有文档/候选/checkpoint 面，但没有任何制作阶段流水线投影或可视化，创作者看不到「正文→候选→审阅→接受→存档→交付」推进到哪一步。

需要把已建成的 workflow 能力正式接入产品：一个服务端合成的 production pipeline 投影（closed contract、safe refs、诚实状态）加一个统一可视化面（阶段轨 + 自动化运行泳道），让文本与漫剧项目第一次看到自己的制作工作流。

## What Changes

- 新增 closed 合同 `workbench.production_pipeline.v1`：按 (tenant, workspace, project) + domain 查询的项目级制作流水线投影，含 canonical 阶段轨（文本 6 阶段 / 漫剧 8 阶段）、每阶段封闭状态与有界 facts、有界自动化运行摘要。
- 新增 BFF 只读路由 `GET /v1alpha1/production-pipeline`（Text Development BFF 先例）：服务端 composer 合成投影并整体过 closed codec，结构化阶段事实直达浏览器，不新增 task artifact 编码。
- 文本 composer：从 Auctra WorkingCopy/Checkpoint typed 投影确定性折叠 6 阶段（draft/candidate/review/accept/checkpoint/deliver）；candidate/review/accept 在 owner list 合同发布前如实 `unknown`，不推断。
- 漫剧 adapter：复用 `showcontrol.ComposeShowWorkspaceProjection` 的 canonical 8 阶段与 owner readiness，不建第二套阶段真值；阶段状态仍以 owner stage projection 为准。
- 运行泳道：经 Project Automation binding（project scope）列举有界运行摘要（bindingRef/workflowRunRef/receiptRef/observedAt/run state），逐 binding 走 facade 授权读，不做 per-stage 归属臆造。
- Web 统一可视化组件 `ProductionWorkflowPanel`：阶段轨（状态 chip + 有界 facts）、运行泳道（卡片 + deep link 到 Workflow 控制面）、needs_contract/offline fail-closed 态；挂载于 Creative Production Lens（漫剧）与 registered Pane `production.pipeline.v1`（全项目）。
- SDK：`production-pipeline-models.ts` + client + HTTP method 映射 + fail-closed normalizer。

## Capabilities

### New Capabilities

- `workbench-production-workflow-visualization`: production pipeline 投影合同、文本/漫剧阶段合成、自动化运行泳道、统一可视化面与诚实状态语义。

### Modified Capabilities

无。BFF 路由、SDK client、pane 注册、Creative Production Lens 挂载均为 additive；`workbench.durable_workflow_runtime`、`show.workspace_projection.get`、Text Development 与 Project Automation 合同不改义。

## Impact

- Go：新增 `service/internal/productionpipeline/**`（contract/composer+测试）、`service/internal/transport/productionpipelinehttp/**`（handler+测试）、`service/internal/runtime/runtime.go` 接线（auctraConnector/show owner readiness/automation facade → source 绑定 + 路由挂载）。
- SDK：`packages/task-sdk/src/production-pipeline-models.ts`、`production-pipeline-client.ts`、`http.ts` method 映射、`client.ts` 导出；round-trip 测试。
- Web：`apps/web/src/workbench/agent/production-workflow/**`（面板+模型+i18n）、Creative Production Lens 挂载、agent pane registry/catalog/manifest 注册 `production.pipeline.v1`；组件测试。
- 数据：不新增存储；投影是即时合成，只读，不保存 owner payload、credential、raw prompt 或完整内容。
- Compatibility：`breaking_surfaces: []`；所有 source 未绑定时 fail-closed 渲染 needs_contract/offline，rollback 为卸载路由/面板与 pane 注册，不改任何 owner 或 workflow canonical 状态。
