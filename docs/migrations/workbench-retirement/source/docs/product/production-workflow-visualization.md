# Production Workflow Visualization

> 状态：当前产品设计真源（openspec/changes/workbench-production-workflow-visualization-v1）。本文定义文本与漫剧两条创作线的「制作工作流可视化」——项目级制作阶段轨 + 自动化运行泳道。

## 产品定位

R4 durable workflow runtime 与 Project Automation 已在服务端建成，但生产者看不见：漫剧的 Show Home 阶段轨在 owner stage projection 签约前只能渲染硬编码 `unknown`，阶段事实（结构化）到不了浏览器；文本创作线没有任何制作阶段视图；R4 运行与 automation binding 在生产面上不可见。

Production Workflow Visualization 是一个**服务端合成、只读、诚实**的项目级制作流水线投影（`workbench.production_pipeline.v1`）加一个统一可视化面（`ProductionWorkflowPanel`：阶段轨 + 自动化运行泳道）。它不是新引擎：阶段真值分别来自 Auctra typed 投影（文本）与 showcontrol canonical 8 阶段（漫剧）；运行事实来自 Project Automation binding 的授权读与 R4 workflow runtime。

## 两个域

| 域 | canonical 阶段 | 事实源 |
| --- | --- | --- |
| text（文本创作） | draft → candidate → review → accept → checkpoint → deliver | Auctra WorkingCopy status + checkpoints；candidate/review/accept 在 owner candidate list 合同发布前如实 `unknown` |
| drama（AI 漫剧） | setup → story → foundation → plan → generate → review → assemble → deliver | showcontrol `show.workspace_projection` canonical 8 阶段（owner stage projection 未签约前如实 `unknown`）+ owner 段计数 facts |

阶段状态词汇与 Show Home 一致：`unknown`（无从观察）、`pending`（已观察为空/未开始）、`active`（进行中）、`blocked`（受阻，含 conflict/recovery）、`accepted`（已接受完成）。折叠规则是服务端确定性的：**unknown 不折叠为 pending 或完成；「已观察为空」与「无从观察」严格区分**。

## 运行泳道

以 Project Automation binding 的 project scope 枚举项目运行（逐 binding 走 facade 授权读，失败如实跳过并计数），运行状态经 R4 workflow runtime 只读查询；有界 ≤8，超出截断如实标注。run 不归属到任何阶段（无合同，不臆造）；automation 不可用只降级 `runsReadiness`，不拖垮阶段轨。

## 数据通道与挂载

- BFF 只读路由 `GET /v1alpha1/production-pipeline`（closed snake_case query：`workspace_id/project_id/project_mode/domain/show_ref/episode_ref/working_copy_ref*`；未知参数与跨 domain 参数拒绝）。结构化阶段事实直达浏览器，不做 task artifact ref 间接层。
- SDK：`workbenchClient.productionPipeline.getPipeline()`（fail-closed normalizer；jsonRpc 面接线前 unconfigured）。
- Web 挂载两处，同一组件：
  1. `/agent` Creative Production Lens：Show Home 之后 additive 挂载（drama 域，随 show scope）。
  2. registered Pane `production.pipeline.v1`（pane dock/command palette，全项目；closed params `sessionRef/projectRef/domain/showRef/episodeRef`，read scope `production.pipeline.read`）。

## 诚实状态语义

- source 未绑定（Auctra connector 未配置 / show owner readiness 未接入 / automation 未接入）→ 对应段如实降级：阶段 `unknown` + `readiness=needs_contract/offline`，runs 空 + `runsReadiness=needs_contract/unavailable`；响应仍是 200 投影事实。
- 面板 fail-closed：查询失败渲染诊断块，不渲染任何推测阶段；状态以文本 chip 表达（不只靠颜色）；refs 用 mono；run 卡 deep link 到 `/workflows/:tenant/:workspace?runRef=`。
- 投影即时合成、零持久化；浏览器不直连 owner；不携带 owner payload/credential/raw prompt。

## 非目标

不做第二套 stage 状态机、per-stage run 归属（待 binding stage metadata 合同）、production GA canary、移动布局；不修改 R4 workflow runtime、showcontrol、Text Development、Project Automation 任何合同。回滚 = 卸载路由/面板/pane 注册，canonical 状态零影响。

## Owning OpenSpec

[workbench-production-workflow-visualization-v1](../../openspec/changes/workbench-production-workflow-visualization-v1/)
