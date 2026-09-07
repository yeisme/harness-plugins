## ADDED Requirements

### Requirement: Project-data staging evidence MUST remain distinct from local and production evidence

Project-data daily operations SHALL provide a fixed, redacted staging-soak
entrypoint that uses only public Workbench contracts and emits structured
receipts. Local fixture, compressed-window, browser, database, and OpenSpec
evidence MUST NOT be presented as a completed staging soak; staging evidence
MUST NOT itself grant promotion or production authority.

#### Scenario: A local compressed test passes
- **WHEN** a local test uses a compressed TTL or an observation window below
  the fixed staging minimum
- **THEN** its output MUST be classified as local/component evidence
- **AND** no task, receipt, or document may claim that the 24-hour staging
  soak or a production promotion gate passed
