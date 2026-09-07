## ADDED Requirements

### Requirement: dsh web --resume SHALL open the session URL
`dsh web --resume <session-id>` SHALL 在 boot 后把浏览器打开目标设为该会话 URL。存在 historyFallback 时目标 path SHALL 为 `/s/<session-id>`；否则 SHALL 降级为 `/?s=<session-id>`。`--no-open` SHALL 把完整会话 URL 打印到属于 shell 的 URL 行，MUST NOT 打开浏览器。本 flag MUST NOT 改变既有 tui `--resume` 语义。

#### Scenario: Resume opens the browser
- **WHEN** 用户运行 `dsh web --resume abc123` 且未传 `--no-open`
- **THEN** 打开目标 SHALL 包含会话 id `abc123`
- **AND** MUST NOT 在 URL 中附加 token

#### Scenario: No-open prints the session URL
- **WHEN** 用户运行 `dsh web --resume abc123 --no-open` 且端口由 OS 分配
- **THEN** stdout 的 URL 行 SHALL 含实际监听 origin 与会话 path 或 query
- **AND** 该行 SHALL 属于 shell 而非浏览器协议日志

#### Scenario: Unknown id still prints a URL
- **WHEN** `--resume` 指向尚未查询到的 id
- **THEN** CLI SHALL 仍打开或打印该 id 的会话 URL
- **AND** 缺失会话的友好空态 SHALL 由 Client 在 boot 后处理

### Requirement: Session command /url SHALL print or copy the current session link
会话内命令面 SHALL 提供 `/url`（或等价扩展），用于打印或复制当前会话 canonical URL。默认人类输出为英文摘要。`--agent` SHALL 从同一投影渲染，并包含 additive 键 `session.url=<full-url>`。既有 `--agent` 键 MUST NOT 被重命名或删除。

#### Scenario: Agent mode emits session.url
- **WHEN** 当前会话存在且用户执行 `/url --agent`
- **THEN** stdout SHALL 含 `mode=agent`、`status=success` 与 `session.url=` 完整 URL
- **AND** 该 URL SHALL 与浏览器地址栏在 History 同步后的值一致

#### Scenario: JSON envelope stays additive
- **WHEN** 用户执行 `/url --json`
- **THEN** stdout SHALL 为合法 envelope，`data` 中含会话 URL
- **AND** 顶层字段 `spec_version`、`mode`、`command`、`status` SHALL 保持既有合同

#### Scenario: No session selected
- **WHEN** 没有当前会话时执行 `/url`
- **THEN** 命令 SHALL 以 `status=failed` 或等价失败投影返回
- **AND** MUST NOT 发明 session id

### Requirement: Safe handoff descriptors MAY carry a read-only session URL
Ordo / Workbench 安全 handoff descriptor SHALL 允许可选只读字段携带 DSH 会话 URL。缺字段的旧消费者 SHALL 忽略。该 URL MUST NOT 被解释为 mutation、批准或凭据。

#### Scenario: Descriptor with session URL
- **WHEN** handoff 含 DSH 会话 URL 且消费者只读投影
- **THEN** 消费者 MAY 展示或打开该链接
- **AND** MUST NOT 因持有 URL 而获得额外 Host 权限

#### Scenario: Descriptor without the field
- **WHEN** 旧 handoff 不含会话 URL 字段
- **THEN** 解析 SHALL 成功
- **AND** MUST NOT 要求该字段

### Requirement: CLI and agent output MUST redact secrets
会话 URL 的人类、`--agent`、`--json`、日志与集成证据 MUST NOT 包含 token、cookie、Authorization、raw prompt 或草稿正文。

#### Scenario: Evidence redaction
- **WHEN** 集成测试记录 `--resume` 或 `/url` 输出
- **THEN** `temp/integration-test-runs/<run-id>/` 中的 URL SHALL 最多含 origin 与 session id
- **AND** 证据六件套 SHALL 在失败时同样保留
