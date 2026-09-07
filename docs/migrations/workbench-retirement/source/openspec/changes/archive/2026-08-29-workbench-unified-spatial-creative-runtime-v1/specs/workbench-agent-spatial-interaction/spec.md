## ADDED Requirements

### Requirement: Agent spatial intents MUST use a separate closed contract
Agent outputs MAY attach negotiated `AgentSpatialIntentV1` projections with only `open_lens`、`focus_ref`、`highlight_refs`、`compare_refs`、`preview_change_set` and `open_runtime_action`. The contract MUST reject arbitrary maps, DOM selectors, URLs, HTML, code, component props, credentials and private paths, and MUST NOT widen `AgentPresentationIntentV1`.

#### Scenario: Agent emits an unsafe spatial target
- **WHEN** an Agent spatial intent contains a DOM selector, raw URL or unregistered Lens
- **THEN** the whole intent MUST be rejected with a stable failure code
- **AND** no focus, overlay, proposal or mutation effect MAY occur

### Requirement: Automatic Agent effects MUST remain presentation-only
Live foreground open/highlight effects MAY be Follow Pi eligible only after server capability, active-session consent, scope, expiry, authorized refs, dirty composer, active Review, modal and dedupe guards pass. Automatic effects MUST NOT move keyboard focus, create a proposal decision or persist spatial state.

#### Scenario: Follow Pi receives a highlight intent
- **WHEN** a valid live highlight intent arrives while Follow Pi is enabled and no guard blocks it
- **THEN** Workbench MAY render a temporary bounded overlay
- **AND** Board revision, Workflow state and selected keyboard focus MUST remain unchanged

### Requirement: Persistent Agent edits MUST be proposal-first
Any Agent-authored create, move, group, connect, display, Workflow draft or binding suggestion MUST become a server-authored change-set proposal with base revision, bounded operations, impact, reversibility, risk, cost and required decision. Browser-local previews MUST NOT be accepted as authority.

#### Scenario: User accepts a Board change-set
- **WHEN** the user accepts a current proposal revision
- **THEN** ProposalAuthority MUST reload scope, capability, basis, target versions and operation descriptor before creating the TaskService mutation
- **AND** success MUST be shown only from the resulting Board receipt

### Requirement: Board change-sets MUST commit atomically
`ApplySpatialChangeSet` MUST validate the complete bounded Board operation list, expected Board revision, registry digest, authorization, idempotency and inverse metadata before one atomic commit. A failed operation MUST leave the Board revision and graph unchanged.

#### Scenario: One operation conflicts with current revision
- **WHEN** a change-set contains a stale node move among otherwise valid operations
- **THEN** the entire Board change-set MUST fail with revision conflict
- **AND** Workbench MUST offer refresh/review rather than applying a partial graph

### Requirement: Large layout plans MUST remain non-mutating until accepted
Interactive browser layout MUST be limited to at most 2k selected nodes. Larger layout requests MUST run through `PlanSpatialLayout` and return a proposal preview; planning MUST NOT change Board geometry.

#### Scenario: Agent requests whole-Board layout
- **WHEN** the requested scope exceeds the interactive layout limit
- **THEN** Workbench MUST create an asynchronous layout plan and show its bounded diff
- **AND** Board geometry MUST remain unchanged until the proposal is accepted and receipted

### Requirement: Ambiguous decisions MUST reconcile without replay
Any possible post-dispatch ambiguity for proposal decision or Board mutation MUST enter `decision_unknown` or `unknown_accept`. The system MUST reconcile the original Task/receipt identity and MUST NOT create a replacement proposal, Task or automatic retry.

#### Scenario: Change-set acceptance response is lost
- **WHEN** the network fails after the acceptance Task may have been submitted
- **THEN** Workbench MUST display reconcile-only state using the original idempotency identity
- **AND** MUST NOT resubmit the change-set with a new key
