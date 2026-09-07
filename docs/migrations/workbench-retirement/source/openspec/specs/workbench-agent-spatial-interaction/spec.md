# workbench-agent-spatial-interaction Specification

## Purpose
TBD - created by archiving change workbench-unified-spatial-creative-runtime-v1. Update Purpose after archive.
## Requirements
### Requirement: Agent spatial intents MUST use a separate closed contract
Agent outputs MAY attach negotiated `AgentSpatialIntentV1` projections with only `open_lens`、`focus_ref`、`highlight_refs`、`compare_refs`、`preview_change_set` and `open_runtime_action`. The contract MUST reject arbitrary maps, DOM selectors, URLs, HTML, code, component props, credentials and private paths, and MUST NOT widen `AgentPresentationIntentV1`.

#### Scenario: Agent emits an unsafe spatial target
- **WHEN** an Agent spatial intent contains a DOM selector, raw URL or unregistered Lens
- **THEN** the whole intent MUST be rejected with a stable failure code
- **AND** no focus, overlay, proposal or mutation effect MAY occur

### Requirement: Automatic Agent effects MUST remain presentation-only

Live foreground open/highlight effects MAY be Follow Pi eligible only after server capability, active-session consent, scope, expiry, authorized refs, dirty composer, active Review, modal, delivery and dedupe guards pass. Automatic effects MUST NOT move keyboard focus, write composer context, attach a Context Pack, create a proposal decision, persist spatial state or call a mutation endpoint. User-triggered Pane opening MAY use the existing responsive focus contract.

#### Scenario: Follow Pi receives a highlight intent
- **WHEN** a valid live highlight intent arrives while Follow Pi is enabled and no guard blocks it
- **THEN** Workbench MAY render a temporary bounded overlay or update the shared context rail
- **AND** Board revision, Workflow state, composer draft and selected keyboard focus remain unchanged

#### Scenario: A presentation suggestion is activated
- **WHEN** the user explicitly activates a valid `open_pane` or `show_evidence` suggestion
- **THEN** the canonical Pane registry resolves and focuses the requested Pane according to the current viewport contract
- **AND** no Task, Proposal, Context attachment or Owner mutation is created by presentation alone

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

### Requirement: Negotiated Agent spatial intents SHALL reach the active surface
Only validated optional spatial intents attached to real Agent outputs may flow through the session workspace and route into the active Spatial Surface. Follow Pi guards MUST use the actual composer dirty, Review, modal and delivery state; effects remain temporary presentation.

#### Scenario: Agent emits a preview intent
- **WHEN** a negotiated Agent output emits a valid preview change-set intent while all Follow Pi guards permit it
- **THEN** the active surface shows only a temporary preview
- **AND** no proposal decision, Task or runtime action is created until explicit user action

### Requirement: Spatial Canvas SHALL remain truthful and accessible when rendering degrades

Each semantic level MUST expose an accessible region/cluster/object summary independent of rich DOM overlays. WebGL, worker, contract, owner or context loss MUST produce a visible degraded/unavailable state with a bounded accessible list or recovery action. Atlas/Cluster MUST NOT be considered correct solely because rich DOM count is zero, and unavailable content MUST use the shared local status/recovery pattern.

#### Scenario: The Spatial contract is unavailable
- **WHEN** the Spatial service or projection reports needs_contract, offline or stale
- **THEN** the surface retains its structure, labels the impact in localized language and exposes one retry, refresh or contract recovery action
- **AND** it does not render synthetic nodes or claim the surface is ready

#### Scenario: The renderer loses context
- **WHEN** WebGL or the worker renderer loses context
- **THEN** Workbench shows a degraded renderer state and a bounded accessible object/region list
- **AND** the user can inspect or return to the last-confirmed safe content without a second editor or mutation path

#### Scenario: The user selects an object
- **WHEN** a keyboard or pointer user selects a canonical or Draft object
- **THEN** the shared context rail reflects the safe selection and announces the selection count
- **AND** adding the object to the composer or Draft requires an explicit user action

### Requirement: Creative Production SHALL host a closed Screenplay Room renderer

The `creative_production` Lens SHALL support a closed `screenplay_room` surface descriptor that replaces the central generic renderer while preserving the existing Spatial selection, context rail, Agent intent, proposal and focus contracts. Unknown surface values MUST fail closed to the existing Creative Production experience.

#### Scenario: Screenplay Room surface is selected

- **WHEN** trusted ingress and server capability resolve `creativeSurface=screenplay_room`
- **THEN** the central surface SHALL mount the specialized dual-timeline renderer
- **AND** it SHALL not add a second fixed business rail, composer, event stream or Task control plane.

#### Scenario: User exits Screenplay Room

- **WHEN** the user returns to the previous Creative Production surface
- **THEN** Agent session/composer and safe Pane state SHALL remain recoverable
- **AND** exiting SHALL not cancel owner mutations or discard confirmed receipts.

