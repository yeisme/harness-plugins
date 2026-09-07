# 编辑器风格按键，多 Pane 交互

## Why
用户要求类似 tmux 的 Pane 交互逻辑，明确不采用 tmux 按键；此前 Ctrl+B 前缀方案偏离要求。

## What Changes
移除前缀与等待提示，恢复直接侧栏按键，增加直接分屏和数字聚焦。保留多 Pane 循环、拖拽、分屏和布局重排。

## Capabilities
### New Capabilities
- `pane-editor-shortcuts`: 编辑器风格直接快捷键。
### Modified Capabilities
无。

## Impact
fit：宿主 ui-layout 拥有键盘与几何；通过 upstream-prs 增量交付，不修改插件搜索和会话 owner。
