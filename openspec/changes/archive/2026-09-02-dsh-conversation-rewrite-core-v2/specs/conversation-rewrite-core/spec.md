## ADDED Requirements

### Requirement: Core SHALL use host-neutral immutable rewrite inputs

`@yeisme/dsh-client-ui-conversation-rewrite-core` SHALL expose plain TypeScript types for Session identity, generation, messages, text parts, turn ends, capabilities and targets. The package MUST NOT import React, DOM APIs, DSH client runtime/private modules or UI slot types. Boundary functions SHALL be pure and MUST NOT perform mutation, I/O or global state access.

#### Scenario: Core is consumed in Node/TUI
- **WHEN** a consumer imports the package in a Node-only process without React or DSH Web packages
- **THEN** typecheck, tests and build SHALL succeed
- **AND** package source/output SHALL contain no React, DOM or DSH private-runtime import

#### Scenario: Input is evaluated twice
- **WHEN** the same immutable snapshot and target request are passed to a boundary function twice
- **THEN** both calls SHALL return deeply equivalent decisions
- **AND** the input snapshot SHALL remain unchanged

### Requirement: V2 boundary SHALL derive Edit and Retry from the same stable pre-turn rule

The core SHALL derive Edit/Retry targets from a completed text-only user/steering prompt and the nearest preceding stable `turn/end`. It SHALL return the original/edited prompt target separately from the boundary, and SHALL use stable disable reasons including existing `not-found`, `not-text`, `running`, `first-round`, `removed` plus additive `stale`, `stable-boundary-unavailable` and `settlement-pending` where applicable.

#### Scenario: Non-first Edit target is valid
- **WHEN** a completed text-only user message has a preceding `turn/end`
- **THEN** the core SHALL return its message seq, text and the nearest preceding end seq
- **AND** SHALL NOT choose a later end or modify the snapshot

#### Scenario: Retry resolves its own prompt
- **WHEN** a completed assistant target can be associated with a prior user/steering prompt
- **THEN** Retry SHALL use that prompt's text and preceding stable boundary
- **AND** SHALL NOT fall back to a newer prompt when the assistant was exactly addressed

#### Scenario: First-round capability is absent
- **WHEN** a target has no preceding `turn/end` and `forkBeforeMessage` is unavailable
- **THEN** the decision SHALL be disabled with `first-round`
- **AND** SHALL NOT fabricate a boundary after the target answer

#### Scenario: Unsafe target is classified
- **WHEN** the target is running/open, non-text, removed, stale or lacks a stable boundary
- **THEN** the core SHALL return the matching typed disable reason
- **AND** SHALL NOT return an executable target

### Requirement: Mutation host SHALL classify every owner call as accepted, rejected or unknown

The V2 host contract SHALL return `RewriteMutationOutcomeV2<T>` with `accepted`, `rejected` or `unknown`. `rejected` SHALL mean the owner definitively did not accept the operation; `unknown` SHALL mean acceptance cannot be proven and MAY carry partial safe facts such as a known child ID. Unclassified transport exceptions SHALL default to `unknown`, never to `rejected`.

#### Scenario: Definitive owner rejection
- **WHEN** an adapter receives a typed owner response proving the mutation was rejected
- **THEN** it SHALL return `rejected` with a stable code
- **AND** the controller MAY permit a future explicit retry without assuming prior acceptance

#### Scenario: Transport disconnects after request write
- **WHEN** the adapter cannot prove whether fork or prompt was accepted
- **THEN** it SHALL return `unknown`
- **AND** the controller SHALL NOT automatically call that mutation again

### Requirement: Controller SHALL expose staged single-flight execution

The V2 controller SHALL execute one operation at a time through `forking → prompting → activating → optional hydrating → succeeded`. It SHALL include operation ID, source Session/generation, active target key, stage, outcome class, reason code and known child ID in observable state while excluding prompt text. A second run during an active operation SHALL join or return the existing operation rather than start a duplicate.

#### Scenario: Successful rewrite pipeline
- **WHEN** fork, prompt, activate and optional hydrate each return accepted
- **THEN** the controller SHALL call them once in order and finish `succeeded`
- **AND** observable state SHALL include the child ID but not the submitted prompt

#### Scenario: Concurrent duplicate run
- **WHEN** the same controller receives another run while one is active
- **THEN** it SHALL not issue another fork or prompt
- **AND** both callers SHALL settle from the same operation result

#### Scenario: Controller is disposed
- **WHEN** dispose occurs during an active stage
- **THEN** no later owner result SHALL publish a success state to subscribers
- **AND** the observable state SHALL settle without starting compensating mutation

### Requirement: Partial success SHALL produce a recoverable receipt without destructive compensation

If fork is rejected, the controller SHALL finish without a child. If fork outcome is unknown, the controller SHALL require reconciliation and MUST NOT auto-fork. Once child ID is known, prompt/activate/hydrate rejection or unknown outcome SHALL preserve that child ID and produce `recoverable_error`; the core MUST NOT auto-delete the child, resend prompt, change prompt mode or invent success.

#### Scenario: Prompt rejected after child creation
- **WHEN** fork is accepted with a child ID and prompt is rejected
- **THEN** state SHALL finish `recoverable_error` at `prompt` with that child ID
- **AND** recovery SHALL require an explicit caller decision

#### Scenario: Prompt outcome is unknown
- **WHEN** fork is accepted and prompt returns unknown
- **THEN** the receipt SHALL require owner-history reconciliation
- **AND** SHALL NOT expose an automatic retry command

#### Scenario: Activation fails after accepted prompt
- **WHEN** fork and prompt are accepted but activate or hydrate fails
- **THEN** state SHALL preserve child identity and the failed stage
- **AND** callers MAY offer open/inspect/retry-activation actions without resending the prompt

### Requirement: Public state and receipts SHALL exclude sensitive prompt content

Core observable state, errors, recovery receipts, test evidence and logs MUST NOT contain source prompt text, edited text, raw provider payload, private tool arguments, Authorization data or model reasoning. Host adapters MAY receive prompt text as an execution argument but SHALL keep it outside public snapshots and sanitize error messages to stable codes plus bounded safe summaries.

#### Scenario: Recovery state is serialized for a test
- **WHEN** a partial-success state is inspected or serialized
- **THEN** it SHALL contain stage, outcome, reason, operation/source/child identifiers and timestamps/counts only
- **AND** SHALL NOT contain original or edited prompt text

### Requirement: Existing Web package SHALL remain backward compatible through adapters

`@yeisme/dsh-client-ui-conversation-rewrite` SHALL retain all existing package exports, import paths, function signatures and V1 view phases. Existing boundary functions SHALL preserve their DSH-specific signatures and legacy disable reasons while delegating to or remaining behaviorally equivalent to V2 core. Existing `ChatRewriteController` SHALL remain usable as a thin facade that collapses V2 stages to `idle | submitting | opened | error`.

#### Scenario: Existing consumer compiles unchanged
- **WHEN** a fixture imports existing controller, boundary, Edit/Retry component, lineage, locale and seam exports without source changes
- **THEN** typecheck and runtime tests SHALL pass
- **AND** package export paths SHALL remain unchanged

#### Scenario: V1 first-round behavior remains fail-closed
- **WHEN** an existing Web caller computes or runs first-round rewrite without `forkBeforeMessage`
- **THEN** it SHALL continue returning/settling the existing disabled/error behavior
- **AND** the compatibility facade SHALL NOT expose a fabricated child

### Requirement: Web and TUI adapters SHALL pass one cross-surface fixture suite

The repository SHALL publish host-neutral fixtures and expected decisions/results for completed Edit, completed Retry, first-round enabled/disabled, running, non-text, removed, stale, fork unknown, prompt rejected/unknown and activation/hydration failure. Web and TUI adapters SHALL map their owner data into these fixtures without changing expected boundary, reason or recovery classification.

#### Scenario: Cross-surface parity runs
- **WHEN** Web and TUI adapter tests execute the shared fixtures
- **THEN** both SHALL produce identical target boundary, availability and stage/outcome classifications
- **AND** UI-specific labels/layout MAY differ without changing mutation order or safety rules
