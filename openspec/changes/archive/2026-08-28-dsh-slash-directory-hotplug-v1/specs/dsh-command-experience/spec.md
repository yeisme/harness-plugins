# dsh-command-experience

## ADDED Requirements

### Requirement: 实时三层 slash 目录
系统 SHALL 合并 P0 目录、pane 热贡献与 host commands 投影为一份 `/` 目录。第一次发现 MUST NOT 发出 RPC。P0 保留名 MUST NOT 被面板覆盖。面板之间的 canonical 冲突 SHALL 使后到者 disabled 并带原因，MUST NOT throw 或拆掉菜单。卸载 pane 源后，其贡献行 SHALL 立即消失。

#### Scenario: 面板抢保留名
- **WHEN** 面板贡献 `mcp` 而 P0 已有 `/mcp`
- **THEN** P0 条目保留，面板条目 disabled，原因包含 reserved

#### Scenario: 热卸载
- **WHEN** pane 源被 remove
- **THEN** 该源命令从 snapshot 消失，P0 `/pane` 仍在

### Requirement: `/pane` 中枢与常见 inspect 命令
系统 SHALL 提供 `/pane`（缺 Pane Workbench 时 disabled）。`/pane <token>` SHALL 在 picker 可见 view 上做唯一安全前缀匹配并打开该 kind。`/mcp` SHALL 解析到 MCP inspector conversation view；`/skills` SHALL 打开 Agent Context 的 skills tab；`/plugins` SHALL 本地列出已加载插件；`/explorer`（别名 `files`）与 `/git` SHALL 打开对应 pane。缺目标时命令可见且 disabled 并带原因。`/agent` SHALL 接受别名 `agents`。

#### Scenario: `/pane explorer`
- **WHEN** registry 含 picker 可见 `dsh.explorer` 且用户确认 `/pane explorer`
- **THEN** 系统 SHALL `openView` 该 kind

#### Scenario: 未安装 MCP inspector
- **WHEN** 无 MCP inspector 插件
- **THEN** `/mcp` SHALL disabled 或执行结果为 unavailable，原因说明未安装

### Requirement: 面板 launcher 与可选短名无需改目录源码
`presentation.launcher === true` 的 pane 命令 SHALL 自动进入 `/`，默认名由 id 的 `.`/`_` 收成 `-`。可选 `slash.name` SHALL 发布短名。描述符携带 shortcut、execute 函数、远程 URL 或 dynamic import SHALL 被拒绝。执行 SHALL 调用 `pane.commands.execute(id)`，command-experience MUST NOT 复制面板业务 handler。

#### Scenario: Creator 短名
- **WHEN** 面板声明 `slash.name: creator` 且 launcher 为 true
- **THEN** `/` 目录 SHALL 出现 `creator`，schemaKey 指向 `pane-command:creator.open`
