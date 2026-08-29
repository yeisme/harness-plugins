## 1. Show-control contracts and host service

- [x] 1.1 Add additive `v1alpha1` show snapshot, episode, review, asset, delivery, query, page, action-preview, owner-adapter, and remote contracts with bounded validators and public exports.
- [x] 1.2 Implement the owner-adapter registry and context-bound service gateway without storing canonical Show, Episode, Review, Approval, Run, or Delivery state.
- [x] 1.3 Enforce tenant, workspace, principal, show, runtime-generation, cursor, descriptor-expiry, safe-ref, page-size, and unknown-result rules, including negative contract tests.
- [x] 1.4 Publish the typed show-control remote contribution and add fake adapter conformance plus honest `needs_contract` and `partial` degradation.

## 2. Show-control client and navigation

- [x] 2.1 Implement a show-control client controller for snapshots, pagination, filters, loaded-target selection, action preview, one-shot dispatch, receipts, reconcile, and exact disposal.
- [x] 2.2 Implement `drama.show-board`, `drama.review-inbox`, `drama.asset-wall`, and `drama.delivery` with accessible loading, empty, partial, stale, offline, error, narrow-screen, and keyboard states.
- [x] 2.3 Enforce the 100-loaded-target batch limit and clear selection whenever filters, show context, snapshot identity, or runtime generation changes.
- [x] 2.4 Add `/drama show`, `/drama inbox`, `/drama assets`, `/drama delivery`, the additive `show-control` preset, and the Creator Home full-show-console entry while preserving `director` and `/drama open`.
- [x] 2.5 Add capability probes, disabled reasons, install/uninstall/reinstall coverage, and no-dead-button behavior when a real domain adapter is absent.

## 3. Compatibility, evidence, and closeout

- [x] 3.1 Add contract, state, component, action, idempotency, approval, cursor, context-switch, late-response, responsive, and compatibility tests for Tier 0 and Tier 1 hosts.
- [x] 3.2 Write redacted integration evidence for Show Board to Review Inbox to batch preview to receipt to reconcile, Asset Wall compare, and Delivery readiness to owner evidence.
- [x] 3.3 Update generated bundle/profile metadata, package exports, user documentation, the Workbench optional-host wording, the roadmap, and the capability gap ledger.
- [x] 3.4 Run focused and root typecheck, test, build, bundle, documentation-sync, strict OpenSpec, and redaction gates.
  - Evidence (2026-08-29): 根 typecheck/build 绿、check:bundles 24/24、`pnpm run doc-sync` 5/5（脚本重建入库）、strict OpenSpec 三 change valid、`git diff --check` 干净；`pnpm run test` 唯一失败为 dsh-language-intelligence 满载时序 flake（隔离复跑 8/8×2，environmental）；focused gates 见 3.1-3.3 证据。
  - Evidence: focused gates, root typecheck/test/build, bundle contracts, strict OpenSpec and redaction checks pass. `pnpm run doc-sync` is pending because the repository script points to missing `scripts/doc-sync.mjs`; this pre-existing repository gate is recorded without inventing a replacement checker.
