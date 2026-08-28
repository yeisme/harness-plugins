# Design: dsh-pane-agents-host-compat-v1

## Host probe

`probePaneWorkbenchHost()` 不变：完整 Core 仍要求 `workspace.core-pane.v1`、`shell.workspace.right`、`shell.workspace.bottom`、`ctx.workspaceLayout`。

`hasPartialWorkspaceHost()` 收紧为：两个 workspace slot **均已 `slots.spec` 声明** 且 Core 不可用。仅有残缺 `workspaceLayout`、slots 未声明 Right/Bottom 时返回 false，`apply()` 走 `mountOfficialSidebarPaneHost`。

| 运行时 | 行为 |
| --- | --- |
| 完整 Core + Right/Bottom | Core host |
| 官方 rc.9：残缺 layout、未声明 workspace slots | official overlay + footer + header，`provide('paneWorkbench')` |
| slots 已声明 Right/Bottom，缺 `corePaneVersion` | fail-closed；不 inject overlay；入口禁用 + 原因 |

不实现 `ui-layout` 几何。完整四列仍等 `upstream-prs/pane-workspace-layout` 合入。

## Peer

`@deepseek-ai/dsh-client-ui-layout` peer 从 `>=0.1.1-rc.3 <0.2.0` 放宽为 `>=0.1.0-rc.9 <0.2.0`。`REQUIRED_LAYOUT_VERSION` 仍描述完整 Core 目标 seam，不再当作 npm 安装下界。

## Icon entries

- Header / sidebar footer Agents：可见文本去掉，渲染与 `WorkbenchIcon` `agents` 相同的 stroke SVG；`aria-label` 为 `Open Agents pane`。
- Official「窗格」：`WorkbenchIcon` `window`；`aria-label` 仍为 `Toggle workspace panes`。
- 右侧 rail：若 registry 有 `subagent.monitor`，常驻 Agents 按钮，点击 `openView`；与 Explorer/Git 一样从动态 opened-view 列表排除该 kind，避免重复图标。
- `paneWorkbench` 或当前 session 缺失时按钮 `disabled` + `aria-disabled` + `title` 原因，`onClick` 不调用 `openView`。

## Non-goals

- 不发布 `@deepseek-ai/dsh-client-ui-layout@0.1.1-rc.3`。
- 不改 Details 栏、conversation sidebar、V3 picker/tab 重做。
- 不新增图标库。
