## 1. DSH 正式布局

- [x] 1.1 在 `ui-layout` 声明 Right/Bottom root single slots 与 `ctx.workspaceLayout` 单 owner 句柄
- [x] 1.2 实现四列两行 geometry solver、44px rail、窄屏 Sheet 与 sidebar 边界不变量
- [x] 1.3 在 AppFrame 实现 pointer/keyboard resize、辅助表面优先级、Pane 最大化与 `Escape` 恢复
- [x] 1.4 添加 workspace service、geometry 与 AppFrame 组件测试及实现 Agent Note

## 2. Pane 双区域宿主

- [x] 2.1 将 canonical workspace、registry reconciliation、session persistence 提升到共享 controller/store
- [x] 2.2 实现 Right/Bottom `PaneRegionChrome` 与跨 root `PaneDragCoordinator`
- [x] 2.3 将导航改为已打开上下文 Tab 与 `+` view selector，并保留完整键盘路径和 ARIA announcement
- [x] 2.4 升级 V2 persistence envelope、迁移 V1 安全字段并丢弃临时 maximize/overlay 状态
- [x] 2.5 改为只注册 `shell.workspace.right` / `shell.workspace.bottom`，旧 DSH 明确失败且不回退 overlay

## 3. 内容与入口迁移

- [x] 3.1 将 Desktop Workbench 改为文件、文档、媒体、搜索、通知与终端 Pane view provider
- [x] 3.2 将 Workbench Compose 改为 provider 与 additive 打开入口，移除生产 `sidebar.footer.action`
- [x] 3.3 把现有 Plan Sidebar/Fullscreen 内容合并为上下文 Plan Pane，生产撤销第二侧栏和页面级 overlay
- [x] 3.4 保留 `DesktopWorkbenchOverlay`、`PlanSidebar` 与 `PlanFullscreen` 一个 RC 的 deprecated story 导出

## 4. 验证与收口

- [x] 4.1 运行 DSH ui-layout、ui-plan 与 Pane/Desktop/Compose focused typecheck 和测试
- [x] 4.2 运行两个子项目的最终 build、完整相关测试、文档门禁与 OpenSpec strict validation
- [x] 4.3 使用 `dsh --profile web --port 3802` 验证 Right、Bottom、跨区移动、Details、刷新、最大化与窄屏 Sheet
- [x] 4.4 保存截图、ARIA 与命令证据到各子项目 `temp/integration-test-runs/<run-id>/`

验证记录：

- DSH 相关 42 个测试文件、555 个测试、3 个客户端 package typecheck/bundle 与本变更双语文档一致性检查通过。全仓 Agent Note format 门禁仅剩用户已有脏工作树中的 `2026-08-19-dsh-login-token-remote-access.md` 缺少新格式章节，本变更 Note 不在失败列表中。
- Pane Workbench 72 个测试、Desktop 12 个测试、Compose 18 个测试、所有对应 typecheck/build、profile conformance、文档同步门禁与 OpenSpec strict validation 通过。
- DSH 浏览器证据：`temp/integration-test-runs/2026-08-20T09-20-00-648Z-1927470-pane-browser/`。
- Harness Plugins 浏览器证据：`temp/integration-test-runs/2026-08-20T09-20-00-657Z-1927471-pane-browser/`。
- Pane profile 安装/卸载证据：`temp/integration-test-runs/2026-08-20T09-19-31-552Z-1915392-pane-profile/`。
