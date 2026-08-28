## 1. Contract And Package Foundation

- [x] 1.1 Create Host, Client, and bundle package skeletons with public exports, peer dependencies, tsconfig/tsdown/vitest configuration, and one bundle patch row.
- [x] 1.2 Freeze Host/Client wire mirrors for `devtools.snapshot@1`, `devtools.captureCpuProfile@1`, record unions, summaries, capabilities, failures, and export v1; add contract tests.

## 2. Host Collection And Terminal Output

- [x] 2.1 Implement bounded record buffers, monotonic cursors, summary folding, SHA-256 fingerprints, path/string/key redaction, and forbidden-content scans with focused tests.
- [x] 2.2 Implement Cordis logger exporter and stderr human renderer with level filtering, `NO_COLOR`, startup/periodic/slow/error/shutdown lines, and stdout-isolation tests.
- [x] 2.3 Implement session/turn/TTFT/tool/retry/error lifecycle derivation with partial-close behavior and focused event tests.
- [x] 2.4 Implement Node CPU/memory/event-loop sampling and deterministic finding rules with fake-clock/sample tests.
- [x] 2.5 Implement Typert snapshot Remote, strict limit/cursor validation, capability projection, and old/new additive codec tests.
- [x] 2.6 Implement local-only bounded CPU profile capture, concurrency/disposal cleanup, script URL normalization, and inspector-adapter tests.

## 3. Browser Collection And DevTools UI

- [x] 3.1 Implement capability-probed browser collector for navigation/paint/LCP/layout-shift/long-task and safe same-origin `/api` timing, excluding DevTools self-calls.
- [x] 3.2 Implement Host snapshot controller, cursor polling while mounted, clock offset/uncertainty estimation, partial/error recovery, and Client Remote resolution.
- [x] 3.3 Implement the Overview, Timeline, Logs, and Performance diagnostics panel using existing visual tokens, native/CSS primitives, accessible tabs, loading/empty/error/partial states, and reduced motion.
- [x] 3.4 Register the singleton bottom Pane view, session-header launcher, disabled Host-unavailable state, and `shell.overlay` fallback with component/probe tests.
- [x] 3.5 Implement CPU Capture interaction and application-authored `dsh.devtools.export` JSON download with final forbidden-content rejection tests.

## 4. Integration, Evidence, And Documentation

- [x] 4.1 Add `pnpm run test:integration` and a generated redacted evidence wrapper that preserves success/failure exit codes and writes the required subproject temp files.
- [x] 4.2 Add the smallest browser fixture/screenshot lane for 1400/960/560 normal, slow, Host-unavailable, CPU-capture, and export states under integration artifacts.
- [x] 4.3 Document install, local checkout, run, level override, export, uninstall, security boundaries, capabilities, and honest exact-trace limitation using real commands.
- [x] 4.4 Update shared package scripts/workspace metadata and docs index with minimal conflict-safe edits; do not rewrite unrelated dirty files.

## 5. Verification And Closeout

- [x] 5.1 Run focused package tests/typechecks/builds, bundle checks, strict OpenSpec validation, and `git diff --check`; repair only introduced failures.
- [x] 5.2 Run the real integration entrypoint, inspect generated `summary.json` and artifacts, scan all evidence for forbidden content, and record verification results in this task file.
  - Evidence: `temp/integration-test-runs/2026-08-28T09-44-55-360Z-6fd0eaab/summary.json` reports `passed` with exit code `0`; Host 10/10, Client 8/8, and bundle 1/1 tests passed.
  - Artifacts: five screenshots cover normal 1400, slow 960, Host-unavailable 560, CPU capture 960, and export 1400 states.
  - Redaction: recursive evidence scan found no Authorization, bearer token, API key, password, secret, raw/system prompt, provider payload, tool argument, chain-of-thought, workspace path, or user-home path sentinel.
- [x] 5.3 Run final workspace typecheck/test/build, classify unrelated dirty-worktree failures, and leave the change implementation-complete without publishing or archiving.
  - Passed: `pnpm run typecheck`, `pnpm run build`, `pnpm run check:bundles` (20/20), strict OpenSpec validation, and scoped `git diff --check`.
  - DevTools tests passed in the workspace run: Host 10/10 and Client 8/8; the bundle 1/1 test passed in focused and integration runs.
  - Unrelated dirty-worktree failure: `pnpm run test` stopped in `@yeisme/dsh-pane-protocol` because `tests/protocol.spec.ts` referenced `PaneContextSchema` as undefined. Both that test and `src/index.ts` contain pre-existing out-of-scope modifications; no DevTools file imports or changes Pane Protocol.
  - Closeout: implementation remains local at `0.1.0-rc.1`; no package was published, no OpenSpec change was archived, and rollback remains plugin removal.
