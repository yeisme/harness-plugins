# harness-plugins memory

## Active change: dsh-session-insights-and-status

- Kimi session `session_d053cb5b-1d96-4c73-b883-5253da6b240e` implemented tasks 1.1–4.3, then hit a 5-hour provider quota on 4.4/4.5.
- 2026-09-05 closeout: 4.4/4.5 recorded. Protocol gates (typecheck/test/build/check:bundles/check:surfaces/check:plugins + OpenSpec strict) passed. `pnpm run test:visual` 27 failures in concurrent dirty `visual.spec.ts` fixtures were classified concurrent+environmental; owned `visual-status.spec.ts` 17/17 passed.
- Evidence: `temp/integration-test-runs/full-plugins-2026-09-05T18-51-57-898Z-1270300/` and `temp/integration-test-runs/ui-visual-2026-09-05T18-20-23-203Z-462829/`.
- Unverified owners remain: `upstream-prs/session-history-usage-identity/` and `upstream-prs/session-trajectory-locator/`. Do not claim full-session usage is verified on real DSH.

## Constraints

- Do not treat repo-wide visual snapshot drift on concurrent dirty packages as an introduced failure of this change.
- Do not update unrelated visual baselines to green a global `test:visual` run.
- Additive query schema `session.insights.snapshot.v1alpha1`; keep `snapshot()` / `refreshBalance()` signatures.
