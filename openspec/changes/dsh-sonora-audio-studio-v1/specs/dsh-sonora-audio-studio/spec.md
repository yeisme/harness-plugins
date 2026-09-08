## ADDED Requirements

### Requirement: Studio consumes Sonora as the only audio owner
The plugin SHALL read audio work, capabilities and outputs only through the published Sonora contracts and SHALL NOT create a second audio runtime, subtitle state machine or alignment authority.

#### Scenario: Owner contract is unavailable
- **WHEN** the Sonora capability is absent or the contract mismatches
- **THEN** the studio reports an explicit unavailable reason without fake audio work

### Requirement: Provider capability matrix is owner-sourced
Voice, subtitle, alignment and export capabilities SHALL come from owner descriptions marked supported, missing or unverified; missing required capabilities SHALL retain disabled entries with reasons and linked owner tasks.

#### Scenario: Word-level alignment is unverified
- **WHEN** the owner exposes segment-to-cue only
- **THEN** the alignment entry shows the boundary explicitly and no word-level claim is made

### Requirement: Authorized playback only
Audition SHALL use owner-authorized renditions through the existing media renderer; local transcoding or raw URL fetch SHALL NOT occur.

#### Scenario: Rendition authorization is missing
- **WHEN** an audio output has no authorized rendition
- **THEN** playback stays disabled with the reason instead of fetching a raw URL

### Requirement: Execution follows preview and owner confirmation
Audio actions SHALL be discovered through owner descriptors with permission and cost state; cancellation SHALL reflect owner confirmation only.

#### Scenario: Cancel is requested during synthesis
- **WHEN** the user requests cancel during a synthesis run
- **THEN** the UI shows cancelling until the owner confirms and never marks the output cancelled locally

### Requirement: Handoff obtains separate receipts
Voice, subtitle and handoff outputs SHALL each obtain an owner receipt with version and target scope before being marked delivered; outputs SHALL pin owner, ref and version.

#### Scenario: Handoff outcome is unknown
- **WHEN** a handoff has no confirmed owner receipt
- **THEN** the studio preserves the output, reports unknown and does not claim delivered

### Requirement: Real audio evidence is independent
Fixture checks SHALL NOT satisfy the real usability task; real loop evidence SHALL record fixture/real marking.

#### Scenario: Only adapter fixtures passed
- **WHEN** adapter tests pass without a real Sonora audio loop
- **THEN** the real usability task remains incomplete

### Requirement: Complete audio task families
The studio SHALL provide independent speech, music and sound-effect configuration, audition and candidate comparison; unavailable required capabilities SHALL expose a reason and linked owner task.

#### Scenario: 音乐尚未真实验证
- **WHEN** speech tests pass while music or sound-effect capabilities remain fixture-only
- **THEN** the unverified capability and its required acceptance tasks remain incomplete

### Requirement: Subtitle precision and rights remain truthful
Subtitle/alignment precision, readability findings, rights, handoff readiness and production acceptance SHALL remain owner-authored and distinct.

#### Scenario: 字幕门禁失败
- **WHEN** a cue fails timing/readability checks or music lacks production rights
- **THEN** the UI shows the exact blocker and cannot advertise production-ready handoff or unsupported subtitle precision

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
