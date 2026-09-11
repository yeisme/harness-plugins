## 1. 服务端 watch（dsh-file-host）

- [x] 1.1 [Owner: Harness Plugins；Scope: `src/watch-registry.ts`（新）+ `package.json`；Dependencies: none] 实现 `createWorkspaceWatchRegistry`：引用计数 chokidar watcher（ignoreInitial、ignored=workspaceIgnorePatterns∪.git）、事件→`FileWatchEventV1` 映射（issue 铸造 ref、单调 sequence、512 环形缓冲、出站 assert 防御）。Acceptance: 临时目录真实事件 spec 全绿；Validation: `pnpm --filter @yeisme/dsh-file-host run test`。
- [x] 1.2 [Owner: Harness Plugins；Scope: `src/node.ts`；Dependencies: 1.1] `fs.watch.streamV1` GET SSE 路由（sessionId fence 403、cursor 事件、since 重放、retry+心跳、close→release）；现有方法零改动。Acceptance: SSE spec（2003 语义）全绿；Validation: 同上。

## 2. 浏览器 host（dsh-file-host）

- [x] 2.1 [Owner: Harness Plugins；Scope: `src/index.ts`；Dependencies: none] `createExplorerFileHost` 增 `FILE_WATCH_CAPABILITY` + `watch(parentRef?)`：懒单例 EventSource、cursor 捕获、形状校验丢弃、error 以最新 cursor 重开、末位退订 close。Acceptance: EventSource stub spec 全绿；`probeFileWatch` 变 live；Validation: 同上。

## 3. 树 UX + runtime 广告（ui-pane-workbench / dsh-desktop-workbench）

> 注：原计划的 reveal-in-tree 由并行 lane（search-center 波次）先行落地（reveal-channel/reveal-navigation + runtime.revealResource + tree-ui 消费），本 change 撤销该项避免重复实现。

- [x] 3.1 [Owner: Harness Plugins；Scope: `src/explorer/tree-ui.tsx` + `src/explorer/styles.ts`；Dependencies: none] 活度徽标（`data-file-watch=live|ondemand` + `data-freshness`）+「刷新」按钮（视图级权威重读 roots+已展开目录，`reconcile_apply` 语义保留展开/选择/焦点/滚动锚点）。Acceptance: 组件 spec（三态/刷新保留断言）绿；Validation: `pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test`。
- [x] 3.2 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-desktop-workbench/src/client/apply.ts`；Dependencies: 1.x, 2.1] runtime 广告 `fileWatch`（host 具备 `FILE_WATCH_CAPABILITY` 时注入，`ExplorerWatchController` 立即绑定；缺位保持 on-demand）。Acceptance: typecheck + bundle test 绿；Validation: `pnpm --filter @yeisme/dsh-desktop-workbench run test`。

## 4. 门与冒烟

- [x] 4.1 [Owner: Harness Plugins；Scope: 仓库门；Dependencies: 1.x-3.x] Evidence (2026-09-11): dsh-file-host test 67/67 + build；ui-pane-workbench typecheck/build + 本 lane specs 绿（包内剩 2 失败均为并行 lane：dsh-projection dsh-llm CallId 依赖漂移、region-chrome 其 chrome/shared.ts 在途改动）；dsh-desktop-workbench test 61/61 + build；check:bundles 29/29、check:plugins 六检查器全 PASS、check:surfaces 通过；test:visual pane-menus（explorer fixture）5/5 无基线漂移；dsh:workbench --check 通过。
- [x] 4.2 [Owner: Harness Plugins；Scope: 真机冒烟；Dependencies: 4.1] Evidence: 真实 webServer 链路 403 fence 两次验证（默认+isolated home）；SSE 全语义（cursor/replay/live/心跳/release）在真实 node http + 真实 chokidar 事件上绿（watch-registry.spec 7 项）；WebServer 原始 res 直通 + compression 默认 none（代码级流式保证）；完整浏览器目视（pill=live + 树自动刷新）留 dogfood——isolated home 旧 session 首帧 header 格式漂移致 loader 拒载（上游问题），无可用 session 建流。证据 temp/integration-test-runs/explorer-live-watch-smoke-20260911T1130Z/summary.md。
- [x] 4.3 [Owner: Harness Plugins；Scope: change 文档；Dependencies: all] `openspec validate dsh-explorer-live-watch-v1 --strict --no-interactive` 通过（2026-09-11，spec 按并行 lane reveal 交付与 ignore 语义如实修订）。
