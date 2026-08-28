# dsh-command-experience Specification

## Purpose
TBD - created by archiving change dsh-command-experience-session-keymap-v1. Update Purpose after archive.
## Requirements
### Requirement: 统一命令目录与 `/session` 管理中枢
系统 SHALL 在共享命令目录（`P0_SEEDS` → `buildP0Catalog`）提供 `/session`（别名 `sessions`，selectorKey `sessionId`，requiredAction `open-session`，danger safe）作为 session 管理中枢：无参打开 session selector，选中目标后进入动作菜单（Switch / Rename / Archive；已归档目标 SHALL 把 Archive 换成 Restore）。`/session <subcommand>` SHALL 经 `splitSessionHubInput`/`parseSessionSubcommand` 解析，未知 token 宽容回退 switch，MUST NOT 中途报错。

#### Scenario: 无参打开中枢
- **WHEN** 用户输入 `/session` 并确认
- **THEN** 系统 SHALL 打开 sessionId selector，且可用性与 `/resume` 同源（缺 `open-session` owner action 时同步 disabled）

#### Scenario: 已归档目标的动作集
- **WHEN** 选中的 session 处于已归档状态
- **THEN** 动作菜单 SHALL 提供 Restore 而非 Archive

#### Scenario: 子命令直达与宽容回退
- **WHEN** 用户输入 `/session archive` 或 `/session rename <title>` 或 `/session 未知词`
- **THEN** 系统 SHALL 分别预置 archive 模式、携带 title 的 rename 意图、回退为 switch；`<title>` 的大小写 MUST 原样保留

### Requirement: session 变更动作 receipt-gated 且受 danger 门约束
`/session` hub 的每个动作 SHALL 经 `planSessionItemAction` 映射到 owner action（switch→`open-session`、rename→`rename-session`、archive→`archive-session`、restore→`restore-session`）并走 `OwnerActionAdapter` 的 correlation-id + receipt 通道。Archive SHALL 同时满足 `evaluateDangerGate` 与 `prepareDestructiveSubmit`（owner preview 必需、receipt 能力必需）；hub MUST NOT 提供或嵌套 delete 动作。`/archive`（confirm）与 `/delete`（destructive）SHALL 作为独立目录条目保持 staged：缺 preview 或 receipt 能力时 disabled 且带原因。

#### Scenario: 缺失 owner preview 的 archive
- **WHEN** owner 未提供 preview 或不具备 receipt 能力
- **THEN** archive 动作与 `/archive` 目录条目 SHALL 保持 staged/disabled 并显示原因，MUST NOT 提交请求

#### Scenario: restore 动作
- **WHEN** 用户在已归档目标上选择 Restore
- **THEN** 系统 SHALL 提交 `restore-session`（danger safe）owner action 并等待 receipt

#### Scenario: hub 不含 delete
- **WHEN** 渲染 `/session` 动作菜单
- **THEN** 菜单 MUST NOT 出现任何 delete 入口

### Requirement: 共享 keymap 的纯解析与默认键位
系统 SHALL 提供纯函数 keymap（`resolveKeyAction`：逻辑键事件 + reducer 状态 + 键位配置 → reducer action 或 adapter 意图），无 DOM/stdin 依赖，按状态分派：idle→toggle；assist/selected/argument/selector→光标移动、（assist/selected）Tab 补全、执行、取消；confirmation→仅显式确认绑定；receipt→关回执。默认键位 SHALL 为 toggle `ctrl+k`/`meta+k`、上下移 `arrowup`+`ctrl+p`/`arrowdown`+`ctrl+n`、首末 `home`/`end`、执行 `enter`、取消 `escape`、确认 `ctrl+enter`/`meta+enter`、关回执 `escape`/`ctrl+d`/`meta+d`、补全 `tab`。裸 `j`/`k` MUST NOT 出现在默认键位（会吞查询字母），仅 config 可开。确认态下裸 `enter` MUST NOT 触发确认。Tab 补全 MUST 仅在唯一安全前缀时改写 query（补全源为用户 draft），歧义时 MUST NOT 拦截按键。快捷键声明 MUST NOT 进入命令元数据（sanitize `GLOBAL_SHORTCUT_PATTERN` 边界），只允许存在于 adapter 配置。

#### Scenario: 裸 Enter 不确认 danger gate
- **WHEN** 状态机处于 confirmation 且用户按 `enter`
- **THEN** keymap SHALL 返回 unhandled；仅 `ctrl+enter`/`meta+enter` 返回 CONFIRM

#### Scenario: Tab 歧义不拦截
- **WHEN** assist 态下 query 前缀命中多个可执行命令且用户按 `tab`
- **THEN** keymap SHALL 返回 unhandled，MUST NOT preventDefault 或改写 query

#### Scenario: 键位可配置
- **WHEN** adapter 传入 `keyboardShortcuts.navigateUp = ['k']`
- **THEN** `resolveKeymap` SHALL 合并覆盖该键位并保留其余默认

### Requirement: reducer 光标导航与陈旧策略
状态机 SHALL 支持 `MOVE_SELECTION { delta?|index?; candidateKeys }` 与 `cursorKey`/`cursorMoved` 字段：无候选时为 no-op；移动 clamp 在候选范围内；光标 key 在候选刷新后消失时 SHALL 清空光标（`UPDATE_QUERY` 可携带新 candidateKeys），MUST NOT 自动跳到邻居；`SELECT_COMMAND`/`CANCEL`/`RESET` SHALL 复位光标。发现层的 auto-select SHALL 让位于已移动的光标（`cursorMoved` 且未指向被选项时跳过 auto-select）。

#### Scenario: 光标移动与执行
- **WHEN** assist 态按 `arrowdown` 两次后按 `enter`
- **THEN** 光标 SHALL 停在第二个候选且执行该候选（若为禁用行则拒执行且状态不变）

#### Scenario: 候选消失
- **WHEN** query 变化后携带的新 candidateKeys 不含当前 cursorKey
- **THEN** 光标 SHALL 变为 null，MUST NOT 选中相邻候选

### Requirement: Web 与 TUI 表面接线
Web 菜单/selector/确认/回执四处键盘处理 SHALL 统一经 `resolveKeyAction`（消费 `keyboardShortcuts` 配置），并提供 `useCommandPaletteToggle`（window 级 toggle，`enabled: false` 时挂起）。TUI SHALL 提供纯函数 `parseTerminalKey`（终端键序列→逻辑键）与 `applyTuiConsoleKey`/`controller.handleKeyEvent`（官方 seam 接入点）；TUI 适配器 MUST NOT 读 stdin 或开 rawMode，seam 未发布时保持 fail-closed。Web 焦点回补在官方 `bindComposerFocus` 公开前 SHALL 使用 DOM fallback。键盘可达界面 SHALL 提供礼貌 aria-live 播报。

#### Scenario: Ctrl+K 打开面板
- **WHEN** web 页面处于 idle 且用户按 `ctrl+k`
- **THEN** 系统 SHALL 进入 assist 态并聚焦命令输入

#### Scenario: TUI 合成键序列
- **WHEN** 本地测试宿主向 controller 喂 `\x1b[B`、`\r`、`\x1b`
- **THEN** SHALL 分别产生光标下移、执行意图、取消并恢复 draft

#### Scenario: TUI seam 缺失
- **WHEN** 官方 `@deepseek-ai/dsh-client-tui` seam 不可用
- **THEN** 适配器 SHALL 保持未注册并给出原因，MUST NOT 伪造 console

### Requirement: fail-closed 降级无死按钮
缺 owner action 的命令与动作 SHALL 保持可见并 disabled 且带原因；mutation 仅在 receipt 通道可用时启用。hub 动作清单 SHALL 由 `buildSessionHubActions` 依 owner capability 快照派生（缺 `archive-session` → Archive disabled + `missing owner action archive-session`）。

#### Scenario: capability 快照缺动作
- **WHEN** `availableActions` 只含 `open-session`
- **THEN** hub 中 Switch 可用，Rename/Archive disabled 且各带 missing 原因

### Requirement: 无递归与元数据安全
插件侧 archive/delete 提交 SHALL 仅携带 owner-authored target ref；携带 descendants/paths/recursive 的提交 MUST 被拒绝（`refusePluginRecursiveDelete`）。命令描述符携带快捷键声明（`shortcut` 字段或 `globalShortcut`/`registerHotkey` 等模式）MUST 被 sanitize 拒绝。

#### Scenario: 递归负载被拒
- **WHEN** 提交携带 `recursive: true` 或非空 descendants/paths
- **THEN** 系统 SHALL 拒绝并返回 staged 状态与原因

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

