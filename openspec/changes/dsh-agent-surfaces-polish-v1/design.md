## 作用域与信息结构

会话标题下的 Subagents 只显示该会话真实子会话。顶部显示作用域、运行数与来源已报告的用量；主区为树列表，选择后展示状态、父级关系、用量细项和明确目标的跟进。搜索跨已加载树，状态过滤不更改会话或任务。没有子会话时解释如何产生记录；没有 Ordo 关联时不显示空的 Ordo 标题。

Agent Team 常驻 Pane 属于当前本地用户工作区。首页列出已注册项目，显式进入项目后复用 Ordo 的待处理、任务图、执行者与时间线。项目选择和会话切换相互独立；子会话只通过已登记关联出现在 Ordo 视图。既有 agents.hub、subagent.monitor、/ordo-project 保留，增加清楚命名的 /agent-team 入口。用户级入口可重复聚焦，兼容项目深链保留独立目标。

列表关系只来自 DSH parentRef；任务依赖只来自 Ordo dependencies；两种图不混合。UI 状态仅存搜索、选择、布局和草稿，事实始终来自 owner。未知状态不转换为成功，缺失 API 禁用对应操作。迟到的读取、停止、发送结果不能覆盖另一个对象的反馈。

## UI Contract

- Surface classification: adopted。
- Surface kind: Subagent navigator + inspector；Agent Team workspace。
- First / second / third visual priority: 当前范围与待处理对象；执行关系与选择详情；用量和证据引用。
- Existing components reused: ui-surface、官方 Button/Input、ui-visual-kit token、现有 React Flow、Side Chat。
- Cards that earn existence: 无指标卡片墙；项目入口、任务和子会话均为可选行。
- Primary scroll owner: 工作区 body；宽屏树与详情在同一区域顶部对齐，不分别占满整屏高度。

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| Subagents | 标记目录读取中 | 区分无子会话与筛选无匹配 | 保留可见记录、提示刷新 | 目标内反馈 | 明确未知／过期，暂停写入 | API 缺失说明、并排能力说明 |
| Agent Team | 正在读取注册项目 | 说明注册入口 | 可重试的读取状态 | owner 回执 | 旧快照与对账提示 | 保留真实启动未接线原因 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 列表与详情切换，操作换行 | 列表与详情切换 | 列表与详情两列并顶部对齐 |

### Accessibility

- Keyboard path: Tab 遍历搜索、筛选和行动；树选择支持上下/Home/End、左右展开/折叠；Enter 选择；返回恢复触发控件焦点。
- Focus owner/return: 选择后详情标题，返回后原行；新事件不夺焦点。
- Visible labels and accessible names: 搜索、状态、跟进目标均可见；中英词典；长标题在详情完整换行。
- Reduced motion and coarse pointer: 不增加动画；触屏目标至少 44px。

### Visual Exceptions

树层级缩进属于有界几何，最多缩进六级，完整关系由父引用保留。不自建 token、图标库或宿主布局。

## 验证与边界

复用 Vitest、Testing Library 和现有 Playwright 视觉服务；检查 360/560/960px、单节点顶部布局、多层树、长名称、空态、断线、键盘以及两个会话的迟到结果隔离。浏览器 fixture 使用实际编译插件和明确合成数据，不启动模型。截图保存在本项目 temp/integration-test-runs。既有真实执行、两次返工及人工验收缺口继续由原 OpenSpec 跟踪，不以美化验收关闭。
