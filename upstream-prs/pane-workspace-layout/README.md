# pane-workspace-layout

dsh pane workspace layout (right/bottom docking geometry, AppFrame service, tool-call -> Details reveal)

- Archived: 2026-08-20T15:44:01Z
- Base commit: `141eb6fef83422698aef7a981029e843e8161534` (deepseek-harness, dsh 0.1.0-rc.8 merge)
- `changes.patch`: diff of tracked files (includes staged additions).
- `new-files/`: untracked source files to copy in (apply.sh handles this).
- Apply: `./apply.sh <clean-checkout>` then run the package tests listed below.

## Files
```
 .../src/client/chat/ChatNodeSeat.tsx               |  31 +-
 .../ui-conversation/src/client/chat/ChatView.tsx   |   3 +-
 .../ui-conversation/src/client/contract/slots.ts   |   2 +
 .../tests/chat-view.client.spec.tsx                |  10 +
 packages/client/ui-layout/README.i18n.yaml         |   4 +-
 packages/client/ui-layout/README.md                |  16 +-
 packages/client/ui-layout/README.zh.md             |  16 +-
 packages/client/ui-layout/package.json             |   4 +-
 .../ui-layout/src/client/AppFrame.module.css       | 149 ++++++----
 packages/client/ui-layout/src/client/AppFrame.tsx  | 312 +++++++++++++--------
 packages/client/ui-layout/src/client/index.ts      |  33 ++-
 packages/client/ui-layout/src/client/service.ts    |   4 +
 .../ui-layout/tests/app-frame.client.spec.tsx      |  13 +-
 .../client/ui-layout/tests/apply.client.spec.ts    |  12 +-
# untracked additions:
.agents/notes/implemented/feature/2026-08-20-dsh-pane-workspace-layout.i18n.yaml
.agents/notes/implemented/feature/2026-08-20-dsh-pane-workspace-layout.md
.agents/notes/implemented/feature/2026-08-20-dsh-pane-workspace-layout.zh.md
packages/client/ui-layout/scripts/run-workspace-browser-evidence.mjs
packages/client/ui-layout/src/client/workspace-geometry.ts
packages/client/ui-layout/src/client/workspace-layout.ts
packages/client/ui-layout/tests/workspace-geometry.client.spec.ts
packages/client/ui-layout/tests/workspace-layout.client.spec.ts
```
