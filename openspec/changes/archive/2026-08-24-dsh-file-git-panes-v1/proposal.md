## Why

根级任务 3.2 要求 File watcher 与 Git Manager 接入同一 Pane 平台。DSH `ctx.fs` watcher 尚未合入上游；现有 File Pane 只做按需 `listEntries`。若客户端用轮询假装实时，会违反 snapshot+push 合同。Git 若接受任意 argv，会绕过 preview/approval/receipt，并可能误释放 Ordo worktree lease。

## What Changes

- 冻结 `FileWatchCapabilityV1`：opaque ref、cursor、created/changed/deleted/renamed 事件。缺 seam 时 File Pane 保持按需列表，freshness 为 `unknown`/`stale`/`offline`/`contract_mismatch`，MUST NOT 宣称 live。
- 冻结 `GitTypedActionsCapabilityV1`：stage/unstage/commit/diff/worktree 仅 owner-authored typed action；任意 argv 拒绝。危险动作必须 preview → approval → receipt。worktree delete MUST NOT 释放 Ordo lease。
- 上游缺口登记 `upstream-prs/fs-watch/` 与 `upstream-prs/git-typed-actions/`。插件只 capability probe，不 DOM patch，不 `setInterval` refetch。

## Capabilities

### New Capabilities

- `dsh-file-watch-pane`：File Pane 对 `FileWatchCapabilityV1` 的诚实探测与 owner event 折叠。
- `dsh-git-typed-actions-pane`：Git Manager 只接受 typed action，worktree/lease 边界明确。

### Modified Capabilities

无。不修改 File tree 的按需 list、不实现真实 inotify、不向 DSH core 提交合入。

## Impact

- Owner：`agent/harness-plugins`。
- 上游：`agent/harness-plugins/upstream-prs/fs-watch/`、`git-typed-actions/`。
- 根 handoff：`openspec/changes/dsh-pane-plugin-ecosystem-v1/` 任务 3.2。
- Ordo lease 仍由 Ordo canonical scheduler 拥有。
