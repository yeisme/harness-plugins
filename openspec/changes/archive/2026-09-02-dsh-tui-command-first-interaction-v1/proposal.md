## Why

DSH TUI 已有共享 P0 command catalog、`/` assist、`:` 兼容前缀、纯终端按键解析、`Ctrl+K` toggle 意图和 fail-closed command-console seam，但它仍只是 contribution adapter：没有完整可视 renderer、结构化参数步骤、session selector、确认界面、receipt lane、Activity 恢复、状态条、`/status` Inspector 或终端尺寸策略。

因此同一批常见命令在 Web 可以形成完整交互，在 TUI 中却只能停在目录和测试适配层。用户无法仅靠键盘稳定完成“发现 → 选择 → 补参数 → 确认 → 查看结果/恢复路径”，也无法持续看到当前 session、model、context remaining 和 Provider limit。

本 change 为 TUI 建立与 Web 同源但符合终端习惯的命令优先壳：共享 command directory、owner action、session status projection 和 durable command events；TUI 只拥有纯状态机、布局、焦点、键位和安全 renderer，不读取 stdin、不切 raw mode、不接管 canonical session/runtime state。

## What Changes

- 输入区键入 `/` 打开就地 Slash Assist；`Ctrl+K` 打开全屏 Command Center。两者共享同一实时目录、canonical identity、availability、danger、coverage、owner 和最近成功命令。
- 完整承接当前 P0 的 discovery、session、model、work、lifecycle 五类命令与 aliases；V1 深度 journey 聚焦 `/help`、`/commands`、`/status`、`/session`、`/new`、`/fork`、`/rename`、`/compact`、`/model`、`/permissions`。
- 命令选择后进入结构化 TUI flow：command token、argument editor、selector、confirm/destructive gate、dispatch、receipt。原聊天草稿在取消后精确恢复。
- safe 命令可 Enter 执行；confirm 命令默认焦点为 Cancel，可用明确 `y`、移动焦点后 Enter 或宿主支持的 modified Enter 确认；destructive 命令要求 owner preview、receipt capability 和输入 owner-authored confirmation phrase。
- 新增 TUI receipt lane 与 Command Center Activity 页，只读取 durable `command/run|done`；pending 防重复、error/stale/partial 保持可见，command result 不写入模型消息。
- 新增安全的 TUI result Inspector：宽终端右侧详情，标准终端全屏页，窄终端单列分页；只消费 typed/bounded projection，不解析 Web DOM 或人类 CLI 文本。
- 新增当前 session 状态条和 `/status` Inspector，复用 `session.status.snapshot.v1alpha1`；context、Provider quota/reset、token usage/balance 保持独立语义。
- TUI shell 遵守 `update(state,event) -> state + commands` 与 `render(state,width,height) -> frame`；raw mode、alternate screen、mouse、signal 和 cleanup 仍由官方宿主拥有。
- 增加 redacted event/frame replay debug mode；日志写 sidecar 文件，TUI 占用终端时不得写 stdout/stderr。
- 保留现有 `CommandConsoleContribution`、`parseTerminalKey`、`applyTuiConsoleKey`、`:` alias、Web surfaces、命令 descriptor 和 owner action。新 state、renderer、optional contribution 字段均 additive。

## Capabilities

### New Capabilities

- `dsh-tui-command-first-shell`: TUI Slash Assist、Command Center、完整 P0、结构化命令流、风险确认、receipt、Activity、Inspector、键位、终端尺寸和可重放状态机。
- `dsh-tui-session-status`: 当前 session 状态条、`/status` Inspector、context warning、Provider limit 与诚实降级。

### Modified Capabilities

无。现有 `dsh-command-experience`、TUI adapter、session status projection 和命令 owner 合同保持兼容；新能力通过 additive renderer/contribution 与 capability probe 组合。

## Impact

- 主要实现：`packages/client/command-experience-core`、`packages/client/ui-command-experience-tui`、`packages/bundle/dsh-command-experience`。
- 共享依赖：`packages/host/dsh-session-status` 与其 Client wire mirror；若 sibling change `dsh-web-command-first-interaction-v1` 尚未落地，TUI status 保持 unavailable/disabled，不自行推算。
- 可选消费：Pane/inspect command 的安全 result descriptor、官方 `command/run|done` session events、session/model/tokenMeter/provider owner projections。
- 上游边界：官方 `@deepseek-ai/dsh-client-tui` 必须提供 contribution、logical key、viewport/frame、focus/input、status region 或 inspector seam；缺失时只产出最小 `upstream-prs/<slug>/`，插件继续 fail-closed，不读取 stdin、不 patch 宿主。
- 兼容分类：新增纯状态、optional contribution 字段、renderer registry 和状态视图均为 additive；无 breaking surface、无 deprecation window。回滚为关闭新 renderer capability，现有 assist adapter、`:` alias 与 Web command experience 继续工作。
- 不新增终端 UI 框架依赖；优先使用官方 TUI primitives。若宿主只提供 frame seam，renderer 保持纯字符串/cell grid projection。
