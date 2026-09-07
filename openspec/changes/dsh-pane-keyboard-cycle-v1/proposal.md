# macOS 快捷键与多 Pane 循环

## Why
旧快捷键在编辑区域无响应，布局只改变最外层分割方向，缺少任意数量 Pane 的循环入口。

## What Changes
- 增加 Ctrl+B 前缀；支持循环焦点、布局和持续分屏。
- macOS Option 使用物理 code，Cmd+B 在非编辑区保留侧栏入口。
- 通过现有 workspace 服务保持会话、草稿和 tab 身份。

## Capabilities
### New Capabilities
- `pane-keyboard-cycle`: 跨平台前缀、多 Pane 循环与全树布局。
### Modified Capabilities
无。

## Impact
fit：几何和键盘属于 DSH ui-layout，使用 upstream-prs 增量；插件不维护第二份布局状态。
