## 1. Data contracts and compatibility

- [x] 1.1 Add safe bulk-close planning/intent/result types while preserving existing atomic `bulk_close` tests.
- [x] 1.2 Add management/history persistence envelopes, scope handling, bounded retention and session-to-workspace seeding.
- [x] 1.3 Add optional provider restore state/rendition and optional conversation-search/workspace-context Host contracts with safety validation.

## 2. Pane management model

- [x] 2.1 Implement grouped Pane/Tab/history index, filters and deterministic ranking from existing presentation metadata.
- [x] 2.2 Implement close history batches, undo/reopen placement and protected-target confirmation data.
- [x] 2.3 Implement user group templates, workspace overrides, favorites and recent ordering without duplicating provider state.

## 3. Shared UI and keyboard

- [x] 3.1 Replace normal Chrome hierarchy with one-line 36px connected rounded Tabs and distinct open/manage action buttons.
- [x] 3.2 Implement the centered Pane management dialog with open/manage modes, grouping, search, filters, multi-select and target selection.
- [x] 3.3 Register shared keymap commands and add 10-second undo plus orphan/stale recovery presentation.
- [x] 3.4 Align Git Pane content hierarchy so the active Tab owns the title and form labels remain accessible.

## 4. Verification

- [x] 4.1 Add unit tests for ranking, filtering, safe bulk close, history retention, scope migration and restore-state rejection.
- [x] 4.2 Add component tests for 50 Tabs, keyboard flows, conversation opt-in/cancellation, multi-select, protected close and undo.
- [x] 4.3 Run focused package typecheck/tests/build and preserve existing atomic bulk-close and V2 persistence compatibility.
- [x] 4.4 Run `test:integration`, inspect redacted evidence files, run strict OpenSpec validation and record final evidence.
