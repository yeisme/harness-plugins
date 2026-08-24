# @yeisme/dsh-desktop-workbench

Self-maintained DSH Pane view-provider bundle. It contributes files, documents,
media, history search, notifications, and terminal views to the shared right /
bottom workspace.

The DSH sidebar remains the only conversation browser. Production code does
not register `shell.overlay`, `SessionSidebar`, or a second full-screen shell.
The exported `DesktopWorkbenchOverlay` is retained for one RC as a deprecated
story component only.

This bundle requires Pane Workbench V2 and a DSH layout exposing
`shell.workspace.right`, `shell.workspace.bottom`, and `ctx.workspaceLayout`
(peer range: `@deepseek-ai/dsh-client-ui-layout >=0.1.1-rc.3 <0.2.0`).
Older DSH builds fail with an explicit compatibility error rather than falling
back to an overlay that covers the sidebar. No released DSH ships the core-pane
seam yet (latest is 0.1.1-rc.2; the seam lives in
`upstream-prs/pane-workspace-layout/` awaiting upstream merge), so on release
channel DSH both `@yeisme/dsh-pane-workbench` and this bundle refuse to load by
design. Until a seam release lands, remove both rows:

```bash
dsh plugin --profile web remove @yeisme/dsh-pane-workbench
dsh plugin --profile web remove @yeisme/dsh-desktop-workbench
```

The client discovers optional owner services through `dsh.fileHost`,
`dsh.mediaHost`, and the interactive `dsh.terminalHost` V2 capability. File
views register from `/yeisme-files/api` (`fs.tree` / `fs.read`) when
`dsh.fileHost` is absent, so a stock Web profile shows workspace files and
text preview without installing `dsh-better-sidebar`. The files pane opens on the right automatically. Click a file to open it
as a content tab (Codex-style preview); double-click pins it. Header and
sidebar-footer buttons reopen the tree. Git status is a read-only porcelain
pane.

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
