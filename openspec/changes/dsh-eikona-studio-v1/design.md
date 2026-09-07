## Context

依据 2026-09-07 创作台程序与 Workbench 退役决定。Eikona 公共接口见其 consumer contract matrix（generation、workflow、batch、asset/lineage/handoff）；本仓只做 DSH 侧消费。原文快照不构成实施权威。

## Goals / Non-Goals

目标：在 DSH Pane 内完成「选资产/参数 → 动作预览 → 确认生成 → 候选比较 → 采纳回填」的一条真实路径。

不做第二 provider runtime、图像缓存权威、自动采纳最新候选、绕过 owner 费用/权限复核，或把列表顺序当最新采用。

## Decisions

1. Owner-fit：split-owner。Eikona 拥有生成执行、资产与版本；DSH 插件拥有 Pane 呈现、动作入口与候选比较 UI。
2. 只经 server-authored 动作 descriptor 发现生成/编辑/批量动作；输入类型、权限、费用状态、expected revision 来自 owner，前端不自授 capability。
3. 遮罩/局部编辑的具体模型支持在合同核对任务中逐项标注支持/缺失/未验证；缺失时不渲染入口，不造客户端图像处理 fallback。
4. 候选比较、采纳、写回复用既有引用工作区 candidate/action 通道；资产引用按 ArtifactRefV1 固定 owner/ref/version 回填画布节点。
5. 取消先请求，收到 owner 确认才显示 cancelled；unknown 只对账原 operation。
6. 项目列表带 project scope、分页游标与 freshness；不从目录名猜项目。

## UI Contract

- Surface classification: adopted（ui-surface 完整面；画布节点内嵌预览用 ui-visual-kit）
- Surface kind: workspace（专业主 Pane）+ inspector（详情/参数）
- First / second / third visual priority: 当前资产或候选 / 主要生成动作 / 来源与技术详情
- Existing components reused: ui-visual-kit token、官方 primitives Menu/Modal、既有候选比较组件
- Cards that earn existence: 候选对比卡（同 base revision 多候选）；无卡片仪表盘
- Primary scroll owner: 资产/候选列表；参数面板独立滚动

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 项目/资产列表 | 保留最后安全内容 | 解释空目录 | owner 原因 | 列表+freshness | 标明缺失范围 | 权限原因 |
| 生成动作 | 预检中 | 无可用动作说明 | owner 错误 | 回执摘要 | expected revision 过期 | 权限/费用未知原因 |
| 候选比较 | 骨架 | 无候选说明 | 读取错误 | 候选+版本 | stale 标注 | 未采纳不可写回 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 单栏+返回；参数折叠 | 导航/内容切换 | 列表+详情并列 |

### Accessibility

- Keyboard path: 列表→详情→动作→确认全程键盘；Escape 回发起行
- Focus owner/return: 列表行；动作完成后回候选或发起行
- Visible labels and accessible names: 动作/状态/费用文本化，不只靠颜色
- Reduced motion and coarse pointer: 禁非必要动画；触控目标 ≥44px

## Validation

focused adapter/组件测试先行；稳定后全门禁。真实生成闭环在 Eikona staging 验证并标注 fixture/real。证据写 `temp/integration-test-runs/<run-id>/`，脱敏凭据与 provider payload。
