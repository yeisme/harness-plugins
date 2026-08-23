# @yeisme/dsh-client-ui-pane-domain

Serial Pane adapters for Eikona, Sonora, Auctra, Pinax, Anatomia, and Ordo Team. Canonical state stays with each owner. The client folds `PaneEventEnvelopeV1` only. Mutations pause on `reconcile_required`, `offline`, and `contract_mismatch`. Ordo launch, cancel, redispatch, and lease.release stay `not_available` even if a snapshot lists them. The Ordo Team view consumes the existing `ordoAgentOps` Host snapshot; it does not create a second scheduler.

## Owner source host bridge

Each domain pane reads a formal `domain.<owner>` owner source when the Host mounts one:

- `DomainOwnerSourceBridge` folds one authoritative snapshot read plus push events (`duplicate` idempotent, gap/context switch → `reconcile_required`, unsafe payload → `contract_mismatch`, channel drop → `offline`; reconnect re-reads exactly once). No timer polling anywhere.
- `mountDomainOwnerSource(ctx, owner, transport)` provides the `domain.<owner>` service; `apply()` consumes it live via `useSyncExternalStore` and falls back to an honest `offline` snapshot when no source is mounted.
- Owner contract ports: `sonoraSnapshotRead`/`sonoraNegativeRead` (takes, rights+cost gated actions), `pinaxSnapshotRead`/`pinaxNegativeRead`/`pinaxHandwrittenMetadataRead` (notes, capture/sync via owner command), `createOrdoOwnerTransport` (Ordo snapshot + owner events, `domain.ordo` live source).
- Anatomia port: `anatomiaSnapshotRead`/`anatomiaNegativeRead`/`anatomiaEvidenceArtifact`/`createAnatomiaActionChannel` (source/job/timeline/shot/scene/transcript/OCR/observation/evidence facets; owner job state machine keeps `partial` distinct from complete; `analyze.start`/`evidence.inspect` stay owner-gated with revision-bound descriptors).
- Auctra port: `auctraSnapshotRead`/`auctraNegativeRead`/`auctraUnitArtifact`/`createAuctraActionChannel` (review queue first, structure fallback; `candidate.create`/`review.accept`/`review.partial` gated with revision-bound descriptors, `export.unit` only when the owner pulse is export-ready; timeout folds to `unknown` and never promotes canonical text).
- Eikona port: `eikonaSnapshotRead`/`eikonaNegativeRead`/`eikonaCardArtifact`/`createEikonaActionChannel`/`normalizeEikonaModelRef` (gallery cards with the canonical `openai/gpt-5.4-image-2` default; `generate.preview` takes an owner-held `prompt_ref`, never a raw prompt; aliases normalize at ingress only).

## Action gateway

`DomainActionGateway` only submits server-authored `PaneActionDescriptorV1` descriptors: request fields come from the descriptor, `unknown`/malformed receipts, timeouts, owner errors, and expired descriptors all fold to `reconcile_required` — never optimistic success. Missing cost/rights preview facets fail visible (`approval_required`) instead of inferring renderability.
