## Context

DSH 当前 AppFrame 只有 `sidebar | conversation | details` 三列和 frame-wide `shell.overlay`。Pane Workbench 的 reducer 已经能表达 Right/Bottom region、Tab、group、split、resize 与 maximize，但 React chrome 自己持有状态并只挂载一个 overlay；Desktop Workbench 还复制了一套会话侧栏。结果是布局 owner 与内容 owner 混在一起，overlay 无法遵守左栏边界，也无法与 Tool Details 做确定性的空间竞争。

本 change 跨两个独立子项目。DSH 只拥有 frame geometry 与 slot 生命周期；Harness Plugins 只拥有 pane canonical state、view registry 和 provider 组合。现有脏工作树中的 Plan、conversation 与其他 bundle 改动必须语义合并，不能重置。

## Goals / Non-Goals

**Goals:**

- 左侧 DSH sidebar 在 dock、sheet 与 maximize 下始终 mounted 且可见。
- 提供正式 Right/Bottom root slots 与单 owner、可订阅、可释放的 layout service。
- 让两个 React slot root 读取同一 Pane workspace store，并保留跨区域原子操作。
- 保留 `registerView()` / `openView()`，把 Desktop/Compose 迁移为 view provider 与打开入口。
- V1 安全迁移到 V2，卸载 bundle 后不保留 rail、尺寸或监听器。

**Non-Goals:**

- 不使用浏览器 Fullscreen API，不允许浮窗或拖入 sidebar。
- 不把 Tool Details、会话列表或领域业务状态迁入 Pane Workbench。
- 不引入第三方 docking runtime，不用 DOM selector、固定 sidebar offset 或全局 margin。
- 不恢复临时 maximize，不把窄屏 projection 写回 canonical pane tree。

## Decisions

### 1. DSH geometry service is additive and single-owner

新增 `ctx.workspaceLayout`，由 `WorkspaceLayoutController` 提供。`attach(ownerId, initialPreference)` 在同一时刻只允许一个 owner；重复 attach 立即抛错。句柄包含 `update()`、`getSnapshot()`、`subscribe()` 与幂等 `dispose()`。AppFrame 直接订阅同一 controller，因此 attach/dispose 会同步增加或移除布局预留，不需要扩展现有 `ctx.layout` 或让 Pane 读取 DSH 私有 store。

备选是在 `ctx.layout` 增加 Pane 方法；拒绝，因为这会扩大所有现有 layout fake 和 consumer 的兼容面，并混淆 core panels 与可卸载插件 surface。

### 2. AppFrame owns a pure two-dimensional solve

AppFrame 使用纯 solver 输入 frame 宽高、sidebar/details preference、workspace preference 与最后明确打开的辅助表面，输出四列两行 tracks 和每个 surface mode。Right 默认 480px、限制 360–840px 且不超过 sidebar 右侧区域的 60%；Bottom 默认 34%、限制 180px–65%；conversation floor 为 420×320px。

Right 关闭但 owner attached 时保留 44px rail；Bottom 关闭为 0。Right 与 Details 不足以并存时，最后明确打开者保留 dock，另一者派生为 rail/closed，但 preference 不被重写。任何活动 workspace 无法满足 conversation floor 时，solver 输出 `sheet`，workspace 覆盖 sidebar 右侧主区域。`maximized` 使用相同边界，并隐藏但不卸载 conversation、其他 region 与 Details。

备选是在 Pane CSS 中计算 `left`/`width`；拒绝，因为 sidebar 的真实 collapse/resize、Details concession 和 HMR 生命周期只有 AppFrame 知道。

### 3. Resize is committed through the layout handle

AppFrame 的 separator 统一处理 pointer capture、rAF preview、pointerup final commit 与 Arrow keyboard adjustment。Right 写回 px；Bottom 写回 frame-relative ratio。Pane controller 订阅句柄，将最终值投影回 canonical reducer state并保存。拖动期间只改变 frame visual state，不在每个 pointermove 重建 Pane tree。

### 4. Pane controller becomes the canonical external store

`PaneWorkbenchController` 持有 normalized `PaneWorkspaceV1`、reducer dispatch、registry orphan reconciliation、persistence 和 listeners。Right/Bottom `PaneRegionChrome` 使用 `useSyncExternalStore` 读取稳定 snapshot；两个实例只过滤各自 region，不复制 state。`openView()` 仍接受现有 request，并先展开 request 的 preferred/解析后 region。

跨 root 拖拽由一个 module/controller-scoped `PaneDragCoordinator` 保存 drag session 与 target。两边 chrome 订阅 coordinator；drop 只向 controller 提交一次既有 `move_view`、`reorder_view` 或 `split_with_view` intent，无效 target 仅清理 session。

### 5. V2 persistence excludes transient projection

envelope 改为 `pane.workspace.persisted.v2`。V2 保存 region visible/size、tree/group/tab/view 安全 metadata 与 active ids，但序列化时强制删除 `maximizedGroupId`。读取旧 `v1alpha1` 时走同一个 normalizer并清除 overlay/maximize 临时字段；未知 provider 恢复为 orphaned。domain payload、absolute path、terminal output、prompt 与 credential 继续禁止持久化。

### 6. Desktop and Compose only provide views and launchers

`dsh-desktop-workbench` 生产 apply 只通过 `ctx.paneWorkbench.registerView()` 注册文件、文档、媒体、历史搜索、通知与终端等本地组件，并提供打开入口；不再注册 `shell.overlay`。`dsh-workbench-compose` 移除 sidebar 内嵌工作台，只组合 provider/commands。会话浏览和会话操作继续由 DSH sidebar canonical owner 提供。

旧 `DesktopWorkbenchOverlay` 保留 deprecated export 一个 RC，供 story/迁移测试显式 mount，但 profile manifest 不再引用它。旧 DSH seam 不足时抛出含最低版本与缺失 service/slot 的 compatibility error。

## Risks / Trade-offs

- [两个独立 React root 的 pointer 生命周期更复杂] → drag session 放入单一 coordinator，window blur、pointer cancel、unmount 与 HMR 都清理；键盘/菜单提供完整等价路径。
- [Right、Bottom、Details 同时打开会频繁改变 projection] → preference 与 derived mode 分离，只在显式 open/resize 时改 canonical state；窗口恢复自动还原。
- [DSH 与 Pane 版本不匹配] → 提升 peer version，加载时 fail fast；禁止 overlay fallback，避免再次遮挡 sidebar。
- [现有 Desktop 组件假设自己拥有整页] → 先复用内容组件为 bounded Pane view，保留 deprecated shell 仅供测试，逐个移除 layout chrome。
- [脏工作树导致误覆盖] → 只 patch 已检查的目标 hunk，验证 diff，不执行 reset/stash/format-all。

## Migration Plan

1. DSH 发布带两个 slots、service、solver、tests 与 Agent Note 的 RC。
2. Pane bundle 提升 peer 要求，加载 V1 snapshot 到 V2 controller，生产注册改为两个 workspace slots。
3. Desktop/Compose 改为 provider/launcher，Web profile 删除 overlay entry。
4. 运行两个子项目 focused checks、full gates 和真实 `dsh --profile web --port 3802` 证据。
5. 一个 RC 后删除 deprecated overlay story export；历史 V1 OpenSpec 不改写。

回滚通过恢复上一 RC 的 DSH + Pane bundle/profile 组合完成。V2 不在运行时自动降级；卸载 V2 owner 会立即 dispose 两个 slot entry 和 AppFrame reservation。

## Open Questions

- Tool Details 未来若也迁入统一辅助 surface registry，可复用 priority 字段；本 change 保持其 canonical owner 与现有 `ctx.layout` API 不变。
- 浏览器外的其他 DSH client profile 是否采用 workspace slots，由对应 profile 后续单独声明；本 change 只要求 Web。
