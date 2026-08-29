## 1. Contract And Projection

- [x] 1.1 Add optional observedAt/healthAvailable/reasonCode/health fields to host and client wire mirrors while preserving `specVersion: 1.0`, `toolHub.*@1`, package paths and old exported symbols. Verify with old-response/new-response codec and public API tests.
- [x] 1.2 Extend host catalog projection with stable reason codes and optional safe `ctx.mcpServers.list()` health facts; provider absence must remain honest and secrets/config must be dropped. Verify with host catalog/service tests.
- [x] 1.3 Add safe transport error normalization so endpoint/host/contract/storage/catalog/unknown failures never expose raw objects in primary UI. Verify with controller/remote tests.

## 2. Activity Model

- [x] 2.1 Add deterministic `deriveToolActivity` for MCP/native/aggregate Skill activity, malformed-name dropping, durations and running calls; preserve `deriveMcpActivity`. Verify with focused activity tests.
- [x] 2.2 Add catalog/activity correlation helpers for summary counts, recent use, selected item details and bounded rendering. Verify with pure unit tests.

## 3. Tools Workbench UI

- [x] 3.1 Replace stretched vertical card layout with compact status/coverage strip and 58/42 catalog/activity-details workbench; use container-query tab/single-column fallbacks. Verify with component structure and style tests.
- [x] 3.2 Implement dense catalog rows, local search/family/availability filters, authoritative toggle pending/error/conflict states and item details. Verify with keyboard/component tests.
- [x] 3.3 Implement activity list/timeline modes, running/error filters, safe duration rendering and textual accessibility fallback. Verify with activity UI tests.
- [x] 3.4 Route all visible copy through `mcpInspector` zh/en locale, add focus, ARIA, coarse-pointer and reduced-motion behavior. Verify with locale/a11y/motion policy tests.

## 4. Browser Evidence And Human Gate

- [x] 4.1 Add the smallest package-local browser screenshot fixture/runner for 1400/960/560 widths and normal/error/partial/running/focus/reduced-motion states; document why Vitest alone is insufficient. Verify screenshots write only under `temp/integration-test-runs/<run-id>/artifacts/`.
- [x] 4.2 Add `pnpm run ui:acceptance -- prepare|record|verify` that generates redacted minimum evidence files and commit/source/screenshot-bound `human-acceptance.json`; add success/reject/stale/missing-artifact tests.
- [x] 4.3 Run focused package tests/typecheck/build, bundle checks, strict OpenSpec validation and `git diff --check`; classify unrelated dirty-worktree failures instead of repairing outside scope.
  - Evidence: client 30/30, host 9/9, bundle 3/3；三包 typecheck/build 通过；`check:bundles` 18/18、strict OpenSpec、`git diff --check`、motion policy 均通过。最终截图 evidence 由最后一次无源码变更的 `ui:acceptance prepare` 生成。
  - Full-workspace classification: `pnpm run typecheck` 被并行 `packages/bundle/dsh-command-experience/src/slash-bind.ts` exact-optional/type drift 阻断；`pnpm run test` 被并行 `packages/client/ui-ordo-agent-ops` inject expectation drift 阻断。两者均不在本 change owned paths，未修改。

## 5. Human Acceptance And Closeout

- [ ] 5.1 Human product owner reviews the generated board for populated desktop, catalog endpoint failure with activity retained, partial catalog, running/error timeline, narrow layout and keyboard focus; record `accept` or `reject` with the repository command. Agent/automation MUST NOT mark this task complete.
- [ ] 5.2 After an `accept` receipt verifies against the current commit, affected-source digest, and screenshot digests, archive `dsh-tools-center-observability-v1`; until then report implementation complete but awaiting human acceptance.
