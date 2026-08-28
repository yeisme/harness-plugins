# Coverage Ledger: dsh-command-experience-session-keymap-v1

Baseline: `openspec/changes/archive/2026-08-25-dsh-codex-command-experience-v1/coverage-ledger.md` (P0 26 条)。本 change 增量如下；`auditCoverageLedger` 约束每行必须有 owner/seam/verify command。

## P0 增量（本 change）

| command | coverage | owner | seam | verify |
|---|---|---|---|---|
| `/session` (sessions) | adapted | dsh | OwnerActionAdapter `open-session`/`archive-session`/`restore-session` + local planner | `pnpm --filter @yeisme/dsh-client-ui-command-experience-core test` |
| `/archive` | staged | dsh | `prepareDestructiveSubmit` preview+receipt 门 | `pnpm --filter @yeisme/dsh-command-experience-host test` |
| `/delete` | staged | dsh | 同上（destructive） | 同上 |

P0 合计 26 → 29 条。

## P1 剩余（未实现，沿用归档账本）

`/clear` `/side` `/btw` `/usage` `/debug-config` `/theme` `/statusline`；数字快捷选前 N 项（keymap P1）；`/agent <preset>` 迁移收尾。

## Keymap 覆盖表

| 动作 | 默认键位 | 状态 |
|---|---|---|
| toggle | ctrl+k / meta+k | web（菜单 + useCommandPaletteToggle）与 TUI（toggle 意图）已接 |
| navigateUp / navigateDown | arrowup+ctrl+p / arrowdown+ctrl+n | web 菜单/selector/动作菜单 + TUI 合成序列已接 |
| moveFirst / moveLast | home / end | 同上 |
| execute | enter | 同上（禁用行拒执行） |
| cancel | escape | 同上（恢复 draft） |
| confirmExecute | ctrl+enter / meta+enter | web 确认框已接；裸 enter 不确认 |
| closeReceipt | escape / ctrl+d / meta+d | web 回执已接 |
| tabComplete | tab | web 菜单 + TUI（assist/selected 态，唯一安全前缀） |
| bare j / k | —（config 可开） | 默认关闭：吞查询字母 |

## 不在本 change

- `SessionManagerHostV1` 真实化（placeholder not_implemented，属其自身 change）。
- 官方 TUI console seam（`@deepseek-ai/dsh-client-tui` 未发布，fail-closed probe 保持）。
- 官方 `bindComposerFocus`/popup 公开前的焦点回补（DOM fallback 保持）。
- session labels（`dsh-session-tags-grouping-v1` 域）。
