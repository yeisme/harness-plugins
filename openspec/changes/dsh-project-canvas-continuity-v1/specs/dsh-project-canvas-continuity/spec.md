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

### Requirement: Rich project canvas interactions
The canvas SHALL use @xyflow/react@12.11.6 and support material, draft, operation, result and group nodes; references SHALL include image, video, audio, file and owner objects. Selection, resize, move, copy, grouping, undo/redo, search, fit and minimap SHALL have keyboard-equivalent controls.

#### Scenario: 复制操作节点
- **WHEN** an operation node with a previous run is copied
- **THEN** only a new editable draft is created; no owner run or asset is duplicated

### Requirement: One document for two edge kinds
Reference and execution edges SHALL share one project document; reference edges SHALL NOT create execution dependencies and execution semantics SHALL be provided by dsh-creative-workflow-v1.

#### Scenario: 工作流未启用
- **WHEN** the workflow capability is disabled
- **THEN** the canvas and independent professional Panes remain usable without a second graph document

### Requirement: Scoped agent draft editing
Agent changes SHALL be limited to the authorized canvas/layout/draft scope, produce a summary and support undo, without changing owner content, accepted results or running snapshots.

#### Scenario: Agent修改草案
- **WHEN** an Agent optimizes a selected draft branch
- **THEN** the changes do not execute or replace accepted artifacts and can be reviewed and undone

### Requirement: Media and sustained-use acceptance
The canvas SHALL lazily load media, pause offscreen video and verify a 300-node mixed-media one-hour workload with p95 input at most 100ms, cached switching at most 200ms, no sustained resource growth and no loss of confirmed saves.

#### Scenario: 负载验收
- **WHEN** a performance run uses the agreed mixed-media sample
- **THEN** the report includes machine, viewport, latency, frame/resource trends and save receipts rather than empty placeholder nodes
