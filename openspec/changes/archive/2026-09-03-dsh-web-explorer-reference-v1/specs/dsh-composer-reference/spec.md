## ADDED Requirements

### Requirement: Revisioned composer reference state
系统 SHALL 提供 `ComposerReferenceCapabilityV1` 的 revisioned `snapshot`、`subscribe` 和 `dispatch`，管理一个活动引用与最多八个固定引用。

#### Scenario: Successful preview becomes active
- **WHEN** 文件通过严格 preview gate 并成功打开
- **THEN** controller 原子替换活动引用，不自动加入固定集合

#### Scenario: Pin reference
- **WHEN** 用户对活动引用执行 Pin
- **THEN** 引用进入固定集合；第九个 Pin 返回 typed limit rejection，不静默删除既有引用

#### Scenario: Revision mismatch
- **WHEN** dispatch 的 expected revision 不等于当前 snapshot revision
- **THEN** controller 拒绝 mutation 并返回最新 snapshot

### Requirement: Unified file and selection reference envelope
引用 SHALL 统一承载 owner/ref/version、可见 scope、bounded quote、digest、label、freshness，以及文件 preview window 或 selection anchor。

#### Scenario: Selection anchor reference
- **WHEN** selection owner 提交明确引用动作和有效 anchor
- **THEN** controller 以同一 envelope 建立活动引用，并保留 anchor digest 与可见范围

#### Scenario: Partial file reference
- **WHEN** 文件 rendition 为 partial
- **THEN** envelope 必须包含 owner 已检视的 bounded window 或明确选区，否则 dispatch 被拒绝

### Requirement: Frozen sent snapshots and stale current references
系统 SHALL 冻结随消息发送的引用快照，资源变化不得改写历史消息。

#### Scenario: Resource version changes before send
- **WHEN** 当前文件 version 与未发送引用 version 不同
- **THEN** controller 将引用标记 stale，并提供查看当前版本动作

#### Scenario: Resource version changes after send
- **WHEN** 已发送消息引用的资源随后变化或重命名
- **THEN** 历史 envelope 保持原 owner/ref/version/quote/digest，不被 redirect 或新内容覆盖

### Requirement: Public conversation dock projection
系统 SHALL 只在公开 `conversation.input.dock` 投影引用 chips，且不得创建第二套 Composer。

#### Scenario: Structured send capability available
- **WHEN** DSH Conversation owner 声明兼容的结构化发送 capability
- **THEN** dock 将冻结引用快照交给该 capability，并在 owner 确认后清理相应未发送状态

#### Scenario: Structured send capability missing
- **WHEN** 结构化发送 capability 缺失或不兼容
- **THEN** 引用发送 fail-closed，dock 明示 blocked，并只提供显式复制为 `@mention`/引用文本

#### Scenario: No silent text downgrade
- **WHEN** 用户使用现有 Composer 发送普通消息而引用发送被阻止
- **THEN** 系统不得自动把引用、绝对路径或 quote 拼接进正文

### Requirement: Redirect unsent references only
系统 SHALL 接受 owner-authored oldRef-to-newRef redirect，并只迁移当前 UI 与未发送引用。

#### Scenario: Rename redirect
- **WHEN** rename/move receipt 返回有效 redirect
- **THEN** 树、打开 Tab、活动引用和未发送固定引用原子迁移到 newRef，已发送引用保持冻结
