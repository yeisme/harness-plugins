## MODIFIED Requirements

### Requirement: Agent proposal authority is server canonical
The system SHALL persist every actionable Agent proposal as a versioned server-authoritative record before exposing an enabled decision control. Agent output, browser state, Pane state, fixture data, and presentation intents MUST remain non-authoritative projections.

#### Scenario: Actionable proposal is projected
- **WHEN** the Agent runtime emits a valid closed proposal for an authorized session and source output
- **THEN** the server stores a proposal ref, revision, closed descriptor, safe basis refs, target Operation identity, expiry, scope and required version references
- **AND** the browser receives only a bounded safe projection of that record

#### Scenario: Browser-only proposal is rendered
- **WHEN** a fixture or stale client constructs a proposal that has no matching server authority record
- **THEN** the decision capability is `needs_contract` or unavailable
- **AND** no accept, reject, request-changes, Task or Owner mutation is created

### Requirement: Decision requests are closed and minimal
The system MUST accept only a typed proposal decision containing the proposal ref, expected proposal revision, a closed decision, an idempotency key, and policy-approved bounded reason metadata. The request MUST NOT allow the caller to supply actor identity, scope authority, basis visibility, target Operation, target ref, Owner endpoint, expected domain versions, permission claims, cost claims, tool arguments, or Owner payload.

#### Scenario: User accepts a current proposal
- **WHEN** an authenticated user submits `accept` with the current proposal revision and a new idempotency key
- **THEN** the service resolves the actor and scope from authenticated server context
- **AND** it reloads every execution-relevant field from the canonical proposal

#### Scenario: Caller supplies execution fields
- **WHEN** a request includes an arbitrary Operation, URL, Owner endpoint, basis override, expected Owner version, actor, tool arguments or payload
- **THEN** schema or service validation rejects the request as `invalid_argument`
- **AND** the unsafe value is not echoed into logs, events, receipts or UI errors

### Requirement: Proposal decisions enforce revision and idempotency
The system SHALL guard each decision with expected proposal revision and principal-scoped idempotency. A key reused with the same digest MUST return the original result; a key reused with another digest MUST fail with a typed conflict.

#### Scenario: Two clients decide the same revision
- **WHEN** two authorized clients concurrently submit different decisions against the same proposal revision
- **THEN** exactly one decision claim succeeds
- **AND** the other client receives the current safe projection and `revision_conflict` or `decision_in_progress`

#### Scenario: Decision request is replayed
- **WHEN** the same principal replays the same idempotency key and request digest
- **THEN** the service returns the original decision result without creating another Task or decision attempt

#### Scenario: Idempotency key digest changes
- **WHEN** the same principal reuses a decision idempotency key with another proposal, revision, decision or reason digest
- **THEN** the service returns `idempotency_conflict`
- **AND** it does not change the proposal or dispatch a Task

### Requirement: Acceptance revalidates all server authority
Before dispatching an acceptance, the system MUST reload and validate proposal status, expiry, principal scope, session/source visibility, basis visibility, descriptor identity and revision, target Operation, Owner capability, permission, cost, approval requirements, expected domain versions and action canary state.

#### Scenario: Proposal remains valid
- **WHEN** every authoritative fact still matches the proposal and policy permits the action
- **THEN** the service may cross the dispatch boundary through the existing TaskService

#### Scenario: Source or descriptor drifts
- **WHEN** the source output, basis visibility, descriptor digest, target Operation or expected domain version no longer matches
- **THEN** acceptance fails closed with a typed stale, superseded, permission, capability or version reason
- **AND** no fallback Operation, Provider or Owner is selected

#### Scenario: Proposal expires before decision
- **WHEN** the authoritative proposal expiry elapses before the decision claim crosses dispatch
- **THEN** the proposal becomes `expired`
- **AND** the UI requires a new proposal instead of reviving the expired one

### Requirement: Accepted proposals enter the existing Task control plane
The system SHALL execute an accepted proposal only by submitting the registered `orbit.proposal.accept` Operation through the existing TaskService. The sealed Task input MUST reference a server decision record and MUST NOT trust browser-provided basis, target, action, version or payload fields.

#### Scenario: Acceptance is admitted by TaskService
- **WHEN** proposal revalidation succeeds and TaskService accepts the sealed decision ref
- **THEN** the proposal decision becomes `accepted` with the returned Task ref and safe receipt/correlation refs
- **AND** Task status remains a separate authoritative state from proposal decision status

#### Scenario: Target Operation is unavailable
- **WHEN** the sealed proposal resolves to an unregistered, disabled or contract-mismatched target Operation
- **THEN** the service returns `capability_unavailable` or `needs_contract`
- **AND** it does not substitute another Operation or fabricate an accepted receipt

### Requirement: Reject and request-changes do not execute work
The system SHALL support `reject` and `request_changes` as Workbench-owned proposal decisions. These decisions MUST NOT create a Task, invoke an Owner, submit an Agent turn, overwrite a composer draft, or change Owner canonical state.

#### Scenario: User rejects a proposal
- **WHEN** an authorized user submits `reject` against the current proposal revision
- **THEN** the proposal becomes `rejected` with a versioned decision receipt
- **AND** no Task or Owner call occurs

#### Scenario: User requests changes
- **WHEN** an authorized user submits `request_changes` with an approved bounded reason code
- **THEN** the proposal becomes `changes_requested`
- **AND** any composer handoff remains a separate explicit user action that cannot auto-submit

### Requirement: Unknown acceptance is reconcile only
If the system cannot determine whether acceptance crossed the Task or Owner dispatch boundary, it MUST persist the original attempt as `decision_unknown`. It MUST NOT replay the mutation, create a fallback Task, change Provider/adapter, or fabricate a terminal state.

#### Scenario: Dispatch result is indeterminate
- **WHEN** timeout, process interruption or unreadable response leaves acceptance outcome uncertain after a durable dispatch intent exists
- **THEN** the proposal enters `decision_unknown` with the original decision, idempotency, Task, receipt and correlation refs that are known
- **AND** all decision controls except reconcile are disabled

#### Scenario: Reconcile proves acceptance
- **WHEN** status, receipt or reconcile proves the original acceptance occurred
- **THEN** the original decision becomes `accepted`
- **AND** the existing Task/receipt is linked without submitting another mutation

#### Scenario: Reconcile proves no acceptance
- **WHEN** authoritative reconcile proves the original acceptance did not occur
- **THEN** the attempt becomes `reconciled_not_accepted` and the proposal returns to `open` with a new revision if it remains current
- **AND** any later accept requires a new explicit decision and a new idempotency key

### Requirement: Proposal projection separates decision, Task and Owner truth
The system SHALL project proposal status, decision status, Task status, Owner receipt/reconcile status and action availability as separate fields. No layer may derive one of these states from another or display acceptance as target-operation success.

#### Scenario: Accepted Task is still running
- **WHEN** TaskService accepted the proposal but the target Task is queued, running, blocked, partial or failed
- **THEN** Review Pane shows the decision as accepted and the Task state separately
- **AND** it does not display the proposal as completed work

#### Scenario: Owner outcome remains unknown
- **WHEN** the linked Task or receipt is `unknown_accept`
- **THEN** Review, timeline, Activity and session attention all expose reconcile-only truth
- **AND** the composer is blocked only for the affected session as defined by the Agent workspace contract

### Requirement: Proposal actions have transport and SDK parity
HTTP REST/SSE, gRPC unary/stream, JSON-RPC 2.0 and the TypeScript SDK SHALL expose equivalent get, decide and reconcile semantics, revisions, idempotency, authorization, typed errors and safe results through one shared service implementation.

#### Scenario: Acceptance succeeds across transports
- **WHEN** equivalent valid decision requests are issued through each supported wire transport
- **THEN** every transport observes the same proposal revision, decision state, Task ref, receipt refs and idempotency replay behavior

#### Scenario: Revision conflict occurs across transports
- **WHEN** equivalent stale-revision requests are issued through each supported wire transport
- **THEN** every transport maps the same canonical `revision_conflict` and current safe projection
- **AND** no transport handler contains an operation-specific authorization bypass

### Requirement: Proposal events reuse bounded Agent streams
Proposal registration, decision, conflict, expiry, acceptance, unknown and reconciliation events SHALL be projected through the existing workspace directory and selected-turn event mechanisms. The browser MUST NOT open one independent stream per proposal.

#### Scenario: Background proposal requires review
- **WHEN** a background session receives a new open proposal
- **THEN** one workspace directory event updates its server-authored attention and unread state
- **AND** selecting the session can load proposal detail through the existing bounded detail path

#### Scenario: Decision event reconnects
- **WHEN** the event stream disconnects after a decision is persisted
- **THEN** cursor catch-up returns the same safe proposal revision and state without duplicating the decision

### Requirement: Review Pane is a safe consumer of proposal authority
Review Pane SHALL render only server-authored proposal capability and MUST require explicit user activation for every decision. Hover, focus, Pane open, Follow Pi, presentation intents and repeated pointer or keyboard events MUST NOT decide a proposal.

#### Scenario: Presentation intent requests review
- **WHEN** an allowed `request_review` intent resolves for the current proposal
- **THEN** the UI may open or focus Review Pane
- **AND** accept, reject, request-changes and reconcile remain untouched

#### Scenario: Decision capability is unavailable
- **WHEN** proposal read is enabled but proposal decision or the target Owner contract is disabled
- **THEN** Review Pane remains readable and displays `needs_contract`, permission, cost, offline or stale truth with recovery guidance
- **AND** it does not enable a fixture or mock action fallback

#### Scenario: User activates decision twice
- **WHEN** keyboard or pointer input repeats while a decision request is pending
- **THEN** the control remains disabled or reuses the same idempotency request
- **AND** no duplicate decision or Task is created

### Requirement: Proposal data and diagnostics are privacy bounded
The system MUST persist and emit only proposal metadata, safe refs, closed descriptors, revisions/digests, bounded policy-approved decision summaries, Task/receipt/correlation refs and idempotency digests. It MUST reject or redact raw prompts, provider payloads, chain-of-thought, credentials, Authorization values, private paths, signed URLs, arbitrary tool arguments, artifact blobs and Owner private payloads.

#### Scenario: Sensitive sentinel enters a proposal candidate
- **WHEN** runtime or transport input contains credential, private path, raw prompt, provider payload, signed URL, HTML, JavaScript or arbitrary tool argument sentinels
- **THEN** validation rejects or strips those values before canonical persistence
- **AND** database rows, logs, traces, events, SDK fixtures, screenshots, receipts and evidence do not expose them

#### Scenario: User note is not policy enabled
- **WHEN** a client submits free-form decision text while the policy only permits closed reason codes
- **THEN** the service rejects the note as `invalid_argument`
- **AND** it does not persist or forward the text

### Requirement: Proposal authority rolls out in independent capability layers
The system SHALL keep proposal read, decision, reconcile and real tool-action canary capabilities independently server-authorized and disabled by default. Browser query parameters, local storage, build flags, fixture state and route selection MUST NOT grant them.

#### Scenario: Read-only cohort is enabled
- **WHEN** a principal is authorized only for proposal read
- **THEN** the UI can inspect canonical proposals but all decisions remain disabled

#### Scenario: Decision capability is rolled back
- **WHEN** operators disable proposal decision or the target action canary
- **THEN** new decisions stop while existing proposals, attempts, Tasks and receipts remain readable
- **AND** accepted or unknown attempts can continue through their original Task/Owner completion or reconcile path

### Requirement: Readiness evidence is capability scoped
The system MUST keep contract/focused, transport parity, browser/E2E, real Owner adapter, canary/rollback, deployment and production evidence as separate readiness tiers. A lower tier MUST NOT mark a higher tier or another Owner capability ready.

#### Scenario: Component tests pass with a mock adapter
- **WHEN** schema, service, SDK and Review Pane component tests pass against a reference or mock adapter
- **THEN** proposal read/decision implementation may be reported at the focused tier
- **AND** real action capability remains `needs_contract` until approved Owner receipt/reconcile and environment evidence pass

#### Scenario: One Owner canary passes
- **WHEN** a low-risk approved Owner Operation completes real accept, receipt, reconcile and rollback evidence
- **THEN** only that owner/operation cohort may be promoted
- **AND** other Owner operations retain their independent disabled or needs-contract status
