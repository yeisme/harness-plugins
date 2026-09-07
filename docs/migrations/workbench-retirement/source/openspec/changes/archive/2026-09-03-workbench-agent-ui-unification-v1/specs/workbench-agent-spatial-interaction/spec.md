## MODIFIED Requirements

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

## ADDED Requirements

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
