# creative-input-intake-host Specification

## Purpose
TBD - created by archiving change dsh-creative-input-intake-v1. Update Purpose after archive.
## Requirements
### Requirement: 创作输入宿主合同
The implementation SHALL preserve the owner input identity, native reference and explicit opt-in boundary.

#### Scenario: Host can transfer a file
- **WHEN** the authenticated control plane provides an admitted transient transfer descriptor
- **THEN** only the bounded HTTP methods for that input may transfer bytes, with no product CLI or long-lived bearer

#### Scenario: The client cannot preserve transient capabilities
- **WHEN** the file-picker or media relay seam is unavailable
- **THEN** the client receives an explicit unavailable/degraded state and recovers the original request instead of guessing a URL

### Requirement: Sensitive output and evidence
The implementation SHALL keep transient grants, page credentials and file bytes out of ordinary receipts and persisted audit bodies.

#### Scenario: Recovery and inspection
- **WHEN** the same input is queried after an interruption
- **THEN** its stable owner request is reused and no automatic duplicate generation or canonical mutation occurs

