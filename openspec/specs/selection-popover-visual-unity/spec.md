# selection-popover-visual-unity Specification

## Purpose
TBD - created by archiving change dsh-selection-popover-visual-unity-v1. Update Purpose after archive.
## Requirements
### Requirement: Selection popovers share one surface appearance
选区工具条、更多菜单及草稿弹框 SHALL 使用相同宿主浮层背景、边框、圆角和阴影，同时保留现有交互语义。

#### Scenario: Light and dark surface consistency
- **WHEN** 用户在浅色或深色主题打开工具条、更多菜单和草稿弹框
- **THEN** 三者背景、边框、圆角与阴影一致，焦点可见且不会自动发送

### Requirement: Visual acceptance remains explicit
技术验证 SHALL NOT 被用作用户视觉认可的替代。

#### Scenario: User has not accepted the appearance
- **WHEN** 构建与浏览器回归通过但尚无用户认可
- **THEN** 记录技术证据，视觉走查任务仍未完成
