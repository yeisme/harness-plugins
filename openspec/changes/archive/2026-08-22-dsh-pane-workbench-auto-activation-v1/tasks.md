## 1. 激活状态与 Controller

- [x] 1.1 [Owner: Harness Plugins；Scope: `packages/client/ui-pane-workbench/src/controller.ts`；Dependencies: none] 为 `PaneWorkbenchController` 增加 `visible` 状态、`show()/hide()/subscribe()/isVisible`，并让 `openView()` 自动 `show()`；未挂载时保存 `pendingOpen`。Acceptance: controller 单测覆盖 show/hide/openView 自动唤醒与 pending flush；Validation: `pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test`。

## 2. Chrome 默认收起

- [x] 2.1 [依赖：1.1；Scope: `packages/client/ui-pane-workbench/src/chrome.ts`] 为 `PaneWorkbenchChrome` 增加 `defaultVisible?: boolean`（默认 `false`），隐藏态只渲染 `Show Pane Workbench` 按钮；订阅 controller 可见性，外部 `show()` 自动展开。Acceptance: chrome 测试覆盖默认隐藏、Show 展开、openView 自动展开；Validation: `pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test`。

## 3. Launcher 懒挂载

- [x] 3.1 [依赖：2.1；Scope: `packages/client/ui-pane-workbench/src/client.ts`] 将 `shell.overlay` 注册改为 `PaneWorkbenchLauncher`：默认只渲染轻量按钮，首次激活后才挂载完整 `PaneWorkbenchChrome`，挂载后 flush pending open。Acceptance: client/launcher 测试覆盖 dormant、首次激活挂载、dispose 清理；Validation: `pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test`。

## 4. 文件树 Host Adapter

- [x] 4.1 [Owner: Harness Plugins；Scope: `dsh-file-document` 或 `client/ui-pane-file-tree`；Dependencies: none] 实现 `FileTreeHostAdapter`：接收 `ctx.workspaces.listDirectory` 或静态 fake，将 `DirectoryListing` 映射为安全 `FileEntryV1[]`（目录项），内部保存 path 映射但不暴露到 UI。Acceptance: 单元测试覆盖目录映射、空目录、错误、raw path 不进入 entries；Validation: `pnpm --filter @yeisme/dsh-file-document run test`（或新 package test）。

## 5. useFileTree 按需加载

- [x] 5.1 [依赖：4.1；Scope: `dsh-file-document` 或 `client/ui-pane-file-tree`] 实现 `useFileTree(adapter, rootPath, enabled)`：`enabled=true` 时调用 `listDirectory`，返回 `idle/loading/ready/error` 与 `retry`，用 AbortController 取消过期请求。Acceptance: 集成测试覆盖打开面板触发加载、空状态、错误重试；Validation: 对应 package test。

## 6. Compose 与 Pane 文件树接入

- [x] 6.1 [依赖：5.1；Scope: `packages/bundle/dsh-workbench-compose/src/client/composed-workbench.tsx`] 让 `ComposedWorkbench` 在打开面板或切到 Files/Documents Tab 时调用 `useFileTree`，替换 `emptyHostProjection` 的空 entries。Acceptance: compose 测试覆盖文件树从 Host adapter 加载；Validation: `pnpm --filter @yeisme/dsh-workbench-compose run test`。
- [x] 6.2 [依赖：5.1；Scope: `dsh-file-document` 或 `client/ui-pane-file-tree`] 注册 `file.tree` Pane view 与“文件树”入口，调用 `ctx.paneWorkbench.openView` 自动唤醒 workbench。Acceptance: `openView` 后 workbench 展开并显示文件树；Validation: 对应 package test。

## 7. 文档与验证

- [x] 7.1 [依赖：6.2；Scope: OpenSpec + README] 完成本 change 的 proposal/design/tasks/spec 与 package README 更新，说明默认休眠、按需激活、文件树加载与排障。Acceptance: `openspec validate dsh-pane-workbench-auto-activation-v1 --strict --no-interactive` 通过；Validation: 上述命令。
- [x] 7.2 [依赖：7.1；Scope: focused gates] 运行 `pnpm --filter @yeisme/dsh-client-ui-pane-workbench run typecheck && pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test && pnpm --filter @yeisme/dsh-file-document run typecheck && pnpm --filter @yeisme/dsh-file-document run test && pnpm --filter @yeisme/dsh-workbench-compose run typecheck && pnpm --filter @yeisme/dsh-workbench-compose run test && pnpm --filter @yeisme/dsh-workbench-compose run build && openspec validate dsh-pane-workbench-auto-activation-v1 --strict --no-interactive`。Acceptance: 全绿；其他 dirty worktree failure 标注 pre-existing/concurrent。
