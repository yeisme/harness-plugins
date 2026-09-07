## ADDED Requirements

### Requirement: Studio consumes Scaena as the only production owner
The plugin SHALL read production projects, shots, assets and plans only through the published Scaena contracts and SHALL NOT create a second production state machine, shot ledger or delivery authority.

#### Scenario: Owner contract is unavailable
- **WHEN** the Scaena capability is absent or the contract mismatches
- **THEN** the studio reports an explicit unavailable reason without fake production data

### Requirement: Candidate mutations carry expected version and digest
Shot, asset and audio candidate operations SHALL send expected version/digest; owner stale rejection SHALL refresh state while preserving the user's edit input.

#### Scenario: Stale expected version
- **WHEN** the owner rejects a candidate because the expected version advanced
- **THEN** the pane refreshes, keeps the draft and offers comparison instead of overwriting the newer version

### Requirement: Orchestration preview lists scope and blockers
Orchestration preview SHALL show the frozen execution list and out-of-scope inputs; blocked out-of-scope inputs SHALL be listed explicitly and never silently widen the scope.

#### Scenario: An out-of-scope input has no pinned version
- **WHEN** a downstream shot depends on an input without a usable pinned version
- **THEN** the preview marks it as blocking and does not execute the expanded scope

### Requirement: Export success requires owner receipt
Export and delivery SHALL be considered successful only with an owner receipt and artifact ref; UI feedback alone SHALL NOT mark delivery done, and partial success SHALL keep completed artifacts and receipts.

#### Scenario: Export partially fails
- **WHEN** the owner reports partial success for an export
- **THEN** completed artifacts and receipts remain visible and only explicitly repairable parts are offered for retry

### Requirement: Reference packages are version-pinned
Review package consumption SHALL pin owner, ref and version and verify transport per the owner contract.

#### Scenario: Transport verification fails
- **WHEN** a review package fails transport verification
- **THEN** the package is not opened as valid and the failure reason is shown

### Requirement: Real production evidence is independent
Fixture checks SHALL NOT satisfy the real usability task; real loop evidence SHALL record fixture/real marking.

#### Scenario: Only adapter fixtures passed
- **WHEN** adapter tests pass without a real Scaena production loop
- **THEN** the real usability task remains incomplete
