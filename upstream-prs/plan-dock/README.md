# plan-dock

DSH Plan dock, durable plan-mode contracts, and the shared Pane workspace information design.

- Archived: 2026-08-20T15:44:01Z
- Design refinement: 2026-08-20
- Base commit: `141eb6fef83422698aef7a981029e843e8161534` (deepseek-harness, dsh 0.1.0-rc.8 merge)
- `changes.patch`: diff of tracked files and staged additions.
- `new-files/`: new source, tests, and bilingual Agent Note files copied by `apply.sh`.
- Apply: `./apply.sh <clean-checkout>`, then run the focused verification commands below.

## Current Plan workspace

- The dock remains the compact summary and inline-edit entry.
- One dock action opens `PlanWorkspaceView` in the shared Pane Workbench; Pane chrome owns maximize and close.
- The Pane order is status → task progress → options → Markdown → goal → revision history.
- Task and goal states are localized; option selection has pending, failure, and selected feedback.
- The old second-sidebar/fullscreen proposal remains only as superseded design history; obsolete story exports and the module-level view store were removed.

## Focused verification

```bash
pnpm install --frozen-lockfile
pnpm exec vitest run packages/client/ui-plan/tests/plan-document-panel.client.spec.tsx packages/client/ui-plan/tests/plan-workspace-view.client.spec.tsx packages/client/ui-plan/tests/plan-pane-view.client.spec.ts packages/client/ui-plan/tests/browser-plugin.client.spec.ts packages/client/ui-plan/tests/plan-mode-control.client.spec.tsx
pnpm exec oxlint packages/client/ui-plan/src/client/PlanSidebar.tsx packages/client/ui-plan/src/client/PlanDocumentPanel.tsx packages/client/ui-plan/src/client/PlanPaneView.tsx packages/client/ui-plan/src/client/index.ts packages/client/ui-plan/src/client/locales.ts packages/client/ui-plan/tests/plan-workspace-view.client.spec.tsx packages/client/ui-plan/tests/plan-document-panel.client.spec.tsx packages/client/ui-plan/tests/browser-plugin.client.spec.ts
pnpm run build:lib
DSH_SNAPSHOT=replay pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/plan-review.e2e.ts
DSH_SNAPSHOT=replay pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/shipped-composition.e2e.ts -t "assembles the shipped Web catalog"
pnpm run verify-translation-pairing packages/client/ui-plan/README.md .agents/notes/implemented/feature/2026-08-19-plan-dock-inline-edit-and-visual-polish.md .agents/notes/proposed/feature/2026-08-19-plan-sidebar-fullscreen-m2.md
pnpm run verify-agent-note-format
```

The current host completed the production Web build, `test:gui`, and both targeted Web replay lanes above. The repository-wide Web replay also reached 68 passing files, but remained red in unrelated sandbox/replay lanes because no usable `workspace-write` backend is installed on this host; those failures were not repaired by changing non-Plan behavior.

## Files

```text
 ...8-19-plan-dock-inline-edit-and-visual-polish.md |  70 ++
 apps/web/tests/shipped-composition.e2e.ts          |   2 +
 .../lifecycle-chrome/command-menu.expected.md      |   3 +
 .../snapshots/plan-review/approved.expected.md     |  14 +-
 packages/client/ui-plan/README.i18n.yaml           |   4 +-
 packages/client/ui-plan/README.md                  |  16 +-
 packages/client/ui-plan/README.zh.md               |  16 +-
 packages/client/ui-plan/package.json               |   2 +
 .../src/client/PlanDocumentPanel.module.css        | 253 ++++++
 .../ui-plan/src/client/PlanDocumentPanel.tsx       | 225 ++++++
 packages/client/ui-plan/src/client/index.ts        |  64 +-
 packages/client/ui-plan/src/client/locales.ts      |  90 +++
 .../ui-plan/tests/browser-plugin.client.spec.ts    |   2 +-
 .../tests/plan-document-panel.client.spec.tsx      | 141 ++++
 packages/plan/plan-mode/README.i18n.yaml           |   4 +-
 packages/plan/plan-mode/README.md                  |  22 +-
 packages/plan/plan-mode/README.zh.md               |  22 +-
 packages/plan/plan-mode/package.json               |   5 +
 packages/plan/plan-mode/src/index.ts               | 884 +++++++++++++++++++--
 packages/plan/plan-mode/src/types.ts               |  93 ++-
 packages/plan/plan-mode/tests/integration.spec.ts  |  19 +-
 packages/plan/plan-mode/tests/plan-mode.spec.ts    | 327 ++++++--
 packages/plan/plan-mode/tests/projection.spec.ts   |   7 +-
 packages/plan/plan-mode/tsconfig.json              |   3 +
 pnpm-lock.yaml                                     |   6 +
 25 files changed, 2122 insertions(+), 172 deletions(-)

# new files
.agents/notes/implemented/feature/2026-08-19-plan-dock-inline-edit-and-visual-polish.i18n.yaml
.agents/notes/implemented/feature/2026-08-19-plan-dock-inline-edit-and-visual-polish.zh.md
.agents/notes/proposed/feature/2026-08-19-plan-sidebar-fullscreen-m2.i18n.yaml
.agents/notes/proposed/feature/2026-08-19-plan-sidebar-fullscreen-m2.md
.agents/notes/proposed/feature/2026-08-19-plan-sidebar-fullscreen-m2.zh.md
packages/client/ui-plan/src/client/PlanPaneView.tsx
packages/client/ui-plan/src/client/PlanSidebar.module.css
packages/client/ui-plan/src/client/PlanSidebar.tsx
packages/client/ui-plan/tests/plan-pane-view.client.spec.ts
packages/client/ui-plan/tests/plan-workspace-view.client.spec.tsx
```
