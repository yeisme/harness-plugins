## ADDED Requirements

### Requirement: DSH SHALL provide an exception-first OPC scene package view
DSH /drama SHALL consume Scaena OPCScenePackageSummaryV1alpha1 and show context, current stage, primary blocker, one primary action, gate status, evidence status, delivery status, and Workbench handoff without owning production state.

#### Scenario: Scene package is clear
- **WHEN** the summary is current and has no blocking finding
- **THEN** /drama MUST show the three normal human gates and one primary action
- **AND** it MUST link to Review, Evidence, Delivery, and Handoff panes without requiring a second domain model

#### Scenario: Scene package has an exception
- **WHEN** the summary contains rights, cost, stale, unknown, partial, owner-offline, originality/similarity, or plan-amendment findings
- **THEN** /drama MUST show the affected ref/version, reason, evidence refs, and owner-authored recovery or reconcile action
- **AND** MUST NOT hide the exception behind a generic failure or silently continue

### Requirement: DSH SHALL render server-authored actions and receipts
DSH MUST use the Scaena action descriptor as the source for action id, target ref, expected version, side-effect class, confirmation, idempotency, receipt and reconcile identity. A mutation MUST go through the typed host adapter.

#### Scenario: Action is submitted
- **WHEN** the OPC confirms an enabled DSH action
- **THEN** DSH MUST submit the owner action with its expected version and idempotency identity
- **AND** MUST refetch the owner projection after success, conflict, timeout, or unknown outcome
- **AND** MUST NOT claim success from HTTP 2xx or optimistic UI state

#### Scenario: Action is unavailable
- **WHEN** the summary has no valid action descriptor or required owner fact is stale/offline/unknown
- **THEN** DSH MUST disable the action and show the reason
- **AND** MUST NOT synthesize a local retry or replacement action

### Requirement: DSH SHALL keep normal gates separate from triggered exceptions
The normal path MUST show direction_confirm, visual_foundation_accept, and export_confirm. Cost, rights, stale, unknown, partial, owner-offline, originality/similarity, and plan-amendment items MUST be exception cards only when triggered.

#### Scenario: Gate and exception coexist
- **WHEN** export_confirm is pending and a rights finding is also present
- **THEN** DSH MUST show the gate and the rights exception separately
- **AND** MUST NOT mark export ready until both owner facts and the gate are satisfied

### Requirement: DSH SHALL preserve aspect, depth, and role semantics
DSH MUST show 9:16 and 16:9 as formal aspect facts, present a secondary aspect only as an independent reframe variant, and show balanced/cinematic as shared-contract depth values with cinematic requiring explicit upgrade confirmation. The primary UI MUST show role labels rather than requiring manual Skill composition.

#### Scenario: User inspects a cinematic reframe
- **WHEN** the summary contains a cinematic recommendation or secondary reframe
- **THEN** DSH MUST show recommendation/confirmed values, reason, impact, and cost envelope
- **AND** MUST link to the owner-authored variant/review action instead of creating a local action

### Requirement: DSH SHALL preserve partial, stale, offline, and unknown behavior
DSH MUST preserve last-known safe refs, version, evidence and blocker when owner data is unavailable or stale. Partial packages MAY be handed off or downloaded through owner grants only with visible partial and production_ready=false. Unknown outcomes MUST enter reconcile_required and MUST NOT auto-retry.

#### Scenario: Owner is offline
- **WHEN** the Scaena owner cannot be reached
- **THEN** DSH MUST show the last-known observation time and stale/offline reason
- **AND** MUST disable owner-dependent mutations while keeping safe evidence and Workbench handoff available

### Requirement: DSH and Workbench SHALL be semantically compatible
For the same package revision, DSH MUST match Workbench on action identity, target ref, expected version, side-effect class, confirmation/idempotency requirement, and receipt/reconcile identity.

#### Scenario: Cross-entry fixture
- **WHEN** a conformance fixture reads the same package via DSH and Workbench
- **THEN** presentation and exception ordering MAY differ
- **AND** action and receipt semantics MUST be identical

### Requirement: DSH SHALL expose safe evidence and handoff details
/drama evidence, /drama delivery, and /drama handoff MUST expose redacted refs, digests, counts, reason codes, manifest/checksum status, export receipt, short-lived grant status, and copyable real CLI/API details when supplied. They MUST NOT expose raw prompt, provider payload, credentials, signed URLs, absolute paths, or full chain-of-thought.

#### Scenario: User opens delivery details
- **WHEN** the OPC opens /drama delivery
- **THEN** DSH MUST distinguish formal versus partial package and display production_ready
- **AND** MUST explain grant expiry or checksum failure as a typed recovery reason
