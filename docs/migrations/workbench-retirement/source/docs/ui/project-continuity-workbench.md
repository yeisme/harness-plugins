# 项目连续性桌面 UI

状态：设计基线，实施 pending。遵循 [Agent-first UI](agent-first-workbench.md) 与 [UI governance](../design/workbench-ui-governance.md)，产品要求见 [项目连续性工作台](../product/project-continuity-workbench.md)。

## 1. 单壳与视觉优先级

```text
Trusted Chrome：当前项目 / 快速打开 / 当前服务 / 授权范围
Compact product rail：沿用 /agent、/plugins、/activity、/settings
└─ Project directory drawer：最近成果、文件、会话、运行（默认收起）
└─ Agent Chat（320–380px） | Document dock（优先剩余宽度） | Context（按需）
   timeline + composer     最近成果 / 项目续接 / Diff         来源 / 审阅 / 证据
```

中央优先展示当前成果；Chat 保持布局锚点，可收窄但不卸载。Context 初始收起；有用户选择/审阅需要时展开。项目目录复用现有 drawer/目录服务和选择事件，不新增永久第二业务侧栏。现有 Session directory 仍可从项目会话分组和命令面板进入。

已授权的显式 document/Spatial 深链优先于 saved view；没有显式入口时，已有合法 view state 打开最近仍有权限的成果，首次或历史失效则打开紧凑续接 document。Canvas 仍是第一类 document，可主动打开，不作为没有项目内容时的强制空白首页。

## 2. UI Contract

- Surface classification：主区组合为 `core-shell`；项目续接为 `registered-pane`；专业内容保留 `domain-lens`；旧入口为 `advanced-compatible`。
- Primary user question：我正在推进什么成果，接下来可以做什么？
- First / second / third visual priority：当前成果及保存状态；下一动作/需要决定的阻塞；来源、运行与技术详情。
- Page/Pane pattern：现有 document dock + UnifiedSurfaceFrame；重复打开 focus 原 document，沿用默认 1–3、硬上限 4、split depth ≤2。
- Shared primitives/composites reused：Button、IconButton、SearchBox、Tabs、Dialog、Sheet 组合、CommandPalette、StatusBlock/DataState、ActionRecovery、EvidenceBlock、PaneChrome。
- Cards that earn existence：一处项目续接摘要；内容区使用对齐、行与分隔线呈现决定、来源、成果，不堆叠重复状态卡。
- Primary scroll owner：document body、Chat timeline、打开的 drawer 各自一个滚动容器；禁止 body 与 Pane 内容同时滚动同一区域。
- Domain-specific visual allowance：文本、代码、媒体、Diff、Canvas 复用获批 renderer；不定义新 tokens/font/modal/focus trap。
- Visual exceptions：无；继续使用现有 Instrumental Graphite、语义色、图标和 motion token。

## 3. 控件与动作清单

| 控件 | 输入/显示 | 行为与完成依据 | 焦点/恢复 |
|---|---|---|---|
| 项目切换 | 授权项目目录 | 切换 project scope、恢复安全 view；旧流不得污染新项目 | 选择后 focus 主区标题；未保存编辑先交给 owner 保存/提示 |
| 快速打开 | 项目/成果/会话/工具目录 | 复用全局命令面板；授权搜索只返回 safe projection | Escape 回原触发器 |
| 继续工作 | 一个 server-authored next action | prepare 后显示 Context 摘要；用户提交/批准后才执行 | prepare 不抢 composer 焦点 |
| 资料/文本选择 | ref、revision、selection | Ask/Modify/Add to context；复用 pending tray | 点击对象不自动发送或附加 |
| 成果标签 | 文件名、类型、保存/版本状态 | 同一 key 只 focus；关闭不取消执行 | 关闭后回相邻合法 document |
| 保存状态 | editing/saving/saved/uncertain | saved 仅来自 owner receipt；无写合同的 viewer 显示只读 | 离开未确认编辑有恢复提示 |
| 差异审阅 | 原版/候选/来源版本 | 接受候选进入 owner 工作态；正式版本另走原规则 | 冲突保留比较视图 |
| 运行条 | 当前步骤、等待原因、用量摘要 | 展开原 Task/Run；cancel/reconcile 使用原 attempt | 新事件不移动滚动或键盘焦点 |
| 授权范围 | 项目、操作范围、预算、期限 | 查看/申请/撤销独立 action grant | Dialog 关闭回原按钮；撤销不伪造 cancel |
| 来源行 | 来源版本、新鲜度、缺口 | 打开合法来源、Refresh/Remove 或 Pinax review | 保留选择，不静默换为最新引用 |

“项目目录”是用户语言；ProjectWorkspace、Dataset、receipt、grant 等技术字段放在次级详情。所有新文案进入现有中英 locale source 并通过 compose/check，技术标识保持稳定。

## 4. State Matrix

| Feature | Loading | Empty | Ready/Running | Error/Offline | Partial/Stale | Permission/Cost | Unknown |
|---|---|---|---|---|---|---|---|
| 项目 | 局部 skeleton | 选择/关联项目 | 最近成果+下一步 | 保留允许显示的缓存和故障原因 | 分区分别标 freshness | 失权隐藏敏感缓存 | 不据此创建 fallback 项目 |
| Continuity | 保留最后确认摘要 | 无 handoff，显示 context-only | 目标/决定/来源/继续 | Pinax 不可用，基础浏览可用 | 冲突显式 review；刷新来源 | 重新授权对应范围 | 不编造进度/记忆 |
| 成果 | viewer skeleton | 一个真实打开/导入入口 | 正文/预览+owner 保存状态 | 就地重读；未保存缓冲保留 | 外部修改进入 compare | 禁用动作并说明原因 | 未确认保存，查询原操作 |
| Run | 读取快照/cursor | 无活动运行 | 当前步骤+取消入口 | degraded/重连 | 保留 partial output | 显式 grant/gate | 原 attempt reconcile-only |
| Grant | 读取 policy | 申请独立批准 | 范围/预算/期限 | 无法重验时阻止新 dispatch | revision 变化重新准备 | 过期/撤销/预算耗尽 | 保留在途查询与回执 |

连接错误不能伪装成空数据。权限撤销时清除相应 query cache/预览；临时网络失败可保留最后已授权内容但明确 stale。内容删除、项目切换、Runtime 切换分别触发相应授权隔离，不共用浏览器本地“最新上下文”。

## 5. Responsive 与可访问性

| 有效宽度 | 布局 | 交互要求 |
|---|---|---|
| `≥1440px` | Chat + 主成果；Context 按需 | Chat 默认 380/min 320；成果 min 640；Context min 280，放不下则转 Sheet；目录默认 drawer |
| `1024–1439px` | Chat + active document | 项目/Context 使用互斥 labelled Sheet，避免挤压正文 |
| `<1024px` | 单一主内容，Chat/Review/对象摘要通过标签进入 | 保留 Chat、只读成果、差异和允许的决定；不挂完整重型 Canvas 编辑器 |
| `200% zoom` | 按有效 CSS viewport 自适应 | 不以物理屏幕尺寸强行保持三栏，关键动作可达 |

项目续接、保存与授权状态有可见标签及 accessible name。移动 Sheet 使用现有 focus trap、Escape、scroll lock、focus restore；桌面 complementary Pane 不 trap focus。Tabs 支持方向键，目录支持键盘选择，拖动有菜单替代，中文 IME composition 不触发发送快捷键。

动效沿用现有 120–180ms token，reduced-motion 禁用；新内容不自动滚动离开正在审阅的选区。功能正常时不常驻合同诊断告警。长文阅读/编辑采用 feature 内容样式，保持设计系统字体，正文建议 15–16px、1.6 行高；界面 chrome 保持现有紧凑密度。

## 6. 原型与验证

三个 prototype task：重新打开项目找成果、观察执行并介入、比较候选后继续。原型使用明确标识的 fixture，不能请求真实 provider 或授予 capability。原型只用于验证信息层级、宽度、动作可发现性，结果反馈到本 UI Contract。

实现验收固定 `WB-PC-DESKTOP`、`WB-PC-RESTORE`、`WB-PC-CONTEXT`、`WB-PC-REVIEW`、`WB-PC-A11Y` selectors，在 1024/1280/1440/1920 与 200% zoom 覆盖正常、空、partial、offline、stale、revoked、unknown。入口为 `bun run web:e2e --grep WB-PC-`；没有实际匹配用例不能报通过。
