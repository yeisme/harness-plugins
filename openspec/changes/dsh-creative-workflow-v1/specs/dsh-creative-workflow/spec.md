## ADDED Requirements

### Requirement: Execution edges are explicit and separate from references
Execution edges SHALL carry output version and input purpose; reference edges SHALL NOT participate in execution, and incompatible connections SHALL remain drafts with the reason shown instead of implicit conversion.

#### Scenario: Incompatible input purpose
- **WHEN** a user connects an output to an input whose purpose cannot accept it
- **THEN** the connection stays a draft with the reason and no implicit conversion occurs

### Requirement: Scope preview lists blockers instead of widening scope
Execution scope SHALL cover the selected node, its downstream along execution edges or the full flow; out-of-scope inputs without a usable pinned version SHALL be listed as blocking.

#### Scenario: Downstream input lacks a pinned version
- **WHEN** a downstream node depends on an unpinned out-of-scope input
- **THEN** the preview marks it blocking and the scope is not silently widened

### Requirement: Confirmation freezes the plan
Confirming a preview SHALL freeze inputs, parameters, selected versions and the plan summary; budget unknown SHALL be shown as unknown and confirmed explicitly; scope or cost changes SHALL require reconfirmation.

#### Scenario: Budget is unknown
- **WHEN** the plan budget cannot be determined before confirmation
- **THEN** unknown is displayed, explicit confirmation is required and it is never treated as zero

### Requirement: Ordo owns cross-domain execution
Cross-domain execution SHALL go through the Ordo plan adapter; the plugin SHALL NOT create a scheduler, task ledger or approval authority, and single-domain workflows SHALL use the owner engine.

#### Scenario: Ordo capability is unavailable
- **WHEN** the Ordo plan adapter is absent
- **THEN** cross-domain execution entries report unavailability and single-domain workflows remain usable

### Requirement: Run observation recovers without replay
Observation SHALL reuse subscriptions with cursor recovery and generation checks; closing a pane SHALL NOT cancel a run and refresh SHALL NOT replay commands; unknown outcomes SHALL reconcile the original operation.

#### Scenario: Pane closes during a run
- **WHEN** the user closes the observation pane while a run is active
- **THEN** the run continues at the owner and reopening restores observation without replaying commands

### Requirement: Reruns produce new candidates only
Upstream changes SHALL mark affected nodes while keeping adopted results; reruns SHALL produce new candidates that advance the current result only after user comparison and adoption.

#### Scenario: An upstream node changes
- **WHEN** an upstream input changes after adoption
- **THEN** affected nodes are marked, the adopted result is kept and rerunning creates a new candidate

### Requirement: Real execution evidence is independent
Fixture checks SHALL NOT satisfy the real usability task; real loop evidence SHALL record fixture/real marking.

#### Scenario: Only reducer fixtures passed
- **WHEN** scope and reducer tests pass without a real Ordo execution loop
- **THEN** the real usability task remains incomplete

### Requirement: Templates manual editing and agent drafts
The workflow SHALL support template instantiation, manual editing and scoped Agent-generated drafts using the canvas document; creating or editing any draft SHALL NOT submit work.

#### Scenario: 套用模板
- **WHEN** a template references previous model choices or approvals
- **THEN** current capabilities and authorization are checked anew and no old approval is reused

### Requirement: Domain routing and human selection
Single-domain operations and internal workflows SHALL use that domain owner directly; cross-domain execution SHALL use Ordo. Missing single-value candidate selection SHALL pause at an explicit review point rather than choosing the newest result.

#### Scenario: 批量候选需要选择
- **WHEN** an upstream step produces multiple candidates for a single downstream input
- **THEN** the run waits for an authorized choice without changing its execution scope

### Requirement: Draft revision fences execution confirmation
Confirmation SHALL reference the previewed draft revision and fixed plan; editing inputs, scope or authorized cost after preview SHALL invalidate confirmation.

#### Scenario: 预览后变更
- **WHEN** a draft changes before confirmation
- **THEN** the client requests a fresh preview and does not submit the previous plan
