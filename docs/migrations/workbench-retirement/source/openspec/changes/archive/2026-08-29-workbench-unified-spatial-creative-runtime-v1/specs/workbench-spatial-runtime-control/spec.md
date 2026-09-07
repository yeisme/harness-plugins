## ADDED Requirements

### Requirement: Workflow Lens MUST author only typed immutable DAG drafts
The Workflow Lens MUST consume the canonical step registry and support typed steps, ports, input bindings, validation markers and bounded DAG edges. It MUST reject unknown steps, cycles, arbitrary code, URLs, credentials and unbounded loops; publishing MUST continue to create an immutable version/checksum.

#### Scenario: User connects incompatible ports
- **WHEN** an output schema cannot feed the selected input port
- **THEN** the Lens MUST show a typed validation error and MUST NOT publish the definition
- **AND** server validation remains the final authority

### Requirement: Spatial runtime controls MUST reuse WorkflowService authority
Validate、publish、start、pause、resume、cancel and reconcile controls MUST be enabled only from server-authored capability and ActionDescriptor projections. The browser MUST use existing Workflow/Task/Proposal clients and MUST NOT write run or step state directly.

#### Scenario: User pauses a running workflow from the canvas
- **WHEN** the current runtime projection authorizes pause and the user activates it
- **THEN** Workbench MUST submit the typed pause action through the authoritative mutation chain
- **AND** the overlay MUST change only after a canonical run event or snapshot confirms the new state

### Requirement: Run overlays MUST be resumable and bounded
The surface MUST subscribe only to the selected run event stream, dedupe by canonical cursor and reload the runtime snapshot after a gap. It MUST render bounded step state, approval, failure, receipt and evidence overlays without changing Board geometry on every event.

#### Scenario: Runtime event cursor gaps
- **WHEN** the selected run stream reports a retention or sequence gap
- **THEN** Workbench MUST preserve the last-confirmed overlay as stale and fetch the canonical run snapshot
- **AND** MUST NOT fabricate intermediate step transitions

### Requirement: Unknown runtime outcomes MUST be reconcile-only
`unknown_accept`、partial settlement and cancelling ambiguity MUST disable publish/start/retry controls that could duplicate side effects and MUST expose only the server-authorized reconcile action.

#### Scenario: Owner operation has unknown acceptance
- **WHEN** a Workflow step returns `unknown_accept`
- **THEN** the Run Lens MUST identify the affected step and original receipt/correlation refs
- **AND** MUST not automatically retry, switch provider or mark the step terminal

### Requirement: Composite plans MUST expose non-atomic boundaries
The UI MAY group Board changes, Workflow draft publication, run actions and Owner actions into one visual plan, but each authoritative action MUST show its own Task, state and receipt. The UI MUST NOT describe the group as one atomic transaction.

#### Scenario: Board commit succeeds and Workflow publish fails
- **WHEN** a grouped plan receives a Board receipt but Workflow publish is rejected
- **THEN** Workbench MUST show the confirmed Board result and failed Workflow step separately
- **AND** MUST offer only server-authorized repair or rollback actions
