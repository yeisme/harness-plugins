## 收束状态（2026-08-16）

- 本次仅在 `dsh-pane-workbench-interaction-v1` 引入 Pane core/chrome/registry 实现；5.2 现按 owner change 的 1.*–4.* acceptance 收束，未创建第二 reducer。
- `packages/bundle/pane-workbench/` 已创建并通过 disposable profile 的 install/dump/real Web Loader boot/remove conformance；5.3 仍保持 open 的原因仅是浏览器 DOM/ARIA install-load-unload evidence 尚未在本仓库可复现的 Playwright runner 中闭环，不能用 Host boot 或 jsdom 替代。

## 1. Protocol package

- [x] 1.1 [Owner: Harness Plugins；Scope: `packages/host/pane-protocol/`；Dependencies: none] 用 package manager 初始化 `@yeisme/dsh-pane-protocol@0.1.0-rc.1`，新增 TypeScript/Zod plugin、event、projection、artifact 与 intent 合同；复杂 validation、状态边界和兼容逻辑添加 concise English JSDoc/comment。Acceptance: public exports 只含 safe headless contract，未引用 React、Ordo 或参考插件。Validation: `pnpm --filter @yeisme/dsh-pane-protocol run typecheck`；Expected: exit 0；Failure re-check: 先检查 package export/type dependency，不修改其他 package。
- [x] 1.2 [Owner: Harness Plugins；Scope: protocol tests；Dependencies: 1.1] 增加 valid/invalid、unsafe field、budget、unknown schema 与 additive compatibility fixture。Acceptance: forbidden absolute path/raw prompt/arbitrary component/module input typed 拒绝。Validation: `pnpm --filter @yeisme/dsh-pane-protocol run test`；Expected: all pass；Failure re-check: 不通过放宽 schema 隐藏 break。

## 2. Client registry and event runtime

- [x] 2.1 [Owner: Harness Plugins；Scope: `packages/client/ui-pane-workbench/`；Dependencies: 1.1] 用 package manager 初始化 planned client package，新增 plugin registry、disposer、generation reset 与 capability admission；不实现 React chrome。Acceptance: duplicate id fail closed、old generation late event ignored、dispose 后 snapshot 无残留。Validation: `pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test`；Expected: all pass；Failure re-check: 检查 logical identity/disposer，不加全局永不释放 flag。
- [x] 2.2 [Owner: Harness Plugins；Scope: client event reducer；Dependencies: 2.1] 实现纯 `applyPaneEvent`，覆盖 snapshot/upsert/remove/append/invalidate/action_receipt/reset、duplicate/gap/context drift/version rollback 与 bounded state。Acceptance: gap 保留 last safe state 并进入 reconcile，重复 event 返回 same reference。Validation: client focused Vitest；Expected: all pass；Failure re-check: 不用 timer/polling 或 mutable singleton 修补。
- [x] 2.3 [Owner: Harness Plugins；Scope: client artifact intent；Dependencies: 1.2, 2.1] 实现 ArtifactRef/Intent registry 与 mock handoff canary。Acceptance: pointer/keyboard/menu 可共享同一 intent builder，SDK 不执行 owner mutation。Validation: client focused Vitest；Expected: all pass。

## 3. DSH and source-independence canary

- [x] 3.1 [Owner: Harness Plugins；Scope: integration test only；Dependencies: 2.2] 使用真实 `@deepseek-ai/dsh-session-projection`/`dsh-session` 完成 projection → Pane runtime canary。Acceptance: whole-value snapshot/change 连续映射且无轮询；生产 package 不发布 canary projection key。Validation: client integration Vitest；Expected: all pass；Failure re-check: 若 official surface 不满足，记录 contract mismatch 并停止，不 patch core。
- [x] 3.2 [Owner: Harness Plugins；Scope: both new packages；Dependencies: 1.2, 2.3] 增加 source-independence scan，覆盖 manifest/source/build output。Acceptance: 正常代码通过，含参考插件依赖的负向 fixture 失败。Validation: two package tests + `git diff --check`；Expected: exit 0。

## 4. Compatibility and evidence

- [x] 4.1 [Owner: Harness Plugins；Scope: OpenSpec + package docs；Dependencies: 3.1, 3.2] 记录 surface 为 additive experimental，列出稳定起点、rollback 与未来 breaking gate；README 使用真实 typecheck/test/build 命令，并把可安装 bundle 与未完成 browser gate 分开说明。Acceptance: 无 silent generation break，deprecation window 记为 not-applicable。Validation: `openspec validate dsh-pane-plugin-platform-v1 --strict --no-interactive`；Expected: valid。
- [x] 4.2 [Owner: Harness Plugins；Scope: focused final gates；Dependencies: 4.1] 运行两个新 package 的 typecheck/test/build、OpenSpec strict validation 与 diff check。Acceptance: 新路径全绿；仓库其他 dirty failure 标注 pre-existing/concurrent，不改无关业务。Validation: `pnpm --filter @yeisme/dsh-pane-protocol run typecheck && pnpm --filter @yeisme/dsh-pane-protocol run test && pnpm --filter @yeisme/dsh-pane-protocol run build && pnpm --filter @yeisme/dsh-client-ui-pane-workbench run typecheck && pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test && pnpm --filter @yeisme/dsh-client-ui-pane-workbench run build && openspec validate dsh-pane-plugin-platform-v1 --strict --no-interactive && git diff --check`；Expected: exit 0。

## 5. Retained next slice

- [x] 5.1 [Owner: DSH core/client owner；Scope: `/workspaces/yeisme-agent/client/deepseek-harness/apps/cli/`；Dependencies: 4.2] 通过官方 DSH CLI 实现 developer manifest `init|validate|pack`，所有 machine-readable plugin metadata 由 CLI 生成。Acceptance: invalid four-face/compatibility/permission manifest typed 拒绝；Validation: `pnpm exec vitest run apps/cli/tests/args.spec.ts apps/cli/tests/plugin-manifest.spec.ts`（16 tests）、`pnpm exec tsc -b apps/cli`。
- [x] 5.2 [Owner: Harness Plugins；Scope: `dsh-pane-workbench-interaction-v1`；Dependencies: 4.2] 继续 core layout reducer、React chrome、a11y、retention、persistence 与 responsive projection。Acceptance/validation: 以该 owner change tasks 为准，不在本 change 建第二 reducer。（`dsh-pane-workbench-interaction-v1` 的 1.*–4.* core slice 已完成；`pnpm --filter @yeisme/dsh-client-ui-pane-workbench run typecheck`、`run test`（10 files/49 tests）与 `run build` 通过，focused evidence 位于 `temp/integration-test-runs/2026-08-17T17-29-25-919Z-2383503/` 和 `temp/integration-test-runs/2026-08-17T17-29-25-914Z-2383502/`。本 change 不创建第二 reducer；5.3 bundle/profile 已有 local conformance，browser gate 仍保持 open。）
- [ ] 5.3 [Owner: Harness Plugins；Scope: bundle/profile；Dependencies: 5.1, 5.2] 创建 `packages/bundle/pane-workbench/` 并通过 official `shell.overlay` 装配真实 Web profile。当前已完成 bundle/patch/README、thin client face、packed members、`dsh plugin --profile web add/remove`、`dsh --profile web --dump-config` 和真实 Web Loader 启动；最新串行证据：`temp/integration-test-runs/2026-08-18T03-15-23-655Z-3426823-pane-profile/summary.json`（此前 evidence 仍保留）。Acceptance 的 browser evidence 仍 open：外部 DSH workspace 的 Playwright runner 在当前 checkout 因缺少 Harness Plugins workspace package 无法直接复用，且本仓库未安装可执行 browser runner；失败不使用 DOM patch。

## 2026-08-16 收束状态

- 5.1 已转移到 DSH core/client owner 并完成：官方 `dsh plugin manifest` namespace 保持既有 profile plugin forwarding，CLI focused tests 与 typecheck 通过。
- 5.2 已按 `dsh-pane-workbench-interaction-v1` 的 core tasks 收束；5.3 保持未完成：Pane client 尚未形成 bundle、clean profile 或 browser evidence。
