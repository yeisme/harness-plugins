## ADDED Requirements

### Requirement: Project-scoped operations SHALL preserve owner identity

The consumer SHALL read explicit project references, preserve task dependencies and keep domain mutations with Ordo. It SHALL NOT infer a task dependency from a session parent relationship.

#### Scenario: Project switch during a pending read
- **WHEN** a consumer switches projects before a read settles
- **THEN** the late result does not update the new project or its action target

### Requirement: Actions SHALL be version-bound and replay-safe

Every action SHALL bind an exact target and snapshot revision, require explicit confirmation when declared and return an owner settlement. Unknown settlement SHALL NOT cause automatic redispatch.

#### Scenario: Response lost after submission
- **WHEN** the same request is submitted again
- **THEN** the owner returns its persisted receipt without dispatching the operation again

### Requirement: Project and session views SHALL have distinct scope

The project view SHALL remain on its selected project. The Agents tab SHALL bind to its containing session, and side-chat navigation SHALL NOT replace the main conversation.

#### Scenario: Two conversations are open
- **WHEN** a user inspects or follows up with a child in the second conversation
- **THEN** the first conversation and its draft remain unchanged

### Requirement: Real execution SHALL have independent evidence

Simulation and protocol tests SHALL NOT be represented as real runtime evidence. Limited repair and final human acceptance SHALL remain explicit acceptance requirements until exercised through their owning services.

#### Scenario: Runtime capability is unavailable
- **WHEN** the owner cannot admit a real run
- **THEN** the UI presents the limitation without reporting a started or completed agent

