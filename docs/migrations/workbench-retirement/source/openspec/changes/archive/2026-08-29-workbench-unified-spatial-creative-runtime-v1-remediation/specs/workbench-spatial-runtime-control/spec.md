## ADDED Requirements

### Requirement: Spatial watch SHALL expose one closed union across transports
HTTP/SSE, gRPC, JSON-RPC and SDK MUST represent spatial watch as closed `snapshot|event|resync` variants with cursor and lens kind. Existing snapshot-only SDK watch remains a compatibility shim for one release and MUST preserve resync recovery.

#### Scenario: Legacy SDK consumes a resync
- **WHEN** a server emits a spatial resync event
- **THEN** the legacy SDK shim requests a canonical snapshot before yielding further snapshots
- **AND** it MUST NOT throw a snapshot codec mismatch
