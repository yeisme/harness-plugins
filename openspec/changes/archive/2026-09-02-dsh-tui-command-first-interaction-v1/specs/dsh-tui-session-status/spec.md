# dsh-tui-session-status Capability

DSH TUI 当前 session 状态条与 `/status` Inspector，复用安全状态投影并对终端宽度、颜色与未知数据诚实降级。

## ADDED Requirements

### Requirement: TUI status SHALL 只消费 shared safe snapshot
TUI SHALL 消费 `session.status.snapshot.v1alpha1` 或其兼容后续 minor projection，MUST NOT 从 transcript length、process token ledger、balance amount、provider text、CLI human summary 或浏览器状态推导 context/limit。Snapshot unavailable 时 SHALL 显示 unknown/unavailable 与 safe reason。

#### Scenario: 只有 token usage ledger
- **WHEN** token usage history 可用但 context metadata 不可用
- **THEN** statusline SHALL 显示 `ctx ?`/unavailable
- **AND** MUST NOT 用累计 token usage 推算 context remaining

### Requirement: Statusline SHALL 按 lifecycle 与宽度收敛
Statusline SHALL 至少保留 current session safe label/ref、需要处理的 lifecycle 或 context state。Wide layout MAY 显示 model/reasoning/permissions 与最多一个 limit；standard SHALL 显示 session/lifecycle/context/model/permission；compact/minimal SHALL 只显示 session 与最高优先级状态。`waiting_approval`、`error`、`offline` SHALL 优先于普通 context。

#### Scenario: Approval 覆盖普通 context 文案
- **WHEN** lifecycle 为 `waiting_approval` 且 context remaining 为 88%
- **THEN** compact statusline SHALL 优先显示 `APPROVAL`
- **AND** `/status` Inspector SHALL 仍显示 context 88%

#### Scenario: 极窄终端
- **WHEN** viewport 小于 60 columns
- **THEN** statusline SHALL 保留 session short label 与 lifecycle/context highest-priority token
- **AND** MUST NOT 挤掉 input prompt 或产生水平滚动

### Requirement: `/status` SHALL 打开同一事实源的 TUI Inspector
`/status` SHALL 走正式 inspect lifecycle并打开 Status Inspector。Inspector SHALL 显示 session identity/lifecycle、runtime labels、context used/limit/remaining、最多 4 个 Provider limit window、freshness/source 与 safe next actions。结果 MUST NOT 注入模型 transcript。缺 visual Inspector seam 时 SHALL 返回 bounded safe text；缺 snapshot 时 SHALL 返回 unavailable reason。

#### Scenario: Statusline 与 Inspector 一致
- **WHEN** statusline 显示 `ctx 18% WARN`
- **THEN** `/status` Inspector SHALL 使用同 revision 显示 18% remaining 和 warning
- **AND** MUST NOT 发起第二套 context 计算

### Requirement: Context warning SHALL 非阻断且不自动 compact
remainingRatio 大于 0.25 时 SHALL neutral；在 `(0.10, 0.25]` 时 SHALL warning；小于等于 0.10 时 SHALL critical。若 `/compact` available，Status Inspector MAY 提供明确 action；阈值变化 MUST NOT 自动执行、自动确认或抢占 input。unavailable/unsupported SHALL 显示 unknown。

#### Scenario: Critical context
- **WHEN** remainingRatio 为 0.08 且 `/compact` available
- **THEN** statusline SHALL 显示 `CRIT`，Inspector SHALL 提供 `/compact` action
- **AND** 选择该 action SHALL 进入正常 confirm flow而不是直接 compact

### Requirement: Provider limits、balance 与 context SHALL 分开表达
每个 Provider limit SHALL 显示 owner label、remaining ratio、scope、reset time 与 status（若提供）。余额金额与 token usage history SHALL 仅通过现有 owner/detail入口展示，MUST NOT 换算为 quota remaining。缺 reset/ratio 时 SHALL 省略具体值并显示 owner safeMessage，MUST NOT 填 0/100% 或猜日期。

#### Scenario: 只有余额金额
- **WHEN** provider adapter 只提供 account balance，没有 quota window
- **THEN** Status Inspector MAY 提供 Tokens/Balance detail action
- **AND** limit row SHALL 显示 unsupported/unavailable，不得生成百分比

### Requirement: Status SHALL 在无色与 ASCII 模式下完整可读
状态不能只依赖 ANSI color、Unicode block 或 emoji。No-color/ASCII mode SHALL 使用 `[OK]`、`[WARN]`、`[CRIT]`、`[?]`、百分比和文本 reset time。Progress bar MAY 省略，但 exact bounded value和状态 SHALL 保留。

#### Scenario: ASCII fallback
- **WHEN** terminal 声明 ASCII/no-color
- **THEN** `Context [########--] 80%` 或 `Context 80% [OK]` SHALL 可读
- **AND** screen reader/line mode SHALL 获得等价文本

### Requirement: Status frame、日志与 replay SHALL 脱敏
Status frame、sidecar log、event replay、fixture 与 evidence MUST NOT 包含 raw prompt、provider payload、credential、Authorization/cookie/token、private tool args、absolute path、PID、raw URL 或完整 reasoning。Safe label/ref SHALL bounded；credential-shaped/unknown fields SHALL 被 strict parser 拒绝或丢弃。

#### Scenario: Unsafe provider field
- **WHEN** provider limit payload 包含 `apiKey`、`authorization`、`cookie` 或 raw URL
- **THEN** parser SHALL 将该 source 标为 unavailable或拒绝 snapshot
- **AND** frame/log/replay MUST NOT 出现其值
