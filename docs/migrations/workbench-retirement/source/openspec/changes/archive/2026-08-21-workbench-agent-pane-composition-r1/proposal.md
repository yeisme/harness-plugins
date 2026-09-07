## Why

用户评审 `/agent` 主壳打开 Pane 后的实况，指出两个结构性问题：

1. **组合失衡**：composer 的 hero 居中逻辑只判断「会话是否为空」，不考虑 pane dock 是否打开（`agent-conversation-workspace.tsx:1276`）。dock 打开时 composer 仍在变窄的对话列内垂直居中，且空态底部保留 flex-1 间隔块（:1489），形成「组件浮空、下方大空白」的脱离感。`workbench-agent-shell-visual-r1` 的 hero 条款只定义了空/非空两态，没有覆盖「空会话 + dock 打开」组合。
2. **Pane 未彻底实现**：帧头「上下文」重复三层（tab label + 「AGENT 面板」 eyebrow + h2 标题 + 版本行，`agent-pane-dock.tsx:435-444`）；dock 帧头是自写 markup，未消费已建好的 `PaneChrome` composite；内容区只有一张孤卡（unavailable 时），无骨架/分区占位；`contextMap` pane 是纯 stub（永远 unavailable）却可被打开。

## What Changes

- 新增 capability `workbench-agent-pane-composition`：定义壳层组合规则、pane 帧头合同与 pane 内容状态矩阵。
- 组合规则：hero composer 仅在「会话为空 且 无 pane 打开」时启用；任何 pane 打开时 composer 回到底部 dock 并移除空态间隔块；会话统计条/分隔线在组合变化时不产生布局跳变。
- Pane 帧头去重：tab 条承载 label+版本 meta；帧头标题只出现一次 + 操作簇（菜单/关闭）；删除「AGENT 面板」 eyebrow 与重复标题；版本/新鲜度降为次级 meta；桌面帧与移动 Sheet 帧统一消费 design-system `PaneChrome`/`PaneTabs`。
- Pane 内容状态矩阵：每个 pane 定义 loading（结构化骨架，非孤卡）/empty（图标+一行说明+单 CTA）/unavailable（诚实卡 + 恢复动作 + 内容结构占位）/ready 四态；6 个 pane kind 全部落矩阵。
- contextMap 处置：无合同的 pane 在命令面板中呈现为 needs_contract 禁用项（带原因），不可打开 stub pane；有合同后再晋级。
- 诚实性红线不变：unavailable/needs_contract 状态如实呈现，只补结构不伪造内容。

## Capabilities

### New Capabilities

- `workbench-agent-pane-composition`: 定义 `/agent` 壳层在 pane dock 开合下的组合规则（composer hero/dock 判定、间隔块消除、布局稳定）、pane 帧头去重与 PaneChrome 消费合同、pane 内容四态矩阵与无合同 pane 的 fail-closed 呈现。

### Modified Capabilities

无。pane 布局有界性（1-3 可见/上限 4/split≤2）与 registry fail-closed 校验沿用 `workbench-agent-session-workspace` 既有合同，不修改。

## Impact

- 预计影响 `apps/web/src/workbench/agent/agent-conversation-workspace.tsx`（组合判定）、`panes/agent-pane-dock.tsx`（帧头去重、PaneChrome 接入）、`panes/agent-pane-host.tsx`（内容状态矩阵）、`context-canvas.tsx` 等 pane 内容组件、`pane-command-palette.tsx`（contextMap needs_contract 呈现）、相关测试与 e2e。
- 不改 pane registry/catalog 合同、不改 Context Pack/mutation 链、不改控件 API。
- 验证：`openspec validate --all --strict`、`bun run typecheck`、全量 vitest、agent-first/agent-pi-workspace e2e、`compose:i18n && check:i18n`、三视口截图证据（含 dock 打开组合态）。
