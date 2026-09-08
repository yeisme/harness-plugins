## Context

依据 2026-09-07 创作台程序。Auctra Service API 与 text working copy（正文授权读取、候选、版本链）是消费真源。

## Goals / Non-Goals

目标：在 DSH Pane 内完成「打开文本项目 → 授权读取正文 → 编辑/Agent 候选 → 比较采纳 → 保存/冲突恢复」的一条真实路径。

不做第二正文存储、自动保存、覆盖新版本，或把插件草稿当 owner candidate。

## Decisions

1. Owner-fit：split-owner。Auctra 拥有正文、版本链、Canon 与保存回执；DSH 插件拥有 Pane 呈现与编辑入口。
2. 正文读取显式授权：内容与控制面摘要分离；未授权类型不渲染正文区，显示原因。
3. Agent 修改正文一律经 owner candidate（程序 §4）：变更摘要、可撤销，不修改已采纳版本。
4. 版本冲突保留编辑输入与候选，提供重新读取/比较/另存草案；不覆盖新版本。
5. 保存=owner receipt 确认；HTTP 成功或浏览器 pending 不改保存态。Checkpoint/Review/Canon/交付是独立动作。
6. 各文本类型（小说/剧本等）结构映射在 adapter normalizer，不建万能表单。

## UI Contract

- Surface classification: adopted（ui-surface；画布节点内嵌文本摘录用 ui-visual-kit）
- Surface kind: workspace（文本主 Pane）+ inspector（结构/版本详情）
- First / second / third visual priority: 当前正文与版本 / 主要编辑动作 / 结构与来源
- Existing components reused: ui-visual-kit token、既有候选比较、diff 组件、官方 primitives
- Cards that earn existence: 候选/diff 卡；无统计卡片墙
- Primary scroll owner: 正文；结构与版本面板独立滚动

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 文本项目/结构 | 保留最后内容 | 解释空项目 | owner 原因 | 结构+freshness | 标明缺失 | 权限原因 |
| 正文读取 | 加载授权范围 | 无授权说明 | 读取错误 | 授权正文 | stale 标注 | 未授权禁用并解释 |
| 候选/保存 | 预检中 | 无候选说明 | owner 错误 | receipt 摘要 | 版本冲突保留输入 | 未确认禁用 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 单栏+返回 | 导航/内容切换 | 正文+结构并列 |

### Accessibility

- Keyboard path: 结构→正文→候选→保存全程键盘；Escape 回发起位置
- Focus owner/return: 正文光标位置或结构行
- Visible labels and accessible names: 版本/冲突/保存态文本化
- Reduced motion and coarse pointer: 动画可关；触控 ≥44px

## Validation

focused adapter/组件测试先行；稳定后全门禁。真实写作闭环在 Auctra staging 验证并标注 fixture/real。证据写 `temp/integration-test-runs/<run-id>/`，不记录正文内容与原始 prompt。

## 页面、控件与验收补全

[完整页面设计](../../../docs/design/dsh-auctra-writing-studio.md)是本change的UI细化，和本design共同约束实施。所有页面均为required；复用既有artifact-workspace编辑/Diff/候选能力，不另造autosave服务。正文和结构联合变更遵循owner atomic change-set。UTF-16 patch按owner合同处理emoji/IME，不按视觉字数猜offset。插件草稿权限不授权Agent直接覆盖领域正文。

| 工作页 | 控件与动作 | 关键行为 |
|---|---|---|
| 结构与正文 | 小说章节、剧本场景、通用文本单元、正文编辑与结构动作 | Working Copy通过owner读写，浏览器仅有active edit buffer |
| Agent与候选 | 选区引用、候选、文本Diff、比较与采用 | Agent变更进入candidate，base revision/digest必须核对 |
| 版本与审阅 | Working Copy、Checkpoint、Review、Canon和历史 | 各动作独立；采用候选不自动创建检查点或晋级 |
| 导出与交接 | 固定文本版本、格式、用途与导出预览 | 按选定版本导出，源文件写回是另一动作 |

完整路径：打开小说/剧本/文本→编辑并确认保存→选区交给Agent→比较并采用candidate→Checkpoint/Review→固定版本导出。重点恢复：IME/emoji、并发编辑、candidate base过期、autosave失败、atomic change-set失败、采用不晋级Canon。第4组质量/真实验收依赖新增5.1–5.4，不能只交付列表和通用descriptor便关闭。

### UI Contract补全

- 内容主体是主要滚动owner，参数/证据独立滚动；不劫持Composer滚轮或IME。
- 复用CreatorActionComposer、artifact-workspace、ui-surface/visual-kit、官方Button/Input/Menu/Modal/DiffBlock与rich-media；不新建私有atoms。
- 图形/媒体选择必须有列表或菜单等价操作；新结果不抢焦点，关闭对话框回到触发控件。
- 视觉例外：无；不复制Workbench CSS，不增加第二主壳或万能领域表单系统。

## 依赖与回滚补全

本领域直接操作只依赖DSH host与`cli/auctra`；画布回填、跨领域编排按能力单独接入，不阻塞独立页面。已确认缺口在owner创建最小配套change，而不是在插件中实现领域状态。任务5.1必须留下负责方/操作/所需交付物/受影响任务/双向链接。

默认additive演进；旧kind、方法和closed schema保持兼容。新接口schema由CLI/owner生成，未知critical版本拒绝。禁用本Pane不删除草稿、资源或运行；原operation仍通过原owner查询/对账。采用candidate不自动写源文件、晋级Canon或发布。
