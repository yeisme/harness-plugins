## Context

当前 Web AppFrame 同时维护两类右侧辅助表面：DSH `details` 列由 `ctx.layout` 和 conversation selection store 驱动，Pane Workbench Right/Bottom 则由 `ctx.workspaceLayout`、`PaneWorkbenchController` 和 view registry 驱动。两者拥有不同的宽度、打开、关闭、会话切换、Tab 与 responsive 行为，因此用户会看到两个外观和生命周期都不一致的“侧边栏”。

代码 owner 仍然分离：DSH 拥有 AppFrame、`details` occupant、Tool selection 与 slot 生命周期；Harness Plugins 拥有 Pane canonical layout、registry、chrome 与 provider 组合。统一不能把 DSH conversation store 复制进插件，也不能让 DSH core 依赖 Yeisme package。解决方案必须只增加双向的本地适配合同。

受影响稳定面包括：`ctx.workspaceLayout.attach()`、Right/Bottom slot owner props、`ctx.paneWorkbench.registerView/openView`、`PaneLocalViewProps` 和 `ctx.layout.openDetails/closeDetails` 的可观察行为。依据演进策略，本 change 采用 expand-then-contract，不在同一 RC 删除旧 `details`。

## Goals / Non-Goals

**Goals:**

- Pane Workbench 成为唯一正常生产 Core Pane，Tool Details 与生态视图共享 registry、controller、Tab/group、Right/Bottom、a11y 和 teardown。
- 保留 DSH 对 Tool selection、Details React occupant 与具体输出渲染的 canonical ownership。
- 未安装 Pane Workbench、旧版本插件或 adapter attach 失败时，DSH 继续使用现有 `details` 列。
- 为后续 Plan、File、Terminal、Git、Browser、Creator、Ordo 等 provider 固化唯一扩展入口，禁止新增第二 sidebar、overlay workbench 或 domain pane store。
- 迁移期间不丢用户领域数据，不要求重写既有 provider，不改变 `registerView()` / `openView()` 的现有调用。

**Non-Goals:**

- 本 change 不删除 `details` slot、`LayoutController.openDetails/closeDetails` 或 legacy geometry；删除动作必须在下一 RC 另开 change。
- 不把 conversation selection、tool result、terminal output 或 raw provider payload写入 Pane state/persistence。
- 不让远端 projection 下发 React component、slot name、module URL 或任意 core view id。
- 不修改 Tool Details 的内容设计、Input/Output presenter 或工具结果数据模型。

## Decisions

### 1. Core Pane 是 Pane Workbench 的内置 provider，不是第三套系统

Pane Workbench apply 时用现有 `PaneViewRegistry` 注册 `dsh.tool-details`：`role=inspector`、`preferredRegion=right`、`singleton=true`。它和生态 view 使用相同 `open_view` / `close_view` intent、Tab chrome、split/move/maximize 和 error boundary。

注册记录新增可选 `showInPicker`，默认 `true`。`dsh.tool-details` 设置为 `false`，因此只能由 DSH owner 的显式 tool inspect/open 动作打开，不能从通用 provider picker 创建一个没有 selection 的空实例。该字段属于本地注册信息，不进入远端 Pane protocol。

替代方案是在 `PaneRegionChrome` 对 Tool Details 写特殊分支；拒绝，因为这会绕过 registry 并让下一种 core view 再复制一条路径。

### 2. DSH 通过可选 Core Pane host adapter 路由，不依赖 Yeisme package

`ctx.workspaceLayout.attach(ownerId, preference, corePaneHost?)` 增加可选第三参数：

```text
WorkspaceCorePaneHost {
  open(id: 'dsh.tool-details'): void
  close(id: 'dsh.tool-details'): void
}
```

`WorkspaceLayoutController.openCorePane/closeCorePane` 只接受 DSH 定义的封闭 core id。`LayoutController.openDetails()` 先调用 `openCorePane('dsh.tool-details')`；存在 adapter 时由 Pane Workbench 打开 singleton view，不再增加 legacy details width。不存在 adapter 时继续调用原有 layout store action。`closeDetails()` 使用同样回退顺序。

现有两参数 `attach()` 与所有 layout fake 保持有效。Snapshot 新增 `corePaneHostAttached`，供 AppFrame 派生是否需要 legacy details geometry；旧字段 `auxiliaryPriority` 保留一 RC 并标记 deprecated。

替代方案是让 `ui-conversation` 直接 `ctx.get('paneWorkbench')`；拒绝，因为这反转了 DSH core 到 Yeisme 插件的依赖方向，也让无插件 profile 需要理解第三方 service。

### 3. Details 内容通过 owner-authored render callback 进入本地 Core view

Right/Bottom workspace slot owner props 增加 `renderCoreView(id)` 本地 callback。AppFrame 对 `dsh.tool-details` 返回既有 `renderSlot('details', {})`，未知 id 返回 `null`。Pane chrome 把 callback 结果作为新增的 `PaneLocalViewProps.hostContent` 交给已注册的本地 component factory。

只有活动 `dsh.tool-details` view 会调用 renderer，所以同一 `details` occupant 不会同时挂载在 legacy column、Right 与 Bottom。Tool Details Tab 被移动到 Bottom 时仍使用同一 callback 和 selection store，不复制数据。

替代方案是把 Tool result projection复制到插件后重新实现 Details；拒绝，因为会制造第二个 tool presentation owner，并扩大敏感 payload 边界。

### 4. Legacy Details 是兼容回退，不再参与正常空间竞争

当 `corePaneHostAttached=true` 时，AppFrame：

- 向 geometry solver 传入 `details=0`；
- 不在独立 `DetailsColumn` 挂载 `details` occupant；
- 将 renderer callback交给两个 workspace slot；
- session 切换时通过 `closeCorePane('dsh.tool-details')` 关闭 Core Tab。

当 host 未 attach 时，现有 details width、column、close button 与 session lifecycle 原样工作。这样同一 build 可以兼容旧 profile、旧 Pane bundle 和卸载/HMR。

### 5. Core view 生命周期不进入通用 launcher，也不保存业务内容

Core Tool Details view 使用 stable singleton resource key `core:dsh.tool-details`，只保存 kind、Tab title 与布局位置；实际 selection、args 与 output 始终从 DSH `details` occupant读取。通用 persistence 继续不保存 metadata/content。插件启动和每次会话同步都会清理恢复出的 stale Core Tool Details，AppFrame 的 session lifecycle 也会通过 host adapter 显式关闭该 view，保持现有 Details 不跨 reload/session 的语义。

### 6. 后续扩展只允许一条生产路径

所有新侧栏/底栏能力必须：

1. 注册到 `ctx.paneWorkbench.registerView()` 或 `registerPlugin()`；
2. 通过 `openView()` / typed intent 打开；
3. 使用共享 controller 与 Right/Bottom host；
4. 不占用 `sidebar`、`details`、生产 `shell.overlay`，不创建第二 Pane reducer/store。

兼容 story export 可保留，但 profile manifest 和生产 apply 不得引用。

## Risks / Trade-offs

- [Pane bundle 与 DSH seam 版本不匹配] → `REQUIRED_LAYOUT_VERSION` 提升；缺少 core adapter 或 renderer callback 时明确失败，不静默回到双侧栏组合。
- [Details React subtree 跨 slot root 移动时重挂载] → 业务 selection 在 DSH external store，Core view 不持有 canonical tool data；测试验证 Right/Bottom move 后内容仍来自同一 owner。
- [adapter 卸载时 Details 正在打开] → handle dispose 先解除 core host，再恢复 legacy fallback；不自动打开 legacy column，用户下一次 inspect 才进入回退路径。
- [旧 consumer 依赖 `auxiliaryPriority`] → 字段保留一 RC并标记 deprecated；当前 change 不删除、不改类型。
- [Core view 出现在通用 picker] → 本地 registration 增加 `showInPicker=false` 并用 picker test固定。
- [两个 React root 同时调用 renderer] → 仅 active view host调用；同一 view instance只能属于一个 region，component test验证单 mount。

## Migration Plan

1. 在 Harness Plugins 增加 Core view registration、`hostContent` 与隐藏 picker支持，保持现有 provider API不变。
2. 更新 `pane-workspace-layout` upstream staging：可选 adapter、renderer callback、AppFrame Core/legacy分支和 focused tests。
3. Pane bundle 提升 DSH layout peer floor，并在 attach 时传入 Core host adapter。
4. 运行 Pane package tests/typecheck/build、bundle conformance、上游 patch apply/focused tests与 OpenSpec strict validation。
5. 发布一个兼容 RC：Core Pane 为主路径，legacy Details 只在 host 缺席时回退；文档标记独立 Details geometry deprecated。
6. 下一 RC 根据 consumer/telemetry/evidence另开 removal change，才允许删除独立 Details column与 `auxiliaryPriority`。

回滚方式：恢复上一版 `@yeisme/dsh-pane-workbench` 和上一版 DSH layout patch。由于 legacy `details` slot、store action和geometry仍存在，回滚不需要转换 Pane persistence或领域数据。

## Open Questions

- 下一 RC 删除 legacy Details geometry前，需要确认是否存在未安装 Pane Workbench但仍要求 Tool Details 的官方 Web profile；若存在，继续保留回退。
- 后续其他 DSH core auxiliary view 是否加入封闭 `WorkspaceCorePaneId`，必须逐项新增并提供 owner renderer，不接受任意字符串或远端注册。
