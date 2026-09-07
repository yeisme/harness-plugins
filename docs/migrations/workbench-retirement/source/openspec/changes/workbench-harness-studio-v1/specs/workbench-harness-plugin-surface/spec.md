## ADDED Requirements

### Requirement: Studio MUST render only approved plugin surface descriptors in registered slots

Studio MUST obtain plugin surfaces from an authorized control-plane descriptor containing immutable release digest, installation ref, surface ID/kind/slot, contract version/digest, lifecycle/readiness, allowed resource scopes, typed view/action/event schemas, accessibility metadata and permitted deep-link target. The static Workbench slot registry MUST reject unknown slots, malformed schemas, unapproved release digests and incompatible major contracts. Plugin descriptors MUST NOT register arbitrary browser routes, arbitrary network origins, inline scripts or client authority.

#### Scenario: A plugin declares an unknown operations slot
- **WHEN** Studio receives a descriptor with a slot not present in its registered contract version
- **THEN** Studio MUST refuse to render the surface and record only a redacted contract diagnostic
- **AND** it MUST NOT fall back to an arbitrary component, iframe URL or client-generated capability.

### Requirement: Native-reviewed and sandboxed iframe surfaces MUST have separate trust boundaries

`native-reviewed` surfaces MUST be static Workbench renderers that receive only schema-validated typed models. `sandboxed-iframe` surfaces MUST load only an immutable, content-addressed document whose artifact digest, release digest, URL/path and media type match the approved descriptor; an allow-listed mutable origin alone MUST NOT authorize execution. The host and iframe response MUST enforce a restrictive sandbox/CSP without shared origin, browser credential, top navigation, unbounded storage or arbitrary network privilege, and the iframe document MUST deny network egress by default except exact approved bridge/connect destinations or an equivalent isolated proxy. The surface MUST use a versioned capability-limited message bridge. Every message MUST validate exact source window, origin, channel nonce, installation/release/context revision and schema. Neither class may receive session tokens, credential values, raw prompts, provider payloads, signed URLs, canonical domain state or owner private paths.

#### Scenario: Sandboxed surface requests an undeclared action
- **WHEN** an iframe message requests an action absent from its current descriptor
- **THEN** Studio MUST reject the message before action dispatch and expose a safe contract error
- **AND** it MUST NOT forward the message, grant new capability or disclose other slot data.

#### Scenario: Approved iframe origin serves changed bytes
- **WHEN** a previously allow-listed origin returns a document whose content digest no longer matches the approved immutable release artifact
- **THEN** Studio MUST block the surface as `blocked_supply_chain` before executing it
- **AND** it MUST NOT trust origin approval, cached metadata or a matching version label as a substitute for byte integrity.

### Requirement: Studio MUST consume typed views, resources, actions, events, receipts and reconciliations

Studio MUST schema-validate `HarnessView`, `HarnessResource`, `HarnessActionDescriptor`, `HarnessEvent`, `HarnessReceipt` and `HarnessReconcile` envelopes before display. Envelopes MUST carry tenant/workspace/owner/installation-scoped safe refs, contract/projection version, freshness, state and redacted summary; actions MUST additionally contain expected version, idempotency, permission, approval, rights and cost gates. Events may invalidate or refresh an eligible query but MUST NOT overwrite a typed projection with raw event data.

#### Scenario: Owner event contains an unsupported payload version
- **WHEN** Studio receives an event whose required schema/version cannot validate
- **THEN** it MUST mark the relevant capability `contract_mismatch` and request a safe refresh/diagnostic
- **AND** it MUST NOT render the event payload or continue enabling mutations from stale state.

### Requirement: Mutations MUST be descriptor-authorized, receipt-backed and reconcilable

Studio MUST send a user-confirmed action only through the Workbench typed facade/TaskService path. Before dispatch it MUST show target, owner, intended effect, tenant/workspace, expected-version conflict semantics, permission/rights/approval and bounded cost policy. HTTP acceptance, animation or local optimistic state MUST NOT be presented as owner success. `pending`, `partial`, `unknown_accept`, `unknown` and `reconcile_required` MUST retain the same receipt/correlation/idempotency identity and expose only owner-authorized next actions; Studio MUST NOT automatically redispatch an unknown mutation.

#### Scenario: Connection drops after a paid generation dispatch
- **WHEN** the owner may have accepted the descriptor-authorized generation but no terminal response reaches Studio
- **THEN** Studio MUST display `unknown_accept` or `reconcile_required` with its existing receipt and safe reconcile action
- **AND** it MUST NOT create a second generation, report zero cost or claim Eikona/Scaena success.

### Requirement: Studio MUST enforce safe performance and telemetry boundaries for plugin surfaces

Studio MUST lazy-load slots, cancel context-stale work, resume bounded cursor streams, virtualize/paginate large resource lists, coalesce eligible events and enforce schema payload/complexity limits. Logs, telemetry, screenshots and integration evidence MUST contain only safe refs, digests, statuses, redacted diagnostics and receipt/evidence refs; they MUST NOT retain raw prompt, provider payload, signed URL, Authorization, credential, private path, asset bytes or canonical domain payload.

#### Scenario: An Asset Library surface returns an oversized response
- **WHEN** a descriptor response exceeds the configured safe payload limit
- **THEN** Studio MUST stop rendering it and surface a recoverable bounded-response diagnostic
- **AND** it MUST NOT retry unboundedly, persist the response or expose its raw body in telemetry.
