# dsh-pane-session-affinity Specification

## Purpose
TBD - created by archiving change dsh-session-tools-workspace-v2. Update Purpose after archive.
## Requirements
### Requirement: 标题管理会话标签组
Pane 标题区域 SHALL 支持会话标签组、搜索选择、固定预览和重新打开绑定会话；工具旁栏标题 MUST 显示“会话名称 · 工具”。既有 VS Code 风格快捷键 SHALL 保持。

#### Scenario: 切换已有会话
- **WHEN** 用户从标题菜单选择已打开的 B
- **THEN** 系统 SHALL 聚焦既有 B 对话，不复制会话，不改变其他固定工具旁栏的绑定

#### Scenario: 标签固定
- **WHEN** 用户固定 A 标签后再打开 C
- **THEN** A 标签 SHALL 保留；固定标签不得被解释为全局会话跟随模式

### Requirement: 明确且持久的工具旁栏绑定
固定工具 Pane SHALL 持久保存 sessionId，每会话最多一份固定工具旁栏；多会话可以拥有各自旁栏。绑定只能通过显式会话选择改变。

#### Scenario: 关闭来源标签
- **WHEN** A 的对话标签关闭但 A 会话仍存在
- **THEN** A 的工具旁栏 SHALL 继续订阅 A，提供重新打开对话入口，不跟随其他会话

#### Scenario: 会话已删除
- **WHEN** 绑定的 A 被删除或不可访问
- **THEN** Pane SHALL 保留原会话标识并显示不可用，允许选择其他会话或关闭，不自动绑定 B

#### Scenario: 重复固定及刷新
- **WHEN** 用户重复固定 A 或刷新恢复布局
- **THEN** 系统 SHALL 聚焦/恢复唯一 A 工具 Pane，保持会话身份与标签固定状态

#### Scenario: 无绑定旧布局
- **WHEN** 旧 mcp-inspector Pane 没有可恢复 sessionId
- **THEN** UI SHALL 提供会话选择提示，不按全局 current 猜测绑定，也不同时显示新旧两个壳

#### Scenario: 显式切换到已有旁栏的会话
- **WHEN** 用户把 A 工具旁栏显式切到已有工具旁栏的 B
- **THEN** 系统 SHALL 聚焦既有 B 工具旁栏并合并重复展示，A/B 对话本身不变
