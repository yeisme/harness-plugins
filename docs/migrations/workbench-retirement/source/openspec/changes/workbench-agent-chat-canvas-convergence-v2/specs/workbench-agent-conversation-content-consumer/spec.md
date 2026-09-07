## ADDED Requirements

### Requirement: Workbench SHALL consume Conversation Runtime through one typed facade
Workbench SHALL expose a versioned Conversation Runtime client under the existing `WorkbenchClient` facade for runtime profiles, session grants, session content, sealed turn intents, resumable content events, retry attempts, delete and export. Browser code MUST NOT call Conversation Runtime, Runtime Plane, Pi/OMP or provider endpoints directly and MUST NOT submit executable, argv, cwd, env, credential or arbitrary provider/model fields.

#### Scenario: Browser lists runtime profiles
- **WHEN** `/agent` opens the Session Profile surface
- **THEN** the Browser SHALL call the same-origin Workbench facade and render server-authored runtime/model/tool/budget capabilities
- **AND** SHALL NOT discover local binaries, credentials or provider endpoints itself

#### Scenario: Unknown contract version arrives
- **WHEN** Conversation Runtime returns an unsupported major or missing critical field
- **THEN** Workbench SHALL report `version_incompatible` or `needs_contract`
- **AND** SHALL NOT attempt a best-effort provider call or enable send

### Requirement: Workbench SHALL correlate content and control without merging authority
The selected-session projection SHALL correlate Conversation content and Workbench Task lifecycle by authorized `sessionRef`, `turnRef` and `attemptRef`, while preserving separate content and control cursor/freshness/status. Visible content completion MUST NOT imply Task or Owner success; Task failure MUST NOT erase confirmed visible Blocks.

#### Scenario: Content is partial while Task is running
- **WHEN** confirmed Blocks exist and the Task has not reached terminal state
- **THEN** the timeline SHALL render the Blocks with running/partial truth and the Run detail SHALL show Task state
- **AND** SHALL NOT label the turn succeeded

#### Scenario: One stream disconnects
- **WHEN** content or lifecycle streaming becomes unavailable
- **THEN** Workbench SHALL retain the other last-confirmed projection and mark only the disconnected source degraded
- **AND** SHALL NOT create a replacement turn or duplicate a stream per message

### Requirement: Session Profile SHALL authorize ordinary Chat within a bounded grant
Workbench SHALL require explicit confirmation of runtime/model profile, tool classes, Context/artifact scope, budget ceiling, expiry, retention and soft-follow preference before the first real turn. An unexpired server-authored grant MAY authorize ordinary read/chat turns without a per-turn permission prompt; mutations and scope/budget/runtime changes MUST continue to require their owning gate.

#### Scenario: First real turn starts
- **WHEN** the user confirms a valid Profile and sends a turn within its scope
- **THEN** Workbench SHALL bind the sealed turn intent and Task to the grant/profile revision
- **AND** SHALL not render the current every-message permission blocker

#### Scenario: Budget would be exceeded
- **WHEN** the predicted or observed usage would exceed the grant ceiling
- **THEN** Workbench SHALL block dispatch and present a server-authored budget approval/profile update action
- **AND** SHALL NOT silently select a cheaper or more expensive model

### Requirement: Workbench SHALL render only safe structured conversation Blocks
Workbench SHALL render allowlisted `markdown`, `code`, `table`, `quote`, `artifact_ref`, `proposal_summary` and `status` Blocks with bounded content and safe refs. It MUST NOT execute embedded HTML/JavaScript, open arbitrary URLs, expose provider frames, hidden prompts, chain-of-thought, private tool arguments, credentials or private paths.

#### Scenario: Assistant returns code and artifact references
- **WHEN** the content stream contains valid code and approved artifact-ref Blocks
- **THEN** Workbench SHALL render the code and owner-approved artifact actions
- **AND** arbitrary HTML, scripts and unapproved URLs SHALL remain inert or rejected

#### Scenario: Unsafe Block arrives
- **WHEN** a Block contains forbidden fields, oversize content or a sensitive sentinel
- **THEN** Workbench SHALL fail that Block closed and show a bounded content-unavailable status
- **AND** SHALL not echo the unsafe value in UI, logs or evidence

### Requirement: Conversation content lifecycle SHALL remain explicit
Workbench SHALL expose owner-authored retry, delete and export actions. Known failed/partial attempts MAY be retried only by explicit user action and SHALL create a new attempt linked to the same user message. `unknown_accept` SHALL expose only original-attempt reconcile. Delete SHALL remove content through Conversation Runtime without deleting Workbench Task/receipt/domain records.

#### Scenario: User retries a partial answer
- **WHEN** a known failed attempt has confirmed partial Blocks
- **THEN** Workbench SHALL preserve those Blocks and create a new attempt only after explicit Retry
- **AND** SHALL not splice the new output into the old attempt identity

#### Scenario: User deletes conversation content
- **WHEN** the user confirms content deletion
- **THEN** Workbench SHALL call the owner delete action and display the deletion receipt/state
- **AND** existing Task/proposal/receipt safe projections SHALL remain visible without正文

### Requirement: Workbench BFF SHALL orchestrate Aigora Agent Access without exposing local authority to Browser
Workbench BFF SHALL orchestrate Conversation session creation, Identity delegation to audience `aigora-agent-access`, Aigora access context/grant/launch ticket, and Runtime Plane `aigora.agent-access` launch/renew/close. The typed facade MAY expose only `aigora_access_profile_ref`, `aigora_session_access_grant_ref`, `local_access_ref`, `key_family_ref`, `mcp_binding_ref`, `mcp_generation_ref`, generation, safe states, budgets and actions. Browser MUST NOT receive a PrincipalContext exchange token, launch ticket, local bearer/endpoint, `aig_live_*`, Gateway token, Authorization, resolver value or arbitrary endpoint.

#### Scenario: User selects an Aigora profile
- **WHEN** the current project receives a compatible Aigora access context
- **THEN** BFF SHALL bind the selected Conversation session to exact safe refs/revisions/generation and execute the server-side saga
- **AND** Browser SHALL receive only a safe Aigora Access projection after each step

#### Scenario: Aigora projection is stale
- **WHEN** the access context or MCP generation is stale, degraded, forbidden or unknown
- **THEN** Workbench SHALL show the source-specific state and recovery action
- **AND** it SHALL not treat cached data as authorization, reuse an old ticket/bearer or silently select another profile

### Requirement: Workbench SHALL present Agent Framework and Aigora Access as separate source cards
The Session Profile SHALL render an Agent Framework card for ACP/adapter, OMP, session, cursor, tool readiness and Conversation session budget, and an Aigora Access card for grant/generation, model protocol/alias, MCP bridge, freshness and model/MCP budgets. Workbench SHALL NOT calculate a shared hard balance or merge the two cards into one readiness state.

#### Scenario: MCP budget is exhausted
- **WHEN** MCP Gateway reports no remaining MCP calls while model and Conversation budgets remain available
- **THEN** Workbench SHALL disable only the affected MCP actions and show the MCP reason
- **AND** ordinary model chat SHALL remain governed by its independent eligibility

#### Scenario: ACP v2 runtime is absent
- **WHEN** the v2 prototype descriptor reports no compatible runtime
- **THEN** the Agent Framework card SHALL display `blocked` without changing Aigora Access state
- **AND** it SHALL not label v2 first-support or silently run v1/JSON/reference for the same active turn

#### Scenario: Aigora Responses streaming is blocked
- **WHEN** Aigora lacks real `/v1/responses` incremental streaming evidence while another model/MCP capability is active
- **THEN** the Aigora Access card SHALL display the protocol-specific block independently
- **AND** it SHALL not auto-switch an active turn to Chat Completions or mark the whole framework ready/unready

### Requirement: Workbench and Agent Framework SHALL own session controls while Aigora owns only access authority and Key summary
Workbench SHALL provide Agent Framework session create/load/resume/close/cancel, ACP/Pi/OMP controls where supported, tool approval, content delete/export and proposal review. It MAY expose a server-authored safe deep link to Aigora Key detail, but MUST NOT duplicate Aigora Key/grant/local-binding authority or expose complete session controls in the Aigora panel. Aigora summary SHALL NOT display ACP wire or OMP version.

#### Scenario: User opens Aigora Key detail
- **WHEN** Workbench renders the return deep link for an Aigora-backed session
- **THEN** the link SHALL contain only safe project/key-family/profile/consumer refs
- **AND** it SHALL not include a token, ticket, local bearer/endpoint, conversation正文, tenant override, command or mutation payload

#### Scenario: A session effect requires mutation
- **WHEN** Pi/OMP proposes a file write, terminal command, MCP mutation or external write
- **THEN** Workbench SHALL render an owner-authored proposal/approval flow
- **AND** it SHALL not execute the effect solely because the Aigora or Conversation grant is active

#### Scenario: MCP elicitation is approved
- **WHEN** Runtime Plane projects a safe approval event for an original Gateway `tools/call`
- **THEN** Workbench SHALL decide through ProposalAuthority and return the correlated `approval_ref`
- **AND** it SHALL not construct or submit another `tools/call`; Gateway and Workbench receipts SHALL remain separately authoritative

### Requirement: AG-UI compatibility SHALL remain a future BFF projection
Any future AG-UI HTTP/SSE compatibility surface SHALL project approved Conversation content and Task/proposal/approval events from the Workbench BFF. It SHALL NOT enter Aigora, connect Browser directly to owners, become canonical state or carry credentials, tickets, local endpoints/bearers, raw prompts, provider payloads or private tool arguments.

#### Scenario: AG-UI capability is not implemented
- **WHEN** no separately approved Workbench adapter is present
- **THEN** Workbench SHALL omit actionable AG-UI controls and advertise no readiness
- **AND** existing typed facade and event streams SHALL remain unchanged
