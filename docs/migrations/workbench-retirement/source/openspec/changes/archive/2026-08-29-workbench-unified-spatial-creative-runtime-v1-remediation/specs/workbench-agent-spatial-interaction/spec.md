## ADDED Requirements

### Requirement: Negotiated Agent spatial intents SHALL reach the active surface
Only validated optional spatial intents attached to real Agent outputs may flow through the session workspace and route into the active Spatial Surface. Follow Pi guards MUST use the actual composer dirty, Review, modal and delivery state; effects remain temporary presentation.

#### Scenario: Agent emits a preview intent
- **WHEN** a negotiated Agent output emits a valid preview change-set intent while all Follow Pi guards permit it
- **THEN** the active surface shows only a temporary preview
- **AND** no proposal decision, Task or runtime action is created until explicit user action
