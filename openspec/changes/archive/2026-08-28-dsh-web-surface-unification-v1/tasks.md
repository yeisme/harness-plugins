## 1. Foundation Surface Contract

- [x] 1.1 Create `@yeisme/dsh-client-ui-surface` with the five approved composition components, public types, fixed scoped styles and rc.6/rc.7 official-primitives peer compatibility. Evidence: package test/typecheck/build passed; published surface contains only the five composition components plus props/types/styles.
- [x] 1.2 Add unit tests for component props, surface kinds, state ARIA/tone, field/control styling, container queries, coarse pointer and reduced motion. Evidence: `@yeisme/dsh-client-ui-surface` 4/4 tests passed.
- [x] 1.3 Add the root Web surface catalog and `scripts/check-ui-surface-contracts.mjs` with adopted/embed/excluded classifications and explicit dynamic-style allowlists. Evidence: migration-mode conformance passes with 22 client and 7 bundle packages classified; pending packages are reported explicitly.
- [x] 1.4 Add a deterministic Playwright fixture and evidence-producing `pnpm run test:visual` command using the existing tsdown/Playwright stack. Evidence: nine foundation baselines generated and normal regression run passed 9/9; evidence summary written under the project integration-test-runs directory.

## 2. Workbench And Tool Surfaces

- [x] 2.1 Migrate Pane Workbench Source Control to navigator Surface, correct header/clean/composer priority, preserve safe content for stale/partial/offline, and add full state tests. Evidence: focused Source Control suite passed 10/10 and Pane Workbench typecheck passed after rebuilding the shared Surface declarations.
- [x] 2.2 Migrate Pane Workbench Explorer, Workspace Designer, Capabilities, Management Center, Quick Pick and official overlay chrome to shared composition/primitives without changing geometry or drag contracts. Evidence: targeted Pane Workbench suites passed and adopted package conformance accepts only documented virtual/drag geometry.
- [x] 2.3 Migrate Desktop Workbench panes and dialogs, including Git, file/document, search, conversation manager, terminal and media, while preserving published provider contracts. Evidence: Desktop Workbench typecheck and 55/55 tests passed; container-query styles and adopted conformance passed.
- [x] 2.4 Migrate MCP Inspector, DevTools, Token Usage and Session Cookie Manager pane/overlay surfaces and their loading/empty/error/disabled states. Evidence: typechecks passed; focused suites passed 31/31, 8/8, 15/15 and 33/33 respectively; adopted conformance passed.
- [x] 2.5 Migrate bundle-owned file/document, Rich Media, Terminal, Workbench Core and Workbench Compose Web surfaces. Evidence: focused bundle suites passed File/Document 25/25, Rich Media 81/81, Terminal 4/4, Workbench Core 30/30, Workbench Compose 26/26 and Desktop Workbench bundle 22/22; related typechecks and migration-mode conformance passed.

## 3. Creator And Agent Workspaces

- [x] 3.1 Add Creator lifecycle grouping for Start/Create/Produce/Review/Library while retaining every current view kind, command, legacy alias and multi-Pane behavior. Evidence: canonical lifecycle groups render while `creator.review` and `creator.jobs` remain registered and renderable aliases.
- [x] 3.2 Rebuild Creator Home as next action, Production status and review queue; move full Owner status into the Context Bar disclosure and remove the owner card matrix. Evidence: focused DOM priority and Owner disclosure assertions passed.
- [x] 3.3 Migrate Creator task/assets/generation/approval panes to workspace Surface, row/card rules and container layout while preserving action admission and active v2 contracts. Evidence: Creator suite passed 18/18, typecheck/build passed, and adopted surface conformance passed.
- [x] 3.4 Move all Creator lifecycle, state and recovery copy into zh/en/pseudo locale and add focused view/registration/accessibility tests. Evidence: locale registration covers zh/en/pseudo-long/pseudo-rtl and focused cold/loading/error/retained/partial state tests passed.
- [x] 3.5 Migrate AI Drama Director, Domain Pane, Agent Context, Subagent and Ordo Agent Ops Web surfaces without changing owner/runtime contracts. Evidence: focused suites passed 92/92, 109/109, 7/7, 18/18, Ordo bundle 41/41 and compatibility shim 13/13; all related typechecks and migration-mode conformance passed.

## 4. Dialog Overlay And Micro Surfaces

- [x] 4.1 Migrate Command Experience Web, Agent Preset and Session Tags dialogs/overlays to official Modal/Menu plus dialog Surface content. Evidence: typechecks passed; focused suites passed 66/66, 31/31 and 56/56.
- [x] 4.2 Migrate Next-step Suggestions and Conversation Rewrite micro surfaces while preserving their host-owned positioning and actions. Evidence: focused suites passed 26/26 and 58/58 with existing owner write/branch semantics unchanged.
- [x] 4.3 Align Structured Content and Mermaid embedded renderers with shared tokens/typography without wrapping them in Surface. Evidence: embed catalog classification passed; focused suites passed 6/6 and 25/25.
- [x] 4.4 Complete catalog coverage for all remaining bundle inline Web UI and keep `ui-command-experience-tui` explicitly excluded. Evidence: strict surface conformance passes with 22 client and 7 bundle packages, no pending entries, and only TUI/visual-kit excluded.

## 5. Verification And Closeout

- [x] 5.1 Run focused unit/component tests after each wave and record introduced versus pre-existing/concurrent failures. Evidence: all focused suites listed in waves 1–4 passed; failures found during integration were attributed to browser bundle CSS/external resolution or Host/Web boundary crossings and fixed without changing Owner contracts. Remaining output is limited to non-failing upstream React act, storage and Node deprecation warnings.
- [x] 5.2 Generate and approve 360/560/960 visual baselines for every surface kind and three-width coverage for Creator, Source Control, Desktop Git, Command Dialog, Session Tags and Rich Media. Evidence: 27 deterministic Playwright snapshots passed at the required widths with `maxDiffPixelRatio: 0.005`; latest evidence is `temp/integration-test-runs/ui-visual-2026-08-28T13-34-01-354Z-3538230/summary.json`.
- [x] 5.3 Run typecheck, full tests, build, bundle checks, surface conformance, visual evidence and strict OpenSpec validation; record redacted evidence and remaining risk. Evidence: `pnpm run typecheck`, `pnpm run test`, `pnpm run build`, `pnpm run check:bundles` (20/20), `pnpm run check:surfaces` (22 client, 7 bundle packages), `pnpm run test:visual` (27/27), and strict OpenSpec validation passed. No TUI, AppFrame geometry, Owner contract or mutation-admission semantics were changed.
