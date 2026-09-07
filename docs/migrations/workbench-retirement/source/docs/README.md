# Workbench 文档索引

本目录是 Workbench 产品、架构、协议、SDK、运行时、QA 与发布文档的真源。

Workbench 的后续主线是以项目与成果为中心的桌面 Agent 工作环境：对话保持持续交互锚点，成果、上下文与下一步在同一工作区接续。专业产品保持独立部署、完整用户路径和 canonical state；Workbench 拥有 UI 组合、任务控制、安全投影、注册 Pane 与获批深链。云端与本地复用同一 C/S 产品，服务使用本部署的工具与文件。

2026-09-05 新增 [项目连续性实施 change](../openspec/changes/workbench-project-continuity-desktop-v1/design.md)，目前只完成规格/文档/tasks；真实 provider、UI 和双部署验收尚待实施。该 change 在既有主壳上扩展，不替换下述活跃 change 的实现权威。

当前前端基线由已归档 `workbench-agent-pi-workspace-v1` 与 `workbench-agent-ui-unification-v1` 提供；真实 Chat、Canvas/Pane 同一 document dock 与 selected-session content/control 合流由 active `workbench-agent-chat-canvas-convergence-v2` 追踪。既有 R0–R5 Change 继续提供 Task、Identity、Owner、Pane、Spatial、Workflow 与发布能力，但不再共同定义多个并列主入口；相关功能应进入 Agent Pane、advanced route 或 Owner deep link。OpenSpec artifact complete 仅表示规范资产完整，不能替代 capability-scoped handoff、integration、rollback 和直接 evidence closeout。

当前 canonical release change 映射：R0 `workbench-production-foundation-r0`、R1 `workbench-identity-tenant-access-r1-gates`、R2 `workbench-owner-backend-integrations`、R3 `workbench-daily-operations-r3-gates`、R4 `workbench-spatial-workflow-automation-r4`、R5 `workbench-production-ga-r5`（R1/R3 已交付部分随原 change 于 2026-08-16 归档，gates change 承接剩余验证门禁与 closeout 任务）。

传输术语固定为 `HTTP REST/SSE`、`gRPC unary/stream`、`JSON-RPC 2.0` 三个 wire transport；TypeScript SDK facade 不是第四种 wire transport。R2 Owner 能力按 owner 独立使用 selector/status closeout，允许 Eikona 等已验收 owner 晋级，同时让未验收 owner 保持 `disabled` 或 `needs_contract`。

## 产品与平台

- [Ordo 托管工作接入](product/ordo-managed-work.md)：既有主壳中的通用消费、双入口一致性、Text Development 通用 adapter 承接；[实施 tasks](../openspec/changes/workbench-ordo-managed-work-v1/tasks.md) 尚待完成。
- [项目连续性与桌面 Agent 工作台](product/project-continuity-workbench.md)：用户已确定的产品方向、required capabilities、研发/调研/文本/多模态场景、P0–P3 里程碑和真实使用标准。
- [项目连续性实施任务](../openspec/changes/workbench-project-continuity-desktop-v1/tasks.md)：按合同、服务、UI、有界自主、真实部署、场景与最终验收分解的 owning tasks。
- [Agent-first 应用 Blueprint](product/agent-workbench-blueprint.md)：应用级产品真源，定义主壳、对象模型、页面/Pane 归属、前后端组合、capability ledger、Definition of Usable 与实施切片。
- [Text Development Workbench](product/text-development-workbench.md)：`active proposal`，定义通用文本内核、小说/剧本/自媒体 Lens、Working Copy→Checkpoint→Review→Canon、Agent candidate-only 与 Team 协作产品路径。
- [Chat-Canvas Convergence V2](../openspec/changes/workbench-agent-chat-canvas-convergence-v2/design.md)：真实 Conversation Runtime consumer、单一自适应 shell、Canvas/Pane document dock、pending selection、soft-follow、原子 change-set 与本地 Beta rollout。
- [Text Development owning change](../openspec/changes/workbench-text-development-studio-v1/design.md)：Workbench 侧 Working Copy editor、selection-first Agent、adaptive candidate review、四个 Context deck、Profile/egress 与 Ordo Team control 的实现任务真源。
- [Spatial Replica Review Workspace PRD](product/spatial-replica-review-workspace.md)：定义 `/agent` 内源视频、二维证据、Scaena 白模/动作、Auctra 剧本与 owner receipt 的统一审阅体验、four-layer truth、claim ladder、owner-fit、场景矩阵和分层 rollout；不让 Workbench 保存第四套 canonical state。
- [Spatial Canvas V3 产品设计](product/spatial-canvas-experience.md)：将 `/agent` 内 Spatial Surface 演进为四级语义无限画布、五 Lens、项目 Draft、轻量协作与 proposal-first 正式化路径。
- [Auctra Screenplay Room UI](ui/auctra-screenplay-room.md)：`implemented / approved`，定义 `/agent` Spatial Focus 内的双时间轴、Scene/Beat、Context Graph、专注写作与 Auctra owner action；capability 已于 2026-09-05 双半场 canary 后晋级 approved。
- [Workbench 通用平台与多租户设计](product/workbench-platform.md)：通用平台定位、Linear 式租户体验、共享控制面 + 租户实例架构、身份边界、演进阶段与验收标准。
- [子项目产品边界](../../../docs/architecture/subproject-product-boundaries.md)：定义独立产品分发、部署组合、深链、状态摘要和功能冲突裁决。
- [Open Design Studio](product/open-design-studio.md)：设计发现、候选生成、人工审查与实现交付模块。
- [Open Design Studio 页面矩阵](product/open-design-studio-page-matrix.md)：页面对象、主要行为、状态与合同姿态。
- [Creator consumer owner handoff 与就绪口径](implementation/open-design-owner-contract-handoff.md)：连接 [Orbital owner Operation 主规范](../openspec/specs/workbench-orbital-owner-operations/spec.md)、[Workbench consumer 矩阵](../openspec/changes/archive/2026-09-01-workbench-owner-backend-integrations/details/creator-studio-owner-consumer-matrix.md)、[Auctra Service API](../../../cli/auctra/docs/service-api-interface.md) 与 Scaena owner repository 中的 handoff OpenSpec；仅说明 planning/readiness，owner 状态仍以矩阵和各 owner OpenSpec 为准，不代表已实现或 live。
- [Unified Spatial Creative Runtime V1](product/unified-spatial-creative-runtime.md)：`/agent` 内唯一桌面 Spatial Surface，定义五种 Lens、proposal-first Agent、Workflow 控制、四传输 facade、50k 性能结构与旧路由删除边界。
- [AI 做剧 Show Control Room（历史）](product/ai-drama-show-control-room.md)：已退役的旧独立页面设计，仅保留合同与迁移背景。

## 视觉设计

- [项目连续性桌面 UI](ui/project-continuity-workbench.md)：成果优先的单壳布局、控件清单、保存/续接/授权状态、响应式、可访问性和三个原型任务。
- [Workbench UI 设计治理与一致性合同](design/workbench-ui-governance.md)：UI 管理真源，定义唯一视觉权威、route/Pane/Lens 分类、Instrumental Graphite 方向、共享状态/action 语法、当前债务基线、UI Contract、压力测试与迁移顺序。
- [Text Development Workbench UI](ui/text-development-workbench.md)：固定三区域、Create/Collaborate 双姿态、source-preserving editor、adaptive diff、Context/Profile/Team 状态矩阵与移动审阅。
- [Command & Journey Discovery UI](ui/command-journey-discovery.md)：`/command-discovery` 只读跨项目发现面——Gateway/owner typed 投影、能力搜索与旅程步骤、copy-only 精确命令、诚实可用性状态与 feature-flag 回滚。
- [Anatomia Reference Review UI](ui/anatomia-reference-review.md)：播放器参考组件覆盖层（三类组件/时间码/gap 标注）、当前源坐标对齐与诚实降级、claim 审阅 decision 走 owner-approved action surface。
- [Agent-first Pane Workspace UI Spec](ui/agent-first-workbench.md)：当前主产品结构、Pane plugin contract、状态矩阵、响应式与验收标准。
- [Auctra Screenplay Room UI](ui/auctra-screenplay-room.md)：个人编剧/OPC 的专业 Spatial 子模式、统一视觉/图标、结构拖拽恢复、Scene Card/正文分离和移动审阅。
- [Agent UI 统一交互基线](../openspec/changes/archive/2026-09-03-workbench-agent-ui-unification-v1/design.md)：跨 `/agent`、Spatial 和注册 Pane 的 shared chrome、显式联动、就地恢复、空态和验收落地设计；仅改前端组合，不改后端合同。
- [Agent Chat-Canvas V2 UI/系统设计](../openspec/changes/workbench-agent-chat-canvas-convergence-v2/design.md)：左 Chat、中 document dock、右 Context、Session drawer、回答优先 timeline 与真实跨区域状态连续性。
- [Spatial Replica Review Workspace UI Spec](ui/spatial-replica-review-workspace.md)：空间复刻 Pane family 的 source/3D/timeline/Inspector wireframe、control inventory、truth visual grammar、WebGL/mobile fallback、响应式、无障碍、性能与 screenshot evidence 矩阵。
- [Spatial Canvas V3 交互设计](design/spatial-canvas-interaction.md)：桌面断点、HUD、语义缩放、Lens 视觉语法、Draft/presence、状态与无障碍验收。
- [设计体系统一](design/design-system-unification.md)：物理/语义/组件槽三层 token 架构、组件收敛与吸收映射、图标注册表迁移、motion 接线与验收门禁。
- [统一 UI 控件体系](design/ui-controls-system.md)：基础控件分层（Radix 基座 → primitives → composites → Pane chrome）、逐控件 API/状态/无障碍/token/motion 合同、重复实现收敛映射与门禁；`workbench-ui-controls-r1` 已落地（17 个 L1 控件、gallery 截图基线、contract 零违例硬断言）。
- [Pane 交互模型](design/pane-interaction-model.md)：有界布局树 schema、open/focus/close/replace/reorder/move/resize 全操作表（键盘/菜单/拖拽等价）、resolver 前置校验管线、状态矩阵与响应式 Sheet 规则。
- [插件生态](design/plugin-ecosystem.md)：first-party plugin pack 模型、`AgentPaneManifestV1` 字段与校验、availability/permission 链路、版本演化、第三方 harness iframe 车道边界与作者指南。
- [Agent 视觉语言](design/agent-visual-language.md)：Eikona 02 参考图基线的分层表面规则（四级表面、圆角刻度、柔和 elevation）、行节奏与排版、accent tint 克制用法、icon-tile/chip 模式、组件形态映射与验收；已由 `workbench-ui-visual-refresh-r1` 落地（token 刻度 + 控件 CSS 刷新 + gallery 基线重生成）。
- Agent-first Pane Eikona 高保真参考图与生成证据：`../prompts/product/ui-reference/workbench-agent-pane/README.md`

旧 Apple Spatial 与基于其母版的 Open Design Studio 视觉包已经退役；它们不再作为主应用或 Studio Pane 的设计输入。后续所有 Workbench 页面先遵循 Agent-first Blueprint/UI Spec，再按需要生成 Pane-specific Eikona reference。

## 接口与运行时

- [Project Continuity 消费接口](interfaces/project-continuity-workbench.md)：project 三个新增方法、Pinax/Runtime/成果权威、独立 action grant、视图/执行恢复分离与兼容回滚。
- [Agent-first Workspace 前端与后端合同](interfaces/agent-pi-workspace.md)：Browser→BFF→shared services→TaskService→Owner 的信任链、session/stream/Pane/proposal/capability/error/rollback 合同。
- [Text Development Agent 与 Owner 接口](interfaces/text-development-agent-interaction.md)：WorkbenchTextDevelopmentClient、selection anchor、Working Copy patch、candidate、project-full egress、Profile switch 与 Ordo Team control 合同。
- [Spatial Replica Review 前后端与 owner 合同](interfaces/spatial-replica-review.md)：`v1alpha1` exact multi-owner projection、PTS/coordinate/scale、safe media/ReplicaStage、inquiry、ActionDescriptor、receipt/reconcile、single stream、same-origin 与 rollback 合同。
- [Spatial Canvas V3 前后端与兼容合同](interfaces/spatial-canvas-v3.md)：V2/V3 并行 identity、Lens layout/view preference、Draft/presence/promotion、三传输方法矩阵、GORM 持久化与回滚。
- [Owner Backend Integrations](interfaces/owner-backend-integrations.md)：包含 planned Auctra `auctra.screenplay_room.v1alpha1` connector、exact digest、per-operation readiness 与 real-loopback 晋级边界。
- [控制平面接口](interfaces/task-control-plane.md)：架构、实体生命周期、SDK/REST+SSE/gRPC/JSON-RPC 方法矩阵、错误、幂等和 catalog 合同。
- [Gateway Console consumer contract](interfaces/gateway-console.md)：typed facade、Browser→BFF→workbenchd→adapter 信任链、allowlisted operations、恢复/回滚边界与 owner canary 证据要求。
- [本机运行与验证](runtime/local-control-plane.md)：loopback 启动、token、私有存储、owner 边界、可运行调用示例与证据命令。
- [本机 React Workbench](runtime/local-web-workbench.md)：React/Dockview 页面、Bun BFF、Design projection、布局管理与 Web 验证。
- [Managed Identity 运行手册](operations/managed-identity-runbook.md)：local/managed 边界、合同/session/migration/security/integration/canary/revoke/readiness 命令与 promotion 限制。
- [Production Incident Runbook](operations/production-incident-runbook.md)：P0/P1 owner、detect/contain/recovery target、当前 authority gate、证据与回滚规则；`task runbook:validate` 只证明文档与 target registry 一致。

## 实现笔记

- [Lenis 面板局部平滑滚动](implementation/lenis-smooth-scroll.md)：依赖版本、局部滚动边界、生命周期、减少动态效果、验证与回滚。

## CI/CD

- [模块化、分级 CI/CD](delivery/ci-cd.md)：quick、full、integration、release 的触发场景、真实命令和权限边界。
