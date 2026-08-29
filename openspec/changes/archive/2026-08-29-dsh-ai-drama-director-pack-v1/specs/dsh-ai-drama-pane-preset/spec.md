## ADDED Requirements

### Requirement: Director preset 必须支持当前项目完整流程并保持最小工作集

默认 preset SHALL 最多打开 Context、Review 和 Run 三个 visible panes。Story、Visual 和 Audio SHALL 按需打开；用户 SHALL 能在 Pane 内继续当前项目的故事、视觉、音频、生成、审批和 owner 导出动作。完整 Episode Board、专业 Asset Wall、跨集比较、批量 Review Inbox 和 Delivery dashboard SHALL 作为可选 Workbench 专业能力。

#### Scenario: 用户从 Creator Home 进入完整做剧

- **WHEN** Creator Home 调用 Director preset
- **THEN** Context、Review 和 Run SHALL 作为最小工作集打开
- **AND** Story、Visual 和 Audio SHALL 保持按需打开

#### Scenario: 用户需要专业批量管理

- **WHEN** 用户请求完整 Episode Board、跨集比较、专业 Asset Wall 或批量 Review Inbox
- **THEN** Director Pack SHALL 提供可选 Open in Workbench
- **AND** MUST NOT 动态扩张为第二个 Workbench Show Control Room

### Requirement: Pane 注册必须可安全卸载

所有 command、view、intent、event listener、subscription 和 preset registration SHALL effect-scoped、HMR-safe 且可 dispose。

#### Scenario: 插件卸载

- **WHEN** 用户卸载 Director Pack 或切换 profile
- **THEN** 插件 SHALL 移除自身注册和 subscription
- **AND** SHALL NOT 终止 owner run 或删除 canonical state
