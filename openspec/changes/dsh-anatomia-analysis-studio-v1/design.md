## Context

依据 2026-09-07 创作台程序。Anatomia 公共接口与视频观察合同（时间坐标、来源访问、观察记录）是其消费真源；原文快照不构成实施权威。

## Goals / Non-Goals

目标：在 DSH Pane 内完成「打开观察 → 浏览时间坐标/关键帧 → 发起范围分析 → 审阅 → 固定版本参考回填」的一条真实路径。

不做第二观察账本、客户端媒体重解码、绕过授权的关键帧抓取，或把审阅结论写回非 owner 存储。

## Decisions

1. Owner-fit：split-owner。Anatomia 拥有观察、证据与参考包版本；DSH 插件拥有 Pane 呈现与动作入口。
2. 时间坐标显示使用 owner 合同坐标系；坐标换算只在 adapter 层，不在组件内各自换算。
3. 关键帧/来源访问只用 owner 授权范围与 rendition；无授权范围时显示原因，不做客户端截帧。
4. 范围分析走 server-authored descriptor + 预览 + 确认；长任务经既有订阅/游标恢复语义观察。
5. 参考包消费固定版本：stale 版本标明并要求显式刷新比较；不自动采用最新包。
6. 审阅动作与结论保存分离：结论落 owner 审阅合同，不进插件存储。

## UI Contract

- Surface classification: adopted（ui-surface；画布节点内嵌证据缩略用 ui-visual-kit）
- Surface kind: workspace（分析主 Pane）+ inspector（时间轴/关键帧详情）
- First / second / third visual priority: 当前观察与时间轴 / 主要分析动作 / 证据来源与版本
- Existing components reused: ui-visual-kit token、既有媒体 renderer（rich-media）、官方 primitives
- Cards that earn existence: 证据卡（引用固定版本参考包）；无统计卡片墙
- Primary scroll owner: 时间轴/证据列表；详情独立滚动

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 观察列表 | 保留最后内容 | 解释无观察 | owner 原因 | 列表+freshness | 标明范围外 | 权限原因 |
| 关键帧/来源 | 范围加载中 | 无授权范围说明 | 读取错误 | 授权 rendition | stale 标注 | 无授权禁用并解释 |
| 范围分析 | 预检中 | 无可选范围 | owner 错误 | 回执摘要 | 游标 gap 重读 | 权限原因 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 单栏+返回；时间轴折叠 | 导航/内容切换 | 时间轴+详情并列 |

### Accessibility

- Keyboard path: 列表→时间轴→分析→审阅全程键盘；Escape 回发起行
- Focus owner/return: 时间轴行；完成回发起行
- Visible labels and accessible names: 坐标/状态/版本文本化
- Reduced motion and coarse pointer: 时间轴动画禁用可关；触控 ≥44px

## Validation

focused adapter/组件测试先行；稳定后全门禁。真实分析闭环在 Anatomia staging 验证并标注 fixture/real。证据写 `temp/integration-test-runs/<run-id>/`，脱敏媒体路径与原始 payload。

## 页面、控件与验收补全

[完整页面设计](../../../docs/design/dsh-anatomia-analysis-studio.md)是本change的UI细化，和本design共同约束实施。所有页面均为required；保留二维观察、推断、三维空间证据和生产采用的真相区别。没有完整时序coverage或空间校准时显示缺口，不从二维界面推导精确三维事实。范围分析、审阅和包冻结分别执行owner动作。

| 工作页 | 控件与动作 | 关键行为 |
|---|---|---|
| 来源与分析 | 授权来源、媒体概览、分析profile、范围、费用与开始/恢复/取消 | 来源可见不等于允许分析、播放或导出 |
| 播放器与时间线 | 播放器、镜头/场景条目、字幕、关键帧、区间选择与时间码跳转 | 所有视图绑定同一source/version和owner时间基准 |
| 观察与证据 | observed/inferred、coverage、证据、冲突与revision比较/审阅 | 模型观察不自动成为accepted fact，缺口不能显示为完整覆盖 |
| 参考提取 | 片段/关键帧/角色/场景参考、固定版本包与目标交接 | 包固定revision与范围，handoff与生产采用分离 |

完整路径：导入授权视频→分析→镜头/证据定位→审阅观察→提取固定版本参考包→交接。重点恢复：来源失权、时间基准错配、partial coverage、冲突审阅、stale revision包、取消未知。第4组质量/真实验收依赖新增5.1–5.4，不能只交付列表和通用descriptor便关闭。

### UI Contract补全

- 内容主体是主要滚动owner，参数/证据独立滚动；不劫持Composer滚轮或IME。
- 复用CreatorActionComposer、artifact-workspace、ui-surface/visual-kit、官方Button/Input/Menu/Modal/DiffBlock与rich-media；不新建私有atoms。
- 图形/媒体选择必须有列表或菜单等价操作；新结果不抢焦点，关闭对话框回到触发控件。
- 视觉例外：无；不复制Workbench CSS，不增加第二主壳或万能领域表单系统。

## 依赖与回滚补全

本领域直接操作只依赖DSH host与`agent/anatomia`；画布回填、跨领域编排按能力单独接入，不阻塞独立页面。已确认缺口在owner创建最小配套change，而不是在插件中实现领域状态。任务5.1必须留下负责方/操作/所需交付物/受影响任务/双向链接。

默认additive演进；旧kind、方法和closed schema保持兼容。新接口schema由CLI/owner生成，未知critical版本拒绝。禁用本Pane不删除草稿、资源或运行；原operation仍通过原owner查询/对账。采用candidate不自动写源文件、晋级Canon或发布。
