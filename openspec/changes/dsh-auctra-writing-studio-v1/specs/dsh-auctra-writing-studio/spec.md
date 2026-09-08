## ADDED Requirements

### Requirement: Studio consumes Auctra as the only text owner
The plugin SHALL read text projects, structures and bodies only through the published Auctra contracts and SHALL NOT create a second body store, version state machine or canon authority.

#### Scenario: Owner contract is unavailable
- **WHEN** the Auctra capability is absent or the contract mismatches
- **THEN** the studio reports an explicit unavailable reason without fake text data

### Requirement: Body reads are explicitly authorized
Body reads SHALL use explicitly authorized ranges with content separated from control-plane summaries; unauthorized text types SHALL show the reason instead of a body area.

#### Scenario: Text type read is not authorized
- **WHEN** the owner does not authorize body reads for a text type
- **THEN** the body area stays hidden with an explanation and no partial body is displayed

### Requirement: Agent edits flow through owner candidates
Agent modifications of owner-held bodies SHALL go through the owner candidate channel with a change summary and undo; accepted versions SHALL NOT be modified in place.

#### Scenario: Agent proposes a body change
- **WHEN** an agent modifies authorized text
- **THEN** the change appears as an owner candidate with summary and undo, and the accepted version is untouched until adoption

### Requirement: Version conflicts preserve user input
On version conflict the studio SHALL preserve the edit input and candidate and SHALL offer reread, comparison or save-as-draft; it SHALL NOT overwrite the newer version.

#### Scenario: A newer version lands during editing
- **WHEN** the owner advances the version while an edit is pending
- **THEN** the conflict is surfaced with comparison and the newer version is never silently overwritten

### Requirement: Save state follows owner receipts
Save SHALL be reflected only after the owner receipt confirms; HTTP success or pending UI state SHALL NOT mark the text saved, and checkpoint, review, canon and delivery remain separate actions.

#### Scenario: Write outcome is unknown
- **WHEN** a save has no confirmed owner receipt
- **THEN** the studio preserves the candidate, reports unknown and does not claim saved

### Requirement: Real writing evidence is independent
Fixture checks SHALL NOT satisfy the real usability task; real loop evidence SHALL record fixture/real marking.

#### Scenario: Only adapter fixtures passed
- **WHEN** adapter tests pass without a real Auctra writing loop
- **THEN** the real usability task remains incomplete

### Requirement: Three text modes and explicit version lifecycle
The studio SHALL support novel chapters, screenplay scenes and general text units; Working Copy save, candidate adoption, Checkpoint, Review and Canon SHALL remain separate actions.

#### Scenario: 采用候选
- **WHEN** a candidate is successfully applied to the Working Copy
- **THEN** no Checkpoint, Review submission or Canon acceptance is performed automatically

### Requirement: Lossless editing and atomic changes
Editing SHALL preserve Unicode, IME and source text; combined structure/body changes SHALL follow the owner atomic change-set and version contract.

#### Scenario: 联合变更冲突
- **WHEN** one member of an atomic structure/body change-set conflicts
- **THEN** the UI retains drafts and does not report a partial owner commit

### Requirement: Independent direct operation and scope binding
The professional Pane SHALL be usable without canvas, other professional Panes or cross-domain orchestration; object bindings SHALL preserve owner/ref/version/project and separate the target session.

#### Scenario: 双栏迟到响应
- **WHEN** a response arrives after switching project or session
- **THEN** it cannot overwrite the newly selected project, draft or artifact version

### Requirement: Required capability gaps remain owned tasks
Required capability gaps SHALL have a named owner, missing operation, deliverable, affected consumer task and linked owner OpenSpec task; fixture-only proof SHALL NOT close real usability tasks.

#### Scenario: 只有协议通过
- **WHEN** a required capability has passed fixture tests but not a real owner journey
- **THEN** the required capability remains unverified with an actionable task instead of being silently removed
