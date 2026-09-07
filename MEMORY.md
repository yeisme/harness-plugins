# harness-plugins memory

## 2026-09-07: parallel subagent advance (search owner + G21 day 7 + seam recheck)

- Dispatch: 3 children, parallel, no overlapping write leases. Root integrated; no commit/push.
- Search 3.7: wired current-profile `ctx.sessions.list` as `PaneConversationSearchHostV1` (`packages/client/ui-pane-workbench/src/conversation-search-host.ts` + `client.ts` inject, owner-provided host wins). Empty list = available+empty; missing seam = unavailable. Vitest 399/399 + typecheck green. 3.7 stays `[ ]` (`live_query=not_verified`, `mock_query=verified`). Evidence `temp/integration-test-runs/workspace-search-conversation-owner-2026-09-07T04-23-26-839Z-2293966/`. Host-chain not re-run.
- G21 4.3: day 7/14 recorded. `pnpm run check:plugins` exit 0, six checkers 0 findings (`temp/toolchain-runs/2026-09-07T040407631Z-toolchain`). Interactive `pnpm dsh:dev` not observed in-session. Checkbox still `[ ]` until 2026-09-14.
- External recheck: local installed `@deepseek-ai/*` still 0.1.2-rc.1; awaited seams still 0 hits. Explorer could not live-fetch npm/upstream HEAD. 14 remaining active changes still external/user-gated. Do not treat current-profile session list as long-term history.

## 2026-09-06 PM: spec goal session — search 5.2–5.5, two closes, external rechecks

- `dsh-workspace-search-experience-v1` 20→24/25: 5.2–5.5 done. New host-chain runner `scripts/run-workspace-search-host-chain.mjs` (self-boots official dsh web profile + 32 bundles, 13/13 checks incl. identity-across-filter, honest unavailable history, singleton relaunch, theme tokens). Six gates green (surfaces/visual 92/plugins 0 findings/typecheck/build/bundles 27/27). Delivery doc `docs/delivery/dsh-workspace-search-experience-2026-09-06.md` + Agent Note `.agents/notes/proposed/architecture/2026-09-06-workspace-search-experience.md`. Only 3.7 (live history owner) stays open.
- Unified-host search entry implemented: `workspace.search` launcher command + `isUnifiedHostCatalogView` (search pane registers in host catalog because the unified host resolves renderers through its catalog; file-preview stays out). Commit d9ca1df.
- Closed `dsh-tools-pane-migration` + `dsh-full-plugin-ui-acceptance` with per-requirement tasks.md evidence and archived (strict 140/140). Patch verify for remove-plugins-settings re-run green (run 2026-09-06T16-09-15).
- run-web-plugin-acceptance.mjs: optional capability-probe 404s (`/api/*/capabilities`) now classified as `unavailable_owner_services`, not browser errors — the 07:23 token-usage pane's honest probe was failing the boot gate.
- External rechecks 2026-09-06: upstream released 0.1.3-alpha.1 (HEAD `d347e70390`, 9,080 paths) but every awaited seam still 0 hits; npm next 0.1.2-rc.1, host-apiproxy 0.1.1-rc.2, @yeisme trio 404. 43 tasks annotated. Dogfood day 6/14 recorded (zero findings).
- Remaining 15 active changes: all open tasks are external-gated (upstream seams/npm/PAT) or the 09-14 dogfood window; none actionable in-repo without owners moving.
- Pitfall: profile resolves bundles through `packages/bundle/*/lib` (bundle build inlines client code) — rebuilding only `packages/client/*` does NOT reach the booted host; rebuild the bundle layer too.

## 2026-09-06: archive completed DSH changes + workspace search 2.7

- Archived Complete changes (specs synced, `--all --strict` 140/0): `dsh-session-insights-and-status`, `dsh-web-composer-references-theme-v1`, `dsh-selection-conversation-actions-v1`, `dsh-adaptive-pane-docking`, `dsh-unified-multi-pane-workbench`.
- Left active: `dsh-tools-pane-migration` and `dsh-full-plugin-ui-acceptance` (No tasks.md; implementation exists but no checkbox closeout). Remaining incomplete changes are mostly `[external-gate skipped]`.
- Advanced `dsh-workspace-search-experience-v1` 19→20/25: task 2.7 stage-A evidence. Overlay now injects `REGION_STYLES` via `.pwr-root`. History owner still missing; 3.7 stays open (`live_query=not_verified`). Evidence `temp/integration-test-runs/workspace-search-stage-a-2026-09-06T10-05-35-478Z-1677358/`.
- Still open on search: 3.7 live history, 5.2 Playwright host chain, 5.3 surfaces/visual/plugins, 5.4 upstream-prs, 5.5 delivery packet.

## Active change: dsh-session-insights-and-status

- Kimi session `session_d053cb5b-1d96-4c73-b883-5253da6b240e` implemented tasks 1.1–4.3, then hit a 5-hour provider quota on 4.4/4.5.
- 2026-09-05 closeout: 4.4/4.5 recorded. Protocol gates (typecheck/test/build/check:bundles/check:surfaces/check:plugins + OpenSpec strict) passed. `pnpm run test:visual` 27 failures in concurrent dirty `visual.spec.ts` fixtures were classified concurrent+environmental; owned `visual-status.spec.ts` 17/17 passed.
- Evidence: `temp/integration-test-runs/full-plugins-2026-09-05T18-51-57-898Z-1270300/` and `temp/integration-test-runs/ui-visual-2026-09-05T18-20-23-203Z-462829/`.
- Unverified owners remain: `upstream-prs/session-history-usage-identity/` and `upstream-prs/session-trajectory-locator/`. Do not claim full-session usage is verified on real DSH.

## Constraints

- Do not treat repo-wide visual snapshot drift on concurrent dirty packages as an introduced failure of this change.
- Do not update unrelated visual baselines to green a global `test:visual` run.
- Additive query schema `session.insights.snapshot.v1alpha1`; keep `snapshot()` / `refreshBalance()` signatures.

## 2026-09-07: vendor dsh-pentest (pentest-mode tab plugin) + tab-development guide

- Vendored upstream `howmp/dsh-pentest` @ `5d24ba7` (MIT, v0.1.0-rc.26) as self-contained bundle `packages/bundle/dsh-pentest/` (release shape: `lib/` prebuilt + `preset/` + patch; excluded upstream per-package build outputs / lockfile / process docs). Provenance + upgrade flow: `packages/bundle/dsh-pentest/YEISME-VENDORED.md`. User web profile install verified (`--dump-config` rows + boot smoke errors=0).
- Vendored-bundle carve-outs now first-class: `.gitignore` negation keeps the pinned `lib/` in git (no local build); declaration-lint treats any bundle dir with `YEISME-VENDORED.md` as record-only (upstream patches legally use full cordis grammar: id-override rows without `name`, multiple top-level inserts — the repo-converged parser fail-louds on them otherwise). Regression tests in `declaration-lint.spec.ts` (26/26 toolchain suite green).
- New extraction doc `docs/plugin-tab-development.md`: tab/pane/overlay seam selection, two package shapes, host four registration points (tools / systemPrompt.section / sessionProjections / storageDomain), per-session `conversation.view` tab pattern (sessions.list ancestry + cycle guard), pane + honest-degradation pattern (capability probe + disabledReason), visualization window-view rules, preset-root registration. Skill source: root `.skills/yeisme/project-development/dsh-tab-plugin-development/` (target: `agent/harness-plugins.txt`, synced).
- Constraint: do not rename the vendored package or rewrite its patch into the repo-converged grammar — byte-fidelity vs upstream is the upgrade mechanism; changes go through the YEISME-VENDORED.md upgrade flow instead.
