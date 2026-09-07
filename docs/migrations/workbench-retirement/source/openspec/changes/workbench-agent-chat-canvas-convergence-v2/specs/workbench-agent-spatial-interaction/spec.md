## ADDED Requirements

### Requirement: Canvas selection SHALL project into a pending Composer tray
Selecting canonical or Draft objects SHALL immediately update a bounded pending-selection tray with safe refs, labels, types, owner refs, projection revisions and freshness. Pending selection MUST NOT write text, attach a Context Pack, submit a turn, persist Draft/Board state or move keyboard focus.

#### Scenario: User selects Canvas objects
- **WHEN** the user selects one or more authorized objects
- **THEN** the Composer tray SHALL list them as “待附加” with remove and attach actions
- **AND** the current draft and attached Context Pack SHALL remain unchanged

#### Scenario: User changes selection after attaching context
- **WHEN** the Canvas selection changes after a Context Pack was attached
- **THEN** the new selection SHALL appear separately as pending
- **AND** SHALL NOT mutate the exact revision already attached to the current turn

### Requirement: Pending selection SHALL attach only after exact-revision revalidation
When the user explicitly chooses “用于本次提问”, Workbench SHALL ask the Context service to reauthorize every pending ref against current principal/scope and exact projection revision. Any stale, revoked, missing or mismatched item MUST block the attachment until explicitly refreshed or removed.

#### Scenario: Every selected object is current
- **WHEN** all pending refs pass scope and revision validation
- **THEN** Workbench SHALL create or update one authorized Context Pack and render attached per-draft chips
- **AND** the attached refs SHALL clear after a confirmed turn submission

#### Scenario: One selected object is stale
- **WHEN** any pending ref changed revision or lost authorization
- **THEN** the tray SHALL identify the affected safe ref and offer Refresh or Remove
- **AND** SHALL NOT auto-upgrade the revision, silently omit the object or submit a reduced Context Pack

### Requirement: Soft follow SHALL update presentation without changing work
After explicit Session Profile consent, live foreground response intents MAY automatically highlight/compare/preview safe refs and update the shared Context rail. Soft follow MUST NOT move keyboard focus, pan/zoom the camera, switch runtime, write the Composer, attach Context, persist Draft/Board state, decide a proposal or invoke a mutation.

#### Scenario: Live answer references selected objects
- **WHEN** a valid live response emits authorized highlight refs and no dirty/review/modal guard blocks it
- **THEN** the active Canvas SHALL render temporary highlights and the Context rail SHALL show the safe projection
- **AND** keyboard focus, camera and canonical revisions SHALL remain unchanged

#### Scenario: User is reviewing or typing
- **WHEN** a soft-follow intent arrives during a dirty Composer, active Review, modal or replay
- **THEN** Workbench SHALL render an explicit “在画布查看” suggestion
- **AND** SHALL not apply the automatic effect

### Requirement: Agent Canvas changes SHALL remain one atomic proposal
An Agent response MAY reference one server-authored Spatial change-set containing bounded operations, basis refs, expected Board revision, registry digest and inverse metadata. Workbench SHALL render preview only; Accept/Reject/Request Changes SHALL use ProposalAuthority and the complete set SHALL commit atomically or not at all.

#### Scenario: User accepts the preview
- **WHEN** the user accepts a current change-set
- **THEN** ProposalAuthority/TaskService SHALL revalidate and commit the complete operation list through the Spatial owner
- **AND** Workbench SHALL wait for authoritative Task/receipt/Board projection before showing persistence

#### Scenario: One operation conflicts
- **WHEN** any operation fails revision, scope, registry or validation checks
- **THEN** the entire change-set SHALL remain unapplied and show conflict/recovery
- **AND** Workbench SHALL NOT partially apply, auto-split or resubmit it

