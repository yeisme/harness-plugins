# dsh-session-status-center Capability

当前会话状态的 Host 安全投影与 Web 表面：Header capsule、Popover、details Pane、`/status`、context warning 和 Provider limit 诚实降级。

## ADDED Requirements

### Requirement: Host SHALL 提供版本化有界 session status 投影
Host SHALL 提供 `session.status.snapshot.v1alpha1`，至少包含 revision、generatedAt、freshness、overall status、safe session identity/lifecycle、context status/source/safeMessage 与 bounded Provider limits。runtime summary、token counts、remaining ratio 和 reset time SHALL 为 optional owner facts。`snapshot({ sessionRef })` MUST 校验 opaque safe ref；limits MUST 最多 4 条。

#### Scenario: 完整 owner 数据可用
- **WHEN** session、runtime、tokenMeter/context metadata 与 Provider limit projection 均可用
- **THEN** snapshot SHALL 返回 `status=ready`、context remaining 与 bounded limits
- **AND** 每个数值 SHALL 带对应 freshness/source 或明确 window metadata

#### Scenario: 只有 session facts 可用
- **WHEN** context 或 Provider limit source 缺失
- **THEN** snapshot SHALL 返回 `partial` 或 `unavailable` 子状态与 safeMessage
- **AND** MUST NOT 用 0、100% 或虚构 reset time 补齐

### Requirement: Context 与消费账本 SHALL 保持独立语义
context used/limit/remaining MUST 来自官方 tokenMeter/model context metadata 或明确 owner projection。Host MAY 对 owner 数值做有界纯算术归一化；Client MUST NOT 用 today/week/process token ledger、消息长度或本地 tokenizer 推断 context remaining。现有 token usage ledger SHALL 继续表示进程消费历史。

#### Scenario: Process usage 很高但 context source 缺失
- **WHEN** `tokenUsage.windows.process` 非零而 context projection 不可用
- **THEN** status center SHALL 显示 context unavailable
- **AND** MUST NOT 把 process usage 除以 model window 生成百分比

### Requirement: Provider limit 与余额 SHALL 保持独立语义
Provider limit window 只 SHALL 接受 owner-provided remaining ratio/resetAt/status/safeMessage。DeepSeek balance 或其他金额 MAY 通过现有 Tokens detail 展示，但 MUST NOT 被换算为周期 remaining ratio。stale/unsupported/unavailable MUST 文本可见且不只靠颜色。

#### Scenario: 只有余额金额
- **WHEN** DeepSeek balance ready 但无周期 limit window
- **THEN** status Popover SHALL 显示 limit unavailable 或省略该窗口并提供 Tokens detail
- **AND** MUST NOT 从金额计算 7-day remaining

### Requirement: Capsule、Popover 与 details Pane SHALL 共用一份 view model
`SessionStatusCapsule`、状态 Popover 与 `workspace.session-status` Pane SHALL 消费同一 snapshot/view model。Capsule SHALL 优先显示 waiting-approval/error/offline lifecycle，否则显示 context remaining；unknown MUST 使用 neutral tone。Popover SHALL 显示 current session、runtime summary、context、最多 2 个 limits 与最多 4 个 quick actions；Pane SHALL 显示全部 bounded details、freshness/source、Tokens 与 Activity 深链。

#### Scenario: Context ready 的普通会话
- **WHEN** lifecycle 为 idle/running 且 remainingRatio 为 0.88
- **THEN** Capsule SHALL 显示可读的“Context 88%”或本地化等价文本
- **AND** Popover SHALL 同时显示 used/limit 与 remaining 语义

#### Scenario: 等待审批优先
- **WHEN** lifecycle 为 `waiting_approval`
- **THEN** Capsule SHALL 优先显示需要审批而不是普通 context 文案
- **AND** 打开 Popover 后 context 数据仍 SHALL 可见

### Requirement: `/status` SHALL 使用同一事实源与表面降级链
`/status` SHALL 触发 owner inspect/command lifecycle，并打开与 Header 相同的 status view model。Header trigger 可用时 SHALL 打开 Popover；Header seam 缺失时 SHALL 打开 `workspace.session-status` preview Pane；Pane 也缺失时 SHALL 返回安全文本 result。执行 MUST 产生 durable command events，result MUST NOT 进入模型历史。

#### Scenario: 从 Composer 运行 /status
- **WHEN** 用户执行 `/status` 且 Header status trigger 可用
- **THEN** 系统 SHALL 打开状态 Popover并记录 command lifecycle
- **AND** Popover 数据 SHALL 与随后打开的 details Pane 一致

#### Scenario: 所有视觉 seam 缺失
- **WHEN** Header 与 Pane seam 均不可用
- **THEN** `/status` SHALL 返回 bounded safe text 与恢复原因
- **AND** MUST NOT 静默成功或伪造 UI

### Requirement: Context warning SHALL 渐进且非阻断
当 remainingRatio 大于 0.25 时 presentation SHALL neutral；在 `(0.10, 0.25]` 时 SHALL warning 并在 command availability 允许时建议 `/compact`；小于等于 0.10 时 SHALL critical。阈值变化 MUST NOT 自动 compact 或打开 blocking Modal。unavailable/unsupported SHALL neutral unknown。

#### Scenario: Context 低于 warning 阈值
- **WHEN** remainingRatio 为 0.20 且 `/compact` 可用
- **THEN** Capsule/Popover SHALL 显示 warning，Composer SHALL 可出现 `/compact` 建议
- **AND** MUST NOT 自动提交 compact

#### Scenario: Compact 不可用
- **WHEN** remainingRatio 为 0.08 但 owner 不提供 compact action
- **THEN** UI SHALL 显示 critical context 与不可用原因
- **AND** MUST NOT 显示可点击的假 Compact 动作

### Requirement: Status wire 与 DOM SHALL 严格脱敏
status projection、日志、DOM 与 evidence MUST NOT 包含 raw prompt、provider payload、credential、cookie/token、Authorization、private tool arguments、absolute path、PID、raw URL 或完整 reasoning。未知字段和 credential-shaped keys SHALL 被 strict parser 拒绝或丢弃；safe labels MUST 有长度界限。

#### Scenario: Provider adapter 返回 credential-shaped field
- **WHEN** limit payload 携带 `apiKey`、`authorization`、`cookie` 或 URL
- **THEN** Host SHALL 拒绝该 projection 或将该 source 标为 unavailable
- **AND** DOM、日志与 evidence MUST NOT 出现其值

### Requirement: 现有 Tokens surface SHALL 保持兼容
本 capability MUST NOT 删除、重命名或改变 `token-usage-open` 与 `workspace.token-usage` 的既有可用性语义。Status details MAY 深链或组合 TokenUsagePanel，但 token history/balance 的 canonical view model 仍由现有 package 拥有。任何未来移除旧入口 SHALL 由独立 breaking/deprecation change 管理。

#### Scenario: 新 status capability 未加载
- **WHEN** 用户只安装现有 token usage bundle
- **THEN** Tokens header entry、Pane/Modal fallback 与 balance refresh SHALL 继续按原 spec 工作

#### Scenario: 两个 capability 同时加载
- **WHEN** status 与 token usage 均 ready
- **THEN** status details MAY 提供 Tokens deep link
- **AND** MUST NOT 创建第二份消费账本或余额请求
