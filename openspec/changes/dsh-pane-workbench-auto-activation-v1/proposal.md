## Why

当前 `@yeisme/dsh-pane-workbench` 通过 `shell.overlay` 一启动就挂载并默认展开完整 Pane Workbench，即使没有使用也占用 overlay 表面；`@yeisme/dsh-workbench-compose` 的 `ComposedWorkbench` 又默认使用 `emptyHostProjection`，目录树一直显示空状态。用户需要的是“按需使用”：workbench 默认休眠，当用户点击 Show、外部插件调用 `openView` 或打开文件树时，自动加载并启用；启用后文件树按需从 Host 投影加载。

## What Changes

- 新增 Pane Workbench 激活状态机：`dormant -> activating -> active -> collapsed`，默认 `dormant`/`collapsed`。
- `PaneWorkbenchController` 增加可见性状态与 `show()/hide()/subscribe()`；`openView()` 自动唤醒 workbench。
- `client.ts` 改为注册轻量 `PaneWorkbenchLauncher`，首次激活后才挂载完整 `PaneWorkbenchChrome`。
- 新增文件树按需加载：通过官方 `ctx.workspaces.listDirectory` 或未来 DSH session projection，将 `DirectoryListing` 安全映射为 `FileEntryV1[]`，在 workbench 打开或切到 Files Tab 时加载。
- 增加 `file.tree` Pane view 与入口，调用 `openView` 时自动展开 workbench 并显示文件树。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| Workbench 按需激活 | required | Harness Plugins | deliver-now | controller/chrome/launcher tests |
| `openView` 自动唤醒 | required | Harness Plugins | deliver-now | controller + chrome tests |
| 文件树按需加载 | required | Harness Plugins + DSH fs owner | deliver-now（目录）/ retain-next（文件/预览） | adapter + compose tests |
| 安全投影边界 | required | DSH/domain owner | deliver-now | raw path 不进入 UI 状态 |

## Impact

- 修改 `packages/client/ui-pane-workbench/`：controller、chrome、client launcher、tests。
- 修改/新增 `dsh-file-document` 或 `client/ui-pane-file-tree`：`FileTreeHostAdapter`、`useFileTree`、Pane view provider。
- 修改 `packages/bundle/dsh-workbench-compose/`：`ComposedWorkbench` 接入按需加载。
- 不修改 DSH core、不改变 profile patch 结构、不引入新的领域 canonical state。
