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

### Requirement: Synchronized playback and temporal navigation
The studio SHALL offer source import, player, shot/scene timeline, transcript, keyframes and range navigation using a single source version and owner time base.

#### Scenario: 时间码跳转
- **WHEN** a user selects a shot or evidence time range
- **THEN** the player seeks the matching source/range or reports a precise media access restriction

### Requirement: Observation evidence is not acceptance
The studio SHALL retain observed/inferred labels, coverage gaps, conflicting claims and evidence levels; it SHALL NOT automatically accept observations or infer calibrated spatial truth.

#### Scenario: 冲突证据
- **WHEN** two observations conflict over the same source range
- **THEN** both claims and their evidence remain visible with the conflict rather than selecting a winner by confidence

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
