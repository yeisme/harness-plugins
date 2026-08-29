## Context

Creator Studio 当前把六个 owner snapshot、Scaena production/reviews/jobs 和 Pane View 注册组合在一个 `creator.studio.snapshot.v1alpha1` 中。客户端已有唯一 sidebar “创作”入口，但仍会同时打开 Home 与 `creator.jobs`；AI Drama Director 已提供 Context/Story/Visual/Audio/Run/Review Pane 和 `dramaDirector` client face，Ordo Agent Ops 已提供安全 run 与 approval descriptor 投影。

本 change 在现有实验性合同上做增量演进。浏览器仍只消费安全投影；Creator Studio 不拥有项目目录、资产、run、approval、ProductionGraph 或 Workbench 状态。

## Goals / Non-Goals

**Goals:**

- 一个常驻“创作”入口，只打开 Home，并从 Home 按需打开完整 Pane 目录。
- 当前项目默认、全部授权项目可选的跨 owner 资产库。
- 独立生成与审批 Pane，事实与决策由 Ordo owner 提供。
- Pane 内可完成当前项目做剧流程，Workbench 作为可选专业工作台。
- 旧字段、View kind 和 Command 保留一个发布周期。

**Non-Goals:**

- 不在 Creator Studio 创建项目、资产、run、approval 或 Show canonical store。
- 不复制 Workbench 的 Episode Board、批量 Review Inbox、Delivery dashboard 或跨集密集操作。
- 不从 browser fan-out、路径、URL、raw prompt 或 provider payload 构造资产和运行事实。
- 不删除 `jobs`、`reviews`、`creator.jobs` 或 `creator.review`。

## Decisions

### 1. `projectRef` 作为 Pane context 的可选增量字段

`PaneContextV1` 与 `CreatorStudioContextV1` 增加可选 `projectRef`，因为 action descriptor 复用 Pane context。Creator Gateway 构造时冻结并在 snapshot/action 比较中校验它；旧 Host 不提供该字段仍可读取旧功能，但当前项目资产查询返回 `needs_contract`。

### 2. 资产使用独立 Remote 查询，不扩张主 snapshot

新增 `assets(query)`，query scope 只允许 `current_project|all_projects`，并支持 owner/kind/status/text、opaque cursor 与 bounded limit。当前项目读取 owner 当前 snapshot resources；全部项目只调用 owner adapter 的可选 `listAssets`，Host 汇总、稳定排序、过滤和分页。未实现 `listAssets` 的 owner 被记为 unavailable，不触发 browser fallback。

### 3. Ordo operations 作为可选 Host source

Creator Gateway 结构化读取已挂载的 `ordoAgentOps.snapshot()`/`decide()`，再次验证安全子集和 tenant/workspace/principal/installation 绑定。主 snapshot 新增可选 `operations`、`generationRuns`、`approvals`；旧 `jobs/reviews` 继续原样输出给旧客户端。新客户端优先使用 Ordo 字段，旧 Host 下只以 legacy 标记只读展示旧字段。

审批提交只携带 `decisionRef`，Gateway 重新读取 fresh Ordo snapshot、核对 descriptor 与 expiry 后最多调用一次 `decide`，并映射为 Pane receipt。unknown/reconcile 不重试。

### 4. 新 View 与旧别名并存

新增 `creator.assets`、`creator.generation`、`creator.approvals`。`creator.jobs` 与 `creator.review` 继续注册，但组件和命令分别委托给 generation/approvals；旧 kind 不重解释持久化 identity。`creator.open` 和 sidebar launcher 只打开 singleton Home。

### 5. 完整做剧复用 Drama Director face

Creator Home 的“完整做剧”动作优先调用已挂载 `dramaDirector.applyPreset()`；face 缺失时仍打开现有 `creator.production` 并显示 capability reason。用户可在 Context/Story/Visual/Audio/Run/Review 间按需工作，`Open in Workbench` 保留但不是必经路径。

## Risks / Trade-offs

- [全部项目资产每页需要 owner fan-in] → 每个 owner 返回最多 1,000 条安全资产，Host 最多合并 6,000 条后稳定分页；后续有真实规模证据再升级多游标。
- [Ordo 当前只发布一个 run summary] → generation 数组先容纳当前 run，合同保持数组以兼容后续 owner 扩展。
- [旧 Host 没有新字段] → Client 保留 legacy jobs/reviews 只读降级并明确 source，不启用审批 mutation。
- [项目上下文缺失] → 当前项目资产 fail closed；全部项目也必须由 owner adapter 显式支持，不把 workspace 猜成 project。
- [两个做剧客户端体验重叠] → 共享 owner refs/contracts；Pane 面向会话任务，Workbench 面向专业批量管理，不共享 browser state。

## Migration Plan

1. 先发布 additive Pane/Creator context、资产与 operations 合同，保留旧字段和 kind。
2. Host 开始输出新 Ordo projection；Client 优先读取新字段并保留 legacy read-only fallback。
3. Creator Home 接入 Drama Director face；Workbench handoff 保持兼容。
4. 旧 `jobs/reviews` 与 `creator.jobs/review` 至少保留一个完整 release；移除需后续 OpenSpec change。
5. 回滚时恢复旧 Creator host/client bundle；新增字段和 Remote 方法被旧消费者忽略，owner canonical state 不受影响。

## Open Questions

无。多 run、多 owner approval 分页与专业跨项目资产检索在获得规模证据后另开 change。
