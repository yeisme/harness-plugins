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

Canonical Explorer 优先使用 additive `FileTreeProjectionCapabilityV2`：分页返回
`workspaceRef/generation/revision/cursor`，显示 hidden、ignored、敏感名称和
symlink 状态，并由 `FileInspectCapabilityV1` 决定资源能否打开。敏感正文需要
session/ref/version 绑定的短期 reveal token；无效 session 不回退
`process.cwd()`。

本地受保护单用户 Host 还提供 `FileResourceMutationCapabilityV1` 与
`FileTransferCapabilityV1`。资源操作经过 preflight/execute/reconcile/undo，
trash 位于 workspace 外；上传使用二进制 chunk，下载使用一次性短期 ticket。

Live updates require `FileWatchCapabilityV1`. The workspaces browse adapter
and the explorer host do not advertise that capability. Without it, File Pane
stays on-demand `listEntries` and must not claim realtime or poll.

## Development

```bash
pnpm --filter @yeisme/dsh-file-host run typecheck
pnpm --filter @yeisme/dsh-file-host run test
pnpm --filter @yeisme/dsh-file-host run build
pnpm run test:explorer-file-manager-integration
```
