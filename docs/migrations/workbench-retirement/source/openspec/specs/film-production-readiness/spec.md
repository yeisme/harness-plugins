# film-production-readiness Specification

## Purpose
TBD - created by archiving change workbench-film-production-readiness-v1. Update Purpose after archive.
## Requirements
### Requirement: Workbench SHALL compose a refs-only film project index

Workbench SHALL expose `workbench.film_project_index.v1` with primary profile/overlays, owner project refs/revisions/digests/cursors, scene readiness summaries, actor roles, pending decision refs, package/editor refs and receipts. It MUST NOT store screenplay or Prompt bodies, media blobs, provider payloads, credentials, private paths or owner state machines.

#### Scenario: Project opens with all owners available

- **WHEN** Workbench resolves all owner bindings
- **THEN** it SHALL show current revisions/freshness and derived milestones
- **AND** SHALL preserve the canonical owner for every fact/action

### Requirement: Film workspace SHALL organize Project, Sequence, Scene and Shot/Asset

The existing `/agent` spatial runtime SHALL provide a film readiness lens that relates hierarchy, media previews, scene closure, audio, budget, run, continuity, editorial and delivery facts. Layout and selection MAY be local UI state; production facts MUST remain owner projections.

#### Scenario: User selects a blocked scene

- **WHEN** a scene is blocked by a missing wardrobe state and audio replacement
- **THEN** inspector SHALL show both owner-authored blockers, affected downstream tasks and allowed next actions
- **AND** SHALL not show the scene as production complete

### Requirement: Workbench SHALL share one owner decision box

Canonical acceptance, rights/continuity waiver, budget change, external apply and final delivery SHALL use owner-authored action refs/tokens with expected revision, permission/cost class and receipt. Workbench MUST NOT create a parallel local approval terminal.

#### Scenario: Decision completed in another client

- **WHEN** DSH or CLI completes the same decision
- **THEN** Workbench SHALL refetch and display the owner receipt
- **AND** a duplicate submit SHALL return original terminal or stale/already-decided

### Requirement: Stale or unavailable owner facts SHALL fail closed locally

Workbench SHALL make stale/unknown/unavailable visible. Related mutation SHALL be disabled until refetch or owner recovery; unrelated scenes/owners MAY remain usable. Unknown MUST NOT be rendered as pass, zero cost or no blocker.

#### Scenario: Sonora is unavailable

- **WHEN** the last audio projection is no longer fresh
- **THEN** Workbench SHALL show stale/unavailable audio readiness
- **AND** SHALL block final-audio-dependent actions
- **AND** MAY allow unrelated visual review

### Requirement: Workbench SHALL not implement a second NLE or production state machine

Frame-level editing, effects, color and final mix SHALL be handed to external editor/Sonora/Scaena operations. Workbench MAY show proxies, diffs and deep links but MUST NOT make editor-native project files canonical.

#### Scenario: User requests frame-level trim

- **WHEN** the action requires precise timeline editing
- **THEN** Workbench SHALL offer a Scaena editorial handoff/action
- **AND** SHALL not mutate clip timing in a local-only state

### Requirement: Actor roles SHALL remain local and permission-aware

Workbench SHALL display stable local actor ids and role bindings. One actor MAY hold multiple roles, but only the active project lead SHALL receive final delivery and eligible waiver actions. UI role labels MUST NOT bypass owner authorization.

#### Scenario: Reviewer lacks final authority

- **WHEN** a reviewer opens a passed final verification
- **THEN** Workbench SHALL display the result
- **AND** SHALL not offer or successfully execute final delivery without active project-lead authority

### Requirement: Every transport SHALL preserve projection/action/receipt parity

SDK, HTTP, gRPC and JSON-RPC SHALL expose the same operation state, expected revision, idempotency, permission, cost, error and receipt semantics through the existing Workbench service/application path.

#### Scenario: Agent submits a budget decision through JSON-RPC

- **WHEN** the same action is later inspected through Web SDK
- **THEN** both SHALL reference the same owner decision and receipt
- **AND** SHALL not create transport-specific terminal states

