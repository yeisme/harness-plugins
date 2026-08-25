## ADDED Requirements

### Requirement: Director preset 必须保持会话侧最小工作集

默认 preset SHALL 最多打开 Context、Review 和 Run 三个 visible panes。Story、Visual 和 Audio SHALL 按需打开；完整 Episode Board、Asset Wall、批量 Review Inbox 和 Delivery dashboard SHALL 交给 Workbench。

#### Scenario: 用户需要查看整集候选

- **WHEN** 用户在 DSH 请求浏览大量 Episode/Shot/Asset candidates
- **THEN** Director Pack SHALL 提供 Open in Workbench
- **AND** MUST NOT 动态扩张为第二个完整 Show Control Room

### Requirement: Pane 注册必须可安全卸载

所有 command、view、intent、event listener、subscription 和 preset registration SHALL effect-scoped、HMR-safe 且可 dispose。

#### Scenario: 插件卸载

- **WHEN** 用户卸载 Director Pack 或切换 profile
- **THEN** 插件 SHALL 移除自身注册和 subscription
- **AND** SHALL NOT 终止 owner run 或删除 canonical state
