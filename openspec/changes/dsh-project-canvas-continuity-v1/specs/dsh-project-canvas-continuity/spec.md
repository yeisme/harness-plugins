## ADDED Requirements

### Requirement: Project canvas uses the existing DSH host
The plugin SHALL register a project-scoped Pane using the existing paneWorkbench contract and SHALL NOT introduce a second shell, Composer, scheduler or Workbench service dependency.

#### Scenario: Host capability is unavailable
- **WHEN** the required pane or storage capability is absent
- **THEN** the entry reports an explicit unavailable reason without fake data or an alternate execution service

### Requirement: Draft persistence is separate from owner truth
The host SHALL persist project layout, Draft and safe references through an approved storage contract while artifact bodies, revisions and receipts remain with their owners.

#### Scenario: Project is reopened
- **WHEN** a user reopens a project after refresh or restart
- **THEN** confirmed layout and Draft are restored, stale or revoked references are identified, and no Agent action is replayed

### Requirement: Selection and result delivery preserve scope
The plugin SHALL freeze project, target session, selection and revision identity when preparing context and SHALL consume the existing Composer submission and artifact contracts.

#### Scenario: A result arrives after the user changes sessions
- **WHEN** the user switches projects or sessions before a result arrives
- **THEN** the result remains associated with the original scope and cannot mutate the newly selected project or draft

### Requirement: Continuation and save facts are explicit
The plugin SHALL distinguish context preparation, execution, candidate acceptance, file writeback and owner-confirmed save; unknown outcomes SHALL require reconciliation of the original operation.

#### Scenario: Owner write outcome is unknown
- **WHEN** a write has no confirmed owner receipt
- **THEN** the UI preserves the candidate, reports the unknown state and does not replay the mutation or claim saved

### Requirement: Real usability evidence is independent
New tasks SHALL NOT inherit Workbench completion evidence and SHALL distinguish plugin protocol conformance from real DSH product verification.

#### Scenario: Only fixture tests passed
- **WHEN** fixture and protocol checks pass without a real Agent artifact loop
- **THEN** the product usability task remains incomplete
