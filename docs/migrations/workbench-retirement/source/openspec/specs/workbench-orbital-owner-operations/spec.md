# workbench-orbital-owner-operations Specification

## Purpose
TBD - created by archiving change workbench-orbital-owner-operations-v1. Update Purpose after archive.
## Requirements
### Requirement: Operations Orbit SHALL 提供可追溯的 Owner Pulse 与跨项目工作投影

系统 MUST 为项目 Owner 组合来源明确、授权裁剪的 Owner Pulse 以及可与表格逐项核对的跨项目工作图表。Pulse、图表与表格 MUST 使用 Task/Operation/Receipt 安全投影、source version 和 freshness，MUST NOT 以装饰性 KPI、零值或 synthetic success 替代不可用数据。

#### Scenario: Owner 数据过期或合同缺失

- **Given** Owner projection 超过 freshness 边界或缺少已验证合同
- **When** 用户查看 Orbit
- **Then** 对应项目/Owner 行 MUST 显示 `stale`、`needs_contract` 或 `degraded` 与来源原因
- **And** MUST NOT 显示为零阻塞、绿色健康或 production ready
- **And** 表格和图表 MUST 保持同一筛选范围和可追溯 source version

### Requirement: Task、Operation 与 Receipt SHALL 形成可恢复控制面视图

系统 MUST 提供 Task Board、Operation Table 和 receipt/evidence 视图，分别呈现授权的 Task 承诺、operation/attempt 状态和 receipt/evidence 安全摘要。视图 MUST NOT 传送 Owner raw payload、browser token、私有路径、artifact blob 或泛化 map。

#### Scenario: 操作结果未知接受

- **Given** 项目 mode 已提交 mutation，但控制面返回 `unknown_accept`
- **When** 用户从 Operation Table 或 receipt 视图打开该操作
- **Then** UI MUST 保留 Task、safe ref、receipt/status/reconcile 救援上下文
- **And** MUST 禁止自动重放原 mutation 或伪造 `cancelled`
- **And** 只有 reconcile 确认状态并且控制面允许时，才可显示用户确认的 retry

### Requirement: 所有 Context Actions SHALL 经过 project mode 唯一 mutation authority

系统 MUST 从 Orbit 全部入口生成统一、typed 的 Context Actions。任何 mutation MUST 经 project mode 的 Task/Operation/Receipt 控制面，并通过 permission、cost、expected-version、idempotency 和 approval gate；浏览器 MUST NOT 直接调用 Owner。

#### Scenario: 失效 safe ref 触发动作

- **Given** 用户从 Pulse、图表、Task、Operation、receipt 或深链接选择一个 safe ref
- **When** capability、版本、freshness 或授权检查失败
- **Then** 系统 MUST 返回 typed 救援状态并禁用不安全 mutation
- **And** MUST NOT 回退到 generic owner、动态 URL、raw map 或 browser token

### Requirement: Owner deep link 与 Agent proposal SHALL 是 typed 且有界的

系统 MUST 只解析已注册的 `OwnerDeepLinkV1`，并在打开前校验 owner/resource kind/safe ref/view/project ref 与当前授权。Agent proposal MUST 是只读的、可过期的 typed draft，不能直接发起 Task、Operation、审批或 Owner mutation。

#### Scenario: 未注册深链接或 Agent 建议

- **Given** URL 含未注册 owner/resource kind，或 Agent proposal 不含可见 basis refs
- **When** Workbench 解析该输入
- **Then** 系统 MUST 安全拒绝并返回 typed `not_found`、`permission_denied`、`contract_mismatch` 或 validation 状态
- **And** MUST NOT 猜测默认 Owner、读取 Owner 私有数据或执行建议

### Requirement: PaneLayoutV1 SHALL 通过 Registry 安全渐进升级 Dockview

系统 MUST 将 Orbit pane 以 `PaneLayoutV1` 和 Pane Registry 的已注册 kind/typed params 表示。Dockview MUST 作为受控 canary；当初始化、布局验证、注册解析、响应式或可访问性检查失败时，系统 MUST 使用受控 reducer/preset fallback 并保留安全上下文。

#### Scenario: Dockview 无法恢复布局

- **Given** 保存的布局含未知 pane、非法 params 或 Dockview 初始化失败
- **When** 用户打开 Orbit
- **Then** 系统 MUST 不渲染未知内容、不恢复任意 URL/props/payload
- **And** MUST 选择已注册 preset 的 reducer fallback
- **And** MUST 提示用户布局已安全恢复且不丢失当前可见的 receipt/Task 上下文

### Requirement: Orbit SHALL 在所有目标尺寸保持可访问且避免误导视觉

系统 MUST 支持 desktop、tablet 和 mobile 的受控布局。图表 MUST 有等价可筛选表格，状态 MUST 有文本且不只依赖颜色，所有 Context Actions MUST 有键盘与可见焦点路径。系统 MUST NOT 使用无标签图标、自动/不可暂停动效、低对比、桌面自由 docking 的移动端缩放版或将 stale/unknown_accept 呈为成功。

#### Scenario: 窄屏与辅助技术使用 Orbit

- **Given** 用户使用小于 768px 的 viewport 或键盘/屏幕阅读器
- **When** 打开含多个 Orbit panes 的布局并触发 `unknown_accept`
- **Then** 系统 MUST 呈现有序 stack/sheet 和可访问状态文本
- **And** 用户 MUST 能通过键盘定位 receipt、执行 reconcile 并阅读失败原因
- **And** 系统 MUST NOT 暴露不可操作的自由 docking 控制或仅颜色的成功状态
