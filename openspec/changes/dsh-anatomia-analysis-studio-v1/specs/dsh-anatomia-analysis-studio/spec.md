## ADDED Requirements

### Requirement: Studio consumes Anatomia as the only observation owner
The plugin SHALL read observations, evidence and reference packages only through the published Anatomia contracts and SHALL NOT create a second observation ledger or evidence authority.

#### Scenario: Owner contract is unavailable
- **WHEN** the Anatomia capability is absent or the contract mismatches
- **THEN** the studio reports an explicit unavailable reason without fake observations

### Requirement: Authorized source access only
Keyframe and source access SHALL use owner-authorized ranges or renditions; the client SHALL NOT capture frames or decode media locally when authorization is missing.

#### Scenario: Range is not authorized
- **WHEN** the requested keyframe range is outside the authorized scope
- **THEN** the entry is disabled with the reason and no client-side capture fallback runs

### Requirement: Time coordinates follow the owner contract
All timeline displays SHALL use the coordinate system of the owner contract; conversions SHALL live in the adapter layer only.

#### Scenario: Two panes show the same observation
- **WHEN** the same observation is opened in the studio pane and a canvas node
- **THEN** both display identical coordinates without per-component conversion drift

### Requirement: Range analysis follows preview and confirmation
Range analysis actions SHALL be discovered through owner descriptors, previewed with expected revision and confirmed explicitly; unknown outcomes SHALL reconcile the original operation.

#### Scenario: Cursor gap during analysis
- **WHEN** the observation subscription reports a cursor gap
- **THEN** the pane performs one authoritative reread and never auto-mutates review state

### Requirement: Reference packages are version-pinned
Consumed reference packages SHALL pin owner, ref and version; stale versions SHALL be marked and require explicit refresh comparison before adoption.

#### Scenario: A newer package version exists
- **WHEN** the owner publishes a newer reference package version
- **THEN** the pinned reference stays stable and the UI offers a comparison instead of silent adoption

### Requirement: Real analysis evidence is independent
Fixture checks SHALL NOT satisfy the real usability task; real loop evidence SHALL record fixture/real marking.

#### Scenario: Only adapter fixtures passed
- **WHEN** adapter tests pass without a real Anatomia analysis loop
- **THEN** the real usability task remains incomplete
