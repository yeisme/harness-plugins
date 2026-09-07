## ADDED Requirements

### Requirement: Eikona generation, comparison, cost, rights and owner decision MUST remain distinct from Scaena admission

Studio MUST present Eikona process/attempt state, candidate comparison, review evidence, cost summary, rights status, owner decision and receipt as separate typed projections. Eikona candidate acceptance, Visual Library promotion, Scaena subject freeze, shot acceptance and delivery MUST be separate owner-authorized actions with independent receipts. An Eikona accepted decision MUST NOT be rendered as Scaena production admission, shot readiness or delivery success.

#### Scenario: Operator accepts an Eikona candidate for a production episode
- **WHEN** Eikona returns an accepted review decision and Scaena has not admitted the asset
- **THEN** Studio MUST show Eikona acceptance plus a distinct Scaena admission/readiness state and its eligible next action
- **AND** Studio MUST NOT mark the shot accepted, bypass cost/rights gates or call a provider from the browser.

### Requirement: Episode Workspace MUST consume the Scaena six-stage production projection

Episode Workspace MUST obtain a Scaena facade projection for `story`, `breakdown`, `look-development`, `production-preflight`, `shot-production` and `review-delivery`. Each stage MUST identify the current ProductionGraph ref/version, scene/shot summaries, gate, readiness, freshness, evidence/receipt refs and server-authorized next action. Browser UI MUST NOT directly coordinate Auctra, Eikona, Sonora, Ordo or provider mutations to reconstruct a production workflow.

#### Scenario: Production preflight becomes stale before a shot action
- **WHEN** Scaena reports an outdated subject/style/requirement/binding or ProductionGraph version
- **THEN** Studio MUST render `stale_preflight` with the owner-provided repair or replan descriptor and preserve prior evidence
- **AND** it MUST NOT submit the old plan, create a hidden replacement run or claim shot readiness.

### Requirement: Anatomia video evidence and MCP projections MUST be read-only safe UI consumers

Studio MAY display approved Anatomia video timeline, identity/region, provenance, rights, readiness and evidence summaries only through schema-validated tenant-scoped owner projections. MCP data MUST arrive only through an approved server-side projection or bridge and MUST NOT be a browser-required transport. The UI MUST NOT show raw video-analysis/provider payloads, inline geometry/mask/image bytes, signed URLs, raw prompts, MCP private tool arguments or canonical analysis state.

#### Scenario: Video evidence is unavailable
- **WHEN** Anatomia or the approved MCP projection reports unavailable evidence
- **THEN** Studio MUST show the safe blocker, freshness and owner-provided repair/action descriptor if one exists
- **AND** it MUST NOT synthesize a region, infer owner confirmation or access an MCP endpoint directly from the browser.

### Requirement: Unified Asset Library MUST aggregate owner-authorized typed projections without becoming an asset store

Asset Library MUST aggregate only authorized typed resources from approved owners and expose owner, resource type, rights/access, lineage, freshness, release binding, safe preview state and allowed actions. Preview/download access MUST be retrieved through an owner-controlled grant/proxy at use time; Studio MUST NOT persist asset bytes or reuse signed URLs across tenant/workspace contexts.

#### Scenario: An asset preview grant expires after tenant switching
- **WHEN** a user returns to an asset whose prior preview grant has expired or belongs to another context
- **THEN** Studio MUST request a newly authorized projection/grant in the current context or show a safe denial
- **AND** it MUST NOT reuse the URL, cached bytes or metadata as proof of access.

### Requirement: Canvas MUST own layout-only presentation state and versioned references

Canvas MUST persist only viewport, node position, grouping, user annotation, panel preference and versioned safe owner refs/digests. It MUST NOT persist canonical ProductionGraph, scene/shot, asset, Agent, knowledge, review, readiness or receipt state. When an owner version/digest changes, Studio MUST mark the node and dependent proposals stale and rely on current action descriptors for refresh/rebuild/accept/export eligibility.

#### Scenario: A ProductionGraph revision changes under a canvas node
- **WHEN** the current Scaena projection no longer matches the node's bound version/digest
- **THEN** Canvas MUST retain its layout while marking the node and dependent action preview stale
- **AND** it MUST block acceptance/export until an authorized refresh or rebuild completes.

### Requirement: Agent Operations MUST remain an Ordo-owned safe projection

Studio MUST render Ordo-backed DAG, Agent/runtime, task, session, writer lease, approval, verification, attention, evidence, closeout and reconcile state only as typed safe projections. It MUST distinguish running, stale, unknown liveness and reconcile-required states. Workbench MUST NOT become a scheduler or offer an unqualified restart that may duplicate a writer.

#### Scenario: Writer lease persists after controller timeout
- **WHEN** Ordo reports `reconcile_required` with a retained writer lease
- **THEN** Studio MUST show the lease state and only the owner-authorized reconcile/action descriptor
- **AND** it MUST NOT infer that work stopped or dispatch a duplicate Agent run.
