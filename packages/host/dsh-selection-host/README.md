# @yeisme/dsh-selection-host

Selection & Annotation Agent Interaction V1 host contracts for DSH.

Owns the protocol layer only — never filesystem state, conversation runtime
state or screenshot bytes:

- **Selection anchors** — `file-range`, `markdown-range`, `dom-region`,
  `image-point`, `image-region` sharing `artifactRef`/`artifactVersion`,
  `quotePreview`, `quoteDigest`, `freshness` and `reanchorEvidence`.
  Anchors are the single join key for comments, questions and proposals.
- **Annotation batches** — multi-anchor review batches with stable `#N`
  markers; `buildAgentRequest` hands the agent an untrusted-context request
  whose replies must reference markers.
- **Proposals & approval** — per-hunk decision state machine
  (`pending → approved/rejected/revision_requested/deferred/stale`,
  `approved → applying → applied/failed/reconcile_required`), partial-apply
  planning with dependency-closure blocking and version fencing.
- **Version-fenced apply** — patches are registered host-side behind opaque
  `patchRef` handles; browsers never submit patch strings. Version drift
  fails closed into `reconcile_required`.
- **Layered capture** — `WebCaptureAdapterV1` (viewport / full page) vs
  `DesktopCaptureAdapterV1` (window / full desktop, Desktop Client owner);
  the web probe for desktop capture is always unavailable with an explicit
  reason.

`./node` ships an in-memory reference service + versioned file store for
tests and owner-service implementers. See
`openspec/changes/dsh-selection-agent-review-v1/` for the product spec.

## Usage

```ts
import { createSelectionAnnotationService, createInMemoryVersionedFileStore } from '@yeisme/dsh-selection-host/node'

const { store } = createInMemoryVersionedFileStore({ 'file:README.md': '# title\n\nbody' })
const service = createSelectionAnnotationService({ fileStore: store })

const anchor = service.publishAnchor({
  kind: 'file-range',
  artifactRef: 'file:README.md',
  artifactVersion: 'v1',
  quotePreview: 'body',
  quoteDigest, // sha256 hex of the selected text
  startLine: 3, endLine: 3, startColumn: 0, endColumn: 4,
})
```

## Boundaries

- Browser callers only see safe projections and opaque refs.
- Page/file/screenshot content is untrusted context, never instructions.
- No auto-apply: every applied hunk requires an explicit user approval.
