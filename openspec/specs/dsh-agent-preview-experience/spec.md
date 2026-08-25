# dsh-agent-preview-experience Specification

## Purpose
TBD - created by archiving change dsh-agent-composition-preview-v1. Update Purpose after archive.
## Requirements
### Requirement: Picker SHALL offer a read-only composition preview
`packages/client/ui-agent-preset` SHALL 在 preset 行/seat 提供只读 Preview 动作，展示 tools（name + 来源）、prompt sections（id，无正文）、permission 档、三层 health、drift、`capability_digest` 前 12 位。面板 MUST NOT 修改 preset、组合文件或默认选择。

#### Scenario: User previews a preset before creating a session
- **WHEN** 用户在新建会话前打开某 preset 的 Preview
- **THEN** 面板 SHALL 显示该 preset 的组合事实与 health/drift
- **AND** SHALL NOT 启动 agent、session、turn 或修改任何文件

### Requirement: Maturity slot SHALL render only Ordo-provided values
maturity（四维 agent 成熟度）槽位 SHALL 只在 Ordo 投影注入时渲染注入值。DSH MUST NOT 本地计算 risk、maturity 或 qualified 状态；无注入数据时槽位 SHALL 隐藏而非显示未认证状态。

#### Scenario: Ordo projection is not connected
- **WHEN** host 未注入 Ordo 投影
- **THEN** Preview 面板 SHALL 隐藏 maturity/risk 槽位
- **AND** SHALL NOT 显示任何 qualified/未 qualified 徽标

### Requirement: Preview data SHALL be refetched on demand and invalidated honestly
面板每次打开 SHALL 重新取投影；数据 SHALL 展示 `generated_at` 与 freshness。preset 文件或 context 变化后，旧投影 MUST NOT 被乐观合入。UI MUST NOT 缓存 digest 之外的安全假设。

#### Scenario: Preset files change while the panel is closed
- **WHEN** 用户编辑了组合文件后重新打开 Preview
- **THEN** 面板 SHALL 显示新投影（roster 重读）
- **AND** 不依赖旧 digest 的派生状态

### Requirement: Preview SHALL be accessible
Preview 面板 SHALL 支持完整键盘导航、可预测焦点、accessible labels/status、screen reader announcement 与 reduced motion；关闭后 focus SHALL 返回触发点。

#### Scenario: Keyboard-only user opens and closes the preview
- **WHEN** 用户只用键盘打开并关闭 Preview
- **THEN** 面板内容 SHALL 全部可达且被正确宣布
- **AND** 关闭后 focus SHALL 返回原 preset 行

### Requirement: Model-facing preview SHALL be logged (retain-next)
若未来实现模型可见的 `agent_preview` 工具，其输入 SHALL 有对应 session event（model-visible ⟺ logged），展示 SHALL 走 ToolView `tool.call.toolview` 且只显示安全摘要与 digest。本切片不实现该工具。

#### Scenario: A future model tool returns a preview
- **WHEN** `agent_preview` 工具被调用（后续切片）
- **THEN** ToolView SHALL 渲染安全摘要、digest 与 refs
- **AND** 该调用的模型可见输入 SHALL 可从 session log 重建

