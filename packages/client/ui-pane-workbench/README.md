# @yeisme/dsh-client-ui-pane-workbench

Experimental headless foundation for the Yeisme DSH Pane Workbench. This slice contains the plugin registry, generation-safe lifecycle, event reducer, typed artifact intent builder, and the pure `PaneWorkspaceV1` layout reducer. React chrome, pointer docking, persistence, `shell.overlay`, and installable profile composition remain tracked by the owning OpenSpec changes.

No timer polling is used. A stream must start from an owner snapshot; gaps, context changes, and contract mismatches enter `reconcile_required` and keep the last safe projection.

```bash
pnpm --filter @yeisme/dsh-client-ui-pane-workbench run typecheck
pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test
pnpm --filter @yeisme/dsh-client-ui-pane-workbench run build
pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test:integration
```

The integration command writes redacted evidence to `temp/integration-test-runs/<run-id>/`.

`createPaneWorkspace()` returns the bounded right Navigator/Content and bottom Utility preset. `reducePaneWorkspace(state, intent)` is the only layout transition entrypoint; it covers semantic `open_view` routing, preview/pinned/dirty state, split/move/resize, visibility, maximize/restore, reset, and bounded undo. The reducer owns layout and selection only; host services remain the owner of domain facts, permissions, mutations, and receipts.

Design authorities:

- `openspec/changes/dsh-pane-workbench-interaction-v1/`
- `openspec/changes/dsh-pane-plugin-platform-v1/`
