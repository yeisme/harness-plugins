## ADDED Requirements

### Requirement: File Host SHALL issue workspace-scoped opaque refs
File Host SHALL expose a V2 listing/read/write contract whose browser-visible file identifiers are owner-issued opaque refs. V2 payloads MUST NOT contain absolute paths、`file://` URI or client-authored workspace paths.

#### Scenario: 列出 workspace 文件
- **WHEN** 已知 session 请求 V2 根目录或子目录列表
- **THEN** Host 返回 `FileEntryV1` safe projection 与 opaque ref
- **AND** response 中不存在可恢复的文件系统路径

#### Scenario: 缺 session owner
- **WHEN** V2 请求无法由 Host 解析到 workspace
- **THEN** 请求被拒绝或 capability 标记 unavailable
- **AND** Host 不接受浏览器提交的绝对 cwd 作为替代 authority

### Requirement: Opaque refs SHALL be fenced by owner and version
read、write、language target 与 workspace edit SHALL 通过同一 session/workspace ref registry 解析。Host MUST realpath 校验目标仍在 workspace 内；写入 MUST 使用 owner-issued expected version。

#### Scenario: ref 跨 workspace 使用
- **WHEN** 一个 workspace 的 ref 被用于另一 session/workspace
- **THEN** Host 拒绝请求
- **AND** 不返回目标路径或存在性细节

#### Scenario: stale write
- **WHEN** expected version 与当前文件版本不一致
- **THEN** Host 返回 conflict receipt
- **AND** 不覆盖当前文件

### Requirement: Legacy File Host SHALL remain compatible
现有 FileHost V1 与旧 HTTP 方法 SHALL 保持原签名和行为。语义编辑器 MUST 只在 `FileOpaqueRefCapabilityV1` 存在时使用 V2，不得静默回退到 raw-path transport。

#### Scenario: profile 未提供 V2
- **WHEN** Desktop Workbench 只有旧 File Host
- **THEN** 现有 Markdown/纯文本预览继续工作
- **AND** semantic editor 显示 capability unavailable 或不注册
