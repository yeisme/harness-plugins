# @yeisme/dsh-client-ui-pane-workbench

Yeisme 的 DSH 双区域 Pane Workbench client。生产插件通过官方
`shell.workspace.right` 与 `shell.workspace.bottom` slot 挂载两个 React root，二者以
`useSyncExternalStore` 读取同一个 `PaneWorkbenchController`。DSH AppFrame 拥有尺寸、
Sheet、Tool selection 与具体 Details 内容；本包拥有唯一 Core Pane 的 registry、
Pane tree、Tab/group、选择、拖拽和安全视图元数据。

生产路径不会注册 `shell.overlay`，不会覆盖 DSH 左侧会话栏，也不会读取或 patch Web
Shell DOM。旧 `PaneWorkbenchChrome` / `PaneWorkbenchLauncher` 仅作为一个 RC 的 story 与
迁移测试兼容导出。

## 开发

```bash
pnpm --filter @yeisme/dsh-client-ui-pane-workbench run typecheck
pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test
pnpm --filter @yeisme/dsh-client-ui-pane-workbench run build
pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test:integration
```

集成测试将脱敏证据写入 `temp/integration-test-runs/<run-id>/`。

## 布局与生命周期

- 首次安装时 Right 与 Bottom 都保持关闭；DSH 只显示 44px 工作区轨道。
- `ctx.paneWorkbench.openView(request)` 根据 `preferredRegion` 自动展开目标区域；终端默认
  Bottom，文件、文档、媒体和 Plan/Artifact 默认 Right。
- Right/Bottom slot occupant 共用一份 controller generation；provider unload、session
  切换、持久化恢复和跨区移动会原子地反映到两个 root。
- `ctx.workspaceLayout.attach()` 只有一个 live owner。卸载时会依次释放两个 slot、layout
  handle、drag coordinator、session/persistence subscriptions，不留下轨道或网格预留。
- `dsh.tool-details` 是隐藏的内置 provider：Bash 等工具详情通过 Core host adapter 打开，
  和其他视图共用 Tab、Right/Bottom move、split、最大化与关闭行为，不再挂第二套 Details 栏。
- DSH 缺少两个 workspace slot、`ctx.workspaceLayout` 或 `workspace.core-pane.v1` 时加载明确
  失败，不回退 overlay，也不允许 Core Pane 与 legacy Details 并排挂载。

## 导航与交互

- 轨道只显示已经打开的上下文视图；`+` 打开区域内 popover view provider 选择器，不生成固定七模块栏，也不会覆盖 DSH 左侧会话栏。

## V4 交互与回滚

- Tab：双击固定；预览 Tab 同资源去重；More Tabs 可搜索；Close Others/Right/Unpinned/Group 任一 deny 则零部分关闭。
- 拖拽：idle/pending/dragging/committing/cancelling；pointermove 不提交 reducer；reduced-motion 即时提交。键盘 Arrow/Home/End/Enter/Escape 复用同一 drop target。
- Explorer / Source Control：opaque file/Git refs；Git offline 不阻塞树；timeout 不自动 retry。
- Designer：`dsh.workspace-designer` 单例；Apply 走 `apply_workspace_draft`；无官方 Settings/Page 时 Core View 是唯一入口。
- 安装 / 回滚：

```bash
dsh plugin --profile web add @yeisme/dsh-client-ui-pane-workbench
dsh plugin --profile web remove @yeisme/dsh-client-ui-pane-workbench
```

Locale 缺失时 English fallback。CLI 错误与日志保持 English。
- Tab 旁提供语义图标、更多操作、最大化/恢复和关闭按钮；更多菜单支持固定、跨区域移动和边缘拆分。
- Tab 支持 Arrow/Home/End 导航、Delete 关闭、Shift+F10 菜单、键盘跨区移动和 split。
- Pointer drag 可同组排序、跨 group/region 移动或从边缘拆分；无效 drop、Escape、blur、
  pointer cancel、source unmount 与 HMR 都会回滚且保留源 Tab。
- split 深度最大 2，同时可见 group 最大 4，Pane 最小 280×180px；不支持浮窗或拖入左侧栏。
- region/split separator 同时支持 pointer 与键盘，并通过 ARIA live 区域播报布局结果。

## 持久化与安全边界

`PaneWorkspacePersistenceAdapter` 写入 `pane.workspace.persisted.v2`，保存 region 可见性与
比例、split/group/Tab、活动视图和 provider 批准的安全 metadata。它不保存临时最大化、
旧 overlay 状态、终端输出、绝对路径、credential、raw prompt、provider payload 或私有
tool arguments。V1 envelope 会迁移安全布局字段并丢弃临时最大化。

`registerView()` 只接受当前 client 已加载的本地 component factory 与类型化 descriptor；
component URL、任意 module、iframe 和远端代码入口会被拒绝。provider 卸载后已打开 Tab
进入 orphaned 恢复态，而不是继续持有过期组件。

新增侧栏/底栏能力统一使用 `ctx.paneWorkbench.registerView()` / `registerPlugin()` 与
`openView()`；禁止另建 sidebar、生产 overlay 或独立 Pane store。DSH 自有内容若需进入
Core Pane，只能通过封闭的 workspace Core host id 与 owner-authored `renderCoreView()` 适配。

设计与变更依据：

- `openspec/changes/dsh-pane-workspace-docking-v2/`
- `openspec/changes/dsh-pane-workbench-interaction-v1/`
- `openspec/changes/dsh-pane-plugin-platform-v1/`
- `openspec/changes/dsh-unified-core-pane-v1/`

## External openView

```ts
ctx.get('paneWorkbench')?.openView?.({
  kind: 'subagent.monitor',
  resourceKey: 'subagent:root',
  role: 'navigator',
  preferredRegion: 'right',
  retention: 'keep-alive',
  singleton: true,
  pinned: true,
  title: 'Agents',
})
```
