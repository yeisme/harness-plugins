## Context

Pane Workbench V4 已有 `PaneWorkspaceV1`、`PaneViewRegistry`、pinned/preview/overflow、原子 bulk close、拖拽、双 region 和安全 V2 布局持久化。`dsh-web-pane-experience-completion-v1` 正在让 Tier 0 Overlay 与 Tier 1 Core host 复用同一 `PaneRegionChrome`。缺口集中在大量 Tab 的管理入口、关闭历史、工作区范围固定、跨来源搜索和 provider-approved 恢复，而不是缺少第二套 workspace store。

公开面已经是 RC/experimental，但仓内消费者很多；本 change 仍按稳定合同处理，只做 additive 扩展。`pane.workspace.persisted.v2` 明确不保存正文、终端输出和 domain payload，因此历史与恢复必须使用独立 envelope、受限 UI state 和 opaque rendition ref。

## Goals / Non-Goals

**Goals:**

- Tier 0/1 使用同一个单行圆角 Tab Chrome 和 Pane 管理中心。
- 100% 复用现有 registry、workspace reducer、presentation metadata、keymap 与集成 runner。
- 大量 Tab 可通过搜索、筛选、多选、固定、安全批量关闭和历史恢复管理。
- 默认搜索纯本地安全 metadata；对话正文只在用户显式启用后调用 owner Host。
- 保持旧 `bulk_close` 与 V2 persistence 逐字兼容。

**Non-Goals:**

- 不实现云同步、第二 Pane store、浏览器侧对话索引或完整 DOM/终端 buffer 序列化。
- 不改变 host-owned split/dock 几何；Tier 0 继续诚实禁用相关能力。
- 不要求所有 provider 立即支持恢复；未声明能力的 provider 使用安全说明态。

## Decisions

### D1：管理中心是现有 Chrome 的共享 projection

新增 `PaneManagementCenter`，由 `PaneRegionChrome` 与 `OfficialOverlayPaneHost` 共用。`＋` 以 `open` mode 打开，“列表＋数量”以 `manage` mode 打开；组件读取同一个 controller/registry，不创建第二 workspace state。普通停靠态只有一行 Chrome，活动 Tab 承担标题，Pane 内容不得再由 chrome 重复渲染标题。

备选“独立全屏工作台”会制造上下文切换和第二状态 owner；备选“小 popover”容纳不了分组、筛选和批量操作，均拒绝。

### D2：本地索引复用 presentation 与 workspace snapshot

系统默认分组直接使用 `PanePresentationV1.group/task/owner/order/keywords`，缺失时按 kind/role 映射到稳定任务领域。已打开 Tab、历史和自定义分组由管理持久化适配器补充。空查询按收藏/最近/任务分组展示；有查询时按 exact、active/open、pinned、recent、available、history 排序。结果超过 50 项时只渲染可见窗口，本地候选有界为 200。

### D3：高成本对话搜索是可选 Host capability

新增 `PaneConversationSearchHostV1`，只接受安全 workspace/session refs、query、cursor 和 limit，返回 owner-authored title/snippet/ref。只有范围按钮或 `@conversation` 才调用；每页 20、单查询最多 100，输入变化立即 Abort。结果只存在于当前 React/controller 会话，不写 persistence、日志或 evidence。

没有 Host 时入口保持可见但禁用并显示 reason。客户端不得回退为扫描 DOM、日志或本地私有会话文件。

### D4：安全优先关闭通过新 intent 增量实现

保留 `bulk_close` 的全有或全无语义和测试。新增 `bulk_close_safe`：一次 reducer commit 关闭 `allow + clean + recoverable` 目标，并返回 closed/protected 分类；dirty、running、terminal、confirm/deny 保留。后续确认使用既有 `close_view` decision 路径，deny 永不强关。

这是 additive intent，不修改旧 enum 值含义，也不需要弃用窗口。

### D5：历史是独立、有限、可回滚的本地 envelope

新增 `pane.management.v1`（全局分组模板与工作区覆盖）和 `pane.closed-history.v1`（关闭批次）。历史每 scope 50 条、30 天，按最旧未固定记录淘汰。每个 entry 只保存安全 view spec、原 region/group/index、active/pinned 状态、最多 16KiB provider UI state 与 opaque rendition ref。

关闭批次支持 10 秒撤销与后续 Ctrl/Cmd+Shift+T；恢复优先原 group/index，不存在时走现有 smart placement。新 envelope 使用独立 key，旧 V2 读写完全不变。Host 暂无 workspaceRef 时 scope 标为 session；首次获得 workspaceRef 时只复制当前 session bucket 作为 seed，旧 bucket 保留用于回滚。

### D6：Provider 恢复是可选本地合同

`PaneViewRegistrationV1` 增加可选 restore descriptor；`PaneLocalViewProps` 增加当前 restore state、更新回调与失效信息。状态必须通过 `JsonValueSchema` 与 16KiB 限制，rendition 只保存 opaque ref。provider 卸载、资源删除或版本漂移时，若 owner 可解析 rendition 则显示缓存和状态横幅，否则显示说明 Pane及恢复/关闭动作。

旧 provider 不声明 restore 时保持 recreate/keep-alive 现状，无需修改。

### D7：快捷键只注册共享 keymap

Ctrl/Cmd+P、Ctrl/Cmd+W、Ctrl/Cmd+Shift+W、Ctrl/Cmd+Shift+T 经 command-experience keymap 面贡献；冲突时条目可见但禁用/可改键。组件内部只处理已聚焦的 Arrow/Home/End/Enter/Shift+Enter/Escape，不新增 document/window 裸监听。

## Risks / Trade-offs

- [当前 dirty change 同时修改 chrome/overlay] → 新 change 只在共享 chrome 稳定后接线；实现时逐文件保留现有 diff，不重置或替换。
- [恢复状态被 provider 滥用保存内容] → Json 安全校验、16KiB 上限、危险 key/path/URL 拒绝，正文和终端内容只能由 owner rendition ref 重新解析。
- [安全优先关闭与旧原子语义混淆] → 两个独立 intent、独立菜单文案和 contract tests；旧 intent 永不路由到新行为。
- [搜索结果过多导致卡顿] → 本地候选 200、有界窗口；conversation 分页、Abort 和显式启用。
- [工作区身份暂不可用] → UI 标明会话范围，不使用绝对路径或默认全局 bucket。

## Migration Plan

1. 先合入当前 Overlay/Core Chrome 共用路径。
2. 新增纯数据 planner、历史/管理 persistence 与兼容测试，不改变 UI 默认入口。
3. 接入 Pane 中心和单行 Chrome；Tier 0/1 使用同一组件。
4. 接入 keymap 和可选 Host capabilities；缺失路径验证禁用原因。
5. 运行 focused、package full gate 与 integration evidence。

回滚为恢复旧 Picker/Chrome 并回退包版本；新 envelope 无消费者时被忽略，旧 V2 和旧 `bulk_close` 继续工作。无弃用窗口。

## Open Questions

无。云同步、完整正文缓存与 browser-side conversation indexing 明确不在本 change。
