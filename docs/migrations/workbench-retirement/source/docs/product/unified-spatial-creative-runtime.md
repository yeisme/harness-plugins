# Workbench Unified Spatial Creative Runtime V1

## 产品定位

`/agent` 是 Workbench Web 唯一的桌面 Spatial Surface。Project Canvas、Spatial Board、Context Map、Workflow 视图与旧 Show Control Room 不再形成并列页面入口，而是通过同一 Board、同一相机状态和五种 Lens 组合展示。

对 AI 做剧场景，Workbench 是建剧、续作、跨集比较、媒体审阅和交付的默认视觉入口；该职责通过 `/agent` 的 Director Workspace profile 实现，不恢复独立 Show Control Room 页面。DSH 继续作为异常优先的 Agent 入口，复杂候选、时间线差异和跨集空间关系通过 typed handoff 进入 Workbench。

本版本只设计桌面 Web。手机与平板 Web 不提供布局、交互分支、截图或 E2E；未来移动应用作为独立客户端，仅消费稳定 API、事件和 deep link，不拥有 Board、Workflow、Proposal 或 Owner 领域规则。

## 桌面模式与 Lens

`/agent` 提供三种模式：

- `Conversation`：Agent 对话和 Composer 为主。
- `Split`：对话与 Spatial Surface 并列。
- `Spatial Focus`：Spatial Surface 占主要空间，同时保留不可关闭的紧凑对话、Composer、session 状态与异常提醒。

Spatial Surface 通过 Lens 切换对象和控制面，不创建额外页面：

- `Creative Production`：Show → Episode → Scene → Shot → Asset owner projection。
- `Workflow`：当前有界子图，React Flow 不承担全量 Board。
- `Run`：server-authored runtime、approval、failure、receipt 与 reconcile。
- `Review`：change-set diff、风险、成本、可逆性和用户决定。
- `Evidence`：lineage、artifact、receipt 与交付证据 safe refs。

创作生产路径固定为 `Explore → Compose → Review → Publish → Run → Recover → Handoff`。其中 Show、Episode、Shot、Asset 等仍是 owner-authored projection kind，不成为 Workbench 领域真值。

## AI Drama Director Workspace profile

该 profile 的中心画布使用固定语义层级 `Show -> Episode -> Scene -> Shot/Asset`，不是任意自由白板：

- 镜头缩略图、序列预览、角色/场景/声音资产和跨集复用关系构成主要视觉层。
- rights、cost、freshness、readiness、review 和 evidence 作为与选中对象关联的 overlay/inspector。
- 选择 Show、Episode 或 Scene 时，Workbench 只依据 owner refs 定位关联镜头、资产、decision 和 delivery；不得从本地文本或节点连线推断领域事实。
- frame-level trim、track editing、transition、effect 和 color 通过 Scaena external-editor handoff 进入 OpenChatCut 或 Kdenlive；Workbench 不建设第二套完整 NLE timeline。

默认进入路径为 Create/Resume Show -> Creative Production -> Review -> Handoff。媒体画布负责“看全局和比较”，异常条带只突出当前 blocker、待决定项和恢复入口；Run/Evidence 保持独立 lens，避免把系统日志压进创作画布。

### 共享决策箱

Workbench 是复杂媒体差异的主要批准面，但不拥有审批状态。费用、版权、canonical accept、external apply 和 final export 都由 owner-authored decision identity、ActionDescriptor 和 ReceiptRef 表达；DSH 可以处理同一 token。任一入口提交后，Workbench refetch 权威 receipt，不创建第二份本地 accepted 状态。

外编回流只展示 Scaena 发布的 semantic groups：scene、track 或 change type。unsupported change 显示 quarantine reason 和外编定位；stale baseline 进入 reconcile/rebase，不显示可直接 apply 的按钮。

### 外编 handoff

Director Workspace 只消费可验证的 adapter capability：

1. OpenChatCut direct canary：独立本地进程，通过 MCP 与 FCPXML/EDL；
2. Kdenlive：OTIO 文件级回退；
3. OpenCut：稳定 API/MCP/headless/scripting 出现前只显示 planned/unavailable probe。

Workbench 不读取编辑器私有数据库或工程 schema。工作态 handoff 引用原媒体和代理；用户显式 seal、跨机或归档时由 Scaena service 封装实际使用媒体并返回 bundle/receipt refs。全局持久本地信任只控制 editor 启动和文件访问，不能绕过 canonical、rights、cost、external apply 或 final export gate。

## 权威与交互边界

Agent 可以自动打开 Lens、定位、聚焦、解释、临时高亮和预览布局，但创建、移动、分组、关系、Workflow 草稿或 binding 必须先形成 `SpatialChangeSetProposalV1`。浏览器只展示临时 overlay；用户在 Review 接受后，才允许通过 TaskService-gated `ApplySpatialChangeSet` 提交。

单 Board change-set 以 optimistic revision 作为原子边界。Workflow draft、run action 与 Owner mutation 各自拥有独立 Task/receipt；UI 可以组合为一个计划，但不得宣称跨服务原子成功。`unknown_accept` 只开放 reconcile，禁止自动重试。

浏览器不直连 Owner，不保存 raw prompt、provider payload、凭据或完整推理。所有运行控制读取 server-authored capability 和 ActionDescriptor；描述符缺失、过期或版本不可用时 fail closed。

## 合同与传输

新增 additive closed contracts：

- `workbench.spatial_surface.v1`
- `workbench.spatial_viewport.v2`
- `workbench.spatial_lens.v1`
- `workbench.agent_spatial_intent.v1`
- `workbench.spatial_change_set.v1`
- `workbench.spatial_runtime_projection.v1`
- `workbench.board_type_registry.v2`

`QuerySpatialSurface`、`WatchSpatialSurface`、`PlanSpatialLayout`、`ApplySpatialChangeSet` 通过 HTTP REST/SSE、gRPC unary/stream、JSON-RPC 2.0 与 TypeScript SDK facade 暴露。既有 `workbench.board.v1alpha1`、Workflow、Show projection 与稳定 SDK 合同继续可用；新 facade 负责组合，不扩大旧严格枚举。

当前实现中，查询、监听和最多 2,000 个已选节点的确定性布局预案可用；`ApplySpatialChangeSet` 在 Task/receipt authority 未绑定时返回 `needs_contract`，不会回落到浏览器写入或伪造成功。

当前 OpenSpec 实现进度为 28/46。已交付的是统一桌面壳、五 Lens 基础组合、closed contracts/四传输入口、GORM tile index、bounded WebGL/DOM renderer、旧路由移除和性能/回归证据。以下能力仍保持未完成而非伪装 available：owner/runtime 完整 projection composition、可恢复 Watch gap 语义、超过 2,000 节点的异步布局任务、TaskService 原子 Apply、Agent spatial intent 到 UI 的实时激活、Workflow validate/publish/start 完整 descriptor 输入、旧 Creative Production 组件迁移、全路径 Handoff E2E，以及 Project Canvas/Context Map 的最终状态收敛。

AI Drama Director Workspace、共享决策箱和 OpenChatCut/Kdenlive handoff 仍处于 root contract/owner handoff 阶段；在 owning change、consumer fixtures 和两集 canary 完成前必须显示 `needs_contract` 或 disabled reason，不得因本设计文档存在而标记 available。

## 性能结构

- far/medium LOD 使用 PixiJS v8 WebGL stable `Sprite` batching，关系与选择层使用有界 `Graphics`；不启用 experimental `ParticleContainer`。
- near LOD、选中对象、表单、Review 与无障碍对象使用 React DOM overlay，同时挂载硬上限 200。
- 单次 viewport response 的客户端 primitive 硬上限为 4,096；renderer 内部防御上限为 8,192。
- React Flow 只渲染当前 Workflow 子图，节点上限 120、边上限 240，启用 `onlyRenderVisibleElements` 并 memoize 派生节点/边。
- Worker 处理有界 primitive load、hit-test 和布局预计算；OffscreenCanvas 不可用时显式报告 `degraded`。
- 主画布 pan/zoom 只更新相机变换；选择与高亮使用独立轻量图层，不重建完整 Pixi world。
- GORM 管理 `board_spatial_tiles` 可重建 tile/density index；普通业务读取不使用硬编码 SQL。
- 已提供 production-build Chromium performance harness，覆盖 cold/warm first frame、near highlight、medium pan/zoom frame p95、DOM mount、heap、long task 与 WebGL context recovery，并保留 trace 和结构化本地证据。50k PostgreSQL fixture 与本地 Chromium 结果仍只是 promotion evidence，不替代 R4 staging/Owner readiness。

固定验收目标为 Chromium、1440p、8-core CPU、16GB RAM、集成显卡；50k nodes / 75k relations / 1k groups 下验证 cold/warm first frame、viewport p95、frame p95、highlight latency、long task、DOM mount、heap 与 context recovery。

## 路由与兼容性

旧 `/show-control-room` 路由已删除且不重定向，访问时进入通用 `Route unavailable`。DSH、Project 与 Agent 入口统一使用 `/agent` typed spatial ingress，并在服务端重新验证 safe refs、revision 和 capability。

旧 Show SDK/service 合同保留用于兼容 owner projection 和历史 consumer；删除范围仅包括旧 Web 路由、页面编排、专属样式与对应路由测试。

## Owning OpenSpec

[workbench-unified-spatial-creative-runtime-v1](../../openspec/changes/archive/2026-08-29-workbench-unified-spatial-creative-runtime-v1/)

跨项目合同：[ai-drama-director-workspace-editor-roundtrip-v1](../../../../openspec/changes/ai-drama-director-workspace-editor-roundtrip-v1/)

建议 owning change：`workbench-ai-drama-director-canvas-v1`（尚未创建）。
