## ADDED Requirements

### Requirement: Workbench SHALL provide a summary-first OPC scene workspace
Workbench SHALL provide the default OPC scene package workspace from the Creative Production Lens. The initial view MUST show show, episode, scene, package version, current stage, readiness/freshness, primary blocker, one primary action, human-gate status, cost/rights summary, and delivery status before shot-level details.

#### Scenario: OPC opens a current package
- **WHEN** the typed Scaena connector returns a current OPC scene package summary
- **THEN** Workbench MUST render context, Now, Why, Next, gate status and package status in one view
- **AND** the Scene → Shot → Asset tree MUST remain available without being the first required interaction

#### Scenario: Package is empty or unresolved
- **WHEN** the owner reports missing source, empty package, stale digest, contract mismatch, or unavailable owner
- **THEN** Workbench MUST show the known state and a typed reason
- **AND** MUST NOT render ready, accepted, or production-ready based on missing facts

### Requirement: Workbench SHALL render server-authored actions without re-computation
Every enabled mutation MUST originate from the Scaena ActionDescriptor exposed in the summary or an owner refetch. Workbench MUST preserve action id, target ref, expected version, side-effect class, confirmation requirement, idempotency identity, and receipt/reconcile identity.

#### Scenario: User inspects the next action
- **WHEN** the OPC opens action details
- **THEN** Workbench MUST display why the action is available, its expected version, side-effect class, cost/rights impact, confirmation requirement, and a copyable real CLI/API form when supplied
- **AND** Workbench MUST NOT construct a command by concatenating arbitrary user input

#### Scenario: User submits an action
- **WHEN** the OPC confirms an enabled action
- **THEN** Workbench MUST submit through the existing typed client/TaskService path
- **AND** MUST refetch the Scaena projection after success, conflict, timeout, or unknown outcome
- **AND** MUST NOT claim owner success from an HTTP success alone or from optimistic local state

### Requirement: Workbench SHALL expose exactly three normal human gates
The normal path MUST expose direction_confirm, visual_foundation_accept, and export_confirm as the three primary human gates. Rights, cost, stale, unknown, partial, owner-offline, originality/similarity, and plan-amendment findings MUST appear in the Exception Inbox only when triggered.

#### Scenario: Direction gate is pending
- **WHEN** story spine, shot beats, dialogue backbone, visual tone, duration, or ShotAudioIntent still needs confirmation
- **THEN** Workbench MUST focus the direction_confirm gate
- **AND** MUST keep paid generation actions disabled until the gate is satisfied

#### Scenario: Exception is triggered
- **WHEN** a rights, cost, stale, unknown, partial, owner-offline, or plan-amendment finding is returned
- **THEN** Workbench MUST create an exception item with owner reason, affected ref/version, available reconcile or recovery action, and current evidence
- **AND** MUST NOT silently turn the finding into a normal success path

### Requirement: Workbench SHALL preserve dual aspect and quality-depth semantics
Workbench MUST present 9:16 and 16:9 as formal aspect options. A secondary aspect MUST be shown as an independent successor reframe variant with its own ref/version/review state, never as a crop-only or metadata-only switch. Balanced and cinematic MUST share the same package/review/export contract; cinematic MUST be rendered as an explicit upgrade recommendation requiring confirmation.

#### Scenario: User reviews a secondary aspect
- **WHEN** the summary contains a secondary reframe variant
- **THEN** Workbench MUST show the primary package and the independent reframe variant separately
- **AND** MUST show the variant review/readiness/evidence state before enabling export

#### Scenario: User upgrades quality depth
- **WHEN** the system recommends cinematic for a scene
- **THEN** Workbench MUST show the reason, expected asset/wave impact, and cost envelope
- **AND** MUST require explicit confirmation before submitting an amended or paid plan

### Requirement: Workbench SHALL show Skill roles first and Skill metadata on demand
The primary UI MUST show role labels such as director, continuity, producer, and edit/sound. Skill name, source, version, digest, compatibility, and stale reason MUST remain in the details or audit layer. Workbench MUST NOT require the OPC to manually compose a Skill plan.

#### Scenario: User expands Skill details
- **WHEN** the OPC requests implementation details
- **THEN** Workbench MAY show the SkillPlan snapshot ref and redacted metadata
- **AND** the visible role-to-stage mapping MUST remain consistent with the Scaena projection

### Requirement: Workbench SHALL support partial, offline, stale, and secure delivery states
Workbench MUST preserve last known safe refs, version, evidence, and blocker when an owner is offline or a projection becomes stale. It MUST disable dependent mutations and never auto-retry unknown outcomes. A partial package MAY be downloaded only when its partial state and production_ready=false are visible.

#### Scenario: Package export is partial
- **WHEN** Scaena returns a partial export receipt with completed refs and failed items
- **THEN** Workbench MUST show the failure list, last reliable version, recovery/reconcile action, manifest/checksum status, and production_ready=false
- **AND** MUST NOT label the package formal or production-ready

#### Scenario: Download grant expires
- **WHEN** a short-lived package grant is expired, invalid, or checksum/content-type verification fails
- **THEN** Workbench MUST request a fresh owner-authored grant or refetch
- **AND** MUST NOT rewrite the manifest, package state, or receipt locally

### Requirement: Workbench and DSH SHALL remain semantically compatible
For the same package revision, Workbench MUST expose the same action identity, target ref, expected version, side-effect class, confirmation/idempotency requirement, and receipt/reconcile identity as DSH. Layout, copy, summary density, and entry-point language MAY differ.

#### Scenario: Cross-entry conformance check
- **WHEN** a conformance fixture reads one package through Workbench and DSH
- **THEN** the two projections MUST match on action and receipt semantics
- **AND** neither consumer may own or persist Scaena production state

### Requirement: Workbench SHALL meet accessibility and responsive interaction requirements
All gates, actions, dialogs, and exception items MUST be keyboard reachable with visible focus. Loading, stale, partial, blocked, and offline states MUST use text plus non-color indicators. The workspace MUST remain usable at 1440, 1024, 768, and 390 pixel widths, and reduced-motion preferences MUST disable non-essential transitions.

#### Scenario: Keyboard-only action flow
- **WHEN** a keyboard-only user opens a scene, enters action details, confirms a gate, and returns
- **THEN** focus MUST move through a stable order and return to the originating control after dialog close
- **AND** screen readers MUST receive current stage, blocker, action label, gate status, and receipt status
