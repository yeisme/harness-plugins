## ADDED Requirements

### Requirement: Real turns SHALL bind a sealed Conversation Runtime intent
Before submitting `workbench.agent.turn.submit.v1`, Workbench SHALL obtain a versioned sealed `turnIntentRef` from Conversation Runtime using the authenticated session grant, visible user message, exact Context Pack revision and approved artifact refs. TaskService and Runtime Plane SHALL receive only safe refs, revisions, digests and bounded limits.

#### Scenario: Real user message is submitted
- **WHEN** the user sends a valid message inside an active grant
- **THEN** Workbench SHALL seal the content first and submit the returned `turnIntentRef` through the existing Task operation
- **AND** raw message content SHALL NOT enter Task input, replay input, event log or broker payload

#### Scenario: Sealing succeeds but Task submit is uncertain
- **WHEN** a sealed intent exists but Workbench cannot confirm Task acceptance
- **THEN** the draft/intent SHALL remain pending with the same idempotency identities
- **AND** Workbench SHALL NOT create a second intent or display a committed user turn until accepted/read back

### Requirement: Session grants SHALL replace per-turn ordinary permission gates
An ordinary read/chat turn within a valid session grant SHALL not require a new permission gate solely because the turn operation is submitted. Tool mutation, sensitive read, external write, cost/profile/runtime escalation and expired/revoked grants SHALL continue through server-authored approval or blocked states.

#### Scenario: Ordinary conversation remains in scope
- **WHEN** runtime/model/tool/context/budget bindings match the active grant
- **THEN** TaskService SHALL accept or queue the turn without `awaiting_permission` for the same ordinary chat scope
- **AND** Task lifecycle, idempotency and expected-version checks SHALL remain enforced

#### Scenario: Mutation is proposed
- **WHEN** the Agent proposes a Board or Owner mutation
- **THEN** the turn MAY continue presenting the proposal summary
- **AND** execution SHALL require ProposalAuthority/TaskService approval independent of the chat grant

### Requirement: Turn attempts SHALL preserve partial and unknown outcomes
Workbench SHALL represent each runtime attempt separately. Confirmed Blocks from a failed attempt MUST remain `partial`; explicit Retry creates a new attempt. Unknown acceptance MUST remain reconcile-only and MUST NOT auto-retry, auto-switch runtime or concatenate output.

#### Scenario: Runtime exits after visible output
- **WHEN** content Blocks are confirmed before a known runtime failure
- **THEN** the turn SHALL show `partial` with an explicit Retry action
- **AND** the confirmed Blocks SHALL remain associated with the original attempt

#### Scenario: Runtime outcome is unknown
- **WHEN** owner acceptance or terminal state cannot be determined
- **THEN** the turn SHALL show `unknown_accept` and original-attempt Reconcile
- **AND** Retry and runtime switch SHALL remain disabled for that attempt

