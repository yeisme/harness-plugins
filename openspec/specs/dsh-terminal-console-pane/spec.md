# dsh-terminal-console-pane Specification

## Purpose
TBD - created by archiving change dsh-web-pane-terminal-sidechat-v1. Update Purpose after archive.
## Requirements
### Requirement: Terminal console SHALL 以官方 `ctx.terminals` 为唯一 PTY owner
终端 console 的 Host 侧 MUST 通过对官方 `ctx.terminals` 服务的结构化探测获取 PTY 能力，且 MUST NOT 在插件内创建 PTY 进程、实现第二套 PTY 注册表或绕过官方 owner-scoped 合同。`ctx.terminals` 缺席时 Host 侧 MUST 以 typed `service_unavailable` 应答所有会话方法。

#### Scenario: 官方 terminals 服务缺席
- **WHEN** Host 运行环境没有 `ctx.terminals`（DSH < 0.1.1-rc.2）
- **THEN** `terminalPane.probe` 返回 `serviceAvailable: false`
- **AND** `list/spawn/read/send/signal/close` 一律返回 `service_unavailable`，不抛未捕获异常

#### Scenario: 官方服务形状漂移
- **WHEN** `ctx.terminals` 存在但缺少合同要求的任一方法
- **THEN** `probe` 返回 `serviceAvailable: false` 且 `reason` 以缺失方法列表指明 contract mismatch
- **AND** 会话方法返回 `service_unavailable`

### Requirement: 所有 terminal 操作 SHALL 解析目标 session 的 live Agent 作为 owner
`spawn/list` MUST 以 `ctx.agents.get(sessionId)` 解析 owner；解析失败 MUST 返回 typed `session_not_live`。`read/send/signal/close` MUST 校验请求中的 sessionId 即该终端的 owner session，不匹配时返回 `not_owner`。

#### Scenario: 附着到已退出 session 的终端
- **WHEN** 终端由 session A 的 agent 创建，浏览器以 session B 的身份请求 `read`
- **THEN** 返回 `not_owner`，不泄露该终端的滚回内容

#### Scenario: spawn 时 session 不 live
- **WHEN** `spawn` 携带的 sessionId 没有对应 live agent
- **THEN** 返回 `session_not_live`，不创建终端

### Requirement: 浏览器投影 SHALL 是有界且脱敏的
Remote 出参 MUST 限定为：opaque `terminalId` 字符串、显示名、backend type、session status（running/exited+exitCode/signal）、有界滚回文本与分页元数据、send 结果的 viewport/waitReason/truncated。MUST NOT 透出 cwd、环境变量、进程参数或宿主文件系统细节。单次 `read` 行数与 `send` 等待 MUST 有显式上限。

#### Scenario: read 分页上限
- **WHEN** 客户端请求 `count` 超过合同上限
- **THEN** Host 按上限裁剪并在结果中如实标注 `lineBegin/lineEnd/truncated`

### Requirement: Console 视图 SHALL 事件驱动刷新且诚实降级
Console 视图 MUST 在绑定 session 的 ConversationSnapshot 变化（新 terminal 工具调用完成）时重读滚回，MUST NOT 使用定时轮询刷新。`terminalPane` Remote 或官方 terminals 能力缺席时，视图与 `/terminal` 命令 MUST 呈现禁用态与可读原因，MUST NOT 渲染占位输出或伪输入回显。

#### Scenario: 能力缺席的禁用态
- **WHEN** `probe` 返回 `serviceAvailable: false`
- **THEN** console 视图显示禁用原因（需要带 terminals 能力的 DSH）且不渲染任何终端内容
- **AND** `/terminal` 命令入口禁用并给出同一原因

#### Scenario: send 进行中的输入锁定
- **WHEN** 一个 `send` 尚未 settle
- **THEN** composer 输入禁用并提示单 send 保留语义；再次 send 被拒绝为 `send_active` 时 UI 如实展示

### Requirement: bundle 装配 SHALL 单行可逆且双 face 完整
`@yeisme/dsh-terminal` bundle MUST 以 `cordis.patch.yml` 单行 insert 登记（host face 组合 `@yeisme/dsh-terminal-host`，client face 于 `./client`），MUST 保留既有 `module.ts` workbench-core 声明与 `TerminalHostV2` 探针路径不删除不降级。

#### Scenario: 干净 profile 上安装
- **WHEN** `dsh plugin --profile web add @yeisme/dsh-terminal`
- **THEN** host 行加载 terminalPane Remote，client 行注册 `dsh-terminal.console` 视图与命令
- **AND** 既有 xterm/TerminalHostV2 探针行为与安装前一致

### Requirement: send 等待 SHALL 有界并按官方取消语义收敛
Remote `send` MUST 在有界等待上限内返回；触顶时 MUST 经官方 send operation 的取消路径（SIGINT 前台进程组）收敛并在结果中如实标注 `cancelledByWaitTimeout`，MUST NOT 遗留未 settle 的 active send（后续发送不得因残留 `send_active` 被永久阻塞）。

#### Scenario: 长驻前台命令触顶
- **WHEN** 用户发送一个 60s 上限内不回到就绪态的命令
- **THEN** `send` 在上限附近返回，结果标注 `cancelledByWaitTimeout`
- **AND** 紧随其后的下一次 `send` 不因残留 send 保留被拒绝

#### Scenario: 正常就绪返回
- **WHEN** 前台命令在等待上限内回到 stdin_read/inferred_idle
- **THEN** `send` 返回官方 waitReason，不带取消标注

### Requirement: Client contribution SHALL 与 Host wire 逐字段对齐
浏览器侧 `$mount` contribution MUST 为 `terminalPane` 的每个方法提供严格 descriptor：入参 codec 校验必填字段、结果 codec 以封闭失败码集合判别；contribution 的方法集 MUST 与 Host `terminalPaneRemoteMarkers` 一致，漂移 MUST 被包测试钉住（wire-parity）。

#### Scenario: host 新增方法而 contribution 未跟
- **WHEN** Host remote 标记集与 client contribution 方法集不一致
- **THEN** wire-parity 测试失败（构建门红），不允许静默漂移发布

#### Scenario: 结果 codec 拒绝未知失败码
- **WHEN** Host 返回 contribution 封闭集合之外的 `code`
- **THEN** client 侧 parse 抛错（传输层失败呈现），MUST NOT 把未知码当作 ok

### Requirement: 视图与命令文案 SHALL 提供 zh/en 并支持 locale 回退
Console 视图与 `/terminal` 命令的文案 MUST 经 `locale.register(ns, tables)` 注册 zh/en 双表；locale 服务缺席或键未命中时 MUST 回退 en 内建表；带参文案 MUST 以命名插值呈现（如滚回行号）。

#### Scenario: 无 locale 服务的宿主
- **WHEN** client 激活时 `locale` 服务不可用
- **THEN** 视图与命令文案使用 en 内建表，注册零副作用

#### Scenario: zh 环境的禁用原因
- **WHEN** locale 绑定命中 zh 表且能力缺席
- **THEN** 禁用态展示中文原因（含 DSH 版本指引），插值参数正确渲染

