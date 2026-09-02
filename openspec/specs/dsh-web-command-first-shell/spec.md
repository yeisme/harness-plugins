# dsh-web-command-first-shell Specification

## Purpose
TBD - created by archiving change dsh-web-command-first-interaction-v1. Update Purpose after archive.
## Requirements
### Requirement: Slash Assist 与全局 Palette SHALL 共用一份实时目录
系统 SHALL 让 Composer 输入 `/` 打开锚定 Slash Assist，让 `Ctrl+K`/`Meta+K` 打开全局 Palette。两者 MUST 消费同一 revisioned command directory、canonical id、alias、availability、disabled reason、danger、selector 与 handler owner，MUST NOT 复制第二份命令注册表。第一次 `/` 发现 MUST 保持 no-RPC。

#### Scenario: 同一命令从两个入口发现
- **WHEN** `/session` 在当前目录 revision 中可用
- **THEN** Slash Assist 与全局 Palette SHALL 展示同一 canonical command、可用性和禁用原因
- **AND** 两个入口执行后 SHALL 进入同一 reducer/adapter 路径

#### Scenario: Pane command 热卸载
- **WHEN** pane source 卸载并发布新目录 revision
- **THEN** 两个入口 SHALL 同时移除该贡献
- **AND** MUST NOT 留下可点击的陈旧行

### Requirement: 命令排序 SHALL 上下文优先且确定性
目录 projection SHALL 依次使用 exact canonical/alias match、当前 context 可执行性、当前 session 最近成功命令、descriptor order/category/canonical name 排序。Slash Assist SHALL 最多显示 8 条首选项；Palette SHALL 提供完整分组搜索。不可用命令 MUST 保持可见并附可读原因，MUST NOT 因排序隐藏。

#### Scenario: 当前会话命令优先
- **WHEN** 用户在 Composer 输入 `/s`，目录同时含 session、skills 与 source-control 命令
- **THEN** 与当前 session 直接相关且可执行的命令 SHALL 排在无关 Pane 命令之前
- **AND** tie-break SHALL 在重复渲染间稳定

#### Scenario: 不可用命令仍可解释
- **WHEN** `/mcp` 缺少 inspector surface
- **THEN** 目录 SHALL 保留 `/mcp` 并显示 disabled reason
- **AND** Enter/click MUST NOT dispatch

### Requirement: 当前 P0 命令族 SHALL 完整保留 readiness 语义
新壳 SHALL 投影当前 live P0 目录的 discovery、session、model、work 与 lifecycle 五类 canonical command 和 alias。首批实现命令 MAY 作为验收焦点，但其余既有 P0 MUST 保持 canonical identity、owner、actionKind、danger、coverage、availability 与 disabled/not-applicable reason。系统 MUST NOT 以“精简界面”为由隐藏 staged、conditional 或 not-applicable 命令。P1 候选 MUST NOT 在缺 owner handler 时变成可执行占位。

#### Scenario: First-support 之外的命令仍可发现
- **WHEN** V1 只对 `/status`、`/session`、`/new`、`/fork`、`/rename`、`/compact`、`/model`、`/permissions` 运行完整浏览器 journey
- **THEN** `/help`、`/commands`、`/plugins`、`/mcp`、`/skills`、`/pane`、`/explorer`、`/git`、`/agent`、`/resume`、`/archive`、`/delete`、`/preset`、`/reasoning`、`/plan`、`/goal`、`/diff`、`/review`、`/mention`、`/copy`、`/feedback`、`/init`、`/logout` 与 `/quit` 仍 SHALL 从同一目录投影
- **AND** aliases SHALL 只解析到其 canonical identity，不创建第二 handler

#### Scenario: P1 command 尚无 owner contract
- **WHEN** `/usage` 或 `/theme` 仍只存在于候选账本且没有 live descriptor/handler
- **THEN** 新壳 MUST NOT 发布可点击的假命令
- **AND** 未来加入 SHALL 经独立 descriptor、owner、availability 与验证证据

### Requirement: 命令详情 SHALL 在执行前解释参数、风险与结果去向
Slash Assist 的紧凑行 SHALL 显示 canonical name、description 与 shortcut/selector/confirmation/disabled reason 中最相关的一项。Palette 与 `/help <command>` SHALL 可展示由 descriptor 派生的 aliases、category、input hint、actionKind、owner、danger、availability reason、coverage 与 expected presentation。详情 MUST NOT 携带 handler、dynamic import、remote URL、raw owner payload 或 credential。

#### Scenario: 用户检查 staged command
- **WHEN** 用户在 Palette 展开 `/archive`
- **THEN** 详情 SHALL 显示 owner 为 DSH、danger 为 confirm、当前 staged/disabled 原因与 owner preview 要求
- **AND** MUST NOT 暴露 preview 原始 payload 或执行函数

#### Scenario: Alias 展示 canonical identity
- **WHEN** 用户搜索 `/files` 或 `/exit`
- **THEN** 结果 SHALL 明确显示其 canonical command 分别为 `/explorer` 与 `/quit`
- **AND** receipt 与 Activity SHALL 记录 canonical identity

### Requirement: 命令 SHALL 使用渐进式结构化草稿
选择命令后，系统 SHALL 在 Composer 内形成可见 command token，并依 descriptor 进入 argument、selector 或 confirmation 步骤。Command draft 只 MAY 保存 canonical id、当前步骤、safe selected refs 与用户可见草稿；MUST NOT 持久化 raw args、credential、private path 或 owner payload。歧义、缺参数和 disabled 状态 MUST NOT dispatch。

#### Scenario: 带 selector 的 session 命令
- **WHEN** 用户选择 `/session` 且 descriptor 要求 `sessionId`
- **THEN** Composer SHALL 保留 `/session` token 并打开 session selector
- **AND** 选择 safe session ref 后才可进入执行步骤

#### Scenario: Escape 恢复原草稿
- **WHEN** 用户已有普通文本草稿并进入 Slash Assist、command token 与 nested selector
- **THEN** 连续 Escape SHALL 依次关闭 selector、取消 command token、恢复原文本草稿并把焦点还给 Composer

### Requirement: 风险命令 SHALL 分级确认并 fail closed
`safe` 命令在参数完整后 MAY 立即 dispatch；`confirm` 命令 SHALL 显示 inline target/effect 并只接受 `Ctrl+Enter`/`Meta+Enter`；`destructive` 命令 SHALL 要求 owner preview、receipt capability 与 blocking confirmation。裸 Enter MUST NOT 确认 non-safe 命令。stale、unknown、permission-denied 或 preview-missing 状态 MUST 拒绝 mutation。

#### Scenario: Compact 的 inline confirmation
- **WHEN** `/compact` descriptor danger 为 `confirm` 且 owner action 可用
- **THEN** 系统 SHALL 在 Composer 上方显示 effect 摘要
- **AND** 仅 `Ctrl+Enter`/`Meta+Enter` 或明确确认按钮可提交

#### Scenario: Delete 缺 owner preview
- **WHEN** `/delete` 缺少 owner preview 或 receipt capability
- **THEN** 命令 SHALL disabled/staged 并显示原因
- **AND** MUST NOT 打开可绕过 gate 的本地删除路径

### Requirement: 即时 receipt 与 durable Activity SHALL 分层
dispatching/pending/success/error SHALL 在 Composer receipt lane 立即可见。成功摘要 MAY 在 4 秒后折叠为 Activity affordance；error/partial/stale SHALL 保持到用户处理。durable Activity MUST 只读取官方 `command/run|done` session events，MUST NOT 创建第二日志或把 command result 注入模型消息。

#### Scenario: Command 完成后恢复 Activity
- **WHEN** 页面刷新后 session log 仍含 matching `command/run|done`
- **THEN** Activity SHALL 恢复 canonical command、状态、安全摘要、reason/receipt ref
- **AND** 对话模型历史 SHALL 不包含该 result

#### Scenario: Pending 防重复提交
- **WHEN** owner action 尚未 terminal
- **THEN** receipt lane SHALL 显示 pending 并禁用同一 command draft 的重复提交

### Requirement: 富结果 SHALL 使用 Pane preview/pin 生命周期
带 `presentation.viewKind` 的 inspect/navigation result SHALL 通过公开 `paneWorkbench.openView()` 打开 preview view，并遵守 singleton/resourceKey 复用。用户编辑、mutation、drag 或显式 Pin 后 SHALL 提升为 pinned。Command shell MUST NOT 读取或修改 Pane reducer 私有 layout。

#### Scenario: Inspect 结果复用 preview
- **WHEN** 用户连续运行两个使用同一 preview slot 的 inspect 命令且未 Pin 第一个
- **THEN** 第二个结果 SHALL 复用 preview Tab
- **AND** MUST NOT 产生两个永久 pinned Tab

#### Scenario: Pane seam 缺失
- **WHEN** result 需要 Pane 但 `paneWorkbench` 不可用
- **THEN** 系统 SHALL 显示 bounded fallback 或安全文本结果
- **AND** MUST NOT 伪造 right/bottom docking

### Requirement: Composer 控制与下一步建议 SHALL 保持低噪声
桌面 Composer SHALL 提供紧凑 model/preset、reasoning 与 permissions 当前值控制，并与对应 slash selector 共用数据和 reducer。turn 完成且 draft 为空时 MAY 显示 1–3 个建议 chip；点击 SHALL 只写入草稿，MUST NOT 自动发送。开始输入、切换 session 或执行命令 SHALL 收起建议。

#### Scenario: Control 与 slash 同源
- **WHEN** 用户从 Composer control 或 `/model` 选择同一 model
- **THEN** 两条路径 SHALL 提交同一 owner action 并等待同一 receipt 语义

#### Scenario: 建议不会自动发送
- **WHEN** 用户点击“运行验证”建议 chip
- **THEN** 建议文本 SHALL 写入 Composer draft
- **AND** session MUST NOT 在用户按发送前产生新 prompt

### Requirement: 键盘、焦点与响应式行为 SHALL 可预测
Slash Assist、Palette、selector、Popover、Dialog 与 Sheet SHALL 定义 Arrow/Home/End/Enter/Escape/Tab 行为、active descendant、focus trap/return 和 polite live announcement。1024px+ SHALL 使用 anchored assist/popover 与 Pane；768–1023px SHALL 使用 Palette + Sheet；<768px SHALL 使用全宽层并保证触控目标至少 44px。`prefers-reduced-motion` SHALL 移除非必要 transform。

#### Scenario: Palette 关闭后恢复 Composer
- **WHEN** 用户从 Composer 按 `Ctrl+K` 打开 Palette 后按 Escape
- **THEN** Palette SHALL 关闭并把焦点返回原 Composer

#### Scenario: 窄屏打开 selector
- **WHEN** viewport 小于 768px 且 command 需要 selector
- **THEN** selector SHALL 以全宽 Sheet 呈现，内容可滚动且背景锁定
- **AND** 关闭后 SHALL 返回 command token

### Requirement: 共享壳 SHALL 保持 owner 与兼容边界
系统 MUST 保留现有 command descriptor、`token-usage-open`、`workspace.token-usage`、Pane `openView()` 与插件 hotplug 合同。新增 presentation hint、Remote、types 与 component SHALL additive。客户端 MUST NOT patch DOM、执行插件 handler、保存 owner payload 或推断 canonical state。

#### Scenario: 新壳 capability 缺失
- **WHEN** 发布版 DSH 不提供 Composer anchor seam
- **THEN** bundle SHALL 保留旧 Command Menu fallback 并说明 capability 原因
- **AND** 现有命令执行 MUST 继续可用

