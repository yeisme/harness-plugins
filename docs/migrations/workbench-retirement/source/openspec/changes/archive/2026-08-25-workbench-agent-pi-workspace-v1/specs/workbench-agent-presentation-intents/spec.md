## ADDED Requirements

### Requirement: Versioned closed presentation intent contract
Pi SHALL express UI presentation requests only as versioned `AgentPresentationIntentV1` safe projections attached to an Agent output or event. The contract SHALL use closed fields and enums and SHALL NOT accept arbitrary maps, DOM targets, component props, code, HTML, URLs, or credential-bearing values.

#### Scenario: Valid presentation intent is projected
- **WHEN** Pi emits a presentation candidate with a supported contract version, kind, source Task/output, sequence, scope, expiry, and closed target
- **THEN** the Agent service validates and emits a bounded `AgentPresentationIntentV1` projection
- **AND** the underlying `AgentOutputV1` remains independently renderable

#### Scenario: Candidate contains arbitrary browser control
- **WHEN** a candidate includes CSS selector, element ID, XPath, arbitrary URL, HTML, JavaScript, keyboard injection, form submission, dynamic component name, arbitrary props, or credential data
- **THEN** the service rejects or redacts the candidate before it reaches the browser
- **AND** it does not echo the unsafe value in events, logs, UI, or evidence

### Requirement: Presentation intent kinds are allowlisted by effect
The system SHALL support only `attention_raise`, `open_pane`, `focus_safe_ref`, `show_evidence`, `request_review`, and `prefill_draft` in v1. Every kind SHALL map to a bounded presentation effect and SHALL NOT grant Task, proposal, ActionDescriptor, Owner, navigation, or layout authority.

#### Scenario: Unknown intent kind arrives
- **WHEN** a client receives an unknown or future intent kind
- **THEN** it ignores the effect, renders the base safe output, and records only a bounded `unsupported_safe_view` diagnostic
- **AND** it does not attempt a best-effort DOM or component mapping

#### Scenario: Attention intent arrives for a background session
- **WHEN** a valid `attention_raise` intent arrives for a non-selected session
- **THEN** the session rail may update its safe badge and polite announcement
- **AND** the workspace does not switch session, open a pane, or move keyboard focus

### Requirement: Default mode requires explicit user activation
The workspace SHALL treat pane, focus, evidence, review, and draft presentation intents as user-visible suggestions by default. It SHALL NOT automatically apply them unless the user has explicitly enabled temporary Follow Pi for the active session and the intent is classified `follow_eligible`.

#### Scenario: Suggestion mode receives an open-pane intent
- **WHEN** a valid `open_pane` intent arrives and Follow Pi is not enabled
- **THEN** the timeline renders a safe suggestion with reason and an explicit Open action
- **AND** the current pane, scroll, draft, and keyboard focus remain unchanged until user activation

#### Scenario: User activates a suggestion
- **WHEN** the user activates a valid presentation suggestion
- **THEN** the resolver revalidates the target against the current scope, registry, revision, and availability before applying it
- **AND** a failed revalidation produces a truthful safe reason rather than stale UI behavior

### Requirement: Follow Pi is temporary, reversible, and presentation-only
Follow Pi SHALL be off by default, scoped to the active session, and not persisted across reload. It SHALL automatically apply only live foreground `open_pane`, `focus_safe_ref`, or `show_evidence` intents that are marked `follow_eligible` and pass all safety guards. It SHALL never auto-apply `request_review` or `prefill_draft`.

#### Scenario: Follow Pi safely opens a pane
- **WHEN** the user enabled Follow Pi, the active visible turn emits a live follow-eligible `open_pane` intent, the composer is not dirty, no modal/review is active, and the target is already authorized
- **THEN** the workspace may open or visually focus the registered Pane without moving keyboard focus
- **AND** it announces the reversible visual change and provides a Close/Stop following control

#### Scenario: Follow Pi reaches the pane limit
- **WHEN** applying a follow-eligible intent would exceed the visible Pane limit or split-depth limit
- **THEN** the workspace keeps every existing Pane unchanged and renders the intent as a user-visible suggestion with `limit_reached`
- **AND** Follow Pi does not choose a Pane to close or replace on the user's behalf

#### Scenario: User is typing or reviewing
- **WHEN** a follow-eligible intent arrives while the user has a dirty editor, active modal, proposal review, or other protected interaction
- **THEN** the workspace queues or renders it as attention/suggestion instead of applying it
- **AND** user input and focus are not overwritten or stolen

#### Scenario: Session changes or page reloads
- **WHEN** the user switches session, disables Follow Pi, or reloads the page
- **THEN** automatic following stops
- **AND** historical or replayed intents remain suggestions only

### Requirement: Intent validation is scope, revision, registry, and expiry aware
Before applying an intent, the resolver SHALL validate contract version, intent kind, session/source identity, sequence, expiry, registry version, tenant/workspace scope, safe target type, required Context Pack revision, and target availability. Any failed check SHALL fail closed without changing UI state.

#### Scenario: Stale Context Pack intent
- **WHEN** an intent expects a Context Pack revision different from the currently authorized revision
- **THEN** the resolver returns `stale_view_request` and leaves the UI unchanged
- **AND** it may offer the explicit Context refresh path without refreshing automatically

#### Scenario: Cross-workspace target
- **WHEN** an intent references a resource, Task, proposal, receipt, or evidence ref outside the current authorized workspace
- **THEN** the resolver returns `scope_mismatch`
- **AND** it performs no Owner fetch, pane open, navigation, or authorization side effect

#### Scenario: Registry version or pane version is unsupported
- **WHEN** the intent targets an unknown registry revision or pane type/version
- **THEN** the resolver returns `unsupported_safe_view`
- **AND** no dynamic import, alias guessing, or fallback component is loaded

### Requirement: Presentation intents are idempotent and replay safe
The browser SHALL deduplicate intents by authorized session, `intentRef`, and source sequence. Live application state SHALL be renderer-local presentation state, not a Task or Owner outcome. Resumed or historical event replay SHALL NOT repeat automatic UI effects.

#### Scenario: Duplicate live intent is delivered
- **WHEN** the same valid intent is received more than once because of SSE replay or reconnect
- **THEN** the resolver applies or offers it at most once for the active renderer state
- **AND** the underlying safe output remains visible without duplicate panes, focus changes, or announcements

#### Scenario: Historical intent is restored after reload
- **WHEN** a timeline is rebuilt from persisted safe events
- **THEN** historical intents render as optional suggestions if still valid
- **AND** they do not automatically open panes, focus resources, prefill drafts, or enter Follow Pi

### Requirement: Pane intents resolve through the canonical pane registry
`open_pane`, `focus_safe_ref`, and `show_evidence` SHALL resolve only through the approved Workbench versioned Pane registry, closed plugin catalog, and closed parameter validators. The resolver SHALL preserve the bounded session-scoped Pane layout, prevent duplicate Pane documents, respect visible/split limits, and preserve session draft, timeline position, and selected Task subscription.

#### Scenario: Evidence intent resolves
- **WHEN** a valid `show_evidence` intent references an authorized receipt/evidence/task ref supported by `agent.evidence.v1`
- **THEN** the registry opens or focuses the evidence Pane using safe projections without silently replacing another Pane
- **AND** it does not construct an arbitrary Owner URL or expose the raw receipt/provider payload

#### Scenario: Target has no registered pane capability
- **WHEN** a valid safe ref has no registered pane/view mapping
- **THEN** the UI shows `needs_contract` or `unsupported_safe_view` with an explicit next action if one exists
- **AND** it does not fabricate a generic JSON or iframe fallback

### Requirement: Draft prefilling never submits or overwrites user work
`prefill_draft` SHALL contain only a bounded redacted safe template and SHALL require explicit user activation. It SHALL apply only to an empty composer in the same authorized session and SHALL never submit, replace a dirty draft, attach Context Pack state, or create a Task.

#### Scenario: User accepts a draft suggestion into an empty composer
- **WHEN** the user activates a valid `prefill_draft` suggestion and the current session composer is empty
- **THEN** the safe template is inserted as an editable browser-local draft
- **AND** sending it still requires the normal user submit action and TaskService path

#### Scenario: Composer already contains user input
- **WHEN** a user activates a draft suggestion while the composer is non-empty
- **THEN** the workspace refuses to overwrite it and offers copy/append only if explicitly designed and separately confirmed
- **AND** the existing user input remains unchanged

### Requirement: Review intents never accept proposals
`request_review` SHALL only focus or open the registered Review pane for a server-authored proposal projection. It SHALL NOT accept, reject, retry, reconcile, mutate expected versions, or determine availability.

#### Scenario: Review intent opens an available proposal
- **WHEN** the user activates a valid `request_review` intent
- **THEN** the Review pane reloads the current server-authored proposal and ActionDescriptor state
- **AND** Accept remains a separate explicit user action subject to permission, cost, expected-version, idempotency, and approval gates

#### Scenario: Proposal became stale or unavailable
- **WHEN** a review intent points to a proposal whose descriptor is stale, expired, superseded, permission-blocked, or `needs_contract`
- **THEN** the Review pane shows the current reason and recovery action
- **AND** the intent does not restore an old enabled Accept control

### Requirement: Tool and Owner mutations remain TaskService-authorized
No presentation intent SHALL invoke a tool, submit/cancel/reconcile a Task, accept a proposal, call an Owner adapter, change Provider, or claim a receipt. All mutation controls SHALL continue to use the existing server-authored ActionDescriptor and TaskService flow.

#### Scenario: Intent attempts to execute a tool
- **WHEN** an intent candidate contains a tool ID, operation type, raw tool arguments, or an execute/accept/retry instruction as an effect
- **THEN** validation rejects the execution effect
- **AND** the UI may only render an existing safe proposal/review projection if separately authorized

#### Scenario: Unknown accept output suggests retry
- **WHEN** Pi emits a presentation intent that would navigate to retry, submit a replacement, switch Provider, or fabricate cancellation for an `unknown_accept` Task
- **THEN** the resolver rejects that effect
- **AND** the affected session exposes only the original attempt's query/reconcile action

### Requirement: Intent outcomes are not execution receipts
Applied, suggested, rejected, expired, or deduplicated presentation-intent states SHALL be treated as UI diagnostics only. They SHALL NOT be recorded or displayed as Task success, Owner acceptance, proposal resolution, receipt, evidence, or business audit outcome.

#### Scenario: Pane opens successfully
- **WHEN** a valid intent opens a pane
- **THEN** the UI may record a bounded local diagnostic such as `applied`
- **AND** it does not emit a business success toast or alter Task/proposal/receipt state

#### Scenario: Intent fails to resolve
- **WHEN** an intent is rejected for unsupported kind, stale revision, scope mismatch, expiry, or unavailable resource
- **THEN** the base output and canonical Task state remain visible
- **AND** the UI presents only a safe reason and next action without echoing unsafe parameters

### Requirement: Presentation intent surfaces are accessible and non-disruptive
Intent suggestions, Follow Pi controls, automatic pane changes, and rejection states SHALL be keyboard operable, screen-reader understandable, text-labelled, and safe under reduced motion. Automatic effects SHALL NOT steal keyboard focus or trigger backend authorization on hover/focus.

#### Scenario: Keyboard user activates a suggestion
- **WHEN** a keyboard user focuses and activates a presentation suggestion
- **THEN** the resolver applies the same validation as pointer activation
- **AND** pane close restores focus to the activating control

#### Scenario: Automatic follow effect occurs
- **WHEN** Follow Pi applies a permitted live pane or safe-ref effect
- **THEN** the workspace announces a concise polite status without moving focus
- **AND** reduced-motion users receive the same state change without transform animation

#### Scenario: User previews an intent control
- **WHEN** a user hovers or focuses an intent suggestion or session-row preview
- **THEN** the UI shows only already-loaded safe explanatory text
- **AND** it does not fetch Owner data, prepare Context Pack state, resolve paid authorization, or execute any action
