## ADDED Requirements

### Requirement: Conversation timeline SHALL be answer-first with folded run detail
User messages and assistant structured Blocks SHALL form the primary readable timeline. Task submission, thinking, tool lifecycle, gate, proposal transport, receipt and technical refs MUST render inside a per-turn expandable Run detail or bounded inline decision row. Repeated identical lifecycle/status messages MUST be coalesced by canonical identity and state rather than occupying separate primary rows.

#### Scenario: A real answer streams while tools run
- **WHEN** the selected turn produces assistant content and multiple tool lifecycle events
- **THEN** the assistant Blocks SHALL remain the primary timeline content and the tools SHALL appear in one expandable Run detail
- **AND** each tool/task/proposal state SHALL remain inspectable with its safe ref and status

#### Scenario: Permission or rejection repeats
- **WHEN** the same Task/gate/status code is received repeatedly through replay or refresh
- **THEN** the timeline SHALL render one coalesced status with count/last-confirmed time
- **AND** SHALL NOT repeat identical warning rows as separate conversation content

### Requirement: Pending and attached context SHALL use distinct restrained treatments
The Composer SHALL visually distinguish pending Canvas/artifact selections from attached Context Pack refs using text, status dots and hairline boundaries. Neither state SHALL use large filled warning cards or appear as submitted message content.

#### Scenario: Selection awaits attachment
- **WHEN** Canvas objects are selected but not yet authorized for the turn
- **THEN** they SHALL appear in a labelled pending tray with one attach action
- **AND** attached Context chips SHALL remain visually and semantically distinct

