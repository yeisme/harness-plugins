## MODIFIED Requirements

### Requirement: Agent-first shell SHALL expose one stable visual hierarchy

`/agent` MUST 用同一层级呈现 desktop rail、可折叠 session directory、Agent conversation/composer anchor 和 Spatial 或 registered Pane surface。Spatial Focus MUST 使用中央 Canvas 和单一共享 Context rail；Lens renderer MUST NOT 增加竞争的固定业务侧栏。模式/布局改变时 conversation/composer MUST 保持挂载或按原合同可恢复。显式启用 `projectContinuityDesktopV1` 的合法项目 MAY 以当前成果/续接 document 为主视觉，仍遵守同一单壳和状态边界。

#### Scenario: User enters ordinary Agent mode
- **WHEN** 用户打开 `/agent`，没有可信 Spatial ingress 且未启用适用的项目成果姿态
- **THEN** conversation/composer 是主视觉
- **AND** session directory 与 Pane 入口可发现，不增加第二主壳

#### Scenario: User enters Spatial Focus
- **WHEN** 可信 project 或 Spatial ingress 选择 Spatial Focus
- **THEN** Canvas 成为主视觉，conversation/composer 在同一 layout state 中保持可达
- **AND** Detail、Inspector、Review、Evidence 使用共享 Context rail，不建立独立悬浮业务面板

#### Scenario: User changes mode with an open Pane
- **WHEN** 用户切换 Conversation、Split 或 Spatial Focus
- **THEN** active Pane document、composer draft、selected safe refs 和 focus-return trigger 保持可恢复
- **AND** 不因布局变化创建 Task、proposal、Owner subscription 或第二 event stream

#### Scenario: User opens a project-centered workspace
- **WHEN** 合法项目启用 `projectContinuityDesktopV1`，且没有更具体的用户显式 document/Spatial 入口
- **THEN** 最近合法成果或项目续接 document 是主视觉，Chat 保持锚点，Context 按需打开
- **AND** 项目目录复用既有 drawer/session directory，explicit deep link 优先于最近视图，不重建 composer 或执行状态
