# @yeisme/dsh-file-host

Self-maintained DSH file host. It exposes safe `FileEntryV1` projections for the
desktop workbench file tree and owner-authorized preview sources.

Real owners can publish the host through Cordis context key `dsh.fileHost`.
When that owner is absent, Desktop Workbench builds an on-demand host from
the official DSH `ctx.workspaces.listDirectory` browse seam. The browser
receives opaque ids and bounded metadata only; absolute paths and raw
filesystem URLs never cross the host boundary.

The node half (`@yeisme/dsh-file-host/node`) lists files and directories with
`opendir` and a bounded text read, adapted from the DSH-better-sidebar
`fs.tree` / `fs.read` contract. Desktop Workbench serves it at
`/yeisme-files/api`. The browser host (`createExplorerFileHost`) consumes
that API and never sees raw paths.

Live updates require `FileWatchCapabilityV1`. The workspaces browse adapter
and the explorer host do not advertise that capability. Without it, File Pane
stays on-demand `listEntries` and must not claim realtime or poll.

## Development

```bash
pnpm --filter @yeisme/dsh-file-host run typecheck
pnpm --filter @yeisme/dsh-file-host run test
pnpm --filter @yeisme/dsh-file-host run build
```
