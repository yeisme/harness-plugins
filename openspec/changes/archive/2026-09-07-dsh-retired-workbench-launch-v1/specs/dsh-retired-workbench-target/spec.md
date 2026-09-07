## ADDED Requirements

### Requirement: Retired standalone target cannot be activated
The active DSH director client SHALL return the existing target_unavailable disabled result for standalone Workbench activation and handoff without invoking a remote launch or legacy issuance channel.

#### Scenario: Cached remote advertises a compatible target
- **WHEN** a user activates any Workbench intent or the legacy handoff command
- **THEN** no request is sent and the UI reports retirement while existing DSH domain panes remain usable
