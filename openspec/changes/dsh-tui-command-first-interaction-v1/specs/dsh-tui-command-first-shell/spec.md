# dsh-tui-command-first-shell Capability

DSH TUI 的命令优先交互主干：Slash Assist、Command Center、完整 P0、结构化命令、分级确认、receipt、Activity、Inspector、终端尺寸与可重放状态机。

## ADDED Requirements

### Requirement: TUI SHALL 共用实时 command directory 与 canonical identity
TUI Slash Assist、Command Center、selector、command detail、receipt 与 Activity SHALL 消费与 Web 相同的 revisioned command directory 和 canonical identity。alias MUST 解析到 canonical command，MUST NOT 创建第二 handler、owner 或 receipt identity。第一次 `/` 或 `:` discovery MUST no-RPC；`:` SHALL 显示迁移提示但保持兼容。

#### Scenario: Slash 与 Command Center 同 revision
- **WHEN** directory revision 新增或移除一个 TUI command contribution
- **THEN** Slash Assist 与 Command Center SHALL 在同一 revision 反映变化
- **AND** 陈旧 selected command SHALL 变为 stale/disabled，MUST NOT dispatch

#### Scenario: Legacy colon alias
- **WHEN** 用户输入 `:session`
- **THEN** TUI SHALL 按 `/session` canonical identity 解析并显示一次迁移提示
- **AND** receipt/Activity SHALL 记录 `session` 而不是第二个 `:session` identity

### Requirement: TUI SHALL 完整保留当前 P0 命令族
TUI SHALL 投影当前 P0 discovery、session、model、work 与 lifecycle command 及 aliases，并保持 descriptor 的 owner、actionKind、danger、coverage、availability 和 disabled/not-applicable reason。首批深度 journey MAY 聚焦常见命令，但其余 P0 MUST 保持可发现或以明确 TUI renderer/surface reason 禁用。P1 候选没有 live descriptor/handler 时 MUST NOT 成为可执行占位。

#### Scenario: 完整 P0 catalog 回归
- **WHEN** TUI bundle 生成 surface-filtered catalog
- **THEN** `/help`、`/commands`、`/status`、`/plugins`、`/mcp`、`/skills`、`/pane`、`/explorer`、`/git`、`/agent`、`/resume`、`/session`、`/archive`、`/delete`、`/new`、`/fork`、`/rename`、`/compact`、`/model`、`/preset`、`/reasoning`、`/permissions`、`/plan`、`/goal`、`/diff`、`/review`、`/mention`、`/copy`、`/feedback`、`/init`、`/logout` 与 `/quit` SHALL 保持 canonical contract
- **AND** `/h`、`/?`、`/files`、`/agents`、`/subagents`、`/r`、`/sessions` 与 `/exit` SHALL 解析到既有 canonical command

#### Scenario: Web-only view 没有 TUI renderer
- **WHEN** 一个 navigation/inspect command 可在 Web Pane 打开但没有 TUI renderer 或 bounded text projection
- **THEN** TUI SHALL 保留命令并显示 `No TUI renderer` reason
- **AND** MUST NOT 伪造字符版 Pane 或静默打开 Web surface

### Requirement: Slash Assist 与 Command Center SHALL 分工明确
在输入区 command position 键入 `/` SHALL 打开就地 Slash Assist，候选上限依 viewport 为 8/6/4/3；`Ctrl+K` SHALL 打开 Command Center。Command Center SHALL 至少提供 Commands、Recent 与 Status 页面；左右键切页，Escape 返回原 input draft/cursor。两者 SHALL 使用同一排序和 query，disabled item 可聚焦解释但不可执行。

#### Scenario: 从聊天输入打开 Slash Assist
- **WHEN** 用户在空输入或 command position 键入 `/sta`
- **THEN** TUI SHALL 在输入区上方显示 local candidates 且不发 RPC
- **AND** Enter 只选择 exact/active executable row

#### Scenario: Command Center 恢复 draft
- **WHEN** 用户已有普通聊天草稿并按 `Ctrl+K` 打开 Command Center 后按 Escape
- **THEN** Command Center SHALL 关闭并恢复原 draft、cursor 与 transcript scroll anchor

### Requirement: Command detail SHALL 解释参数、owner、风险与结果去向
Slash Assist 紧凑行 SHALL 显示 canonical name、description 和 shortcut/selector/confirm/disabled reason 中最相关的一项。Command Center 与 `/help <command>` SHALL 展示 aliases、category、input hint、actionKind、owner、danger、coverage、availability reason 和 expected TUI presentation。Detail MUST 由 descriptor/capability 派生，MUST NOT 包含 handler、dynamic import、URL、path、credential 或 raw owner payload。

#### Scenario: 查看 archive detail
- **WHEN** 用户在 Command Center 展开 `/archive`
- **THEN** TUI SHALL 显示 owner、confirm grade、staged/disabled reason、preview/receipt requirement 和 result destination
- **AND** MUST NOT 暴露 owner preview 原始 payload

### Requirement: TUI SHALL 使用纯 update/render 与结构化 command draft
TUI shell SHALL 以纯 `update(state,event)` 产生新 state 与 side-effect commands，以纯 `render(state,width,height,projections)` 产生 frame。command flow SHALL 覆盖 conversation、slash-assist、command-center、argument、selector、confirm、destructive-confirm、dispatching、receipt 与 inspector。Raw args MUST 只在当前内存 state 中存在，并在 cancel/dispatch/session reset 后清理。

#### Scenario: Selector flow
- **WHEN** 用户选择 `/session` 并选中一个 owner-safe session ref
- **THEN** update SHALL 进入 session action selection，而不是直接假定 switch
- **AND** render SHALL 只显示 safe label/ref 与 capability-derived actions

#### Scenario: 连续 Escape 恢复原输入
- **WHEN** 用户从聊天草稿进入 Slash、command token、selector 和 detail
- **THEN** 连续 Escape SHALL 按 detail → selector → command token → 原 draft → conversation 返回
- **AND** raw selector query/ref SHALL 在退出对应 scope 后清理

### Requirement: 风险确认 SHALL 适配终端按键差异并 fail closed
safe command MAY 在参数完整时用 Enter dispatch。confirm command SHALL 默认焦点为 Cancel，并只接受明确 `y`、用户移动到 Confirm 后的 Enter，或官方宿主明确报告的 modified Enter。destructive command SHALL 要求 owner preview、receipt capability 和 owner-authored bounded confirmation phrase。初始裸 Enter MUST NOT 确认 non-safe command；stale、unknown、permission denied、preview missing 或 receipt unavailable MUST 拒绝 mutation。

#### Scenario: Compact confirm 默认取消
- **WHEN** 用户进入 `/compact` confirm 页面后直接按 Enter
- **THEN** TUI SHALL 取消/保持未提交状态
- **AND** 只有明确确认动作才可 dispatch

#### Scenario: Delete typed phrase
- **WHEN** `/delete` owner preview 要求 phrase `DELETE 9F3A`
- **THEN** 只有完整匹配 phrase 后 Enter 才可提交
- **AND** typed phrase MUST NOT 进入 receipt、Activity、replay 或日志

### Requirement: Receipt lane 与 Recent Activity SHALL 使用 durable lifecycle
TUI SHALL 在 input 区邻近位置显示 pending/success/failed/partial/stale/rejected receipt。pending SHALL 禁止同一 command draft 重复提交；success MAY 在 owner tick 或下一次输入后折叠；非成功 terminal/unknown 状态 SHALL 保持到用户处理。Recent SHALL 只读取 current session `command/run|done`，MUST NOT 创建第二日志或把 result 写入模型 transcript。

#### Scenario: 页面重建后恢复 Recent
- **WHEN** TUI shell 重建且 current session events 含 matching `command/run|done`
- **THEN** Recent SHALL 恢复 canonical command、status、safe summary 和 receipt/evidence ref
- **AND** transcript SHALL 不出现该 command result message

#### Scenario: Settlement unknown
- **WHEN** `command/run` 存在但 terminal owner event 不可确认
- **THEN** TUI SHALL 显示 pending/unknown 与 reconcile action
- **AND** MUST NOT 自动 retry 或标记 failed

### Requirement: 富结果 SHALL 通过安全 TUI Inspector renderer
TUI MAY 注册以 `schemaKey` 为键的 versioned result renderer。Renderer SHALL 只接收通过 strict schema 的 bounded projection并返回纯 Inspector model；MUST NOT 执行 command handler、fetch URL、读取 path 或修改 owner state。无 renderer 时 SHALL 使用 bounded safe text fallback；无 text 时命令保持 disabled+reason。

#### Scenario: Wide terminal 展示 Inspector
- **WHEN** viewport 至少 120 columns 且 result 有 TUI renderer
- **THEN** Inspector MAY 在右侧 detail region 展示，主 transcript 保持可见
- **AND** resize 到 80 columns SHALL 切为全屏 detail而不丢 selection/receipt

#### Scenario: 非法 renderer projection
- **WHEN** projection 含 unknown credential-shaped field、raw URL 或 absolute path
- **THEN** strict parser SHALL 拒绝 renderer input并显示安全错误
- **AND** frame、日志和 replay MUST NOT 包含该值

### Requirement: 默认键位 SHALL 可预测且不吞普通输入
默认键位 SHALL 支持 `Ctrl+K` toggle、Up/Down 与 `Ctrl+P`/`Ctrl+N` 导航、Home/End、Enter、Tab、Escape、PageUp/PageDown 和 Command Center Left/Right page。裸 `j/k` MUST NOT 默认绑定；`Ctrl+D` 只 MAY 在 receipt focus 关闭 receipt，idle 时归宿主 EOF policy。插件 MUST NOT 拥有 `Ctrl+C`、SIGINT 或 raw terminal quit policy。

#### Scenario: Tab 歧义前缀
- **WHEN** query 同时匹配多个安全 command
- **THEN** Tab MUST NOT 改写 query 或吞掉普通输入处理

#### Scenario: Ctrl+D 在 idle
- **WHEN** TUI shell 处于 conversation idle 且宿主收到 `Ctrl+D`
- **THEN** command shell MUST 返回 unhandled
- **AND** EOF/quit 行为 SHALL 由官方宿主决定

### Requirement: Renderer SHALL 对终端尺寸、颜色和字符集诚实退化
TUI SHALL 为 ≥120×30、80–119/20–29、60–79/14–19 与更小 viewport 提供 wide、standard、compact、minimal layout。Resize MUST NOT 改变 canonical state。状态与 selection MUST 同时用文字/shape 表达；`NO_COLOR` 和 ASCII fallback SHALL 完整可用。宽字符截断 MUST 按 terminal cell width。

#### Scenario: 60×20 compact flow
- **WHEN** viewport 为 60×20
- **THEN** Slash Assist SHALL 至多显示 4 行且 Inspector 使用单列分页
- **AND** input、active command、disabled reason/confirm status 和 receipt MUST 可达

#### Scenario: No-color terminal
- **WHEN** color disabled 或 terminal 不支持 ANSI color
- **THEN** warning/error/selected/disabled SHALL 仍通过 `[WARN]`、`[ERR]`、`>`、`disabled` 等文本可辨

### Requirement: Debug SHALL 可重放且不污染终端输出
TUI shell SHALL 可记录 redacted logical events并以固定 size 重放。允许字段限 logical key、resize、focus、directory/status revision、canonical command id、receipt status/ref、event/frame counter。Raw draft、args、prompt、provider payload、credential、private tool argument、absolute path 与完整 reasoning MUST NOT 记录。TUI 占用 terminal 时 debug/log MUST 写宿主 sidecar sink，不得写 stdout/stderr。

#### Scenario: Replay destructive flow
- **WHEN** debug replay 包含进入 `/delete`、phrase matched 与 owner receipt 的事件
- **THEN** replay MAY 记录 canonical command、gate transition 和 redacted receipt ref
- **AND** MUST NOT 记录用户输入的 confirmation phrase或 owner private preview

### Requirement: TUI contribution SHALL 保持宿主生命周期与兼容边界
插件 SHALL 继续通过 public command-console capability probe 注册，MUST NOT 读取 stdin、开启 raw mode、切换 alternate screen、捕获 signal 或自行恢复 cursor。现有 contribution、parser、controller 与 `:` alias SHALL 保持兼容；新 renderer/status/debug 字段 SHALL optional/additive。缺官方 seam 时 SHALL fail-closed，不宣称真实 TUI ready。

#### Scenario: 官方 seam 缺失
- **WHEN** `@deepseek-ai/dsh-client-tui` 不提供 required contribution/frame/input seam
- **THEN** bundle SHALL 不注册完整 shell并返回明确 missing capability
- **AND** 现有 local pure tests与 Web command experience SHALL 不受影响
