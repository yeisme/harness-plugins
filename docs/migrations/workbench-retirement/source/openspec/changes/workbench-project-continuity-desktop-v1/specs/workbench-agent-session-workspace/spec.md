## MODIFIED Requirements

### Requirement: Unified Agent-first Pane workspace

Workbench SHALL 提供一个默认 conversation-first Agent 工作区，包含一个 compact product rail、一个 session directory、一个 conversation timeline、一个 session-scoped composer 与一个有界 Pane dock。显式启用 `projectContinuityDesktopV1` 且已有合法 project scope 时，主区 SHALL 采用项目与成果优先姿态，复用同一 directory/会话/transport/状态 owner；没有合法 project scope 时先显示项目选择，不猜测目录。系统 SHALL NOT 建立第二套 chat、spatial、plugin 或 tool execution control plane。

#### Scenario: Agent route renders the unified shell
- **WHEN** 当前服务端授权 cohort 启用 `pi-workspace-v1`
- **THEN** `/agent` 使用同一 Agent client 渲染一个 product rail、session directory、timeline、composer 和注册 Pane dock
- **AND** Operations Orbit、Context Canvas、Inspector、Activity、Review、Evidence 只能作为注册 Pane、明确 advanced route 或获批 owner deep link

#### Scenario: Capability is disabled
- **WHEN** `pi-workspace-v1` 缺失或未启用
- **THEN** 使用原 conversation workspace fallback
- **AND** capability 关闭不改变或删除 Task、event、receipt、session projection 或 presentation records；新项目姿态不得绕过此基础门

#### Scenario: Authorized project posture
- **WHEN** 基础 unified shell、`chatCanvasV2` 与 `projectContinuityDesktopV1` 均有效且项目已授权
- **THEN** 主区恢复最近合法成果或项目续接 document，项目会话分组复用原 session directory
- **AND** conversation/composer 仍持续可达，打开项目不创建或重放执行

#### Scenario: Base shell gate is missing
- **WHEN** 新项目 capability 存在但基础 unified shell 或 `chatCanvasV2` 未被服务端授权
- **THEN** 不启用新姿态，沿用基础门所决定的旧行为
- **AND** 新 capability 不能反向提升其他 shell/runtime 权限

### Requirement: Plugin Pane layout is bounded and session-scoped

桌面工作区 SHALL 默认支持一至三个可见 registered Panes，硬上限为四、split depth 最大为二。未启用新增项目视图合同时，Pane layout SHALL 保持 browser-local 和 session-scoped。`projectContinuityDesktopV1` 生效时，Layout service SHALL 可以保存经批准的 principal/project 安全 presentation metadata，作为打开项目的视图种子；session 草稿、滚动和独立 Pane 状态仍按会话管理，不持有领域内容或权限真相。

#### Scenario: User opens panes within the default limit
- **WHEN** 用户在一个桌面 session 打开不同的已授权 Context、Run、Evidence Panes
- **THEN** 三个 Pane 保持可见，不替换对话、草稿、timeline 位置、选中 Task 或事件订阅
- **AND** 未使用项目视图扩展时，切换会话恢复其独立 browser-local Pane layout

#### Scenario: User reaches the visible pane limit
- **WHEN** 打开另一个 Pane 会超过可见上限或 split depth
- **THEN** 返回 typed `limit_reached` 并提供明确 Close/Replace 选择
- **AND** 不静默关闭、替换、持久化或改变已有 Pane 与 authoritative Agent state

#### Scenario: User opens an already visible pane
- **WHEN** 请求的 closed Pane document 已在当前 session 可见
- **THEN** focus 已有 Pane，不创建副本
- **AND** 只有直接用户动作才移动键盘焦点，Agent presentation intent 本身不抢焦点

#### Scenario: User closes a pane
- **WHEN** 用户关闭可见 Pane
- **THEN** 焦点返回真实触发器或最近可见 Pane，只移除对应布局项，并按已启用的视图合同保存安全偏好
- **AND** 不改变 Task、proposal、receipt、Context Pack、Owner state、timeline event 或 draft

#### Scenario: Tablet or mobile opens a pane
- **WHEN** viewport 小于桌面 Pane dock 断点
- **THEN** 一次呈现一个 labelled Sheet/Dialog，包含 focus containment、Escape、scroll lock 和 focus restore
- **AND** 不丢弃隐藏桌面布局，不把响应式显隐或保存的 view metadata 当作领域或授权状态

#### Scenario: Saved project view is revalidated
- **WHEN** 用户重新打开已启用新能力的项目
- **THEN** Layout service 返回该 principal/project 的 safe document refs，逐项重验权限与版本，非法历史回到项目续接 document
- **AND** 不跨项目恢复草稿、复制正文或替代当前会话的 Task/event authority
