## Context

`/agent` 当前已经具备 Agent conversation、Conversation/Split/Spatial Focus 三种桌面模式、注册 Pane、Spatial Lens、上下文栏和 truthful capability 状态。但实现仍由多批次组件组成：`agent-route.tsx` 负责模式组合，`agent-conversation-workspace.tsx` 负责会话/时间线/composer，`spatial-surface.tsx` 同时负责 HUD、画布、Lens 和详情，多个 Pane 又各自维护 header、空态和 unavailable markup。

截图中最明显的问题不是缺少功能，而是同一语义被不同视觉语言重复表达：中文与英文混排、状态 chip/警告块层级不一致、Spatial 内部浮动 rail 与外层 conversation rail 互相遮挡、空白区域没有下一步、disabled 控件没有就地恢复路径。已有 design-system primitives 和 `workbench-agent-shell-visual-language`/`workbench-agent-pane-composition` 规范可以承接本次收敛，因此无需新依赖或后端合同。

本 change 只负责 `/agent` 与已注册 Pane 的前端组合和文案；截图是视觉参考，不是 owner/API 指令。Task、Proposal、Owner、Spatial V2/V3、SDK、BFF、稳定 route 和服务端 capability 仍是现有真源。

## Goals / Non-Goals

**Goals:**

- 建立一个可复用的 Agent UI composition contract：共享 surface、spacing、typography、status、focus、toolbar、empty 和 recovery 槽位。
- 让桌面壳稳定呈现“可折叠会话栏 → 对话锚点 → Spatial/Pane 主面 → 单一上下文栏”的层级，并保持平板/手机 Sheet 规则。
- 让跨区域联动只传递已验证 safe refs，所有 attach/open/apply 行为由用户明确触发且不抢键盘焦点。
- 让 `needs_contract/offline/stale/permission_required/unknown_accept` 在原地可理解、可恢复，并在 ready 时不占用额外空间。
- 让空 session、空目录、空 Spatial 投影都有一个真实起步动作，同时不放演示数据。
- 在不改变 aria、`data-*`、i18n key、SDK 或后端 contract 的前提下补齐中英文生成目录和浏览器验收矩阵。

**Non-Goals:**

- 不新增或修改 HTTP、SSE、gRPC、JSON-RPC、protobuf、SDK public type、Task/Proposal/Owner operation 或数据库表。
- 不把 Spatial、Studio、Gateway、Eikona、Scaena、Anatomia、Auctra 等 owner/advanced route 重写成第二主壳。
- 不把 capability availability 交给 URL、Vite env、localStorage、demo fixture 或浏览器 optimistic state。
- 不实现移动端完整无限画布编辑器、自由 docking、任意插件代码或新的 Owner mutation。

## Decisions

### 1. 只保留一个组合层和一个状态来源

继续使用现有 `AgentRoute`、Agent layout reducer、Pane registry、`WorkbenchClient` 和 server-authored capability。实现只增加 UI composition helpers，不增加第二个 layout reducer、transport client、event stream 或业务 state machine。

候选方案：

- 选择 A（采用）：在已有组件边界上抽取共享 chrome/status/empty/recovery 槽位，迁移调用方。
- 放弃 B：直接重写 `AgentConversationWorkspace` 与 `SpatialSurface`，虽然代码更整齐，但会扩大回归面并威胁已归档合同。
- 放弃 C：只改 CSS，不改结构，无法消除重复状态块和焦点/恢复语义分叉。

### 2. 固定桌面信息层级，禁止 Lens 私有业务侧栏

`>=1440px` 使用可折叠 session rail、conversation/composer、Spatial canvas 和 shared context rail；`1024–1439px` 使用 conversation + 一个 320–384px context rail；`<1024px` 继续使用 conversation + Sheet/可访问对象列表，不挂载完整 Spatial editor。

Spatial 的 Detail、Inspector、Review、Evidence 由同一 context rail tab strip 承载。Lens 只能提供投影内容和上下文操作，不得在画布内部再创建固定宽度业务 rail。这样既保留已有 V3 adaptive rail，也修复截图中多层浮动面板互相覆盖的问题。

### 3. 共享组件采用最小组合，不引入新依赖

优先复用已有 `PaneChrome`、`PaneToolbar`、`StatusChip`、`DataState`、`ActionRecovery`、`Button`、`IconButton`、`SegmentedControl`、`TextArea`。只有现有 composite 无法表达跨 Agent/Spatial 共用语义时，才在 design-system/composites 增加薄包装；组件不持有 Task、Proposal、Owner 或 transport 状态。

建议的 UI 槽位：

```text
UnifiedSurfaceFrame
├── SurfaceHeader(title, status, technicalMeta, actions)
├── SurfaceToolbar(primaryViewActions, search, commandPalette)
├── SurfaceBody
│   ├── LoadingSkeleton
│   ├── EmptyState(one real CTA)
│   ├── StatusBlock(impact, state, one recovery action, technical disclosure)
│   └── ReadyContent
└── SurfaceFooter(optional notice, cursor/freshness)
```

`UnifiedSurfaceFrame` 只是呈现组合，不是新业务 owner。Pane descriptor、registry availability 和 existing `data-*` selectors 继续由原模块提供。

### 4. 状态文案采用“影响 → 下一步 → 技术详情”顺序

用户首先看到本地化的 domain impact，例如“空间画布暂不可用”；随后看到一个真实主动作，例如“重新检查连接”或“查看合同要求”；reason code、operation id、version 和 safe ref 进入折叠 technical details。`unknown_accept` 只能显示 reconcile action，绝不出现成功、失败或 retry 文案。

同一 capability 在多个区域出现时，composer footer 或当前 Pane 负责主说明，其他区域只显示 compact linked indicator。ready 时完全不渲染 unavailable summary，避免空壳常驻。

### 5. 联动使用显式 action，不使用自动写入

Canvas selection 只更新 shared context rail。用户点击“加入上下文”才创建 composer context chip；用户点击 Pane suggestion 才走 registry resolver；用户点击 recovery action 才发起 read/re-authorize/reconcile。Follow Pi 继续受现有 server cohort、consent、dirty composer、Review、modal、expiry 和 dedupe guards 约束，且不得移动 keyboard focus。

### 6. 文案源文件是唯一交付入口

所有新增 Agent/Spatial/Pane 说明分别写入 `api/locale/source/zh-CN/**` 与 `api/locale/source/en-US/**`，随后运行生成/校验脚本。组件不以 inline literal 作为主路径；技术值保留英文但通过现有 stable-value/mono renderer 呈现。不会直接编辑 `messages.generated.ts`。

### 7. 验收以真实 route 状态矩阵为准

组件测试验证槽位、状态映射、焦点和无副作用；Playwright 使用真实 `/agent` route 覆盖空 session、ready、needs_contract、offline/stale、Pane open、mode switch、Spatial selection、mobile Sheet 和 reduced motion。截图只验证层级/密度/溢出，不把视觉相似度当 capability readiness。

## Risks / Trade-offs

- [Risk] 抽取 shared chrome 时改变现有 aria 或 `data-*` selector。→ [Mitigation] 先建立 selector/aria inventory，组件测试和既有 E2E 必须保持绿色；delta spec 明确禁止语义回归。
- [Risk] “统一状态”误变成浏览器自行推断 capability。→ [Mitigation] status block 只接受 server projection；没有 projection 时使用固定 loading/offline fallback，不允许由 route、fixture 或 localStorage 提升 ready。
- [Risk] 通过减少浮层导致 Spatial 详情可发现性下降。→ [Mitigation] context rail 保留 Detail/Inspector/Review/Evidence tabs，Canvas selection 只更新 rail，并提供明确的 focus/inspect action。
- [Risk] 中文优先改文案时破坏技术标识和测试查找器。→ [Mitigation] 人类标签走 locale key，技术 ref 保持稳定英文；aria/data contract 不改名，英文 locale 做同一行为回归。
- [Risk] 全矩阵浏览器验收成本较高。→ [Mitigation] 先跑 focused component/i18n/typecheck，再跑固定 1440/1024/390 三档和 reduced-motion；失败保留 `temp/integration-test-runs/<run-id>/` 证据。

## Migration Plan

1. 先更新产品 Blueprint、UI Spec 与文档索引，发布本 change 的 acceptance vocabulary。
2. 建立 shared surface/status/empty/recovery primitives 和对应 tests，不改变现有调用合同。
3. 迁移 Agent header、session rail、composer footer、Spatial modebar/context rail 和首批 registered Pane；每批保留既有 selectors 与 capability states。
4. 补齐 zh-CN/en-US source、运行生成与 parity 检查，完成真实 `/agent` browser matrix。
5. 以 canary flag 或现有前端 composition gate 控制切换；回滚只恢复旧 renderer composition，不删除任务、事件、proposal、receipt、layout 或 owner state。

## Open Questions

无阻塞性开放决策。视觉参考图、截图和当前本机预览只作为结构/密度输入；真实 Owner、Provider、production 和 Spatial V3 readiness 继续由各自 capability evidence 决定。
