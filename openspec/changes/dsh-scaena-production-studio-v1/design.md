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
