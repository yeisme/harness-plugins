## ADDED Requirements

### Requirement: Workbench SHALL register one fixed Conversation Runtime adapter binding
Workbench runtime integration SHALL use a versioned fixed owner/adapter/operation binding for Conversation Runtime with safe `turnIntentRef`, session grant, bounded limits, events, cancel and reconcile. Browser query, localStorage, environment exposed to the client or caller fields MUST NOT select executable, argv, cwd, env, provider endpoint, credential or arbitrary model.

#### Scenario: Conversation Runtime is compatible and enabled
- **WHEN** Workbench service configuration, Runtime Plane descriptor, owner contract version and session grant all match
- **THEN** the Agent runtime descriptor SHALL report the real Pi/OMP Profile as available for the authorized cohort
- **AND** Task dispatch SHALL use the fixed adapter and preserve Task/event/receipt correlation

#### Scenario: Adapter is unavailable
- **WHEN** broker, owner, executable provenance, auth, version or profile readiness is unavailable
- **THEN** Workbench SHALL report the specific safe unavailable state and disable real send
- **AND** SHALL NOT auto-fallback to the deterministic reference adapter or another runtime

### Requirement: Reference runtime SHALL remain explicitly dev-only beside the real adapter
The deterministic reference adapter MAY remain available under its existing explicit dev flag and SHALL be labelled reference/dev. It MUST NOT satisfy real Conversation Runtime readiness, content persistence, Profile, provider or vertical-slice acceptance and MUST NOT be selected automatically.

#### Scenario: Developer enables reference mode
- **WHEN** the explicit reference adapter flag is enabled without a real Conversation Runtime
- **THEN** Workbench SHALL label the runtime as reference/dev and MAY run deterministic tests
- **AND** SHALL NOT claim real Chat, encrypted history or Pi/OMP provider readiness

### Requirement: Workbench SHALL use a distinct fixed Aigora Agent Access control adapter
Workbench BFF SHALL invoke Aigora local access only through Runtime Plane `aigora.agent-access`, separately from the Conversation Runtime adapter and existing `aigora.text`. The strict envelope MAY carry opaque Aigora access-profile, session-access-grant, launch-ticket, local-access, Key-family, MCP-binding and MCP-generation refs plus expected generation/revision/idempotency. It MUST NOT carry `aig_live_*`, delegation/Gateway tokens, local bearer/endpoint, Authorization, resolver value, arbitrary provider/model endpoint, MCP server, executable, argv, cwd, env or raw conversation content.

#### Scenario: Aigora-backed turn is dispatched
- **WHEN** the current Conversation session, Aigora grant generation and launch ticket are compatible
- **THEN** `aigora.agent-access` SHALL dispatch safe refs, fences and correlation only
- **AND** parent-Key resolution/activation SHALL remain inside the Aigora runtime owner process

#### Scenario: Caller supplies a process or server override
- **WHEN** the request contains an endpoint, header, MCP server, executable, argv, cwd, env or credential field
- **THEN** Workbench and Runtime Plane SHALL reject it before owner/process/network execution
- **AND** the error/evidence SHALL not echo the forbidden value

### Requirement: Workbench SHALL preserve independent framework and Aigora adapter truth
The Conversation Runtime adapter SHALL report Agent Framework ACP/OMP/JSON/RPC/SDK readiness; `aigora.agent-access` SHALL report only grant/model/MCP access readiness. Unknown acceptance SHALL be reconcile-only. An active turn MUST NOT auto-switch framework protocol, reference runtime, Aigora model protocol or egress generation.

#### Scenario: ACP v1 framework gate passes
- **WHEN** Conversation Runtime protocol/redaction/real canary evidence passes
- **THEN** only the Agent Framework source MAY expose ACP v1 first-support for the approved cohort
- **AND** the Aigora Access source SHALL retain its independent model/MCP state and digest

#### Scenario: Terminal response is lost
- **WHEN** the adapter cannot determine whether a model or MCP operation completed
- **THEN** it SHALL retain the original attempt/cursor and request owner readback
- **AND** it SHALL keep retry and runtime/protocol switch disabled until reconciliation
