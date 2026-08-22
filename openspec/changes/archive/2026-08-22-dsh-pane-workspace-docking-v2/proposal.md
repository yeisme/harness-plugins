## Why

当前 Pane Workbench 与 Desktop Workbench 通过 `shell.overlay` 覆盖整个 DSH frame，既遮挡 canonical 左侧会话栏，也让工作区尺寸、Tool Details 竞争和窄屏行为脱离 DSH 的正式布局求解。V2 需要把工作区提升为 DSH 拥有几何、Pane Workbench 拥有内容状态的双区域能力，并保留现有 view provider 合同。

## What Changes

- 在 DSH `ui-layout` 新增 root-scoped single slots：`shell.workspace.right` 与 `shell.workspace.bottom`，以及 additive `ctx.workspaceLayout` attach/update/subscribe/dispose 服务。
- AppFrame 改为 sidebar、conversation、right workspace、Tool Details 四列与 conversation/bottom workspace 两行；sidebar 始终保留，最大化只占其右侧区域。
- DSH 统一处理右侧/底部尺寸、辅助表面优先级、窄屏 sheet、最大化与恢复，并保证隐藏表面不卸载。
- Pane Workbench 将 `PaneWorkspaceV1` 提升为两个 slot 实例共享的外部 controller/store，两个 region chrome 共享 Tab、split、drag、openView 与持久化状态。
- 导航改为仅展示已打开上下文视图；轨道 `+` 打开视图选择器。文件/文档/媒体默认右侧，终端默认底部，且允许跨区域移动。
- 持久化 envelope 升级为 V2；V1 自动迁移安全的 region、Tab、group 与 split，丢弃 overlay 可见性和临时最大化字段。
- `dsh-desktop-workbench` 改为 Pane view provider；`dsh-workbench-compose` 只组合 provider、命令与打开入口，不再挂载重复的 SessionSidebar 或侧栏内嵌工作台。
- **BREAKING**：生产 Web profile 不再注册 Pane/Desktop `shell.overlay`。旧 DSH 缺少新 slots 或 `ctx.workspaceLayout` 时加载明确失败，不回退到覆盖左侧栏的旧实现。
- `DesktopWorkbenchOverlay` 最多保留一个 RC 的 deprecated 测试/故事导出；V2 canary 验证通过后删除兼容导出。

## Admission Decision

结论：`split-owner`。Host 几何与 slot 实现走 `upstream-prs/`，不挡插件完成。`agent/harness-plugins` 只做协议对接：探测 workspace slot / `ctx.workspaceLayout`、共享 Pane controller、V2 安全持久化与诚实降级。文件、终端、媒体等领域 provider 继续拥有业务状态。

## Capabilities

### New Capabilities

- `dsh-pane-workspace-docking`: DSH 双区域 workspace slots、layout service、尺寸求解、辅助表面优先级、sheet/maximize、Pane 双宿主、迁移、卸载与真实 profile 验证。

### Modified Capabilities

- `dsh-pane-workbench-extension`: 官方接入从 `shell.overlay` 改为 `shell.workspace.right` / `shell.workspace.bottom`，缺少 V2 seam 时明确报兼容错误。
- `pane-workbench-interaction`: canonical workspace 改由共享 external store 驱动两个 slot，持久化升级为 V2 且临时最大化不恢复。

## Impact

- DSH：`packages/client/ui-layout` 的公开 client context、slots、AppFrame、尺寸 solver、组件测试与 Agent Note。
- Harness Plugins：`packages/client/ui-pane-workbench`、`packages/bundle/pane-workbench`、`packages/client/ui-desktop-workbench`、`packages/bundle/dsh-desktop-workbench`、`packages/bundle/dsh-workbench-compose` 及其测试和文档。
- 兼容边界：`PaneWorkbenchClientFace.registerView()` 与 `openView()` 保持兼容；`ctx.layout` 不变；新增 `ctx.workspaceLayout` 为 additive service。Pane bundle 提升 DSH peer 要求。
- 回滚：在 RC 窗口内可恢复旧 bundle/profile 版本；V2 本身不会运行时回退到 overlay，卸载后必须释放两个 slot 与全部布局预留。
