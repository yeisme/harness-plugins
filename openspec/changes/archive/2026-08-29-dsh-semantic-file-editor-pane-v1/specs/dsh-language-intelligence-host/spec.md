## ADDED Requirements

### Requirement: Language Host SHALL expose normalized typed intelligence
Language Host SHALL expose probe、document lifecycle、semantic query 与 structure query 的 typed contract。浏览器 MUST NOT receive raw LSP messages、server paths、argv、environment、provider credentials or arbitrary command payloads.

#### Scenario: Language Server 可用
- **WHEN** allowlisted provider 在 workspace 中启动并声明能力
- **THEN** probe 返回 `lsp+ast` 与准确 capability 集合
- **AND** semantic tokens、symbols、diagnostics 与 navigation 被归一化为 bounded UTF-16 projection

#### Scenario: Language Server 缺失
- **WHEN** provider executable 不存在或启动失败
- **THEN** Host 返回 `ast-only` 或 `source-only` 及原因
- **AND** 文件预览与基础编辑不白屏

### Requirement: Language Host SHALL maintain versioned document lifecycle
每个 open document SHALL 持有 owner file version 和单调 document version。change、query、cancel、save 与 close MUST 检查 handle ownership；旧 version response MUST be dropped.

#### Scenario: 乱序 diagnostics
- **WHEN** 较旧 document version 的 diagnostics 在新 change 后返回
- **THEN** Host 或 client facade 丢弃旧结果
- **AND** UI 不覆盖新版本状态

#### Scenario: close document
- **WHEN** Pane close、provider dispose 或 session fence
- **THEN** Host 发送对应 didClose 并释放 parser tree 和 listener
- **AND** 重复 close 保持幂等

### Requirement: AST SHALL be independent, bounded and safe
代码与结构化文本 SHALL 通过 host-side parser 生成 `SyntaxTreeProjectionV1`。结果 MUST 限制 node 数、深度、字符串长度和 range；parser byte offset MUST 转换为 UTF-16 position。

#### Scenario: Unicode range
- **WHEN** 文档包含 CJK、emoji 或 surrogate pair
- **THEN** AST、diagnostic 与 Monaco selection 指向相同字符范围

#### Scenario: oversized tree
- **WHEN** parser 超过 node、深度或时间预算
- **THEN** Host 返回 partial/source-only 与可见原因
- **AND** 不传输无界 tree 或源码副本

### Requirement: Language Server execution SHALL be allowlisted
Host SHALL only spawn built-in provider descriptors with `shell:false` and workspace-scoped cwd. Browser input MUST NOT select executable、argv、environment or initialization options；Host MUST NOT auto-install or download servers.

#### Scenario: command-only code action
- **WHEN** server 返回只有 `workspace/executeCommand` 的 action
- **THEN** Host 将其标记 unsupported/rejected
- **AND** 浏览器不执行该 command
