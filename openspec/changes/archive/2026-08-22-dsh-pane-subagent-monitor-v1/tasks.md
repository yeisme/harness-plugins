## 1. Package foundation

- [x] 1.1 [Owner: Harness Plugins；Scope: `packages/client/ui-pane-subagent/`；Dependencies: none] 创建 `@yeisme/dsh-client-ui-pane-subagent` package，配置 package.json、tsconfig、README、tsdown。Acceptance: typecheck/build 通过；Validation: `pnpm --filter @yeisme/dsh-client-ui-pane-subagent run typecheck`。
- [x] 1.2 [Owner: Harness Plugins；Scope: package tests；Dependencies: 1.1] 增加 `SubagentPaneProjectionV1` safe schema 与 projection selector。Acceptance: 非法字段、绝对路径、未知 status 被拒绝；Validation: `pnpm --filter @yeisme/dsh-client-ui-pane-subagent run test`。

## 2. Controller and view

- [x] 2.1 [Owner: Harness Plugins；Scope: `src/controller.ts`；Dependencies: 1.2] 实现 `SubagentMonitorController`：订阅 `ctx.sessions.list`，生成 bounded projection。Acceptance: 当前会话切换后投影重置，dispose 后无订阅残留；Validation: focused Vitest。
- [x] 2.2 [Owner: Harness Plugins；Scope: `src/SubagentMonitorView.tsx`；Dependencies: 2.1] 实现树、running/inactive、tokens/time、refresh、open-in-main。Acceptance: 键盘可导航，叶子无展开箭头，orphaned 可恢复；Validation: component Vitest。
- [x] 2.3 [Owner: Harness Plugins；Scope: `src/index.ts`；Dependencies: 2.2] 注册 `subagent.monitor` Pane view，并在 header actions 增加 “Agents” 入口。Acceptance: 点击入口打开 Pane view，Pane 缺失时保留 header catalog；Validation: component/browser test。

## 3. Bundle and official assembly

- [x] 3.1 [Owner: Harness Plugins；Scope: `packages/bundle/pane-subagent/`；Dependencies: 2.3] 创建可安装 bundle，组合 pane-workbench 与 subagent monitor。Acceptance: `dsh plugin --profile web add` 后可安装/移除，dump 无残留；Validation: `pnpm --filter @yeisme/dsh-pane-subagent run test`。
- [x] 3.2 [Owner: Harness Plugins；Scope: profile evidence；Dependencies: 3.1] 运行真实 Web profile Loader conformance，证据写入 `temp/integration-test-runs/<run-id>/`。Acceptance: 安装/启动/移除全绿；Validation: bundle conformance script。

## 4. Detail management slice

- [x] 4.1 [Owner: Harness Plugins；Scope: `src/detail.tsx`；Dependencies: 2.2] 接入 `ctx.connection.api.subagents.history/prompt/interrupt`，实现只读 peek、send follow-up、interrupt。Acceptance: 仅 continuable 可 send/interrupt，receipt 驱动状态，不乐观成功；Validation: integration Vitest。
- [x] 4.2 [Owner: Harness Plugins；Scope: tests；Dependencies: 4.1] 增加 keyless integration test，覆盖 accepted/rejected/unknown 与 action receipt。Validation: `pnpm --filter @yeisme/dsh-client-ui-pane-subagent run test`。

## 5. Parallel and outcome

- [x] 5.1 [Owner: Harness Plugins；Scope: `src/parallel-mode.ts`；Dependencies: 4.1] 实现 Parallel/Swarm steering 开关，固定有界指令包裹下一条主会话 prompt。Acceptance: 开关不影响普通 prompt，指令不进入投影；Validation: focused Vitest。
- [x] 5.2 [Owner: DSH；Scope: additive subagent outcome projection；Dependencies: none] 增加 `subagentOutcome` 投影或扩展 `SubagentListEntry` outcome 字段。Acceptance: 可区分 completed/failed/cancelled；Validation: DSH 自身测试。
- [x] 5.3 [Owner: Harness Plugins；Scope: view；Dependencies: 5.2] Pane 消费 outcome 投影，显示终态与失败筛选。Validation: snapshot + component Vitest。

## 6. Final gates

- [x] 6.1 [Owner: Harness Plugins；Scope: all new packages；Dependencies: 5.3] 运行 `pnpm run typecheck`、`pnpm run test`、`pnpm run build`、`openspec validate dsh-pane-subagent-monitor-v1 --strict --no-interactive`、`git diff --check`。Acceptance: 全部通过。
