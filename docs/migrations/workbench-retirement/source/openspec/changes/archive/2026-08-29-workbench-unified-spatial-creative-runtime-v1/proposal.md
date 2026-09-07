## Why

Workbench 已同时存在 Project Canvas、Spatial Board、Context Map、Workflow Pane 与独立 Show Control Room，导致同一对象、选择、视口、运行和 Review 被多套 UI 状态重复表达；现有 React DOM/React Flow 路径也不能诚实承担单 Board 50k addressable nodes 的桌面交互目标。本 change 将这些能力收敛到 `/agent` 唯一主壳中的桌面 Spatial Surface，并保持 Board、Workflow、ProposalAuthority、TaskService 与各 Owner 的既有权威边界。

## What Changes

- 新增桌面 Spatial Surface 与 `creative_production|workflow|run|review|evidence` 五种 Lens，支持 Conversation、Split、Spatial Focus 三种布局模式；Agent timeline、Composer、session 状态和 gate 提示保持不可关闭。
- 新增 versioned closed Spatial snapshot/viewport/lens/runtime/change-set contracts，以及独立 `AgentSpatialIntentV1`；不扩宽 `AgentPresentationIntentV1` 的 closed enum。
- 新增 `QuerySpatialSurface`、`WatchSpatialSurface`、`PlanSpatialLayout` 与 TaskService-gated `ApplySpatialChangeSet` additive operations；所有 transport 共享 capability、revision、idempotency、receipt 与 reconcile 语义。
- 新增 proposal-first 空间协作：Agent 可以打开 Lens、定位、高亮、比较和预览布局，但任何持久 Board/Workflow 变更必须形成 server-authored proposal，经 Review 接受后进入 ProposalAuthority → TaskService。
- 在 Spatial Surface 内提供 Workflow validate/publish/start/pause/resume/cancel/reconcile 控制；执行状态、approval、lease、receipt 与 `unknown_accept` 仍由既有 durable Workflow runtime 权威维护。
- 新增 WebGL + bounded DOM 分层渲染、OffscreenCanvas/Web Worker、viewport tile/density projection 与 50k nodes / 75k relations / 1k groups 性能门禁；React Flow 只承担有界 Workflow 编辑子图。
- 将 Show/Episode/Scene/Shot/Asset/Review/Delivery 的 safe projection 迁入 Creative Production Lens；Workbench 不保存或推断 Owner canonical content。
- **BREAKING**：立即删除 `/show-control-room` Web route、独立页面编排、专属响应式样式与对应 route E2E，不提供 redirect；同 change 更新所有仓内 Agent、Project 与 DSH ingress 到 `/agent` typed spatial entry。稳定 Show SDK/service contracts 保留并由新 facade 消费。
- Web Workbench 明确为 desktop-only；不交付手机/平板 CSS、交互分支、截图或 E2E。未来移动应用属于独立 client owner，只消费稳定 API/events/deep links。

## Capabilities

### New Capabilities

- `workbench-spatial-surface`: 定义单壳 Spatial Surface、五种 Lens、桌面布局、safe projection composition、viewport/LOD、WebGL/DOM renderer、50k capacity、accessibility 与恢复合同。
- `workbench-agent-spatial-interaction`: 定义 `AgentSpatialIntentV1`、临时 overlay、proposal-first change-set、Review activation、dedupe、authority 与 mutation 禁区。
- `workbench-spatial-runtime-control`: 定义画布内 Workflow authoring、validation、publish/run controls、live runtime overlay、approval、receipt、unknown/reconcile 与跨步骤非原子展示合同。

### Modified Capabilities

- `workbench-agent-pane-composition`: 增加 Spatial Focus 布局，同时保持 conversation/composer 锚点、Pane 上限与单一 reducer。
- `workbench-ai-drama-show-navigation`: 将独立 Show Control Room 替换为 `/agent` Creative Production Lens，并删除旧 route。
- `workbench-ai-drama-owner-projection`: 允许 safe owner segments 进入 Spatial Surface projection composition，但不改变 Owner truth 或 action authority。
- `workbench-ai-drama-review-inbox`: 将 exception-first Review 迁入 Spatial Review Lens，并复用 ProposalAuthority/TaskService。

## Impact

- Web：`apps/web` 的 Agent shell、Pane layout、Spatial Board/Project Canvas、Workflow panes、creative production components、route wiring、styles、workers 与 Playwright coverage。
- SDK/API：`packages/task-sdk` 新增 additive spatial contracts/client；Proto/JSON Schema/HTTP/gRPC/JSON-RPC 增加 methods，不移除现有 Board、Workflow、Agent 或 Show exported surface。
- Service/storage：新增 spatial composition/query/layout/change-set service、GORM-managed tile/density projection index、registry operations、four-transport parity 与 50k PostgreSQL capacity evidence；无 drop/rename migration。
- Dependencies：新增 PixiJS v8 stable rendering primitives；experimental ParticleContainer 只允许 feature-flag benchmark canary，不是默认交付路径。
- Compatibility：旧 Web route 是本 change 唯一立即移除的 released surface；consumer migration 必须在删除 route 前完成。回滚通过恢复旧 route/component wiring、关闭 Spatial feature flag 并继续读取未删除的旧 SDK/service contracts完成。
- Production gate：R4 Board/Workflow/worker/Owner/staging promotion gates 继续是 production readiness 前置条件，本 change 不以本地 fixture 冒充 production ready。
