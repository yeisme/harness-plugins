# dsh-conversation-reference-drafts Specification

## Purpose
TBD - created by archiving change dsh-web-composer-references-theme-v1. Update Purpose after archive.
## Requirements
### Requirement: Conversation-scoped structured reference drafts
系统 SHALL 将引用正文节点和草稿状态按工作区与对话隔离，默认插入明确主对话保存的光标位置，缺少有效光标时追加末尾。

#### Scenario: Cross-pane insert while generating
- **WHEN** 主对话正在生成且用户从其他面板引用选区
- **THEN** 引用加入该对话下一条草稿，保持来源焦点并提示目标，不中断或自动发送

#### Scenario: Target no longer available
- **WHEN** 捕获的目标对话关闭或不再可访问
- **THEN** 拒绝插入并提供目标选择，不将内容转入其他对话

### Requirement: Typed discovery and preview
系统 SHALL 通过授权 owner 提供文件、目录、选区、消息、终端、图片/区域、Agent、技能和工具的分组发现、正文标签及来源预览；普通 @ 文本 SHALL NOT 自动变为能力调用。

#### Scenario: Mention a capability
- **WHEN** 用户选择 Agent、技能或工具
- **THEN** 草稿分别记录协作对象、指引或可用能力意图，发送仍沿用现有权限和执行机制

#### Scenario: Directory and region bounds
- **WHEN** 引用目录或图片区域
- **THEN** 仅包含 owner 授权的有界清单或明确区域，不隐式读取完整目录

### Requirement: Immutable submissions and acknowledgement
系统 SHALL 冻结发送快照并由 owner 校验权限、版本和范围，仅在确认后消费属于本次提交的草稿节点。

#### Scenario: User edits during send
- **WHEN** 提交等待确认期间用户追加文字或引用
- **THEN** 确认不清除新增内容，历史只记录已提交快照

#### Scenario: Failure or unknown outcome
- **WHEN** 发送失败或结果未知
- **THEN** 保留草稿和引用，不静默重试或降级拼接文本

### Requirement: Explicit stale resolution and V1 compatibility
系统 SHALL 保留既有 V1 API，并对新能力进行探测；stale 引用 SHALL 要求刷新、移除或明确采用 owner 证明仍可读的旧快照。

#### Scenario: Missing host seam
- **WHEN** 宿主缺少结构化编辑或发送接口
- **THEN** 新能力显示明确不可用原因，普通文本和 V1 保持原行为，整体实际 Web 验收仍未完成

