## Why

`docs/design/agent-visual-language.md` 已定义 `/agent` 主壳的目标视觉语言（扁平、发丝线分隔、卡片禁令、24px 行节奏、幽灵按钮、色点徽章），但当前实现存在系统性偏差：StateBanner 仍是 border+bg 横幅、徽章是底色 pill、session rail 选中行是圆角色块、composer 容器 16px 圆角贴底、pane host 内部仍有多处 `rounded-xl border bg` 方块卡、4 个文件仍直接 import lucide。`workbench-ui-controls-r1` 已完成控件层统一（视觉等价收敛），本 change 在其基础上做**看得见的视觉重塑**，让 /agent 主壳落地既定视觉语言。

## What Changes

- 时间线去方块化：StateBanner 改细线+色文字（禁大面积状态底色）；run/proposal 状态徽章与 basis refs chips 改色点+文字或发丝底 pill；thinking/tool 行压实到 24px 行节奏。
- session rail：选中行从圆角色块改为 accent 左条（border-l-2）+浅底；行高压到行节奏；未读徽章去实心 pill；过滤器（最近/已置顶/未读/已归档）迁到 design-system `SegmentedControl`。
- composer：容器从 16px 圆角贴底改为 ≤12px 圆角+细边+轻阴影的浮起形态；needs_contract 工具 chips 与上下文 chips 去底色块化（色点+文字/发丝 pill）；内部 textarea/按钮迁到 `TextArea`/`Button`/`IconButton` primitive。
- header 操作按钮：迁到 `Button`/`IconButton` primitive，radius 收敛到 6–8px，保持幽灵形态。
- pane host（`agent-pane-host.tsx`）内部方块卡（RunPane 摘要卡、事件流行盒、unknown_accept 卡、expectedVersions 行盒）改发丝线区段+语义左色条。
- 图标收敛：`agent-pane-icon.tsx`、`agent-pane-host.tsx`、`pane-command-palette.tsx`、`agent-pane-dock.tsx` 的 lucide 直接 import 迁入 icons registry（私有 pane 映射并入 registry 语义名）。
- 范围限定在 `/agent` 活路径（conversation workspace + agent panes）；`agent-ops-*` 遗留空间壳不在本 change（非当前活路径）。
- 全程保持 aria/data 选择器与文案 key 不变（纯视觉层改动）；token 只消费 `--wb-*`/`--color-*` 既有定义，不新增 token 家族。

## Capabilities

### New Capabilities

- `workbench-agent-shell-visual-language`: 定义 /agent 主壳视觉语言的落地合同：卡片禁令、发丝线分隔、行节奏与字级、幽灵按钮、色点徽章、composer 浮起形态、图标 registry 收敛，以及截图基线与黑名单验收。

### Modified Capabilities

无。本 change 只改 `apps/web` 视觉层，不改变 `workbench-ui-foundation`、`workbench-ui-controls` 或任何运行时/合同 capability 的 Requirement。

## Impact

- 预计影响 `apps/web/src/workbench/agent/conversation/{conversation-blocks,session-rail,composer,conversation-header}.tsx`、`apps/web/src/workbench/agent/panes/{agent-pane-host,agent-pane-icon,agent-pane-dock,pane-command-palette}.tsx`、`apps/web/src/design-system/icons/{icon-name,registry}.ts`、相关测试与 e2e 截图基线。
- 不改 aria/data 选择器、不改 i18n key、不改任何数据流/状态机/合同；无新增依赖。
- 验证：`bun run typecheck`、`bun run --cwd apps/web vitest run`、design-system 套件、foundation-contract、e2e（agent-first 等）、`bun run compose:i18n && bun run check:i18n`；视觉证据按截图对比 + UI Spec §8 黑名单过审。
