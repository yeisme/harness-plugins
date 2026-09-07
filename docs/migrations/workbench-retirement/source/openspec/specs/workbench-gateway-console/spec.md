# workbench-gateway-console Specification

## Purpose
TBD - created by archiving change workbench-mcp-gateway-console. Update Purpose after archive.
## Requirements
### Requirement: Workbench SHALL expose a dedicated typed Gateway facade
Workbench SHALL add `WorkbenchClient.gateway` using `workbench.gateway.v1alpha1` and SHALL accept only supported Gateway console contract versions and typed resource references.

#### Scenario: Supported Gateway contract is consumed
- **WHEN** `workbenchd` negotiates `gateway.console.contract.v1`
- **THEN** the SDK and BFF expose typed Gateway capability and summary projections without a generic owner fallback

#### Scenario: Unknown major version is received
- **WHEN** Gateway returns an unsupported console contract major version
- **THEN** Workbench reports `contract_mismatch`, disables Gateway actions, and does not infer fields from raw JSON

### Requirement: Workbench SHALL preserve the server-side Gateway trust chain
Workbench SHALL route Gateway traffic Browser → BFF → `workbenchd` → dedicated Gateway adapter and SHALL NOT return Gateway credentials, Authorization headers, credential references, or private URLs to the browser.

#### Scenario: Browser opens a Gateway page
- **WHEN** the browser requests Gateway operator data
- **THEN** the BFF obtains a typed projection from `workbenchd` and no Gateway credential appears in browser payloads, storage, URLs, logs, or network requests

#### Scenario: Browser attempts arbitrary Gateway proxying
- **WHEN** a browser request supplies an arbitrary Gateway path, method, or raw body
- **THEN** Workbench rejects the request and performs no downstream Gateway call

### Requirement: Workbench SHALL provide four bounded Gateway operator pages
Workbench SHALL provide Overview, Backends, Approvals, and Activity pages whose data and actions come only from the dedicated typed facade and Task operations.

#### Scenario: Operator investigates Gateway health
- **WHEN** the operator opens Overview
- **THEN** Workbench shows real overall and section status, freshness, evidence references, and investigation paths without decorative or fabricated KPI values

#### Scenario: Operator investigates one backend failure
- **WHEN** one backend reports `backend_unavailable`
- **THEN** Backends isolates that failure while unrelated approvals, activity, and healthy backend data remain available

#### Scenario: Operator reviews an approval
- **WHEN** an approval has a safe summary, current revision, and expiry
- **THEN** Approvals shows decision context and only offers actions authorized by the current capability projection

#### Scenario: Operator inspects activity
- **WHEN** audit or operation references are available
- **THEN** Activity shows bounded chronological safe summaries and receipt/evidence links without raw tool arguments or owner payloads

### Requirement: Workbench SHALL render explicit recoverable data states
Each Gateway page SHALL distinguish `loading`, `empty`, `error`, `browser_offline`, `workbench_unavailable`, `gateway_unavailable`, `backend_down`, `stale`, and `permission` states with a safe explanation and valid recovery path.

#### Scenario: Gateway is unavailable with a prior safe snapshot
- **WHEN** the daemon cannot reach Gateway and policy permits the last safe snapshot
- **THEN** Workbench labels it stale with observation time and provides retry/recovery without presenting it as live

#### Scenario: Principal lacks permission
- **WHEN** a capability requires a scope the current principal does not have
- **THEN** Workbench explains the unavailable action, does not expose policy internals, and does not rely on an ambiguous disabled control

#### Scenario: Browser is offline
- **WHEN** browser connectivity is offline
- **THEN** Workbench shows a browser-local recovery state and does not submit a mutation

### Requirement: Workbench SHALL execute only allowlisted Gateway Task operations
Workbench SHALL register only `gateway.approval.decide`, `gateway.tools.refresh`, and `gateway.runtime.reload` for the initial contract, and each SHALL use Task permission, expected revision, idempotency, audit, receipt, and reconciliation semantics.

#### Scenario: Approval decision succeeds once
- **WHEN** an authorized operator submits a decision with the current revision and a new idempotency key
- **THEN** Workbench creates one Task attempt, records the owner receipt, and projects the accepted result

#### Scenario: Approval revision is stale
- **WHEN** the owner rejects a decision because `expected_revision` is stale
- **THEN** Workbench records a revision conflict, refreshes the projection, and does not replay the decision automatically

#### Scenario: Mutation outcome is ambiguous
- **WHEN** the downstream connection fails after Gateway may have accepted an allowlisted mutation
- **THEN** Workbench transitions the Task to `unknown_accept` and requires explicit receipt/status reconciliation before any retry

#### Scenario: Undeclared Gateway mutation is requested
- **WHEN** a caller requests runtime restart, registry/policy mutation, token provisioning, arbitrary tool execution, or another undeclared operation
- **THEN** Workbench rejects it as unavailable and performs no downstream call

### Requirement: Workbench SHALL persist only safe Gateway control-plane references
Workbench SHALL persist only Task metadata, revisions, safe resource references, receipt/evidence references, and transport receipts for Gateway interactions.

#### Scenario: Gateway returns sensitive owner data
- **WHEN** a Gateway response or error contains credentials, private URLs, raw tool arguments, provider payloads, hidden prompts, or private reasoning
- **THEN** Workbench redacts or rejects the content and does not persist or render it

### Requirement: Workbench Gateway pages SHALL be responsive and accessible
Gateway pages SHALL support desktop, tablet, and mobile layouts and SHALL meet WCAG 2.2 AA interaction, focus, keyboard, semantics, contrast, zoom, reduced-motion, and status-announcement requirements.

#### Scenario: Operator uses keyboard only
- **WHEN** the operator navigates, inspects a row/card, opens a decision flow, confirms or cancels, and returns to the page using only a keyboard
- **THEN** all functions are available in logical order and focus is restored to the initiating control

#### Scenario: Backends table is viewed on mobile
- **WHEN** the viewport is below the tablet breakpoint
- **THEN** the table becomes labeled cards or a stacked detail route without horizontal workflow dependence or lost status/action labels

#### Scenario: Reduced motion is enabled
- **WHEN** the operating system requests reduced motion
- **THEN** Workbench disables non-essential transitions while preserving state and focus feedback

### Requirement: Workbench SHALL produce redacted integration and E2E evidence
Contract, integration, process E2E, and accessibility entry points for the Gateway slice SHALL write required redacted evidence under `temp/integration-test-runs/<run-id>/` and preserve the original exit code on failure.

#### Scenario: Gateway integration run completes
- **WHEN** the integration runner exercises negotiation, healthy/degraded reads, one allowlisted mutation, conflict, permission, offline, and unknown-outcome paths
- **THEN** the run writes `summary.json`, `command.txt`, `stdout.log`, `stderr.log`, `env.json`, and `artifacts/` with no secret sentinels

