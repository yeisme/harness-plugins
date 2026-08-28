## 1. 合同与版本

- [x] 1.1 将 Pane Workbench peer floor 与宿主探测收口为完整 `workspace.core-pane.v1`，旧/残缺 seam 必须明确失败。
- [x] 1.2 更新 bundle README、conformance 与版本说明，声明新旧 DSH/Pane RC 不可混装，回滚按完整 RC 组合执行。

## 2. Harness Plugins 清理

- [x] 2.1 删除 `OfficialSidebarPaneHost`、footer 入口、overlay 注册与相关 locale/export。
- [x] 2.2 删除 `layout.openDetails/closeDetails` monkey patch、partial-host probe 与旧宿主测试，只保留 Core adapter 路径。
- [x] 2.3 重建 `@yeisme/dsh-pane-workbench` browser bundle，并验证产物不含 official fallback 标识。

## 3. DSH Core Pane-only 布局

- [x] 3.1 删除 staging `ui-layout` 的独立 Details track、宽度/优先级状态和 legacy occupant mount。
- [x] 3.2 令 workspace owner 必须提供 Core adapter，`layout.openDetails/closeDetails` 只路由 `dsh.tool-details`。
- [x] 3.3 更新 `ui-conversation` / `ui-layout` focused tests，覆盖 Bash inspect 只打开 Core Pane 及缺 owner 明确失败。
- [x] 3.4 从 clean upstream baseline 刷新 `upstream-prs/pane-workspace-layout/changes.patch` 与 new-files。

## 4. 验证

- [x] 4.1 运行 Pane Workbench focused test、typecheck、build 与 bundle conformance。
- [x] 4.2 运行 staging DSH focused tests、client typecheck/build 与 lint。
- [x] 4.3 运行 `openspec validate dsh-core-pane-only-next-rc --strict`、`pnpm run check:bundles` 与 diff whitespace 检查。
