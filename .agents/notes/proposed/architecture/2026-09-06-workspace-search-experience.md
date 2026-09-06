# Workspace Search Experience

**Date**: 2026-09-06
**Status**: Implemented (plugin protocol gate green; host joint gate green; live history owner pending)
**Change**: dsh-workspace-search-experience-v1

## Overview

The "add panel" entry is replaced by a unified Search-and-open surface: grouped
search over registry panes, pane commands, and (when the host provides it)
conversation history, with category filters, stable result identity, bounded
memory caching, and open/pin/drag behaviors routed through the single
`PaneWorkbenchController`.

## Architecture Decisions

### 1. Surface placement per host capability

- Region-chrome hosts (Core Pane / Tier 0 overlay): the floating overlay opens
  from the chrome `openView` trigger; "Pin search as a pane" transfers the
  query into a singleton `dsh.workspace-search` pane.
- Unified workspace host (`upstream-prs/unified-multi-pane-workbench`): the
  host owns chrome and its picker, so the search pane is discovered through
  (a) the `workspace.search` pane command (launcher + `/search` slash) and
  (b) a host-catalog row registered despite `showInPicker: false`, because the
  host resolves pane renderers through its catalog
  (`isUnifiedHostCatalogView`). Per-resource hidden views (file preview) stay
  out of the catalog.

### 2. Honest history boundary

The history source is probed per host
(`probeWorkspaceSearchHistoryAdapter`). Without a conversation-search owner
the surface renders the localized unavailable notice, issues no history
requests, and never fabricates session rows or fake pagination ("Load more").
Mock adapters are used only in component tests; host-chain evidence records
`live_query=not_verified` separately from verified adapter contracts.

### 3. Identity and caching

Result identity is `kind:owner:viewKind:resourceKey` (`stableKey`); filters
and locale switches preserve it. The cache is an in-memory LRU (32 pages /
1000 summaries, 30s TTL, 5min stale window) keyed by permission/project
context; recent-use and named filters persist only structured references
through the host preference seam — never query text or snippets.

## Gates (recorded separately)

- Plugin protocol gate (this repository):
  `pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test` (383 tests),
  `pnpm run typecheck`, `pnpm run build`, `pnpm run check:bundles` (27/27),
  `pnpm run check:surfaces`, `pnpm run test:visual` (92/92),
  `pnpm run check:plugins` (six checkers, 0 findings) — all exit 0.
- Host joint gate (official dsh web profile + 32 local bundles):
  `pnpm --filter @yeisme/dsh-client-ui-pane-workbench run
  test:workspace-search-host-chain` — 13/13 checks passed (open, query,
  identity across filters, honest unavailable history, open-result growth,
  singleton relaunch, theme token inheritance, drag boundary recorded
  honestly). Evidence:
  `temp/integration-test-runs/workspace-search-host-chain-2026-09-06T16-45-10-1717037/`.
- Upstream series health: `upstream-prs/unified-multi-pane-workbench/`
  applies cleanly to its reviewed base (`a66e4702`), verified 2026-09-06 on a
  fresh worktree. No host-side patch changes were needed for search; the
  series already exposes `registerView` / `registerCommand` faces.

## Rollback

The legacy "add panel" entry is superseded, not removed: the region-chrome
picker remains available behind the chrome menu, and the pinned search pane
closes without executing actions. Profile fallback = remove the
`@yeisme/dsh-pane-workbench` bundle row; no data migration is involved
(persistence stores only safe references under the existing allowlist).
