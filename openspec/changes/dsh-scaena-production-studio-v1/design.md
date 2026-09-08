## Context

依据 2026-09-07 创作台程序。Scaena Production API（镜头/资产/声音动作、编排、导出）与 review-package application/transport 是消费真源。

## Goals / Non-Goals

目标：在 DSH Pane 内完成「打开制作项目 → 镜头/资产动作预览确认 → 候选比较采纳 → 编排预览 → 导出交付」的一条真实路径。

不做第二制作状态机、渲染调度器、镜头账本，或把 UI toast 当导出成功。

## Decisions

1. Owner-fit：split-owner。Scaena 拥有制作执行、编排与交付；DSH 插件拥有 Pane 呈现与动作入口。
2. 候选操作带 expected version/digest；owner 拒绝 stale 时刷新并保留编辑输入，不覆盖新版本。
3. 编排预览走 owner 计划面：固定范围、明确将执行项与范围外输入阻塞清单；跨领域执行经 creative-workflow 的 Ordo 通道。
4. 导出以 owner 回执与产物 ref 为准；部分成功保留已完成成果与回执，只修复明确允许的部分。
5. review-package 消费固定版本；传输验证沿用其 transport 合同。
6. 长任务观察复用订阅/游标恢复；关闭 Pane 不取消运行。

## UI Contract

- Surface classification: adopted（ui-surface；画布节点内嵌镜头缩略用 ui-visual-kit）
- Surface kind: workspace（制作主 Pane）+ inspector（镜头/资产详情与参数）
- First / second / third visual priority: 当前镜头/资产与状态 / 主要制作动作 / 版本与交付证据
- Existing components reused: ui-visual-kit token、既有候选比较、媒体 renderer、官方 primitives
- Cards that earn existence: 候选/交付证据卡；无进度卡片墙
- Primary scroll owner: 镜头/资产列表；详情独立滚动

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 制作项目/镜头 | 保留最后内容 | 解释空项目 | owner 原因 | 列表+freshness | 标明缺失范围 | 权限原因 |
| 动作/编排预览 | 预检中 | 无可用动作 | owner 错误 | 计划摘要 | expected version 过期 | 权限原因 |
| 导出/交付 | 提交中 | 无可导出说明 | owner 错误 | 回执+产物 ref | 部分成功保留 | 未确认禁用 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 单栏+返回 | 导航/内容切换 | 列表+详情并列 |

### Accessibility

- Keyboard path: 列表→详情→动作→确认全程键盘；Escape 回发起行
- Focus owner/return: 列表行；完成回发起行
- Visible labels and accessible names: 版本/digest/状态文本化
- Reduced motion and coarse pointer: 动画可关；触控 ≥44px

## Validation

focused adapter/组件测试先行；稳定后全门禁。真实制作/导出闭环在 Scaena staging 验证并标注 fixture/real。证据写 `temp/integration-test-runs/<run-id>/`，脱敏产物路径与 payload。

## 页面、控件与验收补全

[完整页面设计](../../../docs/design/dsh-scaena-production-studio.md)是本change的UI细化，和本design共同约束实施。所有页面均为required；范围包括镜头级制作、顺序/时长/声音编排和支持的合成/导出，不增加通用多轨剪辑器。领域内部制作workflow直接使用Scaena，只有跨领域编排由Ordo控制。本Pane是Scaena公开合同的DSH呈现，不创建另一套Production Canvas或状态机。

| 工作页 | 控件与动作 | 关键行为 |
|---|---|---|
| 项目与镜头 | 项目/剧集/场景/镜头树、镜头描述、批准的结构编辑 | 结构写入由Scaena处理；画布只绑定资源 |
| 资产与制作 | 角色/场景/图像/声音绑定、制作参数、运行与候选比较替换 | 采用校验expected version/digest，旧成果保留 |
| 镜头级编排 | 镜头顺序、时长、声音关联、素材缺口、预览与保存 | 时长修改显示声音/字幕影响，不静默伸缩原音频 |
| 审阅与交付 | 生产审阅、证据/权利/连续性缺口、合成/制作包导出 | 运行成功、production acceptance和delivered独立 |

完整路径：创建或打开镜头→绑定图像/声音→制作→比较替换候选→保存镜头编排→审阅→合成或导出。重点恢复：候选digest冲突、绑定失权、partial制作、声音时长不匹配、导出失败、unknown采用。第4组质量/真实验收依赖新增5.1–5.4，不能只交付列表和通用descriptor便关闭。

### UI Contract补全

- 内容主体是主要滚动owner，参数/证据独立滚动；不劫持Composer滚轮或IME。
- 复用CreatorActionComposer、artifact-workspace、ui-surface/visual-kit、官方Button/Input/Menu/Modal/DiffBlock与rich-media；不新建私有atoms。
- 图形/媒体选择必须有列表或菜单等价操作；新结果不抢焦点，关闭对话框回到触发控件。
- 视觉例外：无；不复制Workbench CSS，不增加第二主壳或万能领域表单系统。

## 依赖与回滚补全

本领域直接操作只依赖DSH host与`agent/scaena`；画布回填、跨领域编排按能力单独接入，不阻塞独立页面。已确认缺口在owner创建最小配套change，而不是在插件中实现领域状态。任务5.1必须留下负责方/操作/所需交付物/受影响任务/双向链接。

默认additive演进；旧kind、方法和closed schema保持兼容。新接口schema由CLI/owner生成，未知critical版本拒绝。禁用本Pane不删除草稿、资源或运行；原operation仍通过原owner查询/对账。采用candidate不自动写源文件、晋级Canon或发布。
