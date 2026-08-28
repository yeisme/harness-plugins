# dsh-devtools-observability Specification

## Purpose
TBD - created by archiving change dsh-devtools-observability-v1. Update Purpose after archive.
## Requirements
### Requirement: Installable DevTools bundle preserves DSH CLI channels
The system SHALL provide public Host, Client, and bundle packages installable into the Web profile, and SHALL write DevTools diagnostics only to stderr while preserving existing DSH stdout behavior.

#### Scenario: Installed bundle boots with Web profile
- **WHEN** a user installs `@yeisme/dsh-devtools` into profile `web` and runs `dsh --profile web`
- **THEN** the Host and Client DevTools faces are composed and the existing Web URL remains on stdout
- **AND** DevTools lifecycle, log, slow-operation, and performance summaries are written to stderr

#### Scenario: Bundle is removed
- **WHEN** the user removes `@yeisme/dsh-devtools` from profile `web`
- **THEN** the DevTools Host, Client, panel, exporters, observers, and timers are absent without persistent cleanup

### Requirement: Host records are bounded and safe
The Host plugin SHALL project Cordis logs, DSH lifecycle spans, performance samples, and findings into bounded in-memory records without persisting raw sensitive content.

#### Scenario: Logger receives dynamic sensitive arguments
- **WHEN** a Cordis log message includes prompt text, tool arguments, provider payload, credentials, Authorization data, cookies, tokens, absolute paths, objects, or errors
- **THEN** the DevTools record contains only safe source/severity/fingerprint/code metadata and redacted markers
- **AND** forbidden content does not appear in stderr, snapshots, exports, fixtures, or evidence

#### Scenario: Ring capacity is exceeded
- **WHEN** a record family exceeds its configured capacity
- **THEN** the oldest records in that family are discarded and later snapshots report truncation honestly

### Requirement: Session and tool timelines derive from canonical events
The Host plugin SHALL derive turn, TTFT, tool, retry, error, and lifecycle records from DSH events without copying session canonical state or private payload fields.

#### Scenario: Tool call settles
- **WHEN** matching `tool/call` and `tool/result` events are observed
- **THEN** the system emits a tool span with opaque identity, safe tool name, start/end time, duration, and success/error status

#### Scenario: Span never settles
- **WHEN** a session or plugin disposes while a derived span is open
- **THEN** the span ends with `partial` status and is not reported as success

### Requirement: Host performance sampling and findings are deterministic
The Host plugin SHALL sample CPU, memory, event-loop utilization, and event-loop delay with Node native APIs and SHALL generate findings from stable threshold rules.

#### Scenario: Event-loop delay exceeds threshold
- **WHEN** observed event-loop p95 exceeds the configured threshold
- **THEN** a `host.event_loop_lag` finding references the supporting sample sequence and the terminal renderer emits a safe warning

#### Scenario: No threshold is crossed
- **WHEN** samples remain below all thresholds
- **THEN** the system records samples and periodic summaries without fabricating findings

### Requirement: Snapshot Remote is versioned and incremental
The Host SHALL expose `devtools.snapshot@1` with spec version `1.0`, bounded limit validation, monotonic cursor behavior, capabilities, summary, and records.

#### Scenario: Incremental snapshot succeeds
- **WHEN** the Client requests records after a valid sequence with an omitted limit
- **THEN** the Host returns at most 200 records, `nextSeq`, `serverTime`, capabilities, summary, and an honest `truncated` flag

#### Scenario: Requested limit exceeds maximum
- **WHEN** the Client requests more than 500 records or supplies an invalid cursor
- **THEN** the Remote returns a stable validation failure without exposing stack traces or private data

### Requirement: CPU profiling is explicit, bounded, and local-only
The Host SHALL expose `devtools.captureCpuProfile@1` only when local authority is proven and SHALL constrain profiling duration and concurrency.

#### Scenario: Local CPU profile completes
- **WHEN** a local user requests a duration between 1 and 30 seconds and no profile is active
- **THEN** the Host returns a redacted CPU profile whose workspace script paths are relative and whose external paths are replaced

#### Scenario: Remote or concurrent capture is refused
- **WHEN** local authority cannot be proven or another profile is active
- **THEN** the Host returns `not_local`, `capability_unavailable`, or `capture_busy` and does not start another inspector session

#### Scenario: Capture is interrupted
- **WHEN** the request, plugin, or process is disposed during profiling
- **THEN** the inspector profiler is stopped and resources are released

### Requirement: Browser performance collection is local and capability-probed
The Client SHALL collect supported browser performance entries in memory and SHALL omit request payloads, response payloads, URL origins, queries, and fragments.

#### Scenario: Supported browser observes API timing
- **WHEN** a same-origin `/api` resource entry completes and is not a DevTools self-call
- **THEN** the Client records the normalized pathname, start time, duration, transfer size if available, and a deterministic slow-API finding when applicable

#### Scenario: Entry type is unsupported
- **WHEN** PerformanceObserver does not support long task, layout shift, or LCP entries
- **THEN** the corresponding capability is false and the remaining browser diagnostics continue to work

### Requirement: Web diagnostics surface has Pane and overlay paths
The Client SHALL provide a keyboard-accessible diagnostics panel with Overview, Timeline, Logs, and Performance views, plus CPU Capture and Export actions.

#### Scenario: Pane Workbench is available
- **WHEN** the user activates DevTools and the Pane capability exists
- **THEN** the Client opens singleton `workspace.devtools` in the bottom utility region

#### Scenario: Pane Workbench is unavailable
- **WHEN** the Host Remote is ready but the Pane capability is absent
- **THEN** the same panel opens through `shell.overlay` with correct focus and close behavior

#### Scenario: Host Remote is unavailable
- **WHEN** the DevTools Host Remote cannot be resolved
- **THEN** the entry remains visible but disabled with a readable reason and no dead action

### Requirement: Cross-surface timing is honest
The Client SHALL estimate Host/browser clock offset from snapshot round trips and SHALL disclose timing uncertainty and exact-correlation capability.

#### Scenario: Host and browser lanes are displayed
- **WHEN** the panel combines Host and browser records
- **THEN** it reports `clockUncertaintyMs` and `exactRpcCorrelation=false` unless a future authoritative seam is present

### Requirement: Diagnostic export is application-authored and redacted
The Web application SHALL generate a versioned `dsh.devtools.export` JSON document from the current safe Host and browser projections and SHALL reject unsafe export content.

#### Scenario: Safe export succeeds
- **WHEN** the user selects Export and all records pass the forbidden-content scan
- **THEN** the browser downloads one JSON document containing spec version, summaries, records, capabilities, clock information, and redaction metadata

#### Scenario: Unsafe export is detected
- **WHEN** a secret sentinel, raw prompt marker, private tool argument, provider payload, Authorization data, absolute path, or complete stack is detected
- **THEN** the export is refused and the UI shows a safe error without writing a file

### Requirement: Integration runs preserve redacted evidence
The project SHALL provide an integration entrypoint that writes the required evidence set under the owning subproject temp directory on both success and failure.

#### Scenario: Integration run passes
- **WHEN** `pnpm run test:integration` succeeds
- **THEN** it writes generated `summary.json`, `command.txt`, `stdout.log`, `stderr.log`, `env.json`, and `artifacts/` under `temp/integration-test-runs/<run-id>/`

#### Scenario: Integration run fails
- **WHEN** the wrapped test command fails
- **THEN** the same evidence set is preserved, secrets and private reasoning are redacted, and the wrapper exits with the original status

