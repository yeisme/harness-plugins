# dsh-pane-agents-host-compat-v1

## Why

官方 Web 安装了 `@yeisme/dsh-pane-workbench` 后，顶部 **Agents** 点击无反应：`ui-layout 0.1.0-rc.9` 暴露残缺 `workspaceLayout`、缺少完整 `workspace.core-pane.v1`，Pane Workbench 把半成品宿主当成 pre-Core 而整机停挂，`paneWorkbench` 不提供。Agents 入口静默 return，左下角「窗格」与右侧 44px 轨道也不出现。同时 peer 钉死未发布的 `@deepseek-ai/dsh-client-ui-layout >=0.1.1-rc.3`，ModuleLoader 出现 404。入口仍是文字按钮，与已有 Activity Rail 图标不一致。

## What Changes

- 收紧 pre-Core fail-closed：仅当 `shell.workspace.right` 与 `shell.workspace.bottom` 均已声明、但缺少 `workspace.core-pane.v1` 时停挂载。残缺 `workspaceLayout`、未声明 workspace slots 时走已有 official overlay / footer / header，并 `provide('paneWorkbench')`。
- peer 放宽为 `>=0.1.0-rc.9 <0.2.0`，消除对幽灵 `0.1.1-rc.3` 的安装/加载 404。完整 Core 列仍要求未发布 seam，由运行时 probe 表达。
- Agents / 窗格入口改为 32×32 icon-only（`title` + `aria-label` 保留文字）。`paneWorkbench` 缺失时禁用入口并给出原因，禁止死按钮。右侧 Activity Rail 在 `subagent.monitor` 已注册时增加常驻 Agents 图标。

## Boundary Decision

`split-owner`：AppFrame 几何与 Core Pane 合同属 DSH `ui-layout`（`upstream-prs/pane-workspace-layout/`）。本仓库只做插件 probe、official overlay 宿主、入口呈现与 peer 合同。不伪造四列布局，不占用 `details`。

## Capabilities

### New Capabilities

- `dsh-pane-agents-entry`: Agents / 窗格入口为 icon-only；缺 `paneWorkbench` 时禁用并写明原因。

### Modified Capabilities

- `dsh-pane-workbench-extension`: pre-Core fail-closed 仅适用于「workspace slots 已声明但 Core 合同缺失」。

## Impact

- `packages/client/ui-pane-workbench`、`packages/client/ui-pane-subagent`、`packages/bundle/pane-workbench`、`packages/bundle/dsh-desktop-workbench`。
- 完成门：受影响包 test / typecheck / build + `openspec validate dsh-pane-agents-host-compat-v1 --strict --no-interactive`。官方 `dsh web` 不是完成门。
