# dsh-pane-agents-entry Specification

## Purpose
TBD - created by archiving change dsh-pane-agents-host-compat-v1. Update Purpose after archive.
## Requirements
### Requirement: Agents and pane entries SHALL be icon-only controls

Header Agents、sidebar footer Agents 与 official 窗格入口 SHALL 渲染 32×32 语义图标，MUST 提供 accessible name 与 Tooltip，MUST NOT 把可见英文/中文标签作为按钮主内容。

#### Scenario: Header Agents is an icon button

- **WHEN** Subagent Monitor 注册 `conversation.session.header.actions`
- **THEN** 入口 SHALL 是带 `Open Agents pane` accessible name 的 icon-only 按钮
- **AND** 可见子树 MUST NOT 包含纯文本 `Agents`

#### Scenario: Official pane toggle is an icon button

- **WHEN** Pane Workbench 挂载 official `sidebar.footer.action`
- **THEN** 入口 SHALL 是带 `Toggle workspace panes` accessible name 的 icon-only 按钮
- **AND** 可见子树 MUST NOT 包含纯文本 `Panes` 或 `窗格`

### Requirement: Missing pane host SHALL disable Agents instead of no-op

当 `ctx.paneWorkbench` 不可用时，Agents 入口 MUST 禁用并给出原因，点击 MUST NOT 调用 `openView`，MUST NOT 静默 return。

#### Scenario: paneWorkbench is absent

- **WHEN** Subagent Monitor 渲染 header Agents 且 `ctx.paneWorkbench` 解析失败
- **THEN** 按钮 SHALL `disabled` 且 `aria-disabled` 为 true
- **AND** `title` / `aria-label` SHALL 说明 Pane Workbench 在此 host 不可用
- **AND** 点击 MUST NOT 调用 `openView`

#### Scenario: paneWorkbench is present

- **WHEN** `paneWorkbench` 已 provide 且当前 session 存在
- **THEN** 点击 Agents SHALL `openView({ kind: 'subagent.monitor', preferredRegion: 'right' })`

### Requirement: Activity rail SHALL expose Agents when the view is registered

Right Activity Rail SHALL 在 `subagent.monitor` 已注册时显示常驻 Agents 图标，点击打开或聚焦该视图；未注册时 MUST NOT 渲染死按钮。

#### Scenario: subagent.monitor is registered

- **WHEN** Right rail 渲染且 registry 含 `subagent.monitor`
- **THEN** rail SHALL 提供 `Agents` accessible name 的图标按钮
- **AND** 点击 SHALL 打开或激活 `subagent.monitor`

#### Scenario: subagent.monitor is not registered

- **WHEN** Right rail 渲染且 registry 不含 `subagent.monitor`
- **THEN** rail MUST NOT 渲染 Agents 入口

