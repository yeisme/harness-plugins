# pane-keyboard-cycle Specification

## Purpose
TBD - created by archiving change dsh-pane-keyboard-cycle-v1. Update Purpose after archive.
## Requirements
### Requirement: Cross-platform prefix
工作台 SHALL 支持 Ctrl+B 松开后的前缀动作，并在两秒超时、Escape 和窗口失焦时取消。

#### Scenario: Composer and macOS
- **WHEN** 用户在 composer 按 Ctrl+B 后按 o，或 macOS 用物理 Digit2 的 Meta+Alt 事件
- **THEN** 工作台分别循环焦点或排列所有停靠组，不修改草稿

### Requirement: Arbitrary pane cycling
工作台 SHALL 在所有现存 Pane 组之间正反循环，不设置双 Pane 上限。

#### Scenario: Wrap and preserve identity
- **WHEN** 用户在至少四个 Pane 下反复按前缀 o/Shift+O 或空格
- **THEN** 焦点绕回起点，布局循环，组内 tab、会话引用与浮动几何保持

### Requirement: Continued splitting
工作台 SHALL 使用原生选择器为当前停靠组继续分屏。

#### Scenario: Split another group
- **WHEN** 用户在已有多组时按前缀 % 或双引号并选择其他会话或工具
- **THEN** 现有 workspace 服务完成分屏；已存在内容只移动、不克隆会话
