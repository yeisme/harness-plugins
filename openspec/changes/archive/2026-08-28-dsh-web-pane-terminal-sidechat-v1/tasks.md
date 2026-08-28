## 1. OpenSpec

- [x] 1.1 [Owner: Harness Plugins；Scope: proposal/design/specs/tasks；Dependencies: none] 完成四件 artifact。验收：`openspec validate dsh-web-pane-terminal-sidechat-v1 --strict --no-interactive` 通过。

## 2. Terminal host：`terminalPane` Remote

- [x] 2.1 [Owner: Harness Plugins；Scope: `packages/host/dsh-terminal-host/src/wire.ts`；Dependencies: 1.1] 冻结 wire 合同（`probe/list/spawn/read/send/signal/close` 判别式、typed 失败码、上限、`TerminalPaneSummaryV1`）。验收：单测穷举判别分支。
- [x] 2.2 [Owner: Harness Plugins；Scope: `packages/host/dsh-terminal-host/src/adapter.ts`；Dependencies: 2.1] 官方 `ctx.terminals`/`ctx.agents` 结构化探测与适配（形状漂移 → `contract_mismatch`；owner 解析；上限裁剪）。验收：fake terminals fixture 单测含漂移用例。
- [x] 2.3 [Owner: Harness Plugins；Scope: `packages/host/dsh-terminal-host/src/remote.ts`；Dependencies: 2.2] `TerminalPaneRemoteService`（TypertRemoteService，namespace `terminalPane`）。验收：cordis 测试上下文注册/注错单测。
- [x] 2.4 [Owner: Harness Plugins；Scope: `packages/host/dsh-terminal-host/src/plugin.ts` + `index.ts`；Dependencies: 2.3] 动态注入装配（`ctx.inject(['terminals','agents'])` 结构化，缺席可载入），既有导出全保留。验收：包测试全绿 + 既有导出快照不回归。

## 3. Terminal client：console 视图

- [x] 3.1 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-terminal/src/client/remote.ts`；Dependencies: 2.1] `terminalPane` Remote contribution + `$mount` 自挂解析（缺席 → undefined）。验收：resolution 单测（direct/mount/均失败三态）。
- [x] 3.2 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-terminal/src/client/console-controller.ts`；Dependencies: 3.1] 控制器状态机（probing/disabled/ready、owner session 切换、send 锁、ConversationSnapshot 事件驱动重读、无定时器）。验收：fake remote 状态机单测。
- [x] 3.3 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-terminal/src/client/console-view.tsx`；Dependencies: 3.2] 视图（列表/picker、滚回渲染、composer、信号、状态徽标、禁用态文案）+ i18n zh/en。验收：渲染矩阵单测。
- [x] 3.4 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-terminal/src/client/index.ts`；Dependencies: 3.3] Cordis client face：pane 视图 `dsh-terminal.console` + `terminal.open` 命令 + slash `terminal` 注册，探针缺席零注册。验收：fake paneWorkbench 注册单测。

## 4. Terminal bundle 装配

- [x] 4.1 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-terminal/`；Dependencies: 3.4] 重组双 face（root=host 组合、`./client`），新增 `cordis.patch.yml`，package.json `dsh` 段与 exports 对齐 token-usage 模式。验收：`pnpm --filter @yeisme/dsh-terminal run test/build` + `check:bundles` 过。

## 5. Side chat 包

- [x] 5.1 [Owner: Harness Plugins；Scope: `packages/client/ui-pane-side-chat/src/controller.ts`；Dependencies: 1.1] 附着/新建/fork 控制器（binding 订阅、create 探测、prompt/steer/cancel、open 零调用断言）。验收：fake sessions 单测含 open 计数断言。
- [x] 5.2 [Owner: Harness Plugins；Scope: `packages/client/ui-pane-side-chat/src/view.tsx`；Dependencies: 5.1] 渲染（节点投影、折叠工具卡、错误、queue 计数）+ composer + picker + 已移除态 + i18n zh/en。验收：渲染矩阵单测。
- [x] 5.3 [Owner: Harness Plugins；Scope: `packages/client/ui-pane-side-chat/src/register.ts` + `index.ts`；Dependencies: 5.2] 视图 `dsh-side-chat.session` + `side-chat.open` 命令 + slash 注册，探针缺席零注册。验收：注册单测。

## 6. Side chat bundle

- [x] 6.1 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-side-chat/`；Dependencies: 5.3] 新包（host face 透传、`./client`、cordis.patch.yml、smoke）。验收：`pnpm --filter @yeisme/dsh-side-chat run test/build` + `check:bundles` 过。

## 7. 验证与证据

- [x] 7.1 [Owner: Harness Plugins；Scope: tests/integration；Dependencies: 4.1, 6.1] fake host 端到端（terminalPane Remote 调用链 + side chat binding 链），证据落 `temp/integration-test-runs/<run-id>/`。验收：两 spec 通过且证据六件套脱敏。
- [x] 7.2 [Owner: Harness Plugins；Scope: 仓根 gates；Dependencies: 7.1] `pnpm run typecheck && pnpm run test && pnpm run build && pnpm run check:bundles && openspec validate --strict`。验收：全绿。
- [x] 7.3 [Owner: Harness Plugins；Scope: docs；Dependencies: 7.2] `docs/design/` 设计说明 + `docs/README.md` 索引 + 两个包 README。验收：链接可达、与实现一致。
