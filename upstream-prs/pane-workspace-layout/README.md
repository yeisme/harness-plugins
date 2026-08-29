# pane-workspace-layout

dsh Core Pane workspace layout plus native/plugin conversation-tab mirroring (right/bottom docking, no legacy Details column)

- Archived: 2026-08-27T11:56:37Z
- Base commit: `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` (deepseek-harness, dsh 0.1.0-rc.8 merge)
- `changes.patch`: diff of tracked files (includes staged additions).
- `new-files/`: untracked source files to copy in (apply.sh handles this).
- Apply: `./apply.sh <clean-checkout>` then run the package tests listed below.

## Files
```
 packages/client/ui-conversation/package.json       |   2 +-
 .../client/ui-conversation/src/client/apply.ts     |  24 +-
 .../src/client/chat/ChatNodeSeat.tsx               |  31 +-
 .../ui-conversation/src/client/chat/ChatView.tsx   |   3 +-
 .../ui-conversation/src/client/contract/slots.ts   |  15 +
 .../src/client/skeleton/ConversationSession.tsx    |  43 ++-
 .../tests/chat-view.client.spec.tsx                |  10 +
 .../ui-conversation/tests/skeleton.client.spec.tsx |  28 +-
 packages/client/ui-layout/README.i18n.yaml         |   4 +-
 packages/client/ui-layout/README.md                |  16 +-
 packages/client/ui-layout/README.zh.md             |  16 +-
 packages/client/ui-layout/package.json             |   4 +-
 .../ui-layout/src/client/AppFrame.module.css       | 145 ++++++---
 packages/client/ui-layout/src/client/AppFrame.tsx  | 324 +++++++++++++--------
 packages/client/ui-layout/src/client/index.ts      |  45 ++-
 packages/client/ui-layout/src/client/service.ts    |  15 +-
 packages/client/ui-layout/src/client/stores.ts     |  20 +-
 .../ui-layout/tests/app-frame.client.spec.tsx      | 127 +++-----
 .../client/ui-layout/tests/apply.client.spec.ts    |  38 ++-
 .../ui-layout/tests/layout-store.client.spec.ts    |  31 +-
 .../client/ui-layout/tests/service.client.spec.ts  |  24 +-
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
