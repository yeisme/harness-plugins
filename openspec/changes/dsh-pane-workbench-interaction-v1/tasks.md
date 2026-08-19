## 收束状态（2026-08-17）

- 已落地并完成 focused 验收：local-only view registry、orphaned 状态恢复、可测试的 drag/resize 会话、两帧 measured activation、per-kind/LRU retention、safe persistence adapter、Tab/Pane chrome 与 `shell.overlay` adapter。
- 已补齐：installable bundle、disposable profile install/dump/remove 与真实 Web profile Loader 启动；真实浏览器 Playwright、canary handoff 与发布流程仍未在本仓库闭环。
- 3.1–3.4、5.1–7.2 的 checkbox 保持按实际 acceptance 管理；4.1/4.2 已由纯状态/适配器和 focused tests 闭环。

## 1. Contract and package foundation

- [x] 1.1 [依赖：无；串行] 创建 `packages/client/ui-pane-workbench/` package、公开 client service 类型、descriptor、`PaneWorkspaceV1` 与 typed intent；只使用 DSH 官方发布 surface，英文 JSDoc 说明生命周期和安全字段。验收：`pnpm --filter @yeisme/dsh-client-ui-pane-workbench run typecheck` 通过；失败时先修 package/tsconfig/export，不改其他业务包。
- [x] 1.2 [依赖：1.1；并行 lane A] 创建 reducer fixture builder 与 schema normalizer，覆盖重复 id、无效 ratio、未知 kind、pane 深度/数量和 min-size fallback。验收：focused Vitest 全部通过，invalid fixture 必须被修复或回退而不是抛出未处理异常。
- [x] 1.3 [依赖：1.1；并行 lane B] 增加 source-independence gate，扫描 manifest、lockfile、imports 与 bundle output，拒绝 `dsh-better-sidebar` dependency、vendored path 或 copied artifact marker。验收：gate 对人工加入的禁用 fixture 失败，对正常 package 通过。

## 2. Core reducer and open routing

- [x] 2.1 [依赖：1.2；串行] 实现 Region、PaneGroup、ViewInstance、split normalize、pane 上限、空 group 合并与 layout history；生产代码和注释使用 English stable identifiers。验收：`pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test` 覆盖所有 reducer intent。
- [x] 2.2 [依赖：2.1；并行 lane A] 实现 semantic `OpenView` routing：显式 target、resource reuse、role、region、bounded split、fallback/reject。验收：Navigator focus 后文件仍进入 Content，Terminal 默认进入 Bottom Utility，locked group 不被普通预览占用。
- [x] 2.3 [依赖：2.1；并行 lane B] 实现 preview/pinned/dirty/singleton/duplicate/close policy。验收：单击复用 preview、双击/dirty 自动 pin、owner deny 时 Tab 不关闭、相同 resource 不重复创建。

## 3. Pane chrome and accessible interaction

- [x] 3.1 [依赖：2.2、2.3；串行] 实现 TabBar、PaneGroup、split renderer、Right/Bottom region chrome、empty/orphaned/error state；每个 view 有独立 error boundary。验收：单 view crash 后 TabBar、其他 pane 与 Reset Layout 可操作。（`chrome.ts` 已显式渲染 right/bottom region、TabBar/tabpanel、empty/orphaned recovery 和独立 `ViewBoundary`；`chrome.spec.tsx` 覆盖 region/ARIA/orphan 与 Delete close，既有 Retry/Reload boundary 测试继续通过。）
- [x] 3.2 [依赖：3.1；并行 lane A] 实现 pointer tab reorder/docking、6px threshold、insertion marker、动态 edge zones、atomic cross-region move 与 cancel cleanup。验收：invalid drop 不丢 source，拖走最后 Tab 后 tree 正规化，Escape/blur/HMR 清理 session。（`src/chrome.ts` 统一 `PaneDragSession` pointer lifecycle：同组 center tab reorder、right/left/top/bottom edge split、Right/Bottom center move、动态 marker/index、locked/invalid drop gating；`src/interactions.ts` 保持 6px threshold 与 idle cleanup，Chrome 增加 Escape/window blur/pointercancel/unmount cleanup。`tests/interactions.spec.ts` 与 `tests/chrome.spec.tsx` 覆盖 threshold、invalid cleanup、同组 reorder、edge split、跨 region move；package focused gate 48 tests 通过。）
- [x] 3.3 [依赖：3.1；并行 lane B] 实现 WAI-ARIA tabs、context menu、command actions、keyboard move mode、live announcements 与 focus return。验收：只用键盘完成 activate、close、pin、move、split、reset；Testing Library 的 role/state 断言通过。（`src/chrome.ts` 提供 roving `tabIndex`、Arrow/Home/End、Enter/Space、Delete 邻接 focus return、Shift+F10 菜单、Pin/Close/Move/Split actions；`Move by Keyboard` 使用 dialog 内 Arrow/Home/End、Enter/Space、Escape 与 polite live region，所有变化仍经 `reducePaneWorkspace`。`tests/chrome.spec.tsx` 覆盖 ARIA state、focus return、keyboard move/split、menu/live feedback；当前 package gate 48 tests 全绿。）
- [x] 3.4 [依赖：3.1；并行 lane C] 实现 preview-then-commit resize、keyboard divider、snap guide 与 reduced motion。验收：pointerup flush 最后一帧，只提交一个 resize intent，drag 期间 transition 为 none。（`PaneResizeSession` 增加可注入 frame scheduler，pointermove coalesce、pointerup flush/cancel cleanup；Chrome 暴露 preview/ARIA range/snap-guide data、drag 中 `transition:none`，键盘 divider 保留 1%/5%/Home/End。`interactions.spec.ts` 与 `chrome.spec.tsx` 覆盖单次 commit、最后比例、cancel 和 drag cleanup；当前 package gate 48 tests 全绿。）

## 4. View lifecycle, persistence and responsive projection

- [x] 4.1 [依赖：3.1；并行 lane A] 实现 `keep-alive`、`snapshot`、`recreate` retention、per-kind/LRU budget 与 measured activation。验收：零尺寸容器不 activate，连续两帧非零后只 activate 一次，隐藏/关闭按 descriptor suspend/dispose。Validation：`packages/client/ui-pane-workbench/src/lifecycle.ts` 的 `PaneViewLifecycleController`/`PaneRetentionManager`，`tests/lifecycle.spec.ts` 覆盖零尺寸、双帧、active LRU、retained LRU、keep-alive dispose、snapshot suspend 与 recreate dispose；package test 37 tests passed；focused evidence：`temp/integration-test-runs/2026-08-17T17-29-25-919Z-2383503/summary.json`。
- [x] 4.2 [依赖：2.1；并行 lane B] 实现 safe `PaneWorkspaceV1` persistence、session restore、workspace preset、normalize/fallback 和 Reset/Delete Local Layout。验收：存储 fixture 不含正文、terminal output、credential、raw prompt、provider payload、private argument 或 absolute path。Validation：`src/persistence.ts` 的 `PaneWorkspacePersistenceAdapter` 只写 `serializePaneWorkspace()` safe projection，拒绝不安全 storage/preset key，异常回退默认 workspace；`tests/projection-persistence.spec.ts` 覆盖 session/preset/reset/delete、malformed JSON、malformed shape 与 throwing storage，37 tests passed；focused evidence：`temp/integration-test-runs/2026-08-17T17-29-25-914Z-2383502/summary.json`。
- [x] 4.3 [依赖：2.1；串行] 实现 wide/compact/sheet projection，不修改 canonical tree/region。验收：1400px → 768px → 430px → 1400px 往返后 Right/Bottom、Tab 和 ratio 与原状态一致。

## 5. Official DSH integration and bundle

- [ ] 5.1 [依赖：3.1、4.1、4.3；串行] 通过 `shell.overlay` list slot 注册 Pane Workbench host，提供 toggle、Right/Bottom overlay 与 narrow sheet；不得占用 `sidebar`、`conversation`、`details`。验收：与现有 Tool Details 同时工作，关闭后底层 DSH 可点击。
- [x] 5.2 [依赖：5.1；并行 lane A] 实现 `ctx.paneWorkbench.registerView` disposer、capability gating、orphaned recovery 和 local-only component factory；host projection 只接受 safe typed fields。验收：component URL/module name/arbitrary iframe fixture 被拒绝为 contract mismatch。（`view-registry.spec.ts` 覆盖 componentUrl/moduleName/iframe 拒绝、capability gating、disposer 后 orphan recovery；client package focused gate 10 files / 49 tests 通过。）
- [x] 5.3 [依赖：5.1；并行 lane B] 创建 `packages/bundle/pane-workbench/` patch、README 与安装/移除说明，命令面向用户使用真实 `dsh plugin --profile web add ...` 形式。验收：`dsh --profile web --dump-config` 可看到贡献，移除 bundle 后无重复 mount 或 DOM residue。（bundle 使用 inert node face + thin `./client` face；最新串行 `temp/integration-test-runs/2026-08-18T03-15-23-655Z-3426823-pane-profile/summary.json` 覆盖 packed members、install/dump row=1、真实 Web Loader boot、remove/dump row=0；浏览器 DOM/Playwright 仍归 6.2。）

## 6. Verification evidence

- [x] 6.1 [依赖：2.*、3.*、4.*；串行] 完成 reducer、component、a11y、retention、persistence 与 teardown focused tests。验收：`pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test`、`pnpm --filter @yeisme/dsh-client-ui-pane-workbench run typecheck` 全绿；确定性失败回到对应任务修复，不扩大到无关包。（2026-08-18 当前 package gate：10 test files / 49 tests 全绿，typecheck 全绿；覆盖 reducer、chrome pointer/keyboard/a11y、lifecycle、persistence、registry、runtime、local-only contract rejection 与 interaction teardown。）
- [ ] 6.2 [依赖：5.*、6.1；串行] 增加真实 DSH profile Playwright：install/load/unload、Right/Bottom、cross-region、resize、session switch、reload restore、narrow round trip、keyboard-only、view crash、HMR。集成运行证据写入 `temp/integration-test-runs/<run-id>/`，包含 summary/command/stdout/stderr/env/artifacts 且脱敏。验收：浏览器场景全绿并保留截图/ARIA snapshot。
- [ ] 6.3 [依赖：6.2；串行] 运行 final gates：`pnpm run typecheck`、`pnpm run test`、`pnpm run build`、`openspec validate dsh-pane-workbench-interaction-v1 --strict --no-interactive`、`git diff --check`。验收：全部通过；任何 dirty worktree failure 先分类为 introduced、pre-existing、concurrent、environmental 或 ambiguous。

## 7. Documentation and canary handoff

- [ ] 7.1 [依赖：5.3、6.2；并行] 更新本仓库 `docs/README.md`、client package README 与 bundle README，说明安装、配置、快捷操作、source-independence、overlay 限制、inspect、remove、reset 与 troubleshooting；开发文档中文，CLI/日志/错误与 code comments 英文。（文档内容已补齐：`packages/client/ui-pane-workbench/README.md` 增加配置、快捷操作、inspect、reset 和 troubleshooting；`packages/bundle/pane-workbench/README.md` 增加中文对应说明。仍等待 6.2 的官方 browser evidence 后按依赖关系勾选。）
- [ ] 7.2 [依赖：6.3、7.1；串行] 生成 canary handoff：记录兼容 DSH 版本、bundle digest、测试证据路径、已知 overlay trade-off、下一批 view provider 与 additive dock slot blocker。验收：OpenSpec 保持 valid，未把未实现的 Terminal/Git/File provider 描述为已交付。（bundle README 已加入 local canary handoff，记录 `0.1.0-rc.6` peer、`@yeisme/dsh-pane-workbench@0.1.0-rc.1`、profile evidence、overlay trade-off 与 browser/additive-slot/provider blockers；6.3/7.1 依赖未满足，保持 open。）
