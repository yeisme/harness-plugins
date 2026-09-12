## ADDED Requirements

### Requirement: Project-level creative pipeline entry

The creative pipeline surface SHALL open from the project-level writing or production context and SHALL preserve the validated project reference across canvas, inspector, Agent drawer and recovery.

#### Scenario: Open from production context

- **WHEN** a user opens the pipeline from a validated project production context
- **THEN** the page shows the same project reference, canvas document and selected context without starting an Agent or run

### Requirement: Safe creative canvas projection

The canvas SHALL project only bounded node summaries, safe references, versions, statuses and layout for assets, characters, scenes, shots and candidates.

#### Scenario: Projection contains no private payload

- **WHEN** an owner snapshot contains private prompt, credentials, provider payload or absolute path fields
- **THEN** the page omits those fields and keeps the node available with a bounded status or unavailable reason

### Requirement: Reference and execution edges remain distinct

Reference edges SHALL express relationships only. Execution edges SHALL carry explicit input purpose, output version and owner projection; incompatible connections SHALL remain drafts with a visible reason.

#### Scenario: Reference edge is selected

- **WHEN** a user selects a reference edge
- **THEN** the inspector shows relationship metadata and no execution controls

#### Scenario: Execution edge is incompatible

- **WHEN** an execution edge input cannot accept the selected output purpose
- **THEN** the edge remains a draft, shows the incompatibility and does not perform implicit conversion

### Requirement: Pipeline inspector exposes owner facts

The inspector SHALL show input refs, versions, owner/adapter status, freshness, budget state, blockers, evidence refs and only the controls available for the validated operation.

#### Scenario: Owner adapter is unavailable

- **WHEN** the required owner adapter is unavailable
- **THEN** the inspector shows `needs_contract` with a reason and disables run controls without fabricating success

### Requirement: Agent is background context

The Agent SHALL appear as a context bar and on-demand drawer. It MAY prepare drafts, explain blockers, and pause or resume an already confirmed run; it SHALL NOT own task, approval, run, result or version truth.

#### Scenario: User asks for an explanation

- **WHEN** a user opens the Agent drawer for a selected blocked edge
- **THEN** the drawer receives the bounded selection projection and can return an explanation or draft without dispatching a new operation

### Requirement: Confirmation boundaries are explicit

New execution scope, input or parameter version changes, owner writes, candidate adoption, budget changes and permission changes SHALL require explicit confirmation.

#### Scenario: Version changes after preview

- **WHEN** an input version changes after a pipeline preview
- **THEN** the confirmation is invalidated and the user must receive a fresh preview before dispatch

### Requirement: Blocked and stale state is preserved

Unknown, stale, blocked and needs-contract states SHALL preserve the graph, draft and last safe owner projection. The page SHALL NOT automatically retry, roll back, delete or replace the writer.

#### Scenario: Owner becomes unavailable

- **WHEN** an owner becomes unavailable during preparation or observation
- **THEN** the execution edge enters a blocked state with reason and impact, while the graph and draft remain visible

### Requirement: Recovery does not replay

Closing or reopening the page SHALL recover the original query identity and observation context without replaying the command or creating a replacement idempotency key.

#### Scenario: Reopen after receipt loss

- **WHEN** the page is reopened after a submitted operation has no local receipt
- **THEN** the page queries the owner using the stored original identity and does not dispatch a new operation

### Requirement: Owner boundary and redaction

The plugin SHALL keep Ordo and domain owners as the authority for scheduling, approvals, runs, candidates, versions and evidence, and SHALL redact private prompts, credentials, provider payloads, private tool arguments and absolute paths from browser projection and evidence.

#### Scenario: Cross-domain execution is unavailable

- **WHEN** the Ordo plan adapter is absent
- **THEN** the page reports unavailable for cross-domain execution while single-domain owner panes remain independently usable

### Requirement: Responsive and accessible visual surface

The page SHALL use the unified visual system, a single SurfaceContextBar, keyboard-accessible object selection, focus restoration, accessible state text, coarse-pointer targets and reduced-motion behavior.

#### Scenario: Narrow viewport

- **WHEN** the viewport cannot fit canvas and inspector side by side
- **THEN** the page presents an object list and detail Sheet without losing access to state, confirmation or recovery actions


### Requirement: Work-surface capsule
The page SHALL expose a persistent top-level capsule for switching between the Agent and Workbench surfaces without changing project, selection, run state, or permissions.

#### Scenario: Switch to Workbench while a run is active
- **WHEN** a user switches from Agent to Workbench while an owner run is active
- **THEN** the Workbench SHALL restore observation of the same run and SHALL NOT replay or duplicate the operation.

### Requirement: ComfyUI-inspired workbench shell
The Workbench SHALL provide project navigation, Workflow/Models/Assets/Render/Gallery entry points, icon-based asset navigation, a draggable node canvas, Inspector/Versions/Comments, and read-only Log/Validation/Render Queue projections while preserving DSH visual and owner boundaries.

#### Scenario: Agent draft is pending review
- **WHEN** Agent prepares a graph or generation draft
- **THEN** the capsule or Workbench entry SHALL show a pending-review indicator and SHALL NOT dispatch execution automatically.
