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
