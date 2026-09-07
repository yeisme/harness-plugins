# workbench-eikona-independent-client Specification

## Purpose
TBD - created by archiving change workbench-eikona-independent-client-v1. Update Purpose after archive.
## Requirements
### Requirement: 客户端 MUST 通过单一 Workbench typed facade 消费 Eikona

Eikona 独立客户端 MUST 通过 `WorkbenchClient` 暴露的 typed design/task/owner facade 读取能力、资源、事件、错误与 receipt。浏览器 MUST NOT 直连 Eikona、持有 owner credential、解析 human CLI output、读取 owner 私有路径或复制 Eikona 状态机。

#### Scenario: 浏览器执行 Produce 查询
- **WHEN** 用户进入项目的 Produce 工作区
- **THEN** 浏览器 MUST 仅请求同源 Workbench BFF/服务接口
- **AND** 页面 MUST 从 typed response 渲染，不接收绝对路径、credential、raw prompt 或 provider payload。

### Requirement: Shell MUST 使用实例与项目上下文驱动稳定路由

客户端 MUST 以 `/i/:instanceId/p/:projectId/*` 作为 Eikona 资源路由前缀，并从 authoritative instance/project API 获取上下文。切换上下文 MUST 取消旧查询并清除 selection、bulk selection、inspector resource 与未提交 operation preview。

#### Scenario: 跨项目切换
- **WHEN** 用户从一个项目切换到另一个项目
- **THEN** 客户端 MUST 失效旧项目查询并清除项目级临时状态
- **AND** MUST NOT 将旧项目资源 ID 带入新项目命令或 deep link。

#### Scenario: 实例不匹配的 deep link
- **WHEN** deep link 的 instanceId 与当前实例不同
- **THEN** 客户端 MUST 显示显式切换实例操作
- **AND** MUST NOT 在当前实例中用相同资源 ID 猜测或搜索。

### Requirement: 四工作区 MUST 由 capability classification 决定可用性

客户端 MUST 提供 Produce、Decide、Reuse 与 Deliver / Operate 四个工作区，并按 `available_rest`、`available_sdk`、`available_event`、`cli_fallback`、`planned`、`unsupported`、`unavailable` 或 degraded 状态展示动作。只有 available 与 CLI fallback 动作可进入命令面板；planned MUST NOT 被伪装为可执行能力。

#### Scenario: planned 动作
- **WHEN** capability descriptor 将动作标记为 planned
- **THEN** 页面 MUST 显示依赖合同与 planned 状态
- **AND** 命令面板 MUST NOT 将该动作列为可执行命令。

#### Scenario: CLI fallback 动作
- **WHEN** 动作仅有批准的 CLI fallback
- **THEN** 客户端 MUST 打开命令预览/复制对话框并说明需在终端执行
- **AND** MUST NOT 发起远端 mutation 或显示成功 receipt。

### Requirement: Produce MUST 保留 plan、receipt 与 event 恢复语义

Produce MUST 覆盖 Draft、Validate、Plan、Submit、run list/detail、events、cancel、retry preview、retry 与 recovery。提交、取消和重试 MUST 以 expected version 与 idempotency 协调，并在 receipt 未确认前保留最后 authoritative state。

#### Scenario: plan 失效
- **WHEN** draft、project、capability digest 或 binding version 在 plan 后变化
- **THEN** 客户端 MUST 将 plan 标记为 stale 并禁用 Submit
- **AND** 用户 MUST 重新 Validate 与 Plan 后才能提交。

#### Scenario: event cursor 过期
- **WHEN** event API 返回 cursor expired
- **THEN** 客户端 MUST 先读取 run detail 获取恢复位置，再从 recovery cursor 继续
- **AND** MUST NOT 静默从头重放或把事件耗尽解释为 run 完成。

#### Scenario: exact mutation retry
- **WHEN** 用户或网络重放同一 submit/cancel/retry mutation
- **THEN** 客户端 MUST 复用原 idempotency identity 并观察同一 receipt
- **AND** MUST NOT 乐观创建第二个 run 或伪造 owner 已接受。

### Requirement: Decide MUST 分离机器建议、人类决定与下游 admission

Decide MUST 显示 candidate comparison、review evidence、machine suggestion、human decision 与 downstream admission 的独立状态。v1 中未 available 的决定 mutation MUST 保持 planned 或 CLI fallback，不能将 accepted 显示为 production-ready。

#### Scenario: 人类评审仅有 CLI fallback
- **WHEN** review decision mutation 尚未由 Workbench registry seal
- **THEN** DecisionBar MUST 只提供批准的复制命令或 planned 状态
- **AND** 页面 MUST 保留 read-only evidence，且 MUST NOT 生成远端 decision receipt。

### Requirement: Reuse 与 Deliver / Operate MUST 保留资源类型和安全修复状态

Reuse MUST 区分 run artifact、Visual Library item、collection、theme、memory 与 recipe；Deliver / Operate MUST 区分 handoff decision、destination admission、grant、diagnostics 与 settings scope。不可用 mutation MUST 保持 planned，已过期 grant MUST 保留稳定 artifact identity。

#### Scenario: 下载授权过期
- **WHEN** artifact preview 或 download grant 过期
- **THEN** 客户端 MUST 保留 artifact metadata 并提供授权范围内的 Refresh access
- **AND** MUST NOT 把 artifact 显示为 deleted 或循环刷新无权限授权。

#### Scenario: 下游拒绝 handoff
- **WHEN** destination 拒绝 admission
- **THEN** 客户端 MUST 保留 Eikona accepted decision 与 handoff evidence
- **AND** MUST 将 correction 或 alternate destination 显示为独立 planned/available action。

### Requirement: 全局状态与错误 MUST 安全、可恢复且不只依赖颜色

Loading、empty、offline、reconnecting、permission、contract mismatch、conflict、partial failure、grant expiry 与 receipt pending MUST 使用文本、图标和 stable error data 表达。页面 MUST 显示 safe message、affected resource、retryability、correlation ID 与可用修复动作，并对敏感资源使用 existence-hiding 文案。

#### Scenario: major contract mismatch
- **WHEN** Workbench 与 Eikona contract major 不匹配
- **THEN** 客户端 MUST 显示 expected/actual version 与诊断入口并禁用全部 mutation
- **AND** MUST NOT 探测 legacy route 或泄露 owner endpoint。

### Requirement: Shell MUST 支持键盘、响应式与无障碍降级

客户端 MUST 支持 command palette、visible focus、overlay focus trap/return、reduced motion 与 desktop/tablet/mobile 三档布局。Desktop `>=1280px` 可使用三栏；tablet 使用 Sheet；mobile MUST 保留 run observation、单候选 review、诊断与 handoff readiness，并将复杂 mutation 降为只读。

#### Scenario: 键盘命令面板
- **WHEN** 用户按下 `Ctrl/Meta+K`
- **THEN** palette MUST 打开并仅列 available 与 CLI fallback 动作
- **AND** `Escape` MUST 关闭 overlay 并把焦点返回触发器。

#### Scenario: mobile run detail
- **WHEN** viewport 小于 768px
- **THEN** run detail MUST 使用单栏/cards 与底部 inspector Sheet
- **AND** MUST NOT 通过缩小字号或自由 Dockview 模拟桌面三栏。

### Requirement: 浏览器与合同证据 MUST 覆盖关键失败路径

fixture、component 与 Playwright 测试 MUST 覆盖主生产循环、validation blocked、stale plan、partial failure、cursor expiry、offline dirty draft、review fallback、promotion/receipt、handoff、permission、contract mismatch、grant expiry、instance mismatch、responsive 与 accessibility。测试证据 MUST 脱敏并写入项目规定的 per-run 目录。

#### Scenario: 浏览器验收运行
- **WHEN** Eikona independent client e2e 运行
- **THEN** 运行 MUST 写入 `temp/integration-test-runs/<run-id>/` 六件套和截图/trace artifacts
- **AND** serious/critical accessibility issue、绝对路径、Authorization、provider payload、raw prompt 或 signed URL MUST 使 gate 失败。
