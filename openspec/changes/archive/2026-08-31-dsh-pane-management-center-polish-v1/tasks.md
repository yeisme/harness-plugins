## 1. Search and compatibility primitives

- [x] 1.1 Add the bounded local similar-result helper while preserving strict ranking and filter semantics.
- [x] 1.2 Add semantic icon names/paths and contract assertions as additive public API changes.
- [x] 1.3 Add natural zh/en management copy, status/search-state labels, and safe built-in provider label resolution.

## 2. Pane center interaction and layout

- [x] 2.1 Rebuild the header, mode, search, source and scope hierarchy with semantic icons and counts.
- [x] 2.2 Make advanced filters collapsible with visible labels, active-count badge and one reset action.
- [x] 2.3 Add similar-result/remote-state rendering, explicit target chevron, on-demand group creation and selection-only bulk actions.
- [x] 2.4 Update scoped chrome styles for the compact desktop hierarchy, single scroll region, reduced motion and 600px full-screen mode.

## 3. Split-owner localization

- [x] 3.1 Add `paneWorkbench/rail.agents` metadata to the Subagent Monitor pane registration without changing its runtime owner or protocol.

## 4. Verification and closeout

- [x] 4.1 Extend unit/component tests for similarity, localization, filter disclosure, target action, remote states, locale switching and 390px layout contracts.
- [x] 4.2 Run Pane Workbench and Subagent focused tests, typecheck and builds.
- [x] 4.3 Run Pane Workbench integration evidence, inspect the generated redacted receipt, and validate this OpenSpec change strictly.
- [x] 4.4 Review the final diff for unrelated dirty-worktree changes and additive compatibility, then mark completed tasks.
