# @yeisme/dsh-client-ui-pane-workbench

Yeisme 的 DSH 双区域 Pane Workbench client。生产插件通过官方
`shell.workspace.right` 与 `shell.workspace.bottom` slot 挂载两个 React root，二者以
`useSyncExternalStore` 读取同一个 `PaneWorkbenchController`。DSH AppFrame 拥有尺寸、
Sheet、Tool Details 竞争与最大化边界；本包只拥有 Pane tree、Tab/group、选择、拖拽和
安全视图元数据。

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
- DSH 缺少两个 workspace slot 或 `ctx.workspaceLayout` 时加载明确失败，不回退 overlay。

## 导航与交互

- 轨道只显示已经打开的上下文视图；`+` 打开区域内 popover view provider 选择器，不生成固定七模块栏，也不会覆盖 DSH 左侧会话栏。
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

设计与变更依据：

- `openspec/changes/dsh-pane-workspace-docking-v2/`
- `openspec/changes/dsh-pane-workbench-interaction-v1/`
- `openspec/changes/dsh-pane-plugin-platform-v1/`

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
