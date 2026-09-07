## ADDED Requirements

### Requirement: Workbench SHALL persist a separate project Draft document

Workbench SHALL own a project-scoped versioned Draft document with object kinds `note | text | ink | connector | frame | reference` and lifecycle `active | locked | promoted | deleted`. Draft objects SHALL remain visually and semantically distinct from canonical projections. A Draft reference to an Owner object SHALL contain only an authorized safe ref/revision.

#### Scenario: User creates a note in Draft mode

- **WHEN** the user explicitly enters Draft mode and creates a note
- **THEN** Workbench SHALL persist it as a Draft object with document/object revision and author safe ref
- **AND** SHALL not create a Board node, Owner record or Task

#### Scenario: User leaves and reopens the project

- **WHEN** the project Draft document is available
- **THEN** Workbench SHALL restore active Draft objects in their Lens projections
- **AND** SHALL preserve their Draft styling and lifecycle state

### Requirement: Draft editing SHALL use bounded revisioned patches

`PatchSpatialDraftDocument` SHALL require document expected revision, idempotency key and at most 200 closed operations. Operations that touch an existing object SHALL carry expected object revision. Same idempotency key and digest SHALL return the original result; different digest SHALL return `idempotency_conflict`.

#### Scenario: Two users edit different Draft objects

- **WHEN** concurrent patches touch different object refs with valid object revisions
- **THEN** the service MAY merge them into ordered document revisions
- **AND** both clients SHALL observe the canonical event order

#### Scenario: Two users edit the same Draft text

- **WHEN** concurrent patches target the same object revision and field
- **THEN** one patch SHALL succeed and the other SHALL receive a typed conflict with current safe object state
- **AND** the client SHALL require compare/reapply rather than silent last-write-wins

### Requirement: Drag preview and committed geometry SHALL be separated

Pointer movement during Draft or layout drag SHALL be ephemeral presence preview. Persistent geometry SHALL be written only on commit such as pointer-up, keyboard move confirmation or explicit menu action. A failed commit SHALL restore or reconcile against the last canonical Draft/layout snapshot.

#### Scenario: User drags a Draft frame

- **WHEN** the pointer moves during the drag
- **THEN** collaborators MAY see a throttled preview without Draft revision changes
- **AND** one bounded geometry patch SHALL be submitted when the drag commits

#### Scenario: Geometry commit conflicts

- **WHEN** another client changed the same object before pointer-up
- **THEN** the local client SHALL show the current remote geometry and a typed conflict
- **AND** SHALL not overwrite it with the stale drag endpoint

### Requirement: Draft undo SHALL append inverse operations without rewinding collaborators

Undo SHALL create a new inverse patch for the current user's latest reversible operation group. It MUST NOT decrement document revision, remove another user's later changes or delete canonical Owner results. Promoted Draft objects SHALL retain promotion provenance even if their source Draft presentation is later hidden.

#### Scenario: User undoes a move after another user adds a note

- **WHEN** the user undoes their last move and another user's note was committed afterward
- **THEN** Workbench SHALL append an inverse move patch
- **AND** SHALL preserve the other user's note and later document revisions

#### Scenario: User attempts to undo a completed promotion

- **WHEN** a Draft object already maps to a terminal canonical receipt
- **THEN** Undo SHALL not delete or revert the Owner object
- **AND** Workbench SHALL direct business rollback through an approved Owner proposal/action when available

### Requirement: Lightweight presence SHALL be ephemeral, bounded and degradable

Presence SHALL contain only safe member identity, active Lens, world cursor, selected safe refs and heartbeat. Cursor updates SHALL be limited to 10Hz, selection/viewport updates to 2Hz, heartbeat TTL to 15 seconds and projected active members to 32 per surface. Presence SHALL NOT enter Draft revision, audit, backup or lifecycle export.

#### Scenario: More than 32 users are active

- **WHEN** a surface has more than 32 active presence participants
- **THEN** Workbench SHALL show an aggregate member count and Lens distribution beyond the bounded visible set
- **AND** SHALL not create an unbounded cursor overlay

#### Scenario: Presence stream is unavailable

- **WHEN** Draft storage remains available but the presence stream disconnects
- **THEN** Workbench SHALL mark `presence_degraded` and continue revisioned Draft editing/refetch
- **AND** SHALL not interpret missing cursors as proof that no collaborator is editing

### Requirement: Draft promotion SHALL operate on an explicit selection set

`PromoteSpatialDraftSelection` SHALL require selected Draft refs, expected Draft/layout/Board revisions, target Lens and idempotency key. The service SHALL reload Draft objects, type registry, Owner visibility and current revisions, then return a mapping preview and canonical `SpatialChangeSetProposalV1`. The browser MUST NOT choose final Owner operation, basis visibility or authorization facts.

#### Scenario: User promotes a connected group

- **WHEN** the user selects notes, references, a frame and provisional connectors and chooses Promote
- **THEN** the service SHALL resolve target types/Owners, dependencies, affected refs, risk and cost as one proposal
- **AND** SHALL preserve the relation set atomically in the proposal preview

#### Scenario: Selection contains an unauthorized Owner reference

- **WHEN** one selected Draft reference is no longer visible to the principal
- **THEN** promotion SHALL fail closed or exclude it only through an explicit partial-selection review
- **AND** SHALL not leak the hidden target or submit a weakened proposal silently

### Requirement: Promotion acceptance SHALL use ProposalAuthority and TaskService

Accepting a Draft promotion SHALL follow user confirmation, server revalidation, ProposalAuthority decision, TaskService execution and Owner receipt/reconcile. `reject` or `request_changes` SHALL not mutate Owner state. `unknown_accept` SHALL preserve the Draft and allow only the original attempt to reconcile.

#### Scenario: Promotion succeeds

- **WHEN** the canonical proposal is accepted and the Owner receipt confirms creation/update
- **THEN** mapped Draft objects SHALL become `promoted` with proposal, Task and Owner safe refs
- **AND** the new canonical projection SHALL be refetched before the UI shows terminal success

#### Scenario: Promotion result is unknown

- **WHEN** dispatch may have crossed the Owner boundary but no terminal receipt is confirmed
- **THEN** Workbench SHALL keep the Draft visible with `unknown_accept`
- **AND** SHALL offer reconcile for the original attempt without replay or fallback mutation

### Requirement: Draft and presence data SHALL follow privacy and retention boundaries

Draft persistence MAY contain bounded user-authored note/text/ink content and safe references required for the Draft job. It MUST NOT contain raw model prompts, provider payloads, tool arguments, credentials, private paths, signed URLs, Owner private payloads, artifact blobs or chain-of-thought. Presence SHALL remain memory/ephemeral only.

#### Scenario: Sensitive sentinel enters a promotion preview

- **WHEN** a Draft field or Owner projection contains a configured sensitive sentinel
- **THEN** logs, traces, events, receipts, screenshots and integration evidence SHALL redact or reject it according to policy
- **AND** SHALL retain only safe refs and bounded summaries

#### Scenario: Project lifecycle deletion is executed

- **WHEN** the owning project/tenant lifecycle policy deletes or blocks Workbench-owned Draft data
- **THEN** Draft documents/events/layout preferences SHALL follow the registered Workbench data class policy
- **AND** no presence record SHALL require deletion because presence was never persisted

