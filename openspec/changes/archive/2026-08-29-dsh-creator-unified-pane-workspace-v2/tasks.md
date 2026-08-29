## 1. Additive Host Contracts

- [x] 1.1 Add optional projectRef to Pane/Creator context and pin compatibility tests. Evidence: Pane protocol 11/11 tests; Creator Host validation accepts old context plus optional projectRef.
- [x] 1.2 Add safe asset query/page types, validation and optional owner listAssets seam. Evidence: current/all-project pagination, permission denial and missing project tests in `packages/host/creator-studio/tests/gateway.spec.ts`.
- [x] 1.3 Add Ordo operations projection and one-shot approval decision mapping while retaining jobs/reviews. Evidence: Ordo mapping and uncertain one-shot decision tests; Creator Host 15/15.
- [x] 1.4 Publish new Remote descriptors and bundle TypeScript exports. Evidence: creator bundle 3/3 tests include assets and decideApproval Typert invocations.

## 2. Creator Client Workspace

- [x] 2.1 Extend controller state for project-scoped asset pages and approval receipts with context reset. Evidence: controller tests cover explicit reset and projectRef drift reset.
- [x] 2.2 Register assets, generation and approvals Pane/commands plus jobs/review compatibility aliases. Evidence: client registration and legacy render tests.
- [x] 2.3 Make sidebar and /creator open only Creator Home. Evidence: client composition test asserts no creator.jobs open.
- [x] 2.4 Group Creator Home into creation, management and operations sections with current/all-project asset controls. Evidence: Creator Client 16/16 tests.

## 3. Drama Integration

- [x] 3.1 Connect Creator Home complete-drama action to the mounted Drama Director preset with production fallback. Evidence: client composition injects and invokes `dramaDirector.applyPreset`; UI click covered in views test.
- [x] 3.2 Update Director positioning so Pane supports an end-to-end current-project workflow and Workbench remains optional. Evidence: Director OpenSpec, design doc and bundle README updated; Director Client 92/92 tests.

## 4. Verification And Closeout

- [x] 4.1 Add Host validation/gateway tests for project context, assets, Ordo projection, approval and no retry. Evidence: Creator Host 15/15.
- [x] 4.2 Add Client controller/view/registration tests for single entry, asset scopes, independent Pane and aliases. Evidence: Creator Client 16/16.
- [x] 4.3 Run focused package tests and record results. Evidence: plan command passed — Creator Host 15, Creator Client 16, Drama Director 92, Ordo Agent Ops 41 tests.
- [x] 4.4 Run typecheck, full tests, build, bundle checks and strict OpenSpec validation; record final evidence. Evidence (re-verified 2026-08-29): `pnpm run build` exit 0 (topo order; the earlier creator-studio TS2307 was an unbuilt pane-workbench lib artifact), `pnpm run typecheck` exit 0, `pnpm run check:bundles` 24/24 PASS, focused `@yeisme/dsh-client-ui-creator-studio` tests 18/18, both strict OpenSpec validations pass. The Mermaid smoke failure was resolved by the terminal-lane closeout (c75c85f).
