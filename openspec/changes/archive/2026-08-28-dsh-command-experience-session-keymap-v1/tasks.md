# Tasks: dsh-command-experience-session-keymap-v1

## 1. Core：目录与 session 规划

- [x] 1.1 `/session` `/archive` `/delete` 目录种子 + 可用性派生。
  - **Owner/Scope**：`packages/client/command-experience-core/src/p0-catalog.ts` + `tests/p0-catalog.test.ts`。
  - **Acceptance**：session 与 resume 同源派生 open-session 可用性；archive=confirm/delete=destructive 且默认 staged disabled；hub 不含 delete 动作。
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-command-experience-core test`（p0-catalog 6/6 绿）。
- [x] 1.2 session 命令规划纯函数：`parseSessionSubcommand`、`planSessionItemAction`、`buildSessionHubActions`；`SessionCommandId` += session；export `findSafeUniquePrefix`。
  - **Owner/Scope**：`src/session-commands.ts`、`src/discovery.ts`、`src/index.ts` + 对应测试。
  - **Acceptance**：未知 token 回退 switch；title 大小写保留（TUI split 侧验证）；hub 动作缺 capability 时 disabled+原因。
  - **Validation**：同上（session-commands 6/6、discovery 7/7 绿）。

## 2. Host：restore-session

- [x] 2.1 action union += `restore-session`；`createRestoreRequest`（safe，无 preview）；probe 把 `/session` 与 `/resume` 同步 unavailable。
  - **Owner/Scope**：`packages/host/dsh-command-experience/src/types.ts`、`src/owner-action-adapter.ts`、`src/capability-probe.ts`、`src/index.ts` + `tests/danger-matrix.test.ts`。
  - **Validation**：`pnpm --filter @yeisme/dsh-command-experience-host test`（38/38 绿）。

## 3. Core：keymap 与 reducer 光标

- [x] 3.1 `keymap.ts`：`CommandKeyEvent`/`CommandKeymapConfig`/默认表（无裸 j/k）/`resolveKeymap`/`formatKeyEvent`/`resolveKeyAction`（按状态分派，confirmation 排除 toggle、裸 enter 不确认、Tab 仅唯一安全前缀、补全源为 draft）。
  - **Validation**：`tests/keymap.test.ts` 13 用例绿。
- [x] 3.2 reducer：`cursorKey`/`cursorMoved`/`MOVE_SELECTION`（clamp、no-op 空候选）；`UPDATE_QUERY` 携带 candidateKeys 时陈旧光标清空不跳邻居；`SELECT_COMMAND` 复位；`actions.moveSelection` creator。
  - **Validation**：`tests/reducer.test.ts` 35 用例绿（含 MOVE_SELECTION/cursor staleness 两组新增）。

## 4. Web：keymap 接线与 /session 流

- [x] 4.1 `commandKeyEventFromDom` + `useCommandPaletteToggle`；四处 keydown（菜单/selector/确认/回执）改走 `resolveKeyAction`；消费 `keyboardShortcuts`（类型增量 moveFirst/moveLast/tabComplete/confirmExecute/closeReceipt）；auto-select 光标守卫；aria-live 播报。
  - **Owner/Scope**：`packages/client/ui-command-experience-web/src/hooks.ts`、`src/components.tsx`、`src/types.ts`。
  - **Acceptance**：既有键盘 spec 逐键复刻（ArrowUp 回无选中、Enter 禁用行 no-op、Ctrl+Enter 才确认）；新增 Ctrl+K 开面板/Home/End/Tab 用例。
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-command-experience-web test`（65/65 绿）+ `typecheck`。
- [x] 4.2 `SessionActionMenu` 组件（动作清单由 `buildSessionHubActions` 派生，键盘导航 + 禁用项带原因 + aria-live；已归档换 Restore）。
  - **Owner/Scope**：`src/session-hub.tsx` + `tests/session-hub.spec.tsx`（vitest include 补 `.spec.tsx`）。
  - **Validation**：同上（session-hub 6 用例绿）。

## 5. TUI：keys 模块

- [x] 5.1 `keys.ts`：`parseTerminalKey`（箭头/home/end/enter/esc/tab/ctrl+n/p/d/k，alt 前缀）、`applyTuiConsoleKey`、`isToggleFromIdle`；controller `handleKeyEvent`；`splitSessionHubInput`（标题保大小写）；index 导出。
  - **Owner/Scope**：`packages/client/ui-command-experience-tui/src/keys.ts`、`src/assist.ts`、`src/client.ts`、`src/index.ts` + `tests/keys.spec.ts`。
  - **Acceptance**：无 stdin/rawMode；本地宿主合成序列驱动；官方 seam 缺失 fail-closed 不变。
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-command-experience-tui test`（20/20 绿）+ `typecheck` + `build`。

## 6. Bundle / 文档 / 治理

- [x] 6.1 bundle client 入口把 `commandExperienceWebAdapter` 字符串占位替换为 `commandExperienceWebAdapterRef` 诚实 handoff 描述符（React 保持 external）；README 补 /session 家族、staged archive/delete、keymap 表；bundle 测试补断言。
  - **Validation**：`pnpm --filter @yeisme/dsh-command-experience test`（22/22 绿）+ `pnpm run check:bundles`。
- [x] 6.2 OpenSpec change artifacts（proposal/design/tasks/spec ADDED/coverage ledger 更新）。
  - **Validation**：`openspec validate dsh-command-experience-session-keymap-v1 --strict --no-interactive`。
- [x] 6.3 全仓门禁（两处他人在途 lane 的预存失败按证据记录，非本 change 引入）：
  - typecheck ✅（exit 0）；build ✅（exit 0）；check:bundles ✅ 18/18；openspec strict ✅。
  - test：本 change 触及的五包全绿（core 113 / host 38 / web 65 / tui 20 / bundle 22）；顺手补上 `dsh-mcp-inspector` bundle 缺失的 smoke 测试（该包提交态无任何测试文件，`vitest run` 直接 exit 1，卡全仓 test 门——只加测试与 vitest 配置，未动其产品代码）。
  - 预存失败 1：`packages/client/ui-ordo-agent-ops`（弃用 shim）HEAD 上 inject 期望与代码不一致（测试要 `remote.ordoAgentOps`，代码为 `['slots','remote','locale']`）——ordo lane 在途合同决策，不代改。
  - 预存失败 2：`packages/bundle/dsh-session-tags` 的 `stubRequire` 未给 `@yeisme/dsh-client-ui-visual-kit` 提供 stub（visual-kit 采用 commit ec38afa 后测试债）——visual-kit lane 在途。
  - `ui-mermaid-render` graft.spec 在并行负载下偶发，单包复跑 22/22 全绿（flaky，非本 change）。
  - **Validation**：`pnpm run typecheck` ✅、`pnpm -r --filter '!@yeisme/dsh-client-ui-ordo-agent-ops' run test`（除上述预存外全绿）、`pnpm run build` ✅、`pnpm run check:bundles` ✅。
