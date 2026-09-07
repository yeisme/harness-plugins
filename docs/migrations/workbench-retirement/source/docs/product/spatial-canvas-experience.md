# Workbench 语义无限画布产品设计

## 0. 文档定位

本文定义 Workbench Spatial Canvas 的产品目标、能力边界、用户工作流和交付口径。它是 [Agent-first 应用 Blueprint](agent-workbench-blueprint.md) 的空间体验细化，不建立独立主壳。

- 交互、控件和可视化：[Spatial Canvas 交互与视觉设计](../design/spatial-canvas-interaction.md)。
- V2/V3 合同、持久化与迁移：[Spatial Canvas V3 接口设计](../interfaces/spatial-canvas-v3.md)。
- 正式实现规格：`openspec/changes/workbench-spatial-canvas-experience-v3/`。
- 既有 Spatial/Creative 实现背景：[Unified Spatial Creative Runtime V1](unified-spatial-creative-runtime.md)。

本文描述目标设计，不代表当前 dirty worktree、local fixture、截图或 OpenSpec artifact 已达到 production readiness。

## 1. 产品判断

Workbench 不需要再做一个通用白板，也不应把 Spatial Canvas 降成只能平移缩放的只读图。正确定位是：

> 以 Owner 安全投影为可信语义主画布，以 Workbench 持久 Draft 承载自由思考，再通过显式 proposal 把草稿提升为可审查、可执行、可对账的正式变化。

这个判断解决三个长期冲突：

1. 用户需要便签、文本、手绘、临时关系和空间编排，但这些内容不能绕过 Owner 权威。
2. Creative、Workflow、Run、Review、Evidence 都需要空间表达，但不能各自复制画布、搜索、协作和状态机。
3. 项目可能包含数万对象，但浏览器只应看见当前 Lens、viewport 和语义层级所需的有界信息。

## 2. 目标用户与核心工作

| 用户 | 主要工作 | 画布价值 |
| --- | --- | --- |
| 创作者/导演/策划 | 理解项目层级、场景、镜头、资产和生产缺口 | 把叙事结构、生产关系和证据放进同一空间上下文 |
| Agent workflow 设计者 | 查看任务、依赖、Agent、工具、运行和审批 | 从全局拓扑进入具体阻塞与安全动作 |
| Reviewer/运营成员 | 比较候选、处理 proposal、核对 receipt/evidence | 保留决策依据、运行结果与恢复入口 |
| 团队协作者 | 共同标注、组织草稿和交接上下文 | 看到轻量 presence，不把临时协作冒充 canonical state |
| 自动化 Agent/CLI | 查找对象、打开 Lens、聚焦或建议变化 | 使用稳定 typed contract，不解析画布像素或页面文本 |

核心 Job-to-be-done：

> 当项目对象、运行、决策和证据分散时，用户能从一个稳定空间视图理解“现在在哪里、什么相关、为什么阻塞、下一步由谁确认”，并在不离开 Agent session 的情况下完成布局、草稿、审查、执行和对账。

## 3. Owner-fit 与 Required Capability Ledger

| 能力 | 准入 | 状态 | Canonical owner | Workbench 责任 | 交付 |
| --- | --- | --- | --- | --- | --- |
| Agent conversation、session、空间模式 | `fit` | committed | Workbench | 单一 `/agent` 壳与上下文切换 | deliver-now |
| Lens layout、region、camera preference | `fit` | required | Workbench | 空间投影与用户偏好 | deliver-now |
| Atlas/Cluster/Object/Detail | `fit` | required | Workbench Spatial service | exact-revision、LOD、聚合和有界渲染 | deliver-now |
| 全局搜索、小地图、适配/回中 | `fit` | required | Workbench | 跨 Lens 导航与可访问定位 | deliver-now |
| 项目持久 Draft、undo、轻量 presence | `fit` | required | Workbench | 临时创作和协作 | deliver-now |
| Draft 选择集提升 | `fit` | required | ProposalAuthority + TaskService | 映射、审查、执行和 receipt | deliver-now |
| Creative/Workflow/Run/Review/Evidence 专业事实 | `split-owner` | required | 各 Owner | safe projection、action、receipt、deep link | staged |
| Owner 业务内容、依赖、状态和终态 | `split-owner` | committed | 各 Owner | 不复制、不推断 | existing boundary |
| 自由图形直接成为业务真相 | `reject-now` | rejected | 未定义 | 必须经过 Draft promotion | none |
| 全员镜头强同步与完整实时白板 | `reject-now` | not-requested | 未定义 | 仅轻量 presence | none |
| 移动端完整画布编辑器 | `reject-now` | not-requested | future client | Web 只保留浏览、审查和深链 | none |

## 4. 产品结构

Spatial Canvas 只存在于 `/agent`：

```text
Agent Workspace
├── Conversation：默认 Agent 入口
├── Split：对话与空间并列
└── Spatial Focus：中央画布 + Agent/context rail
    ├── Creative Production Lens
    ├── Workflow Lens
    ├── Run Lens
    ├── Review Lens
    └── Evidence Lens
```

默认行为：

- 普通 `/agent` 请求进入 Conversation。
- project、DSH、spatial deep link 等可信 ingress 进入 Spatial Focus。
- 每个项目可恢复用户上次有效模式，但本地偏好不能开启服务端未授权 capability。
- Agent timeline/composer 始终可见且不可被 Lens、Pane 或布局恢复关闭。
- `<1024px` 不挂载完整编辑器，使用对象列表、选择摘要、Review 和 Owner deep link。

## 5. 双层对象模型

### 5.1 可信语义层

正式对象来自 Owner、TaskService、ProposalAuthority 或 Workbench 的安全投影。画布可以保存它们在某个 Lens 的位置、区域和显示顺序，但不能修改：

- Owner 内容或领域状态；
- canonical 依赖、审批、成本和权限；
- Task/Workflow 的运行终态；
- receipt、evidence 和交付状态。

拖动正式对象默认只改变 Lens layout。内容、依赖、状态、归属或交付变化必须进入 proposal/action。

### 5.2 Draft 层

Draft 支持：

- 便签和短文本；
- 手绘/高亮；
- 临时 connector；
- frame/section；
- 对正式对象的 safe reference。

进入 Draft 模式时，画布边界、光标、工具栏和对象样式必须同时变化。用户可单独隐藏、锁定或筛选 Draft，避免把草稿误认为真实状态。

Draft 默认项目持久、多人可见、可恢复。它可以承载讨论和规划，但不能独立表示“已批准”“已生产”“已交付”或其他 Owner 终态。

## 6. 五个 Lens 的共同能力与专业语法

“齐平”指核心能力齐平，不是所有 Lens 长成同一种节点图。

| Lens | 主要空间语法 | 首要问题 |
| --- | --- | --- |
| Creative | 层级 Frame、Storyboard、时间顺序、资产分区 | 项目/Show、Episode、Scene、Shot/Asset 如何组织，缺什么 |
| Workflow | 阶段泳道、DAG、关键路径 | 哪些步骤依赖、阻塞或等待批准 |
| Run | 状态/时间泳道、当前步骤和异常覆盖层 | 现在运行到哪里，哪里失败或需要 reconcile |
| Review | 队列、比较区、决策与缺证据区域 | 哪些内容需要决定，依据是否完整 |
| Evidence | Source→Claim→Decision/Receipt→Artifact | 结论和结果由什么证据支持 |

每个 Lens 必须具备：导航、搜索、选择、多选、Draft、布局、proposal、运行/评审/证据入口、导出/深链、truthful unavailable 和可访问对象列表。

同一个对象在多个 Lens 中共享 identity 和 Owner revision，但可以有不同空间位置。切换 Lens 时围绕已选对象保持上下文；目标 Lens 没有投影时显示真实原因和相关对象，不显示空白后假装定位成功。

## 7. 核心用户工作流

### 7.1 从 Agent 对话进入画布

1. 用户在对话中打开项目对象，或 Agent 给出 allowlisted spatial intent。
2. Workbench 验证 session、safe refs、Lens、capability 和版本。
3. Spatial Focus 打开并选中对象；composer 仍可用。
4. 用户可切换 Lens、聚焦、比较或把对象引用加入 Draft。

Agent intent 默认只是 presentation suggestion，不能移动键盘焦点、创建 proposal 或触发 Owner mutation。

### 7.2 从全局概览进入局部编辑

1. Atlas 展示 region、密度、异常和状态热区。
2. 用户通过小地图、搜索、cluster 或 breadcrumb 定位。
3. Cluster 展示分组、数量和关键状态。
4. Object 展示可选轻量卡片与按需关系。
5. Detail 为当前选中对象加载富摘要、thumbnail 和 context controls。

缩放改变信息层级，而不是把同一张复杂卡片无限放大缩小。

### 7.3 草稿提升

1. 用户选择一组 Draft 对象和 connector。
2. Agent/服务端解析目标类型、Owner、依赖、影响、风险、成本和缺失信息。
3. Review 显示映射预览，用户可接受、拒绝或要求修改。
4. 接受后进入 ProposalAuthority→TaskService→Owner。
5. receipt/refetch 确认后 Draft 标记 promoted，并显示 canonical refs。
6. 结果不明时 Draft 保留，只有原 attempt reconcile；禁止自动重试。

### 7.4 多人协作

Draft 修改按 revision/event 顺序保存。光标和拖动预览属于 ephemeral presence：它们帮助共同探索，但不作为锁、审计或 canonical state。presence 不可用时，Draft 仍可通过 revision、冲突和 refetch 工作。

## 8. 产品控件原则

成熟画布需要可发现的导航，但 Workbench 不应常驻完整白板工具墙。常驻 HUD 只保留：

- Lens、breadcrumb、状态和 Draft 模式；
- 缩放、适配全景、适配选区、回到内容；
- 小地图、全局搜索和命令面板。

对象动作随选择出现。正式对象只提供检查、聚焦、比较、跨 Lens 定位、加入 Draft、规划布局和提出变化；Draft 才提供文本、连接、Frame、样式、锁定、删除和提升。

交互模式参考 [FigJam 的平移/缩放](https://help.figma.com/hc/en-us/articles/1500004414582-Pan-and-zoom-in-FigJam)、[FigJam Sections](https://help.figma.com/hc/en-us/articles/4939765379351-Organize-your-FigJam-board-with-sections)、[React Flow Controls](https://reactflow.dev/api-reference/components/controls)、[React Flow MiniMap](https://reactflow.dev/api-reference/components/minimap) 和 [tldraw 性能机制](https://tldraw.dev/sdk-features/performance)，但最终行为以 Workbench 的 Owner/Task/Proposal 边界为准。

## 9. 性能姿态

首个稳定版本选择“5 万对象的流畅控制面”，不追求一次渲染全部对象：

- 50,000 addressable objects；
- 75,000 relations；
- 1,000 regions；
- 默认 viewport query 4,096 primitives，hard cap 8,192；
- rich DOM 不超过 200；
- Atlas/Cluster 必须返回可见聚合，而不是空白成功。

性能指标延续当前 browser gate：cold first frame ≤2,500ms、warm ≤1,200ms、highlight ≤50ms、frame P95 ≤20ms、long tasks ≤1、heap <512MiB（可测时）。

## 10. Delivery slices

### Slice A：导航与可理解的远景

- 修复 density/cluster 空白。
- 增加 ResizeObserver、HUD、小地图、全局搜索和适配/回中。
- 完成 1024px 自适应 context rail。

### Slice B：Viewport V3 与 Lens 投影

- 增加四级语义缩放、region 和 V3 transport/SDK。
- 增加 Lens Layout 与用户 View Preference。
- 保留 V2 完整兼容。

### Slice C：Draft 与协作

- 项目持久 Draft、revision patch、undo 和 conflict compare。
- 轻量 presence 与降级路径。

### Slice D：正式化与五 Lens 齐平

- 选择集 promotion、ProposalAuthority/TaskService/receipt。
- 五个 Lens 专业语法和共同能力矩阵。

## 11. Definition of Usable

Spatial Canvas 只有满足以下条件，才能标记为可用：

1. `/agent` 主壳、conversation anchor 和 Owner 边界没有回退。
2. Atlas/Cluster/Object/Detail 均有可理解、非空且可访问的投影。
3. HUD、搜索、小地图、适配和跨 Lens 定位具有真实行为。
4. Draft 与 canonical 对象在视觉、状态、存储和 action 上明确分离。
5. 业务变化只能通过 canonical proposal/Task/receipt 链完成。
6. V2 consumer 不受 V3 部署影响。
7. 1024/1440/1920、keyboard、200% zoom、reduced motion、WebGL degraded 和 reconnect 通过。
8. 50k 性能 gate 与 integration evidence 通过。
9. Owner 能力只有在 typed contract、receipt/reconcile 和 capability evidence 完整时才显示 available。

页面可打开、DOM 为零、fixture 成功、截图好看或 OpenSpec artifact complete，都不能单独证明 Spatial Canvas usable。
