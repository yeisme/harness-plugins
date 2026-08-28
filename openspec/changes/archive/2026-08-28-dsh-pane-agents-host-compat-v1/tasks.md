# Tasks: dsh-pane-agents-host-compat-v1

## 1. Host probe and peer

- [x] 1.1 收紧 `hasPartialWorkspaceHost`：仅两个 workspace slot 均已声明时 fail-closed；残缺 `workspaceLayout` 走 official host。
  - **Owner/Scope**：`packages/client/ui-pane-workbench/src/client.ts` + `tests/client-v2.spec.ts`。
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-pane-workbench test`
- [x] 1.2 peer 放宽为 `@deepseek-ai/dsh-client-ui-layout >=0.1.0-rc.9 <0.2.0`；README / patch 注释同步。
  - **Owner/Scope**：`packages/client/ui-pane-workbench/package.json`、`packages/bundle/pane-workbench/**`、`packages/bundle/dsh-desktop-workbench/**`。
  - **Validation**：`pnpm --filter @yeisme/dsh-desktop-workbench test`

## 2. Icon entries

- [x] 2.1 official 窗格入口改为 `WorkbenchIcon` icon-only。
  - **Owner/Scope**：`packages/client/ui-pane-workbench/src/official-host.ts` + `tests/official-host.spec.tsx`。
- [x] 2.2 Right rail 在 `subagent.monitor` 已注册时增加常驻 Agents 图标。
  - **Owner/Scope**：`packages/client/ui-pane-workbench/src/region-chrome.ts` + `tests/region-chrome.spec.tsx`。
- [x] 2.3 Subagent Agents 入口改为 icon-only；缺 `paneWorkbench` 时禁用 + 原因。
  - **Owner/Scope**：`packages/client/ui-pane-subagent/src/index.ts` + `tests/apply.spec.ts`。
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-pane-subagent test`

## 3. Gates

- [x] 3.1 受影响包 typecheck/test/build + `openspec validate dsh-pane-agents-host-compat-v1 --strict --no-interactive`。
