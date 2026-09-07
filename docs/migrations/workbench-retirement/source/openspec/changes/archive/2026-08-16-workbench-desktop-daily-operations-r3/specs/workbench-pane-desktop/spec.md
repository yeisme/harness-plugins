## ADDED Requirements

### Requirement: Root desktop MUST own the business viewport

系统 MUST 通过 root `WorkbenchDesktop` 管理所有核心业务 Pane；Window chrome/navigation/Overview/Connections/Workspace/Task/Team/Diagnostics MUST 不再形成与 Pane 系统并行的独立业务页面状态。

#### Scenario: 打开 Overview 与 Task detail
- **WHEN** 用户通过导航或命令面板打开 Overview 和 Task detail
- **THEN** 两者 MUST 作为注册 PaneDocument 出现在 root Desktop
- **AND** 用户 MUST 能移动、分组、最大化、关闭并恢复它们

#### Scenario: 未知 Pane type
- **WHEN** route 或 layout 引用未知/不兼容 Pane type/version
- **THEN** Desktop MUST 打开安全 Diagnostics/Recovery Pane
- **AND** MUST NOT 执行任意 dynamic module、恢复未知参数或让整个应用白屏

### Requirement: Pane identity and instances MUST be versioned

每个 Pane MUST 使用版本化 PaneDocument、稳定 document key 与独立 PaneInstance；safe params MUST 只包含 tenant/workspace/owner/resource opaque refs 和受控 view mode。

#### Scenario: 重复打开 singleton document
- **WHEN** 同一 tenant/workspace 的 singleton PaneDocument 已存在
- **THEN** open action MUST 聚焦现有 PaneInstance
- **AND** 只有显式 `open copy` 才可创建新实例

#### Scenario: Layout 含敏感参数
- **WHEN** Pane params 包含 token、raw payload、private path、任意 URL 或未允许字段
- **THEN** serializer MUST 拒绝或清除该参数
- **AND** layout MUST NOT 被保存为有效 revision

### Requirement: Route and history MUST be deterministic

URL/history 与 Desktop state MUST 通过纯 reducer 单向同步，支持 deep link、refresh、back/forward，且 MUST NOT 产生 effect 循环或无意义 history entries。

#### Scenario: 浏览器后退
- **WHEN** 用户从 Asset detail 后退到 WorkItem detail
- **THEN** reducer MUST 聚焦/恢复对应 WorkItem Pane
- **AND** MUST NOT 重复 pushState、打开重复 Pane 或丢失其他 layout group

#### Scenario: 无权限 deep link
- **WHEN** deep link 指向当前 principal 无权限或其他 tenant 的 resource
- **THEN** Pane MUST 显示安全 permission/tombstone state
- **AND** URL/layout MUST NOT 泄露 resource metadata 或恢复旧缓存

### Requirement: LayoutService v3 MUST be canonical and conflict-safe

Layout MUST 由服务端 versioned LayoutService 按 tenant/principal/workspace/device/profile 持久化，并使用 expected revision、checksum、sanitization 和 recovery preset。

#### Scenario: Web 保存布局
- **WHEN** Dockview layout 在浏览器中发生有效变化
- **THEN** client MUST 通过 LayoutService expected revision/idempotency mutation 保存 canonical revision
- **AND** MUST NOT 把完整 layout document、Dockview JSON 或 Pane params 写入 localStorage 作为 canonical 或离线写队列

#### Scenario: 客户端伪造 principal scope
- **WHEN** Layout request 包含 principal、membership、role、allowed action 或其他浏览器提供的授权字段
- **THEN** 服务 MUST 拒绝未知字段或忽略它们并只使用 R1 server PrincipalContext
- **AND** 不得通过 request body、query、layout payload 或 Pane params 切换 authority

#### Scenario: Layout adapter 含敏感或不受控数据
- **WHEN** Dockview adapter payload 超过限制、嵌套过深、包含 token/cookie/credential/private path/raw payload key 或引用未注册 PaneDocument
- **THEN** sanitizer MUST 拒绝整个 draft 并返回稳定 `invalid_argument` 或 `layout_corrupt`
- **AND** 不得部分保存、记录原始 payload、回显敏感值或推进 revision

#### Scenario: 并发保存冲突
- **WHEN** 两个设备基于同一旧 revision 保存 layout
- **THEN** 第二个写入 MUST 返回 `layout_conflict`
- **AND** 客户端 MUST 保留未保存布局并提供 reload、save copy 或显式 overwrite rescue

#### Scenario: Layout 损坏
- **WHEN** canonical layout JSON、checksum 或 Pane schema 无法解析
- **THEN** 服务 MUST 保留损坏 revision并记录 recovery event
- **AND** Desktop MUST 加载安全 preset 而不是覆盖原记录或崩溃

#### Scenario: 导入 legacy localStorage
- **WHEN** 用户首次进入 Layout v3 且存在 legacy layout
- **THEN** 客户端 MUST 经过 allowlist sanitizer 后执行一次 shadow import
- **AND** 未知/敏感/不兼容字段 MUST 被拒绝，legacy layout MUST NOT 继续成为 canonical

#### Scenario: 两个标签页同时导入 legacy layout
- **WHEN** 两个标签页对同一 authority/profile 同时执行首次 import
- **THEN** stable idempotency 与 expected revision MUST 使最多一个 draft 成为 canonical revision
- **AND** loser MUST 重新读取 canonical revision，不得静默覆盖或删除尚未确认导入成功的旧值

### Requirement: Pane lifecycle MUST support maximize, fullscreen, suspend, and rescue

Pane MUST 支持可逆 maximize、受控 fullscreen、非活动 suspend、dirty/rescue 与可预测 focus restoration。

#### Scenario: Preview Pane 全屏后退出
- **WHEN** 用户将 Preview Pane 切换为 fullscreen 后按 Escape 退出
- **THEN** Pane MUST 返回原 Dockview group/position
- **AND** keyboard focus MUST 回到触发控件或 Pane header

#### Scenario: 已最大化 Pane 进入浏览器全屏
- **WHEN** Pane 在进入 browser fullscreen 前已经最大化
- **THEN** 退出 browser fullscreen 后 Pane MUST 保持最大化
- **AND** 不得因为 fullscreenchange 重复触发 Dockview maximize/restore

#### Scenario: 浏览器拒绝或不支持 Fullscreen API
- **WHEN** Fullscreen API 不可用或 `requestFullscreen`/`exitFullscreen` 被拒绝
- **THEN** Pane MUST 回到进入请求前的 Dockview 布局并给出可访问状态通知
- **AND** UI MUST NOT 显示伪 fullscreen 状态或锁死 maximize/close 控制

#### Scenario: 恢复 suspended Pane
- **WHEN** 非活动 Pane 被 suspend 后再次激活
- **THEN** Pane MUST 重新授权并刷新 source version/freshness
- **AND** MUST NOT 使用 tenant switch/revoke 前的 subscription 或敏感 cache

### Requirement: Desktop MUST be responsive and accessible

Desktop MUST 支持 desktop/tablet/mobile layout、keyboard equivalents、screen reader、200% zoom、reduced motion 与高对比度，不得把 drag/drop 作为唯一操作方式。

#### Scenario: Mobile workspace
- **WHEN** viewport 进入 mobile breakpoint
- **THEN** Desktop MUST 使用单活动 Pane stack 与可访问切换器
- **AND** 核心查看、审批、WorkItem 更新和 rescue MUST 可操作

#### Scenario: Keyboard-only layout operation
- **WHEN** 用户不使用指针移动/聚焦/最大化/关闭 Pane
- **THEN** 所有核心操作 MUST 有 keyboard command 与可见 focus
- **AND** screen reader MUST 获得 Pane title、state 和位置变化通知

### Requirement: Desktop performance MUST be bounded

Desktop MUST 对恢复 Pane、query/subscription、render 和 interaction 设置预算，并通过 suspend、dedup、pagination/virtualization 避免随 Pane 数量线性放大请求和内存。

#### Scenario: 恢复 20 个 Pane
- **WHEN** production-like layout 恢复 20 个混合 Pane
- **THEN** 相同 query MUST 被 deduplicate，非活动重 Pane MUST 可 suspend
- **AND** startup/interaction/memory MUST 满足批准的 performance gate

### Requirement: Desktop contracts MUST keep transport parity

Pane/Layout profile、revision、preset、conflict、recovery 和 allowed actions MUST 在 HTTP、gRPC、JSON-RPC 与 TypeScript SDK 中保持同一模型与错误语义。

#### Scenario: Layout parity test
- **WHEN** contract suite通过四 transport create/get/update/save-copy/reset layout
- **THEN** revision/checksum/conflict/error MUST 一致
- **AND** 任一 transport MUST NOT 返回 token、raw Dockview unknown params 或 private path

### Requirement: Layout event streams MUST be resumable, authority-bound, and bounded

Layout watch MUST 在 HTTP SSE、gRPC stream、JSON-RPC stream 与 TypeScript SDK 中使用相同的 source cursor、event id、heartbeat、retention gap、reset/resync 和 terminal error 语义。每个订阅 MUST 绑定 tenant、workspace、principal 与 session revision，并对 slow consumer、连接数、缓冲区和 drain deadline 设置上限。

#### Scenario: 连接中断后恢复

- **WHEN** client 已确认 cursor `N` 后连接中断并使用该 cursor 重连
- **THEN** service MUST 从 `N` 之后重放仍在 retention 内的 committed events
- **AND** client MUST 能以 `(source, cursor, event_id)` 收敛重复事件而不重复应用 layout mutation

#### Scenario: Cursor 已超出 retention

- **WHEN** resume cursor 早于当前可重放窗口或 event history 存在不可证明的 gap
- **THEN** service MUST 返回 typed `resync_required` 与安全的 latest profile/revision hint
- **AND** client MUST 重新读取 canonical Layout snapshot，不得猜测或伪造缺失事件

#### Scenario: Authority 被撤销

- **WHEN** tenant switch、session revision 变化、membership revoke 或 logout 使订阅 authority 失效
- **THEN** server MUST 在批准预算内终止旧订阅，client MUST 清除旧 authority query/layout cache
- **AND** reconnect MUST 以新的 server session context 授权，不能复用旧 bearer、cookie-derived credential 或 cursor lease

#### Scenario: Slow consumer 与服务 drain

- **WHEN** subscriber 无法在缓冲预算内消费或实例进入 drain
- **THEN** server MUST 以 typed retry/resume hint 关闭该流，不得无限缓冲或阻塞 layout writer
- **AND** readiness MUST 反映 broker/retention 状态，shutdown MUST 在 deadline 内释放 subscription lease
