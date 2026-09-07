# Workbench Agent-first Pane Workspace

## 0. 文档定位

本文是 Yeisme Workbench 当前 Agent 前端的 UI Spec 与产品交付基线。应用级产品、页面/Pane 归属和 Definition of Usable 见 [Agent-first 应用 Blueprint](../product/agent-workbench-blueprint.md)，长期 UI 管理、route/Pane/Lens 分类、设计债务与压力测试见 [Workbench UI 设计治理与一致性合同](../design/workbench-ui-governance.md)，前后端信任链和数据合同见 [Agent workspace 接口合同](../interfaces/agent-pi-workspace.md)。Spatial 的详细控件和语义缩放见 [Spatial Canvas 交互设计](../design/spatial-canvas-interaction.md)。已归档 `workbench-agent-pi-workspace-v1` 与 `workbench-agent-ui-unification-v1` 提供 Task-backed Agent shell 和 v1 视觉基线；active `workbench-agent-chat-canvas-convergence-v2` 负责真实 Conversation Runtime、单一自适应 shell、Canvas/Pane document dock、pending selection、soft-follow 与原子 change-set。`workbench-agent-proposal-authority-v1` 继续提供 Review 决策权威；`workbench-spatial-canvas-experience-v3` 继续拥有 Spatial viewport/Lens/Draft/presence 能力，不定义第二主壳。

主视觉参考：

1. `prompts/product/ui-reference/workbench-agent-pane/deliverables/02-plugin-pane-workspace.png`：主布局与 Pane 插入体验。
2. `prompts/product/ui-reference/workbench-agent-pane/deliverables/01-agent-conversation.png`：对话、工具、审批和进度密度。
3. `prompts/product/ui-reference/workbench-agent-pane/deliverables/03-agent-review.png`：执行、评审、证据和恢复状态。

图片只决定构图与体验方向，不决定 Owner、Provider、Task 或插件是否可用。合同与服务端能力优先于图片。

## 1. 产品决策

### 1.1 核心判断

Workbench 的主产品不是 Overview dashboard、Spatial Canvas、Studio 复制品或 Owner 页面集合，而是：

> 一个围绕项目与成果持续工作的环境，以 Agent 对话保持协作，以热插拔 Pane 承载上下文和专业能力。

Agent timeline 与 composer 永远存在且不能被插件关闭。Files、Preview、Task、Evidence、Assets、Operations 等能力通过注册 Pane 插入当前会话；成果可以成为主要内容，对话保持锚点，不建立第二套执行控制面。

项目与成果优先姿态由 `workbench-project-continuity-desktop-v1` 的正式 delta 规划，详见 [项目连续性桌面 UI](project-continuity-workbench.md)。新 capability 生效后，以合法显式深链、最近成果、项目续接 document 的顺序选择主区，Chat 持续挂载；未启用时保留原 ordinary Agent/Spatial 行为。此处是目标 UI，当前不得据此宣称 runtime/continuity 已接通。

### 1.2 Owner-fit 决策

| 能力 | 决策 | Canonical owner | Workbench 角色 |
| --- | --- | --- | --- |
| Agent session、timeline、composer、Pane layout | `fit` | Workbench | 拥有 UI 组合状态与安全投影 |
| Pane plugin catalog、插入/关闭/聚焦/布局 | `fit` | Workbench | 版本化注册表与有界布局 |
| Task、gate、attempt、receipt、reconcile | `fit` | Workbench TaskService | 唯一执行控制面 |
| Proposal、decision、accept/reject/reconcile | `fit` | ProposalAuthorityService | Review 只消费服务端投影与 typed decision |
| Spatial Lens layout、view preference、Draft、presence | `fit` | Workbench | 持有空间呈现和协作草稿，不拥有领域终态 |
| Eikona/Scaena/Pinax/Sonora 专业状态 | `split-owner` | 各领域 Owner | typed projection、approved action、receipt、deep link |
| 文件系统、Terminal、Browser automation | `split-owner` | 获批 runtime/host | Pane 只消费有能力声明的安全接口 |
| 任意第三方插件执行 | `reject-now` | 未定义 | 不加载任意代码、URL、iframe 或 props |

## 2. Required Capability Ledger

| 能力 | 状态 | Delivery | 证据 |
| --- | --- | --- | --- |
| Agent 主对话、session rail、composer | `committed` | deliver-now | Agent component + Playwright |
| 运行中 session 切换与 attention/unread | `committed` | deliver-now | server cursor + reconnect tests |
| 版本化 Pane plugin catalog | `committed` | deliver-now | registry/catalog unit tests |
| 桌面 1–3 个可见 Pane | `required` | deliver-now | layout reducer + screenshot + keyboard |
| Pane command palette | `required` | deliver-now | Cmd/Ctrl+K interaction test |
| Pane close/focus/reorder/replace | `required` | deliver-now | typed state + focus restoration |
| Context、Run、Review、Evidence Pane | `committed` | deliver-now | existing typed panes |
| Proposal read/decision/reconcile | `committed` | deliver-now, default-off exact-principal cohorts | main spec + component/browser/real selected-Owner evidence |
| Operations/Owner Pane | `committed` | deliver-now when contract-ready | real facade or truthful unavailable |
| Files/Browser Preview/Assets Pane | `required` | retain-next by owner contract | descriptor + projection + failure state |
| Terminal Pane | `required` | retain-next behind host capability | no arbitrary shell; audited command contract |
| Saved project layout | `required` | retain-next | `SavedViewV1`/expected revision/idempotency |
| Spatial 四级语义缩放与导航 HUD | `required` | planned V3 | contract/browser/performance evidence |
| Spatial 项目 Draft、presence、选择集提升 | `required` | planned V3 | revision/conflict/authority/browser evidence |
| Mobile review/approval | `committed` | deliver-now | single Sheet path |
| Mobile free docking | `not-requested` | none | explicitly prohibited |

任何 review 或 scope cleanup 都不得静默删除 `required` 项；未交付能力必须保留为 `retain-next` 或 truthful `needs_contract`。

## 3. 页面问题与信息架构

主页面只回答一个问题：

> Agent 正在处理什么，依据是什么，当前阻塞在哪里，我可以安全地继续哪一步？

一级导航采用紧凑 icon rail：

- Agent：默认入口。
- Plugins：Pane catalog 与 capability 状态。
- Activity：跨 session attention 的安全摘要。
- Settings：布局、快捷键和受控 runtime 配置。

Overview、Orbit、Boards、Studio、Gateway、Knowledge Review 等旧顶层页面不再作为默认产品入口。未被删除的能力应逐步迁入注册 Pane 或保留为明确的外部/高级 deep link。

## 4. 桌面布局

目标视口：`1440×960` 与 `2560×1440`。

```text
┌────┬──────────────┬──────────────────────────────┬───────────────────────┐
│Rail│ Session list │ Agent conversation           │ Plugin Pane dock      │
│48– │ 220–260      │ primary, min 560             │ 1–3 visible panes     │
│56  │ optional     │ timeline + composer          │ max 46vw              │
│    │              │                              │ split depth <= 2      │
└────┴──────────────┴──────────────────────────────┴───────────────────────┘
```

布局不变量：

- Agent conversation 占主要视觉权重，建议宽度为可用内容区的 52%–68%。
- session rail 可折叠；折叠后不影响 timeline、draft 或后台 Task。
- Pane dock 默认最多 3 个可见 Pane，硬上限 4，split depth 最大 2。
- 达到上限时必须要求用户关闭或替换目标 Pane，不能静默丢弃旧上下文。
- 主对话、composer 和当前 session 不能被 Pane drag、插件 intent 或布局恢复关闭。
- Pane drag 只改变布局；对象 drag 必须转换为 typed intent 并重新经过 Owner gate。

### 4.1 Spatial Focus contextual layout

Spatial Focus 是 `/agent` 的上下文模式，不是并列主壳。Agent timeline 与 composer 始终存在；Spatial renderer 不得创建第二 composer、第二 event stream 或第二 Task control plane。

- `>=1440px`：canvas 占中央主区域，右侧 context area 可并排显示 Agent timeline 与 Inspector/Review/Evidence。
- `1024–1439px`：canvas 最小宽度 640px；右侧仅保留一个 320–384px context rail，通过 Timeline/Inspector/Review/Evidence 标签切换，composer 固定可见。
- `<1024px`：不挂载完整 renderer/editor，改为可搜索对象列表、当前选择摘要和 Owner deep link。
- Creative、Workflow、Run、Review、Evidence Lens 共用同一 context rail；任何 Lens 都不得在 canvas 内追加固定宽度业务侧栏。
- 常驻 HUD 仅承载 Lens、breadcrumb、Draft、zoom、fit、recenter、minimap、search 和 command palette；对象动作进入 context toolbar 或 rail。

### 4.2 Auctra Screenplay Room

`workbench-auctra-screenplay-room-v1` 计划在 Creative Production 内加入 closed `screenplay_room` 专业主面。它不新增 route、composer、event stream 或业务侧栏；Auctra 保留 structure/Beat、Scene Card/Contract、screenplay order/story time、正文 draft、review、Story Graph 和 receipt 的 canonical owner。

主面上层是可拖拽叙事顺序，下层是故事时间锚点/关系；两者共享选择和四级语义缩放，但 mutation 完全分开。Scene/Graph/Review/Evidence 使用共享 context rail；正文通过 focus mode 替换中央 surface，并保留顶部 timeline strip。`<1024px` 只提供列表/Sheet 审阅，不挂完整编辑器。

视觉、状态、图标、媒体和验收细节见 [Auctra Screenplay Room UI](auctra-screenplay-room.md)。当前 Auctra connector 未晋级，UI 必须保持 `needs_contract`，fixture 不得冒充 live。

## 5. Pane 系统

### 5.1 Pane plugin descriptor

每个 Pane 必须由版本化 descriptor 注册，至少包含：

```text
pluginId
paneType / routeVersion
titleKey / descriptionKey / iconName
group
closedParamsSchema
requiredCapabilities / roles / scopes
preferredPlacement
freshness / availability / disabledReason
rendererId
```

descriptor 不得包含任意组件代码、任意 URL、HTML、JavaScript、DOM selector、Owner credential、raw prompt、provider payload 或私有路径。

### 5.2 首批 Pane

| Pane | 数据来源 | 可执行性 |
| --- | --- | --- |
| Context | `AgentContextPackV1` | 显式 prepare/refresh/detach |
| Task Run | Task/event projection | cancel request / reconcile 走 TaskService |
| Review | canonical proposal + ActionDescriptor | typed decision；read/decision/reconcile 独立 server capability；accept 仅在 exact selected tool、proposal authority 与完整 Task/Owner gate 后启用 |
| Evidence | safe refs + receipt summary | 只读 |
| Operations | approved Owner facade | typed action；无 facade 时 unavailable |
| Context Map | authorized object relations | read-only；合同不足时 needs_contract |
| Work Items | `WorkbenchClient.workItems` typed 投影（workitemshttp 直连 RPC） | update/transition 携带幂等键与 expectedVersion；冲突保留选择 |
| Workflows | `WorkbenchClient.workflow` definitions/runs/events | 只读观察；动作走 proposal/Task |
| Daily Ops | `WorkbenchClient.dailyOps` inbox/approvals/activity | 渲染器就绪；传输投影等 R3 gates，palette needs_contract |
| Assets | `WorkbenchClient.assets` 安全投影 | 渲染器就绪；传输投影等 R3 gates，palette needs_contract |
| Identity | `WorkbenchClient.identity` principal/tenants/readiness | 只读；palette 由 readiness 门控 |
| Gateway | `WorkbenchClient.gateway` overview/backends/approvals | 只读；palette 由 capabilityState 门控（服务端 handler 属 MC 8.3） |
| Project Workspace | 既有 `workItems` 接口上的 Table/Kanban/Todo | 三视图同源同缓存；transition/update 经 typed client |
| Terminal | `workbench-agent-cli-pane-v1` 合同（未落地） | needs_contract；palette 禁用且不可打开 |

直连接口批次不新增 Operation 或第二执行状态机（Phase 2 的 workitemshttp 是既有 wiservice 的薄 wire 投影）：可用性按「传输真值 + 服务端真实投影」两层派生——SDK 方法没有浏览器传输投影的面（Daily Ops/Assets）在 palette fail-closed 并显示传输原因，落地后翻转静态表即启用；传输已注册的面由服务端 readiness/overview 投影门控或在 Pane 内以四态诚实呈现（浏览器不猜能力）。Files、Browser Preview、Terminal 暂不伪造为可用。它们进入 catalog 前必须拥有独立 consumer contract、权限、版本、错误、证据和回滚语义。

Pane lifecycle 固定为 `registered → available/needs_contract/permission_required/offline → requested → resolved/mounted → loading/ready/empty/stale/degraded/error → closed`。`mounted` 只表示 renderer 已装载，不表示 capability ready；关闭 Pane 不取消 Task 或删除 Owner state。

### 5.3 Pane 命令面板

`Cmd/Ctrl+K` 或 `+ Pane` 打开“插入功能面板”：

- 按 Context、Execution、Review、Operations 分组。
- 每项显示图标、名称、说明、快捷键、权限与 availability。
- 不可用项保留并显示原因，而不是从列表消失。
- 选择后再次校验 session、scope、safe params、registry version 和 Pane 上限。
- 键盘支持搜索、Arrow、Enter、Escape；关闭后焦点返回真实 trigger。

## 6. Agent 对话

timeline 使用连续工作记录，不采用大面积聊天气泡：

- 用户意图。
- Agent 简明响应与可展开推理摘要；不显示 chain-of-thought。
- tool execution rows。
- permission/cost/expected-version gate。
- Task progress 与事件。
- finding/question/proposal/handoff。
- artifact、receipt 与 evidence 引用。

composer 固定在当前 session 底部，支持显式 context、attachment descriptor、slash command 和 send/stop。未发送 draft 只保存在浏览器内存；session 切换可以保留，reload 后不声明已恢复。

## 7. 状态与恢复矩阵

| 状态 | 对话 | Pane | 下一步 |
| --- | --- | --- | --- |
| loading | skeleton / connecting | 保留布局骨架 | 等待或取消 |
| empty | 推荐一个真实起步动作 | catalog 可打开 | 新建 turn / 附加上下文 |
| running | 持续事件与可停止状态 | Run 自动更新但不抢焦点 | 继续其他 session |
| permission_required | 显示范围与原因 | Review/Inspector 解释 | 请求权限 |
| cost_required | 不伪造提交 | gate Pane | 明确批准或取消 |
| needs_contract | 基础 output 仍可读 | 插件禁用并解释 | 查看合同要求 |
| stale | 标记旧 revision | 禁止依赖旧版本 mutation | Refresh |
| offline | 显示 last confirmed | 保留 safe cache | Retry read |
| partial | 仅列出已确认 item | Evidence 保留成功项 | 修复失败子项 |
| unknown_accept | 不显示成功或失败 | Run/Review reconcile-only | Reconcile |
| limit_reached | 对话不受影响 | 不插入新 Pane | 关闭或替换 Pane |

## 8. 视觉系统

- Product posture：developer-native、克制、高密度、低饱和、可信、非营销。
- Shell：smoked graphite；玻璃只允许用于 overlay/focus context。
- Typography：UI 使用 Inter/system；ID、路径、Task、receipt、version 使用 mono。
- Spacing：4/8/12/16/24/32。
- Radius：chip/badge 6px；普通控件 10px；面板/Pane 容器 12px；overlay/dialog 14px；pill 仅限开关与小徽章。对齐 Eikona 高保真基线（`prompts/product/ui-reference/workbench-agent-pane/deliverables/02`）。
- Surfaces：四级层次——canvas < rail/sidebar < panel < elevated/popover，逐级微亮；面板与浮层用 1px 低透明边框 + 深色柔和投影（不允许厚玻璃）；实心 accent 填充仅限主 CTA，其余 accent 以 tint（12–16% color-mix）/文字/描边表达。
- Primary：低饱和 cyan/blue，仅用于焦点和 primary action。
- Warning：amber；blocked/destructive：red；success：restrained green。
- Motion：120–240ms，解释 open/close/focus/reorder；支持 reduced motion。

视觉黑名单：Hero、KPI 卡片墙、无意义渐变、厚玻璃、随机 emoji、全屏空 Canvas、假实时、假成功 toast、provider logo 导航、嵌套卡片、没有原因的 disabled action。深色柔和投影与低透明边框是允许的层次手段，不属于"厚玻璃/无意义渐变"。

### 8.1 UI 统一收敛规则

本节是 `workbench-agent-ui-unification-v1` 的前端落地基线，适用于 `/agent` 和全部已注册 Pane：

- 共享 `PaneFrame/PaneChrome`、`PaneToolbar`、`StatusChip`、`DataState`、`ActionRecovery`、`EmptyState` 和 loading skeleton 槽位；Pane 不再自定义同语义 header、状态卡或恢复按钮。
- 主层级固定为“可折叠 session rail → conversation/composer → Spatial/Pane surface → 单一 context rail”。Spatial Lens 不得在画布内叠加固定宽度业务侧栏。
- 状态块按“用户影响 → 一个真实主动作 → 可展开 technical details”排列；`unknown_accept` 只允许原 attempt reconcile，不能出现成功、失败或 retry 文案。
- 选择对象、打开 Pane、加入上下文和应用建议均为显式动作；自动 presentation 不写 composer、不附加 Context Pack、不创建 Task、不移动键盘焦点。
- 中文是默认用户语言；技术 ref、Task、receipt、版本、Pane/Lens 类型作为次要英文 mono metadata。新文案必须同时进入 `api/locale/source/zh-CN/**` 和 `api/locale/source/en-US/**`。
- 空态只提供一个真实起步动作；不得用 demo turn、synthetic node、fake owner data 或重复的 attach/send control 填充空白。

`/agent` 与 registered Pane 统一验收矩阵（同 package revision 下按行验收；matrix 全绿才允许收口本 change）：

| 验收面 | Conversation/Split | Spatial Focus | Registered Pane | 移动端 Sheet |
| --- | --- | --- | --- | --- |
| 主层级（session rail → conversation → surface → 单一 context rail） | ✓ | ✓ | ✓ | Sheet 化，不挂完整 Spatial editor |
| 标题唯一 + 技术元数据次要（mono/折叠） | ✓ | ✓ | ✓ | ✓ |
| 状态块“影响 → 一个主动作 → 技术详情”，ready 不渲染告警 | ✓ | ✓ | ✓ | ✓ |
| `needs_contract/offline/stale/permission/unknown_accept` 就地呈现 + 单一恢复动作 | ✓ | ✓ | ✓ | ✓ |
| 空态单一起步动作，无 demo/fake data | ✓ | ✓ | ✓ | ✓ |
| 选择/attach/open/建议为显式动作，不写 composer、不抢焦点 | ✓ | ✓ | ✓ | ✓ |
| 键盘焦点返回、dialog focus return、reduced-motion | ✓ | ✓ | ✓ | ✓ |
| 中文优先文案，技术 ref 英文 mono | ✓ | ✓ | ✓ | ✓ |
| 1440/1024/390 + 200% 有效宽度无横向溢出 | ✓ | ✓ | ✓ | ✓ |

### 8.2 Chat-Canvas v2 单一自适应工作台

`workbench-agent-chat-canvas-convergence-v2` 在 v1 共享视觉语言之上改变信息架构与状态连接：

- 移除 Conversation/Split/Spatial Focus 作为一级 modebar；旧 `?view=` 值只决定初始 document/layout preference。
- 宽屏默认 `Chat rail 360–440px → Canvas/Pane document dock min 640px → Context rail 320–384px`；Session directory 是默认收起、可 pin 的 drawer。
- Canvas 与 registered Pane 使用同一 document registry、tab/split、visible limit、focus return 和 responsive Sheet 语义；Canvas 不再由 route 独立挂载。
- Timeline 以 user/assistant structured Block 为主线；Task、thinking、tool、gate、receipt 和 technical ref 进入 per-turn Run detail，重复状态按 canonical identity 合并。
- Composer 上方区分“待附加选择”和“已附加 Context/artifact”：Canvas selection 立即进入 pending tray，但必须由用户明确确认并通过 exact-revision server revalidation 后才进入本次 turn。
- Profile Sheet 是首次 real Chat 的授权入口：显示 runtime/model、tool/context scope、预算、期限、retention 和 soft-follow；普通 Chat 在 grant 内直跑，越界/付费/mutation 继续显式 gate。
- Soft follow 在 Profile 明示授权后默认开启，只渲染 temporary highlight/preview 和 Context projection；dirty composer、Review、modal、replay、stale/scope mismatch 自动降级 suggestion。
- Assistant 生成 Canvas change 时，中央 document 显示临时 preview，右侧 Review 显示整包原子 change-set；没有逐项 browser mutation 或自动 Accept。

v2 响应式验收：

| 有效宽度 | 默认组合 | Canvas 能力 | Context/Session |
| --- | --- | --- | --- |
| `>=1440` | 左 Chat + 中 document + 右 Context | 完整 desktop Canvas/Draft | Session drawer 可 pin |
| `1024–1439` | Chat + active document | desktop Canvas，Context 互斥 Sheet | Session/Context Sheet |
| `<1024` | Chat + labelled Sheet/list | 不 mount Pixi/WebGL/Draft editor | 对象摘要、Review/Accept |

所有状态必须覆盖 keyboard、200% zoom、reduced motion、focus restore、screen-reader announcement 与 `needs_contract/offline/stale/partial/unknown_accept` truthful recovery。

实现状态（2026-09-04）：上表响应式矩阵、Sheet 形态、keyboard/Axe/overflow 门与 Profile Sheet send gate 已按 v2 shell 落地并通过全量 e2e（210/0，Axe serious/critical=0，截图/trace 随 evidence run `20260904051106-a2b87e5d`）；Follow Pi（soft-follow 唯一显式入口）的容器断点已对齐 v2 chat rail 宽度契约（@[340px]）。真实 runtime canary 与 Aigora 面仍 blocked（见 Blueprint 3.4 ready 状态）；blocked 面不渲染可操作空壳。

### 8.3 Text Development 长时间创作模式

Text Development 是 `domain-lens` document，不是新的 route shell。它在 v2 的 Chat / Document / Context 三域中增加：

- source-preserving CodeMirror document，仅显式 open 返回正文；autosave 只在 Auctra receipt 后显示 saved。
- `Structure|Review|Versions|Team` 四个稳定 Context deck，避免 Outline、Entities、Candidate、Checkpoint、Profile、Evidence 等形成平级 tab 洪水。
- selection-first action bar；默认 Ask/Rewrite/Polish/Add to context，server manifest 最多增加四个动作。
- inline/document/change-set 三种 candidate review；移动端统一 diff，action identity 不变。
- Working Copy→Checkpoint→ReviewItem→Canon 的可见版本链，以及 Ordo Team Plan/simulation/real canary 的明确成熟度。

实现只能复用本地 design system。`WorkingCopyStatusStrip`、`TextSelectionActionBar`、`TextVersionLedger`、`TextTeamPlanSurface` 先作为 feature-local composition；`DiffView` 只有在两个以上真实 surface 共享相同 normalized diff 语义时才晋级全局 composite。

完整规格见 [Text Development Workbench UI](text-development-workbench.md)。

## 9. 组件树

```text
AgentWorkbenchShellV2
├── TrustedChrome
├── CompactNavigationRail
├── AgentSessionDrawer
├── AgentChatRail
│   ├── ConversationHeader
│   ├── Timeline
│   ├── StructuredMessageBlocks
│   ├── RunDetailDisclosure
│   ├── PendingSelectionTray
│   └── Composer
├── AgentDocumentDock
│   ├── SpatialCanvasDocument
│   ├── TextDevelopmentDocument
│   ├── PaneTabStrip
│   ├── PaneSplitRegion[]
│   └── PaneFrame
├── SharedContextRail
├── PaneCommandPalette
└── ResponsiveOverlayLayer
```

统一组合槽位在上述组件树中复用：

```text
UnifiedSurfaceFrame
├── SurfaceHeader(title, status, technicalMeta, actions)
├── SurfaceToolbar(viewActions, search, commandPalette)
├── SurfaceBody(LoadingSkeleton | EmptyState | StatusBlock | ReadyContent)
└── SurfaceFooter(optional notice, freshness/cursor)
```

`AgentConversationWorkspace` 当前单文件体积过大，应按上述边界拆分；拆分不得创建第二份 transport、Task、Context 或 action state。

## 10. 响应式与无障碍

- `>=1440px`：Chat rail + Canvas/Pane document dock + Context rail；Session drawer 可 pin。
- `1024–1439px`：Chat 与 active document 常驻；Session/Context 使用互斥 Sheet。
- `<1024px`：单列 Chat；Session、Canvas summary、Context 与 Review 为 labelled Sheet/list；不挂完整 Spatial editor。
- 200% zoom 不产生页面级横向滚动；宽表在 Pane 内滚动或转换为 label/value record list。
- 每个 drag action 必须有 menu/keyboard 等价路径。
- Dialog/Sheet 定义 focus trap、Escape、scroll lock 和 focus restore；桌面 complementary Pane 不 trap focus。
- icon-only control 具备 aria-label 与 Tooltip；状态不能只依赖颜色。
- Spatial Canvas 的 region、cluster、object 和 selection 均提供独立于 WebGL 的可访问摘要；键盘用户可搜索、定位、检查和多选。
- Spatial 视口在 layout/rail/mode 改变后按真实 host 尺寸重新查询；不得继续使用固定 canvas bounds。

## 11. 第一交付切片

Deliver now：

1. 将 `/agent` 设为默认产品入口，旧页面降级为 Pane、advanced route 或 deep link。
2. 固化 Pane catalog 与 session-scoped `AgentPaneLayoutState`。
3. 桌面实现最多 3 个可见 Pane；tablet/mobile 保持单 Pane Sheet。
4. 实现 Pane command palette、关闭、聚焦、替换、键盘路径和 limit reason。
5. 将 Context、Run、Review、Evidence、Operations 接入同一 Pane dock。
6. 用 Playwright 固定截图对比三张 Eikona reference 的结构、密度和状态表达。

Retain next：Files、Browser Preview、Assets、Terminal、SavedView、跨设备布局同步。它们必须按 ledger 保留，不得在 cleanup 中静默删除。

Spatial Canvas V3 由独立 change 分阶段交付：先完成四级投影、HUD、搜索、小地图和 1024px 外壳，再增加 Lens layout/view preference、Draft/presence 与选择集提升。V2 在 V3 GA 后至少保留一个发布周期。

## 12. 验收标准

- 未启用项目成果姿态的 ordinary Agent 首屏中，timeline/composer 是主要视觉与交互入口；启用新姿态的合法项目以成果/续接 document 为主视觉，对话/composer 保持锚点；明确 Spatial/专业深链遵循原入口。
- 不出现第二 composer、第二 Agent event stream 或第二 Task control plane。
- 桌面可插入、聚焦、关闭并同时查看 1–3 个已注册 Pane；满额时不静默替换。
- 所有 Pane 都由同一 registry 解析，未知类型/version/params fail closed。
- Pane 不可用时显示稳定原因和恢复动作；不使用 mock fallback 冒充 Owner 数据。
- 运行中 session 可切换，后台 Task 不被取消；unknown accept 仅允许 reconcile。
- 1440×960、1024×768、390×844、200% zoom、reduced motion、keyboard 与 Axe 验证通过。
- 浏览器只访问 Workbench BFF/typed facade，不直连 Owner，不保存 raw prompt、credential、private path 或 provider payload。
- 非空 Spatial 项目在 Atlas/Cluster 不得呈现空白；50k fixture 下仍满足 viewport、primitive、DOM、frame、heap 和 first-frame 预算。
