# dsh-command-experience-session-keymap-v1

## Why

命令体验线（`2026-08-25-dsh-codex-command-experience-v1` 归档 + 2026-08-26 未提交 TUI 适配器）已交付统一 `/` 目录、`/agent` thread picker、`/resume` session picker 与 `:` legacy alias，但三个缺口让无鼠标交互不完整：

1. **`/session` 不存在**：session 类命令只有 resume/new/fork/rename/compact。host 侧 `archive-session`/`delete-session` 请求工厂与 `prepareDestructiveSubmit` danger 门已完整实现，却没有 client 命令入口；归档账本 P1 的 `/archive` `/delete` 从未进目录。
2. **键盘层是半成品**：web 侧 `CommandKeyboardShortcuts` 类型（Ctrl+K 默认）已定义但 components 零消费；reducer 状态机没有候选列表导航 action；TUI 适配器零键盘处理。
3. **治理缺口**：主 specs 没有任何 command-experience capability——这条线从未 sync 成正式 spec。

用户需求（2026-08-27）：继续设计 slash 命令（如 `/agent` `/session`），方便无鼠标交互，支持更多快捷键。

## What Changes

- **`/session` 管理中枢**：无参开 sessionId selector，选中后进入 adapter 自有的动作菜单（Switch / Rename / Archive / Restore，已归档目标把 Archive 换成 Restore）；子命令直达 `/session archive`、`/session rename <title>`，未知 token 宽容回退 switch。与 `/resume` 分层：`/resume` 是快速切换，`/session` 是浏览→动作→receipt-gated 变更。
- **`/archive` `/delete` 独立目录条目**（coverage `staged`，danger confirm/destructive）：无 owner preview 或 receipt 能力时 disabled+reason，可见不留死按钮。
- **新 owner action `restore-session`**（danger safe，receipt-gated）：host union/工厂/probe 各加一处；不接 `SessionManagerHostV1`（见 design.md）。
- **共享 keymap 层**：core 新 `keymap.ts`（纯逻辑键事件 → reducer action / adapter 意图，按状态分派）；reducer 增 `cursorKey`/`cursorMoved` 与 `MOVE_SELECTION`；`UPDATE_QUERY` 支持携带 candidateKeys 做陈旧光标清除（不跳邻居）；export `findSafeUniquePrefix` 供 Tab 补全。
- **Web 接线**：四处 keydown（菜单/selector/确认/回执）改走 keymap；消费 `keyboardShortcuts` 配置；`useCommandPaletteToggle`（Ctrl/Cmd+K）；`SessionActionMenu` 动作菜单组件；aria-live 播报。
- **TUI 接线**：新 `keys.ts`（终端键序列 → 逻辑键，纯函数，无 stdin/rawMode）；controller 增 `handleKeyEvent` 作为官方 seam 未来接入点；`splitSessionHubInput` 解析 `/session` 子命令。

## Boundary Decision

`fit`：命令语义与键位属于 command-experience 插件层；所有 mutation 仍走唯一既定 `OwnerActionAdapter` 通道（correlation id + `subscribeToReceipts` + danger 门）。快捷键声明不进命令元数据（`sanitize.ts` GLOBAL_SHORTCUT_PATTERN 边界），只进 adapter 配置。

## Capabilities

### New Capabilities
- `dsh-command-experience`: 统一 `/` 命令目录、session 命令家族（hub + staged archive/delete）、共享键盘 keymap、fail-closed 降级的完整合同。

### Modified Capabilities
无（主 specs 无既有条目，全部 ADDED）。

## Impact

- 改动：`packages/client/command-experience-core/`（catalog/session-commands/keymap/reducer/types/discovery/index）、`packages/host/dsh-command-experience/`（types/owner-action-adapter/capability-probe）、`packages/client/ui-command-experience-web/`（components/hooks/session-hub/types/index/vitest.config）、`packages/client/ui-command-experience-tui/`（keys/assist/client/index）、`packages/bundle/dsh-command-experience/`（client 入口占位符替换 + README + 测试）。
- 新增文件：core `src/keymap.ts` + `tests/keymap.test.ts`；web `src/session-hub.tsx` + `tests/session-hub.spec.tsx`；tui `src/keys.ts` + `tests/keys.spec.ts`。
- 合同变更：bundle client 入口的 `commandExperienceWebAdapter`（字符串占位）更名为 `commandExperienceWebAdapterRef`（诚实 handoff 描述符）——原值是无意义 stub，rc.1 阶段在本 change 门内更名。
- 不改官方包、不 fork core、不碰 `dsh-session-manager`、`dsh-ordo-command-interaction-v1`、pane-workspace v3 的 keyboard 任务。
- 完成门：`pnpm run typecheck && pnpm run test && pnpm run build && pnpm run check:bundles` + `openspec validate dsh-command-experience-session-keymap-v1 --strict --no-interactive`。
