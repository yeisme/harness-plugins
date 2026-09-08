## ADDED Requirements

### Requirement: Journeys are defined before execution
The change SHALL define a journey matrix covering each domain studio and one cross-domain workflow journey, listing member changes, required owner capabilities and assertion points before any execution evidence is claimed.

#### Scenario: A journey lacks member coverage
- **WHEN** a journey row misses a member change or required capability
- **THEN** the matrix is incomplete and no execution task may claim that journey

### Requirement: Recovery drills cover cross-owner failures
The drill matrix SHALL cover upstream changes, version conflicts, unknown saves, subscription gaps and late events, absent seams, pane disable/reinstall and late results across project or session switches, each with expected behavior and evidence source.

#### Scenario: A late result crosses a project switch
- **WHEN** a result arrives after the user switches projects or sessions
- **THEN** the result stays bound to the original scope and cannot mutate the new project or draft

### Requirement: Composite assertions protect scope and durability
Composite journeys SHALL assert frozen scope identity (project, session, node ref, revision), zero loss of confirmed saves, no draft deletion on pane disable and reconciliation-only handling of unknown outcomes.

#### Scenario: A pane is disabled mid-journey
- **WHEN** a studio pane is disabled during a journey
- **THEN** project drafts and owner artifacts survive and other panes continue working

### Requirement: Evidence is indexed with honest readiness
Evidence SHALL reference member change run-ids through the existing runner six-piece output with redaction, and readiness SHALL be marked per journey as not-run, fixture or real.

#### Scenario: Only fixture journeys executed
- **WHEN** fixture-level journeys pass without real owner capabilities
- **THEN** those journey rows remain fixture and are not reported as real

### Requirement: No duplicate implementation
This change SHALL NOT modify owner contracts or reimplement member change behavior; it owns only the matrix, drills, evidence index and readiness.

#### Scenario: A journey exposes an owner-contract gap
- **WHEN** a journey reveals a contract gap in a member change
- **THEN** the gap is recorded with a bidirectional link to the owning change instead of a local workaround

### Requirement: All required domains receive independent real evidence
Real closeout SHALL require evidence for all five professional journeys and at least one cross-domain production journey, with failure/recovery coverage; compatible member evidence MAY be reused without repeating paid calls.

#### Scenario: 只有两个领域通过
- **WHEN** two domain journeys pass while another required domain remains unverified
- **THEN** the aggregate real-closeout task remains incomplete and the verified Panes retain their independent readiness
