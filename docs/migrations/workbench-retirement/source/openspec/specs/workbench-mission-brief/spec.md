# workbench-mission-brief Specification

## Purpose
Define Mission Brief as a bounded, authority-trimmed planning projection with truthful generation, decision, freshness, transport, evidence, rollout, and rollback semantics.

## Requirements

### Requirement: Mission Brief is a bounded safe planning projection
The system SHALL create a versioned `MissionBrief` for one server-authorized tenant, workspace, and project scope by aggregating only bounded safe projections from Task/Gate/receipt, Daily Operations, Workflow, R5 release/capability readiness, and approved Owner readiness sources. The system MUST NOT treat the brief as canonical Task, WorkItem, Approval, Delivery, Workflow, Release, Capability, or Owner state, and MUST NOT persist Owner payloads, artifact blobs, credentials, session tokens, private paths, raw prompts, raw model outputs, or model chain-of-thought.

#### Scenario: Generate a brief from safe sources
- **WHEN** an authorized user generates a brief for the current workspace and project
- **THEN** the system freezes a bounded safe source snapshot and returns a brief containing only opaque refs, safe summaries, source versions, freshness, risks, approvals, actions, and evidence refs
- **AND** the stored brief does not contain canonical Owner content or secrets

#### Scenario: Required source capability is unavailable
- **WHEN** one or more required source capabilities cannot prove a production contract or current safe projection
- **THEN** the system returns `partial`, `degraded`, or `needs_contract` according to the versioned policy
- **AND** it does not substitute fixtures, browser cache, private Owner data, or fabricated availability

#### Scenario: Source state changes after generation
- **WHEN** a Task, WorkItem, Approval, Delivery, Workflow, Release, authority, capability, or Owner source version used by a brief changes
- **THEN** the system marks the affected item or brief stale or resolved using typed events
- **AND** it does not rewrite the historical source snapshot in place

### Requirement: Authority and tenant isolation are enforced server-side
The system MUST resolve Principal, tenant membership, workspace/project access, object visibility, and allowed actions on the server for every Mission Brief read, generation, refresh, event, and decision. Browser-provided principal or tenant claims MUST NOT override server authority, and repository queries MUST apply authority scope before returning a brief or item.

#### Scenario: Cross-tenant ref probing
- **WHEN** a user supplies a valid brief, item, source, or evidence ref belonging to another tenant
- **THEN** the system returns the same non-disclosing not-found or permission error defined by the authority policy
- **AND** no title, summary, existence, version, freshness, event, or timing-sensitive metadata is exposed

#### Scenario: Membership is revoked while a brief is open
- **WHEN** the active membership or permission version is revoked after the browser loaded a brief
- **THEN** subsequent reads, watches, refreshes, and decisions fail closed against current authority
- **AND** the browser clears tenant-scoped brief cache, event cursor, pending selection, and unsafe rescue data

#### Scenario: Authority changes during generation
- **WHEN** the authority or membership version changes after context freeze but before generator dispatch or brief publication
- **THEN** the system revalidates authority at both boundaries, avoids the provider call when the change is known before dispatch, and does not publish the result when the change is detected before commit
- **AND** the generation returns a typed permission or source-drift outcome without making the stale brief actionable

#### Scenario: Tenant switch
- **WHEN** a user switches tenant or workspace
- **THEN** the Mission Brief client uses a new authority-scoped cache and cursor namespace
- **AND** no brief or item from the previous scope remains actionable or visible in the new scope

### Requirement: Generation requests are typed, bounded, and idempotent
The system SHALL accept only a typed generation request containing authorized scope, the supported current-snapshot horizon, a bounded maximum item count, and optional visible focus refs. The system MUST enforce server-defined limits, rate and concurrency policies, an idempotency key, and an input digest before invoking a generator.

#### Scenario: Equivalent concurrent generation requests
- **WHEN** equivalent requests with the same Principal, scope, input digest, and idempotency key arrive concurrently
- **THEN** the system returns the same generation Task or brief result
- **AND** it invokes the approved generator no more than once for that idempotent operation

#### Scenario: Idempotency key is reused with different input
- **WHEN** a client reuses an idempotency key with a different scope, focus refs, horizon, or max item request
- **THEN** the system returns a typed version or idempotency conflict
- **AND** it does not generate or overwrite a brief

#### Scenario: Request exceeds the generation budget
- **WHEN** a request exceeds the configured source, item, focus-ref, size, rate, concurrency, or cost limit
- **THEN** the system rejects or deterministically clamps it according to the published contract
- **AND** it records a low-cardinality reason without sending excess content to the generator

### Requirement: Generator input and output are isolated as untrusted data
The system MUST invoke a versioned `BriefGenerator` port without Owner credentials, mutation clients, arbitrary tools, shell access, or unapproved network destinations. It MUST treat all source text and generator output as untrusted data and validate strict schema, size, visible basis refs, source versions, expiry, capabilities, allowed actions, required approvals, and duplicates before persisting an item.

#### Scenario: Owner safe text contains prompt injection
- **WHEN** an Owner safe title or summary contains instructions to reveal data, change policy, invoke a tool, or execute an action
- **THEN** the system treats that content only as a data field
- **AND** the generator cannot access tools or credentials and the validator rejects any unauthorized output

#### Scenario: Generator invents an invisible basis ref
- **WHEN** a candidate item cites a basis ref absent from the frozen visible context
- **THEN** the validator rejects that item with a safe `basis_not_visible` reason
- **AND** the ref and candidate text are not exposed to the user or persisted as a valid proposal

#### Scenario: Generator emits an unsupported action or stale version
- **WHEN** a candidate action is outside the operation allowlist, lacks a required capability, omits approval metadata, or references a stale source version
- **THEN** the validator rejects the item
- **AND** no Task, Workflow, Owner mutation, or acceptance receipt is created

#### Scenario: Provider security or data contract is not current
- **WHEN** the configured generator endpoint lacks an approved authenticated-TLS/service-identity contract, tenant isolation, allowed-field policy, data residency, bounded retention, no-training/no-secondary-use, or a matching current digest
- **THEN** the adapter returns `needs_contract` before sending Mission Context data
- **AND** it does not silently fall back to an unapproved endpoint or provider policy

#### Scenario: Only some generated items are valid
- **WHEN** strict validation accepts at least one candidate and rejects at least one other candidate
- **THEN** the system persists only validated items and marks the generation `partial`
- **AND** it records bounded rejection reason counts without storing raw rejected output

### Requirement: Priority is policy-bounded and explainable
The system SHALL apply a versioned server-side priority policy that assigns an auditable priority band and non-model reason codes to every item. Safety and rescue conditions MUST impose non-decreasing priority floors, while a generator MAY only order or summarize items within the policy-permitted band. The user-facing explanation MUST be bounded and MUST NOT expose hidden reasoning or model chain-of-thought.

#### Scenario: Generator attempts to demote a critical rescue
- **WHEN** a candidate associated with `unknown_accept`, an expiring required approval, revoked access rescue, a critical delivery gate, or a release promotion No-Go is ranked below its policy floor
- **THEN** the server restores the required priority band or rejects the candidate according to policy
- **AND** the final item retains the applicable risk and approval reason codes

#### Scenario: User inspects why an item is prioritized
- **WHEN** a user opens a Mission Brief item
- **THEN** the UI displays its priority band, mapped reason codes, safe basis refs, source version/freshness, risk flags, and required approvals
- **AND** it does not display an opaque model score as authoritative fact

#### Scenario: Duplicate candidates describe the same source action
- **WHEN** rules or the generator produce multiple candidates for the same source version and typed action
- **THEN** the system deterministically deduplicates them before enforcing the item limit
- **AND** the retained item preserves all required safety reason codes and evidence refs

### Requirement: Brief generations preserve lifecycle, freshness, and history
The system SHALL maintain explicit `requested`, `generating`, `ready`, `partial`, `degraded`, `failed`, `stale`, `expired`, and `superseded` brief states. It SHALL represent a rules-only result as `state=degraded` plus `generation_mode=rules_only`; `degraded_rules_only` MAY be a normalized SDK/UI display label but MUST NOT become a divergent lifecycle enum. Refresh MUST create a new immutable generation with new digests and watermarks, and MUST NOT overwrite prior generation history or confirmed item decisions.

#### Scenario: Successful refresh
- **WHEN** a user refreshes a stale brief with a valid idempotency key and current authority
- **THEN** the system creates a new generation from a new frozen snapshot
- **AND** it marks the prior generation superseded only after the replacement is safely readable

#### Scenario: Refresh fails
- **WHEN** refresh cannot obtain a safe context or valid result
- **THEN** the refresh Task and attempted generation expose a typed failed, partial, degraded, or needs-contract result
- **AND** the last historical brief remains readable subject to current authority and is not presented as fresh

#### Scenario: Brief or proposal expires
- **WHEN** the brief TTL, proposal TTL, authority validity, capability validity, or a shorter critical source expiry elapses
- **THEN** the system marks the applicable brief or item expired
- **AND** it requires regeneration or refresh before acceptance

### Requirement: Item decisions are versioned and do not grant execution power
The system SHALL support per-item `accept`, `defer`, and `skip` decisions using an expected item version and idempotency key. `Accept` MUST revalidate current authority, source version, expiry, capability, action allowlist, cost, and approval requirements before invoking the existing proposal acceptance control plane. `Defer` and `skip` SHALL modify only Workbench-owned decision metadata and MAY include only a policy-approved bounded decision reason code; the first release MUST NOT persist a free-form decision reason.

#### Scenario: Accept a current valid item
- **WHEN** a user accepts an open item whose authority, source version, proposal, capability, expiry, and required gates remain valid
- **THEN** the system submits the existing bounded proposal through `orbit.proposal.accept` and TaskService
- **AND** it marks the item accepted only after a control-plane receipt confirms acceptance

#### Scenario: Accepted item has not completed execution
- **WHEN** proposal acceptance is confirmed but the linked Task is queued, running, blocked, failed, partial, or awaiting approval
- **THEN** the UI shows the item decision as accepted and the linked Task state separately
- **AND** it does not label the action or source outcome succeeded

#### Scenario: Defer an item
- **WHEN** a user defers an open item to a policy-bounded future time
- **THEN** the system persists the defer decision and expected version without changing the source state
- **AND** source drift, resolution, revoke, or expiry can still make the deferred item stale, resolved, or expired

#### Scenario: Skip an item
- **WHEN** a user skips an open item
- **THEN** the system records the versioned skip decision, an optional policy-approved reason code, and an audit event
- **AND** it does not cancel, resolve, approve, reject, or mutate the referenced source

#### Scenario: Decision version conflict
- **WHEN** two clients decide the same item using the same prior expected version
- **THEN** at most one transition succeeds
- **AND** the other client receives the current item state and a typed version conflict without duplicate acceptance

### Requirement: Drift, expiry, revoke, and unknown acceptance fail closed
The system MUST revalidate item safety at decision time and MUST NOT automatically retry an acceptance whose outcome is unknown. It SHALL expose a reconcile-only recovery state until the existing control plane proves whether acceptance occurred.

#### Scenario: Source version drifts before accept
- **WHEN** the item source version differs from the current authoritative safe projection at acceptance time
- **THEN** the system rejects the decision with `source_drift`, marks the item stale, and offers refresh or source inspection
- **AND** it does not submit the old action

#### Scenario: Permission is revoked before accept
- **WHEN** current authority no longer permits the item action
- **THEN** the system returns `permission_denied`, invalidates the actionable item state, and records a redacted audit event
- **AND** it does not rely on the authority snapshot captured during generation

#### Scenario: Accept response is lost after dispatch
- **WHEN** the transport cannot determine whether the existing proposal control plane accepted the request
- **THEN** the item enters `decision_unknown` with the original idempotency and receipt correlation refs
- **AND** the UI exposes reconcile only and does not automatically submit acceptance again

#### Scenario: Reconcile confirms no acceptance
- **WHEN** reconcile proves the acceptance did not occur and the item remains current and permitted
- **THEN** the system returns the item to open with a new version
- **AND** a later explicit user decision requires a new idempotency key while the original key remains permanently bound to the reconciled attempt

### Requirement: Generator outage and rules-only degradation are honest
The system SHALL distinguish approved-generator output, deterministic rules-only output, and unavailable generation. Rules-only fallback MUST be enabled only by versioned policy and represented as `state=degraded` plus `generation_mode=rules_only`; the SDK/UI MAY label this combination `degraded_rules_only`. Missing provider contracts or prohibited fallback MUST return typed `needs_contract` or `generation_unavailable` without fixtures.

#### Scenario: Approved generator times out and fallback is allowed
- **WHEN** the approved generator exceeds its bounded timeout and policy allows deterministic fallback
- **THEN** the system builds a rules-only brief from validated safe sources
- **AND** the contract records `state=degraded` and `generation_mode=rules_only`, while the UI, audit, and metrics identify the rules-only mode rather than claiming AI generation

#### Scenario: Generator contract is not approved
- **WHEN** no approved generator contract/version is configured for the tenant capability
- **THEN** the generate operation returns `needs_contract`
- **AND** it does not call an arbitrary provider, use a mock response, or promote the capability as available

#### Scenario: Generator and fallback both produce no safe item
- **WHEN** no candidate survives validation and no deterministic actionable source exists
- **THEN** the system returns a typed empty, failed, partial, or unavailable result according to the source and dependency evidence
- **AND** it does not invent work to avoid an empty brief

### Requirement: Registry and transport surfaces have contract parity
The system SHALL register Mission Brief operations once and project them through the TypeScript SDK, HTTP, gRPC, and JSON-RPC using the same request models, normalized result states, stable errors, idempotency, expected-version, pagination, receipt, redaction, and event cursor semantics. Transport adapters MUST NOT own Mission Brief state transitions or operation-specific business logic.

#### Scenario: Generate through any unary transport
- **WHEN** equivalent authorized generate requests are submitted through SDK/HTTP, gRPC, or JSON-RPC
- **THEN** all surfaces reach the same TaskService and MissionBriefService path
- **AND** they return semantically equivalent Task, brief, error, receipt, and idempotency results

#### Scenario: Read and decide through different transports
- **WHEN** a brief is read through one transport and its item is decided through another
- **THEN** both observe the same repository version and decision state
- **AND** expected-version and idempotency conflicts are identical across transports

#### Scenario: Resume brief events from a cursor
- **WHEN** a client reconnects using the last acknowledged brief event cursor
- **THEN** HTTP SSE, gRPC stream, or JSON-RPC bounded long-poll `events.watch` resumes from the same canonical event source, with `events.list` available for no-wait recovery
- **AND** duplicate delivery remains idempotently reducible without claiming global exactly-once ordering

#### Scenario: Event cursor is invalid or outside retention
- **WHEN** a client supplies a malformed, cross-scope, expired, or compacted cursor
- **THEN** the system returns a typed cursor/resync result without leaking another scope
- **AND** the client can reload the current brief projection safely

### Requirement: Mission Brief Desktop pane is the default review surface under a guarded rollout
The system SHALL provide a Mission Brief Pane that becomes the Desktop default only when the capability flag, tenant allowlist, authority, dependencies, and approved production contract are ready. The Pane MUST keep Action Inbox and source panes accessible and MUST present loading, empty, generating, ready, partial, `degraded_rules_only`, stale, expired, permission, needs-contract, error, and reconcile states truthfully.

#### Scenario: User opens a ready brief
- **WHEN** an enabled authorized user opens Workbench with a current ready Mission Brief
- **THEN** the Desktop opens or focuses the Mission Brief Pane and shows ordered item cards with freshness, reasons, risks, approvals, evidence, and typed actions
- **AND** every source or Studio link is derived from an approved safe descriptor

#### Scenario: Capability is disabled or not ready
- **WHEN** the feature flag is off, the tenant is not allowlisted, or a production dependency is not promotion-ready
- **THEN** the existing Desktop/Action Inbox remains the default entry
- **AND** the UI does not imply that Mission Brief is available

#### Scenario: Decision outcome is unknown
- **WHEN** an item is in `decision_unknown`
- **THEN** the Pane disables accept, defer, and skip for that item and presents a reconcile action with receipt/correlation evidence
- **AND** keyboard or repeated pointer input cannot double-submit the acceptance

#### Scenario: Accessible and responsive review
- **WHEN** the Pane is used by keyboard, screen reader, reduced-motion, high-contrast, 200%-zoom, tablet, or mobile users
- **THEN** item order, priority, risk, freshness, decision state, controls, focus changes, and error recovery remain perceivable and operable
- **AND** color is not the only signal for urgency or status

### Requirement: Observability, audit, privacy, and evidence are built in
The system MUST emit low-cardinality metrics, correlated traces, and audit events for generation, validation, fallback, freshness, decision, acceptance, reconcile, and downstream outcome without recording raw tenant/project refs, source text, prompts, model output, credentials, private paths, or sensitive Owner data. Integration, component, system, E2E, security, and performance runs MUST write redacted evidence using the project evidence contract.

#### Scenario: Trace an accepted item to downstream outcome
- **WHEN** an item is generated, accepted, and linked to a Task or Workflow result
- **THEN** authorized diagnostics can follow safe correlation refs from generation through decision receipt to terminal or reconcile state
- **AND** metric labels and trace attributes remain bounded and redacted

#### Scenario: Evidence redaction scan finds a secret-like value
- **WHEN** an evidence run detects a token, cookie, credential, private path, raw prompt/output, or prohibited Owner payload
- **THEN** the evidence run fails while preserving the original test exit code and safe failure report
- **AND** the contaminated artifact is not promoted as valid evidence

#### Scenario: User decision telemetry is collected
- **WHEN** accept, defer, skip, stale, expiry, or source resolution events are aggregated
- **THEN** the system records only policy-approved product metrics and audit facts
- **AND** it does not use the behavior for model training or persist free-form behavioral profiles

### Requirement: Capacity, latency, and backpressure are bounded
The system MUST enforce versioned hard limits for context candidates, brief items, basis refs, explanation size, generator timeout, request rate, concurrent generations, event retention, and stream backpressure. Production promotion SHALL require production-like evidence that safe context queries, brief reads, concurrent deduplication, and event recovery stay within the declared budgets.

#### Scenario: Ten thousand active source candidates exist
- **WHEN** a project contains at least 10,000 active source candidates
- **THEN** the server uses authority-trimmed indexed queries and deterministic preselection to send no more than the configured candidate limit to generation
- **AND** the browser never downloads the full candidate set to build the brief

#### Scenario: Generator exceeds its time budget
- **WHEN** the generator exceeds the configured timeout or concurrency budget
- **THEN** the system cancels or abandons that adapter call according to contract and returns an explicit fallback or unavailable state
- **AND** it does not leave an unbounded Task, goroutine, retry loop, or duplicate generation running

#### Scenario: Event consumer is slow
- **WHEN** an SSE, gRPC, or polling consumer falls behind the bounded event window
- **THEN** the service applies backpressure or returns a typed resync requirement
- **AND** memory use and per-client queued events remain bounded

### Requirement: Rollout and rollback preserve existing operations
The system SHALL ship Mission Brief as additive contracts, tables, clients, operations, and UI behind `WORKBENCH_MISSION_BRIEF_ENABLED`, disabled by default. Rollback MUST stop new Mission Brief generation while preserving prior briefs, decisions, receipts, events, and already accepted Tasks for read, audit, execution, and reconcile under their original owners.

#### Scenario: Disable Mission Brief after canary
- **WHEN** an operator disables the feature flag because a canary gate fails
- **THEN** Workbench restores the existing Desktop/Action Inbox default and rejects new generate/refresh operations with a typed unavailable state
- **AND** it does not delete additive data or cancel accepted downstream Tasks

#### Scenario: Re-enable after rollback
- **WHEN** the capability is re-enabled with compatible contracts and migrations
- **THEN** the service reads existing generation and decision history using stored versions/digests
- **AND** it does not destructively downgrade, regenerate, or reinterpret historical briefs without an explicit migration

### Requirement: Mission Preflight remains outside this capability
The Mission Brief capability MUST NOT claim to execute dependency preflight, auto-fix missing prerequisites, bulk repair projects, or provide one-click launch readiness. Any future Mission Preflight behavior SHALL require a separately approved OpenSpec change and SHALL reuse, rather than bypass, existing Task/Workflow gates.

#### Scenario: Brief identifies a missing prerequisite
- **WHEN** a validated source indicates a missing capability, approval, asset, permission, or Owner contract
- **THEN** Mission Brief may describe the blocker and link to an existing typed source action or rescue path
- **AND** it does not synthesize an unapproved auto-fix or claim the mission is preflight-ready
