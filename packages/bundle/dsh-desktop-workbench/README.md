# @yeisme/dsh-desktop-workbench

Self-maintained DSH Pane view-provider bundle. It contributes conversation
management, files, documents, media, history search, notifications, and terminal views to the shared right /
bottom workspace.

The DSH sidebar remains the canonical conversation browser. This bundle does not
register `SessionSidebar` or a second full-screen shell. Its “对话” footer action
opens the additive `desktop.sessions` Pane view, which consumes `sessionOrganization`
and the DSH sessions/history owners. Missing organization Host state renders a
capability reason rather than fake rows. Files/Git footer
actions open views on the shared Pane Workbench. On official DSH without Core
Pane slots, Pane Workbench hosts those views in an additive right dock via
`shell.overlay`; idle overlay seats render nothing. The exported
`DesktopWorkbenchOverlay` is retained for one RC as a deprecated story
component only.

This bundle prefers Pane Workbench V2 with `shell.workspace.right`,
`shell.workspace.bottom`, and `ctx.workspaceLayout`. The npm peer is the
published layout (`@deepseek-ai/dsh-client-ui-layout >=0.1.0-rc.9 <0.2.0`).
Official layout `0.1.0-rc.9` still lacks the full Core Pane seam
(`upstream-prs/pane-workspace-layout/`). Until it lands, Pane Workbench
provides `ctx.paneWorkbench` through sidebar footer + overlay dock so Files/Git
and Agents remain usable. Residual `workspaceLayout` without declared Right/Bottom
slots uses that official host; declared pre-Core slots stay fail-closed. To hide
the rows entirely:

```bash
dsh plugin --profile web remove @yeisme/dsh-pane-workbench
dsh plugin --profile web remove @yeisme/dsh-desktop-workbench
```

The client discovers optional owner services through `dsh.fileHost`,
`dsh.mediaHost`, and the interactive `dsh.terminalHost` V2 capability. File
views register from `/yeisme-files/api` (`fs.tree` / `fs.read`) when
`dsh.fileHost` is absent, so a stock Web profile shows workspace files and
text preview without installing `dsh-better-sidebar`. 所有文件入口现在打开
canonical `dsh.explorer`；`desktop.files` 只作为隐藏兼容 shim。目录单击展开，
文件单击在严格 owner inspect 通过后打开临时 preview，双击或 Enter 固定；
无法预览的条目仍可见但不会被打开或引用。Explorer 同时挂载结构化引用 dock、
proposal-first 文件操作、trash/undo、分块 import 与一次性 download。Git status
仍是独立只读 porcelain pane。

If `paneWorkbench` is already provided by `@yeisme/dsh-pane-workbench`, this
bundle reuses it. If not, the client bootstraps the shell in-process. Do not
insert a second `pane-workbench` loader id in this package's patch — that
duplicates the dedicated Pane Workbench bundle and fails boot.

Install:

```bash
dsh plugin --profile web add ./packages/bundle/pane-workbench
dsh plugin --profile web add ./packages/bundle/dsh-desktop-workbench
```

A profile that already has `@yeisme/dsh-pane-workbench` only needs the second
command.

Look at the right workspace pane, not the DSH session list. A view and its launcher are registered only when the matching real
owner or official browse seam is present. Missing services therefore do not
create placeholder tabs, fake terminal sessions, or dead actions. Persisted
tabs whose owner was removed remain as the Pane Workbench compatibility state
and can be closed or retried. This bundle does not import
`dsh-better-sidebar` or call `ctx.betterSidebar`.

History search and notifications stay out of the production provider catalog
until their real owner adapters are mounted; their placeholder hosts are test
fixtures only.

For organization management, install the sidecar bundle as well:

```bash
dsh plugin --profile web add ./packages/bundle/dsh-session-tags
dsh plugin --profile web add ./packages/bundle/dsh-desktop-workbench
```

The manager supports Workspace/function/tag/status filters, all-visible
selection, batch preview and receipts, rules, 30-day undo history, and a
temporary administrator gate for permanent deletion. Session lifecycle success
always comes from the DSH owner adapter.

## Development

```bash
pnpm --filter @yeisme/dsh-desktop-workbench run typecheck
pnpm --filter @yeisme/dsh-desktop-workbench run test
pnpm --filter @yeisme/dsh-desktop-workbench run build
```

## Install

```bash
dsh plugin --profile web add ./packages/bundle/dsh-desktop-workbench
```
