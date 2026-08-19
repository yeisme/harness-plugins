# @yeisme/dsh-client-ui-pane-workbench

Experimental Yeisme DSH Pane Workbench client. This package contains the plugin registry, generation-safe lifecycle, measured per-kind retention, safe session/preset persistence, event reducer, typed artifact intent builder, the pure `PaneWorkspaceV1` layout reducer, and accessible local chrome with keyboard and pointer move modes. The installable Web profile layer is `@yeisme/dsh-pane-workbench` in `packages/bundle/pane-workbench/`.

No timer polling is used. A stream must start from an owner snapshot; gaps, context changes, and contract mismatches enter `reconcile_required` and keep the last safe projection.

```bash
pnpm --filter @yeisme/dsh-client-ui-pane-workbench run typecheck
pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test
pnpm --filter @yeisme/dsh-client-ui-pane-workbench run build
pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test:integration
```

The integration command writes redacted evidence to `temp/integration-test-runs/<run-id>/`.

The profile bundle conformance command is:

```bash
pnpm --filter @yeisme/dsh-pane-workbench run test
```

It uses a disposable `DSH_HOME` to verify packed members, `dsh plugin
--profile web add`, one `shell.overlay` profile row, real Web profile Loader
startup, and remove rollback. Raw profile dumps are not persisted.

## Configuration and interaction

The client face is local-only and receives safe typed view descriptors through
`ctx.paneWorkbench.registerView`. It does not accept component URLs, module
names, arbitrary iframes, raw tool output, or domain mutations. The host owns
view facts, permissions, actions, and receipts.

- Tab/Arrow/Home/End navigate the visible tabs; Enter or Space activates a tab.
- Delete closes a view and returns focus to the nearest remaining tab.
- Shift+F10 opens the tab menu; `Move by Keyboard` uses Arrow keys, Enter, and
  Escape with a live announcement.
- Pointer drag reorders tabs or docks them into Right/Bottom edge zones. Escape,
  blur, pointer cancel, HMR, and unmount cancel an incomplete drag.
- The divider supports pointer preview and keyboard 1%/5%/Home/End changes.
- `Reset Layout` restores the bounded default projection. Session/preset
  persistence stores only the safe `PaneWorkspaceV1` projection; reset/delete
  local layout never touches canonical task, session, or run data.

For an inspect flow, the host should dispatch an explicit typed view intent with
an opaque resource ref and owner version. The pane only renders the resulting
safe projection. It must remain orphaned and actionable when its provider is
removed, rather than retaining a stale component or retrying a domain action.

If the pane is missing, first verify the bundle row with `dsh --profile web
--dump-config`, then check the profile Loader and the package typecheck/test
commands above. A browser DOM/ARIA failure must be reproduced in the official
DSH browser runner; jsdom or a Host boot is not a substitute for that gate.

`createPaneWorkspace()` returns the bounded right Navigator/Content and bottom Utility preset. `reducePaneWorkspace(state, intent)` is the only layout transition entrypoint; it covers semantic `open_view` routing, preview/pinned/dirty state, split/move/resize, visibility, maximize/restore, reset, and bounded undo. `PaneRetentionManager` gates size-sensitive activation until two visible non-zero frames and applies per-kind active/retained LRU budgets. `PaneWorkspacePersistenceAdapter` writes only `serializePaneWorkspace()` output, catches storage failures, normalizes restores, supports named presets, and exposes reset/delete-local-layout. The reducer owns layout and selection only; host services remain the owner of domain facts, permissions, mutations, and receipts.

Design authorities:

- `openspec/changes/dsh-pane-workbench-interaction-v1/`
- `openspec/changes/dsh-pane-plugin-platform-v1/`
