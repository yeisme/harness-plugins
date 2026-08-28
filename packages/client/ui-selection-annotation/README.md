# @yeisme/dsh-client-ui-selection-annotation

DSH Web selection & annotation client for the Selection & Annotation Agent
Interaction V1 program.

The `./client` entry grafts onto the conversation DOM without slot
registration or host shadowing (kill-switch:
`localStorage['dsh-selection-annotation'] = 'off'`):

- **Floating selection toolbar** — 问 Agent / 评论 / 编辑 / Agent 修改 / 复制
  引用 / 加入批注组 / 在完整输入框打开; above-selection placement with
  auto-flip, keyboard navigation, Esc close, narrow icon mode and edge-anchor
  collapse when the selection scrolls out of view.
- **Compact Agent Composer overlay** — ask/comment/edit intents, 1–6 row
  growth, draft preserved across expand, comment stays local (no model call)
  unless explicitly enabled, edit always preview-first; the host conversation
  runtime plugs in via `composerAdapter`.
- **Markdown source mapping** — rendered selections map back to `.md` source
  ranges through host-emitted `data-source-*` hints (monotonicity-validated);
  without hints the anchor downgrades to an honestly unmapped `dom-region`,
  never a fabricated line number.
- **Screenshot annotation canvas** (React `AnnotationCanvas`) — point/rect
  markers in normalized 0..1 image coordinates (zoom & high-DPI stable),
  `#N` numbering, per-marker notes, joint Review Batch submit, explicit
  "无 DOM 映射" labelling.
- **Approval panel controller** — per-position approve/reject/request-revision/
  defer, dependency-closure blocking, version-drift conflicts surfaced on rows,
  apply only through the owner service.

Host contracts live in `@yeisme/dsh-selection-host`; the browser never sees
patch text, credentials or screenshot bytes.

## Install

```
dsh plugin --profile web add @yeisme/dsh-selection-annotation
```

Spec: `openspec/changes/dsh-selection-agent-review-v1/`.
