## ADDED Requirements

### Requirement: Studio consumes Eikona as the only generation owner
The plugin SHALL read projects, assets and action descriptors only through the published Eikona contracts and SHALL NOT create a second provider runtime, asset ledger or version authority.

#### Scenario: Owner contract is unavailable
- **WHEN** the Eikona capability is absent or the contract mismatches
- **THEN** the studio reports an explicit unavailable reason and renders no fake assets or actions

### Requirement: Action discovery is server-authored
Generation, edit and batch actions SHALL be discovered through owner-issued descriptors covering input types, permissions, cost state and expected revision; the client SHALL NOT self-grant capability or fabricate cost.

#### Scenario: Mask editing is unsupported
- **WHEN** the owner contract does not expose a mask edit model
- **THEN** the entry stays hidden with the support matrix recording it as missing instead of a client-side image fallback

### Requirement: Candidates keep owner identity
Candidate reads and comparisons SHALL use explicitly authorized content or media ranges and SHALL keep owner, ref, version and freshness; list order SHALL NOT imply the latest adoption.

#### Scenario: A newer candidate exists
- **WHEN** the owner returns additional candidates after a comparison is opened
- **THEN** the comparison preserves the frozen set and offers an explicit refresh instead of silently swapping the adopted target

### Requirement: Adoption and writeback are separate owner actions
Candidate acceptance, file writeback and handoff SHALL each obtain an owner receipt with version and target scope; unknown outcomes SHALL require reconciliation of the original operation.

#### Scenario: Write outcome is unknown
- **WHEN** a writeback has no confirmed owner receipt
- **THEN** the studio preserves the candidate, reports unknown and does not replay the mutation or claim saved

### Requirement: Cancellation follows owner confirmation
Cancel SHALL request owner confirmation before displaying cancelled; generation continues to be observed through the existing subscription until the owner confirms.

#### Scenario: Cancel is requested while generating
- **WHEN** the user requests cancel during generation
- **THEN** the UI shows cancelling until the owner confirms and never marks the artifact cancelled locally

### Requirement: Real generation evidence is independent
Fixture and protocol checks SHALL NOT satisfy the real usability task; real loop evidence SHALL record fixture/real marking and owner capability.

#### Scenario: Only adapter fixtures passed
- **WHEN** adapter tests pass without a real Eikona generation loop
- **THEN** the real usability task remains incomplete
