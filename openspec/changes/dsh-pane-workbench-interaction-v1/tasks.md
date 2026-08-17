## 收束状态（2026-08-16）

- 已落地但尚未逐项验收：local-only view registry、orphaned 状态恢复、可测试的 drag/resize 会话、retention 生命周期控制器、Tab/Pane chrome 与 `shell.overlay` adapter。
- 本次收束未新增 bundle、真实 DSH profile/Playwright、完整 pointer docking、完整 keyboard move、持久化 storage adapter 或 canary handoff。
- 为避免把部分实现误报为交付，3.1–7.2 的 checkbox 均保持未完成；恢复时应先为新增层补 focused component/lifecycle tests，再按原任务顺序完成 acceptance。

## 1. Contract and package foundation

- [x] 1.1 [依赖：无；串行] 创建 `packages/client/ui-pane-workbench/` package、公开 client service 类型、descriptor、`PaneWorkspaceV1` 与 typed intent；只使用 DSH 官方发布 surface，英文 JSDoc 说明生命周期和安全字段。验收：`pnpm --filter @yeisme/dsh-client-ui-pane-workbench run typecheck` 通过；失败时先修 package/tsconfig/export，不改其他业务包。
- [x] 1.2 [依赖：1.1；并行 lane A] 创建 reducer fixture builder 与 schema normalizer，覆盖重复 id、无效 ratio、未知 kind、pane 深度/数量和 min-size fallback。验收：focused Vitest 全部通过，invalid fixture 必须被修复或回退而不是抛出未处理异常。
- [x] 1.3 [依赖：1.1；并行 lane B] 增加 source-independence gate，扫描 manifest、lockfile、imports 与 bundle output，拒绝 `dsh-better-sidebar` dependency、vendored path 或 copied artifact marker。验收：gate 对人工加入的禁用 fixture 失败，对正常 package 通过。

## 2. Core reducer and open routing

- [x] 2.1 [依赖：1.2；串行] 实现 Region、PaneGroup、ViewInstance、split normalize、pane 上限、空 group 合并与 layout history；生产代码和注释使用 English stable identifiers。验收：`pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test` 覆盖所有 reducer intent。
- [x] 2.2 [依赖：2.1；并行 lane A] 实现 semantic `OpenView` routing：显式 target、resource reuse、role、region、bounded split、fallback/reject。验收：Navigator focus 后文件仍进入 Content，Terminal 默认进入 Bottom Utility，locked group 不被普通预览占用。
- [x] 2.3 [依赖：2.1；并行 lane B] 实现 preview/pinned/dirty/singleton/duplicate/close policy。验收：单击复用 preview、双击/dirty 自动 pin、owner deny 时 Tab 不关闭、相同 resource 不重复创建。

## 3. Pane chrome and accessible interaction

- [ ] 3.1 [依赖：2.2、2.3；串行] 实现 TabBar、PaneGroup、split renderer、Right/Bottom region chrome、empty/orphaned/error state；每个 view 有独立 error boundary。验收：单 view crash 后 TabBar、其他 pane 与 Reset Layout 可操作。
- [ ] 3.2 [依赖：3.1；并行 lane A] 实现 pointer tab reorder/docking、6px threshold、insertion marker、动态 edge zones、atomic cross-region move 与 cancel cleanup。验收：invalid drop 不丢 source，拖走最后 Tab 后 tree 正规化，Escape/blur/HMR 清理 session。
- [ ] 3.3 [依赖：3.1；并行 lane B] 实现 WAI-ARIA tabs、context menu、command actions、keyboard move mode、live announcements 与 focus return。验收：只用键盘完成 activate、close、pin、move、split、reset；Testing Library 的 role/state 断言通过。
- [ ] 3.4 [依赖：3.1；并行 lane C] 实现 preview-then-commit resize、keyboard divider、snap guide 与 reduced motion。验收：pointerup flush 最后一帧，只提交一个 resize intent，drag 期间 transition 为 none。

## 4. View lifecycle, persistence and responsive projection

- [ ] 4.1 [依赖：3.1；并行 lane A] 实现 `keep-alive`、`snapshot`、`recreate` retention、per-kind/LRU budget 与 measured activation。验收：零尺寸容器不 activate，连续两帧非零后只 activate 一次，隐藏/关闭按 descriptor suspend/dispose。
- [ ] 4.2 [依赖：2.1；并行 lane B] 实现 safe `PaneWorkspaceV1` persistence、session restore、workspace preset、normalize/fallback 和 Reset/Delete Local Layout。验收：存储 fixture 不含正文、terminal output、credential、raw prompt、provider payload、private argument 或 absolute path。
- [x] 4.3 [依赖：2.1；串行] 实现 wide/compact/sheet projection，不修改 canonical tree/region。验收：1400px → 768px → 430px → 1400px 往返后 Right/Bottom、Tab 和 ratio 与原状态一致。

## 5. Official DSH integration and bundle

- [ ] 5.1 [依赖：3.1、4.1、4.3；串行] 通过 `shell.overlay` list slot 注册 Pane Workbench host，提供 toggle、Right/Bottom overlay 与 narrow sheet；不得占用 `sidebar`、`conversation`、`details`。验收：与现有 Tool Details 同时工作，关闭后底层 DSH 可点击。
- [ ] 5.2 [依赖：5.1；并行 lane A] 实现 `ctx.paneWorkbench.registerView` disposer、capability gating、orphaned recovery 和 local-only component factory；host projection 只接受 safe typed fields。验收：component URL/module name/arbitrary iframe fixture 被拒绝为 contract mismatch。
- [ ] 5.3 [依赖：5.1；并行 lane B] 创建 `packages/bundle/pane-workbench/` patch、README 与安装/移除说明，命令面向用户使用真实 `dsh plugin --profile web add ...` 形式。验收：`dsh --profile web --dump-config` 可看到贡献，移除 bundle 后无重复 mount 或 DOM residue。

## 6. Verification evidence

- [ ] 6.1 [依赖：2.*、3.*、4.*；串行] 完成 reducer、component、a11y、retention、persistence 与 teardown focused tests。验收：`pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test`、`pnpm --filter @yeisme/dsh-client-ui-pane-workbench run typecheck` 全绿；确定性失败回到对应任务修复，不扩大到无关包。
- [ ] 6.2 [依赖：5.*、6.1；串行] 增加真实 DSH profile Playwright：install/load/unload、Right/Bottom、cross-region、resize、session switch、reload restore、narrow round trip、keyboard-only、view crash、HMR。集成运行证据写入 `temp/integration-test-runs/<run-id>/`，包含 summary/command/stdout/stderr/env/artifacts 且脱敏。验收：浏览器场景全绿并保留截图/ARIA snapshot。
- [ ] 6.3 [依赖：6.2；串行] 运行 final gates：`pnpm run typecheck`、`pnpm run test`、`pnpm run build`、`openspec validate dsh-pane-workbench-interaction-v1 --strict --no-interactive`、`git diff --check`。验收：全部通过；任何 dirty worktree failure 先分类为 introduced、pre-existing、concurrent、environmental 或 ambiguous。

## 7. Documentation and canary handoff

- [ ] 7.1 [依赖：5.3、6.2；并行] 更新本仓库 `docs/README.md`、client package README 与 bundle README，说明安装、配置、快捷操作、source-independence、overlay 限制、inspect、remove、reset 与 troubleshooting；开发文档中文，CLI/日志/错误与 code comments 英文。
- [ ] 7.2 [依赖：6.3、7.1；串行] 生成 canary handoff：记录兼容 DSH 版本、bundle digest、测试证据路径、已知 overlay trade-off、下一批 view provider 与 additive dock slot blocker。验收：OpenSpec 保持 valid，未把未实现的 Terminal/Git/File provider 描述为已交付。
