## ADDED Requirements

### Requirement: Route codec SHALL parse and format session URLs
`@yeisme/dsh-client-ui-url-session` SHALL 导出纯函数 `parseLocation(location)` 与 `sessionUrl(base, sessionId, options?)`。`parseLocation` SHALL 从 path `/s/<sessionId>` 或 query `s` 得到 `{ sessionId, anchor, prefill } | null`；path 与 query 同时存在且 id 不一致时 SHALL 以 path 为准。函数 MUST NOT 依赖 Cordis、DOM 或 Host 服务。

#### Scenario: Canonical path
- **WHEN** location pathname 为 `/s/abc123` 且无 query
- **THEN** `parseLocation` SHALL 返回 `sessionId` 为 `abc123`
- **AND** `anchor` 与 `prefill` SHALL 为空

#### Scenario: Query alias
- **WHEN** location pathname 为 `/` 且 search 含 `s=abc123`
- **THEN** `parseLocation` SHALL 返回 `sessionId` 为 `abc123`

#### Scenario: Path wins over conflicting query
- **WHEN** pathname 为 `/s/path-id` 且 search 含 `s=query-id`
- **THEN** `parseLocation` SHALL 返回 `sessionId` 为 `path-id`
- **AND** MUST NOT 报错或合并两个 id

#### Scenario: file origin with query
- **WHEN** location protocol 为 `file:` 且 search 含 `s=abc123`
- **THEN** `parseLocation` SHALL 返回 `sessionId` 为 `abc123`

#### Scenario: Invalid or empty id
- **WHEN** pathname 为 `/s/` 或 query `s` 为空
- **THEN** `parseLocation` SHALL 返回 `null`

#### Scenario: Format canonical URL
- **WHEN** `sessionUrl('http://127.0.0.1:3080', 'abc123')` 被调用
- **THEN** 结果 SHALL 为 `http://127.0.0.1:3080/s/abc123`
- **AND** MUST NOT 包含 token、cookie 或草稿正文

#### Scenario: Mention URI extracts id
- **WHEN** 输入为 `dsh-session:abc123`
- **THEN** codec SHALL 抽出 `abc123`
- **AND** MUST NOT 注册操作系统协议

### Requirement: Client SHALL sync URL and session selection after boot
装有 `@yeisme/dsh-url-session` 的 Web Client SHALL 在全部 fiber ACTIVE 之后读取当前 location。合法 `sessionId` SHALL 经公开 `session-query` 解析，按会话 cwd 切换已注册 workspace，并打开该会话。无 `s` 参数时 MUST NOT 改变既有选择。程序化选择成功后 SHALL `pushState` 更新 canonical path；同一 sessionId 的重复同步 SHALL `replaceState`。`popstate` SHALL 反向选择对应会话。

#### Scenario: Boot with query alias
- **WHEN** 用户打开已运行 SPA 的 `/?s=<id>` 且该会话存在
- **THEN** Client SHALL 在 boot 完成后打开该会话
- **AND** 地址栏 SHALL 同步为 `/s/<id>`（History API 可用时）

#### Scenario: Sidebar selection updates URL
- **WHEN** 用户在侧栏切换到另一存在的会话
- **THEN** 地址栏 SHALL 变为 `/s/<new-id>`
- **AND** MUST NOT 重新加载文档

#### Scenario: Browser back restores previous session
- **WHEN** 用户从会话 A 切到 B 后按下后退
- **THEN** Client SHALL 重新选择会话 A
- **AND** 地址栏 SHALL 反映 A

#### Scenario: Refresh keeps the same session
- **WHEN** 当前 URL 为 `/s/<id>` 或 `/?s=<id>` 且会话仍存在，用户刷新（在 historyFallback 可用或仅 query 别名场景）
- **THEN** boot 完成后 SHALL 回到同一会话

#### Scenario: Cross-workspace session
- **WHEN** URL 指向的会话 cwd 属于另一已注册 workspace
- **THEN** Client SHALL 先切换该 workspace 再打开会话
- **AND** MUST NOT 把 workspace 写入 URL

#### Scenario: Query alias works without historyFallback
- **WHEN** 纯上游 profile 或未启用 historyFallback 的环境中，用户在已加载 SPA 将地址改为 `/?s=<id>`
- **THEN** Client SHALL 仍打开该会话
- **AND** MUST NOT 要求 `/s/<id>` 的服务端 fallback

### Requirement: Missing session SHALL render an in-view empty state
找不到、已删除或已清理的 `sessionId` SHALL 在会话主视图内展示友好空态，文案包含「会话不存在或已被清理」及返回列表动作。空态 MUST NOT 使 boot 失败，MUST NOT 白屏，MUST NOT 伪造会话。

#### Scenario: Unknown session id
- **WHEN** URL 含合法形态但 `session-query` 找不到该 id
- **THEN** 视图 SHALL 显示空态与返回列表
- **AND** boot roster SHALL 仍为 ACTIVE

#### Scenario: Return to list
- **WHEN** 用户在空态选择返回列表
- **THEN** Client SHALL 清除会话选择并回到既有会话列表
- **AND** URL SHALL 不再声称该 id 为当前会话

### Requirement: Users SHALL copy or open the current session link
Client SHALL 在侧栏会话项菜单与会话头部 slot 提供「复制会话链接」和「在新标签页打开」。复制内容 SHALL 为当前 origin 下的 canonical `/s/<id>`（无 History 或无 fallback 文档场景可写 `?s=` 别名）。动作 MUST NOT 把凭证写入 clipboard 或 URL。

#### Scenario: Copy session link
- **WHEN** 当前会话存在且用户选择复制会话链接
- **THEN** clipboard SHALL 含完整会话 URL
- **AND** URL SHALL 不含 token 或 cookie

#### Scenario: Open in new tab
- **WHEN** 用户选择在新标签页打开
- **THEN** 新标签 SHALL 使用同一会话 URL
- **AND** MUST NOT 自动发送草稿

#### Scenario: No current session
- **WHEN** 没有选中会话
- **THEN** 复制与新标签动作 SHALL disabled 并给出原因
- **AND** MUST NOT 写入虚假 URL

### Requirement: Missing session seams SHALL fail closed
Client `inject` 声明所需服务。缺少 `sessions`、`session-query` 或 History 能力时，插件 SHALL 不注册菜单/头部入口，MUST NOT 抛出，MUST NOT 用 DOM selector 模拟选会话。

#### Scenario: Old host without sessions service
- **WHEN** 公开 sessions 选择面不存在
- **THEN** 插件 SHALL 跳过注册
- **AND** 既有侧栏与对话 SHALL 继续工作

### Requirement: Prefill parameters MUST NOT auto-submit
本切片 MAY 忽略 `prompt` query。任何未来解析 `?prompt=` 的实现 MUST 只预填草稿，MUST NOT 自动发送。URL MUST NOT 作为创建会话或提权的凭证。

#### Scenario: Prompt query present in P1
- **WHEN** URL 含 `prompt=` 且本切片未交付预填
- **THEN** Client SHALL 仍按 `sessionId` 打开或显示空态
- **AND** MUST NOT 向该会话提交消息
