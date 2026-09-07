# workbench-pinax-kb-review Specification

## Purpose
Define the bounded read-only Pinax knowledge-base review projection, readiness truth, accessible evaluation workflow, safe guidance, and suite/run attribution contract.

## Requirements

### Requirement: Workbench SHALL consume bounded Pinax KB review projections through its server connector

The Workbench module SHALL use a typed same-origin BFF/connector for the five versioned Pinax GET projections and SHALL reject unsafe or incompatible payloads before rendering them.

#### Scenario: Overview and source inventory load
- **WHEN** the module requests the overview or source inventory
- **THEN** it SHALL display normalized source, provider, sidecar, generation, freshness and next-action facts
- **AND** it SHALL NOT expose absolute vault paths, provider endpoint values, credentials, note bodies, vectors or raw provider payloads.

#### Scenario: Contract drift is detected
- **WHEN** a required identity field is missing, a relative ref is unsafe, or the contract version/schema is incompatible
- **THEN** the connector SHALL return `contract_mismatch`
- **AND** the module SHALL not display `ready`, `searchable`, `passed` or an actionable mutation affordance.

### Requirement: KB review SHALL represent each readiness layer truthfully

The module SHALL keep source, Ollama, sidecar, generation, retrieval/evaluation and answer-generation states independent.

#### Scenario: Daemon reachability is weaker than retrieval readiness
- **WHEN** Ollama responds to a health endpoint but the exact model, real embed, sidecar, or active generation is unavailable
- **THEN** the module SHALL show the strongest proven layer and the failed downstream layer separately
- **AND** it SHALL not label the knowledge base ready or searchable.

#### Scenario: Candidate, stale, failed and offline states
- **WHEN** a candidate exists, the active generation is stale/failed, or the connector is offline
- **THEN** the module SHALL preserve the corresponding state and timestamp
- **AND** cached data SHALL be labeled offline and SHALL not enable mutations or claim current status.

#### Scenario: Generation is not configured
- **WHEN** the P0 has embedding/retrieval only
- **THEN** question and run detail SHALL display `answer_mode=not_generated`
- **AND** bounded retrieval context SHALL not be presented as a generated answer.

### Requirement: KB review page SHALL provide an accessible bounded evaluation workflow

The page SHALL render inside existing Workbench chrome with one primary scroll container, one active detail owner, bounded lazy loading and responsive keyboard-accessible interactions.

#### Scenario: Desktop and narrow layouts
- **WHEN** the viewport is at least 1280 CSS pixels
- **THEN** the page SHALL use a 300–340px question summary column and flexible detail column
- **AND WHEN** the viewport is below 768 CSS pixels
- **THEN** it SHALL use a single-column flow without page-level horizontal overflow and keep disabled reasons visible.

#### Scenario: Keyboard and assistive technology review a question
- **WHEN** a keyboard or screen-reader user opens a suite and selects a question
- **THEN** tabs, question selection, citations and refresh status SHALL be operable and announced using semantic roles
- **AND** status SHALL not depend on color alone.

### Requirement: P0 KB review SHALL remain read-only and command-guided

The browser SHALL not execute rebuild/evaluate/activate/import, mutate review decisions, read local files or invoke LanceDB; all P0 module routes SHALL be GET-only projections.

#### Scenario: Owner-selected unavailable action has a truthful next step
- **WHEN** the overview provides a selected next-action state that exactly matches a safe published owner action
- **THEN** the module SHALL show that state as the disabled reason and the corresponding copyable single allowlisted command with exact token/flag sequence: `pinax kb doctor --vault <vault> --json`, `pinax kb provider doctor PROVIDER --model MODEL --vault <vault> --json`, or `pinax kb rebuild --backend BACKEND --provider PROVIDER --model MODEL --vault <vault> --json`
- **AND** `BACKEND`, `PROVIDER`, and `MODEL` denote non-literal owner values using only ASCII letters, digits, `.`, `:`, `_`, `+`, or `-`; `<vault>` is the sole allowed placeholder and only in its fixed position. It SHALL reject extra, missing, reordered, or positional flags (including `--activate`, `--yes`, and `--force`), arbitrary `pinax` subcommands, glob/shell expansion characters, shell chaining/metacharacters (including single `&`), redirects, non-Pinax prefixes, private paths, URLs, and credential options; it SHALL not synthesize flags, fold a generic success summary into the reason, or start work from the browser.

#### Scenario: Unavailable state has no selected safe action
- **WHEN** the overview next-action state is empty or does not exactly match a safe published owner action
- **THEN** the module SHALL expose no command; an unmatched symbolic owner state MAY remain visible as its reason
- **AND** it SHALL state no safe command is available rather than inventing recovery guidance.

#### Scenario: Relevant state has empty owner guidance
- **WHEN** a partial or unavailable readiness state has an empty owner next-action
- **THEN** the module SHALL explain that no safe server command was selected
- **AND** a healthy state with empty guidance SHALL NOT be labeled unavailable.

### Requirement: Source and suite inventory SHALL preserve safe partial owner truth

The module SHALL distinguish supported knowledge sources, unsupported capabilities, and non-openable invalid suite rows without inventing imports, uploads, indexes, or question requests.

#### Scenario: Owner publishes unsupported source capability inventory
- **WHEN** the sources projection includes bounded `unsupported` rows with safe type, status, and next-action text
- **THEN** the module SHALL render those rows as informational unsupported/not-configured inventory
- **AND** it SHALL normalize `tags:null` to an empty tag list and never expose a path, body, or upload/index control.

#### Scenario: Owner publishes invalid suite source row
- **WHEN** the suites projection contains `{source_ref, status:"invalid"}` without a suite id
- **THEN** the module SHALL render it as non-openable partial inventory
- **AND** it SHALL not request questions for that row; malformed supplied identities remain `contract_mismatch`.

#### Scenario: Safe selected detail ref is missing
- **WHEN** a safe selected suite or run ref receives owner HTTP 400
- **THEN** the connector SHALL reconcile it as `not_found` for that question/run detail only
- **AND** the page SHALL keep current overview, sources, and suites visible without showing an empty suite or global offline state.

### Requirement: KB review SHALL not attribute global runs to the wrong suite

The connector SHALL require safe run `suite_id` and `suite_version`, and the UI SHALL treat a run as suite-level aggregate only.

#### Scenario: Latest global run belongs to another selected suite or version
- **WHEN** the global latest safe run has a `suite_id` or `suite_version` different from the selected suite identity/version
- **THEN** the module SHALL suppress its metrics and citations and explicitly explain that the latest run belongs to a historical suite/version
- **AND** it SHALL render them only after the selected suite id and version both exactly match the run.

#### Scenario: Matching suite run is rendered
- **WHEN** the run suite id and version exactly match the selected suite
- **THEN** the module SHALL label metrics/citations as suite-level aggregate
- **AND** it SHALL NOT present them as question-specific evidence.

#### Scenario: Run suite identity is malformed or missing
- **WHEN** a run omits suite id/version or supplies an unsafe opaque suite id/version token (including traversal, path separators, whitespace, controls including C1, URL, or absolute-path forms)
- **THEN** the connector SHALL return `contract_mismatch`
- **AND** no run metric or citation SHALL cross the browser boundary.

#### Scenario: Mutation request is attempted
- **WHEN** a client sends a non-GET request to a P0 review projection
- **THEN** the BFF/connector SHALL return method-not-allowed or capability-unavailable
- **AND** it SHALL not change Pinax Markdown, `.pinax/**`, LanceDB, Ollama state or Workbench review decision state.
