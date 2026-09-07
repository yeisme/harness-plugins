# workbench-agent-ui-unification Specification

## Purpose
TBD - created by archiving change workbench-agent-ui-unification-v1. Update Purpose after archive.
## Requirements
### Requirement: Agent-first shell SHALL expose one stable visual hierarchy

The `/agent` shell MUST present a desktop rail, an optional collapsible session rail, the Agent conversation/composer anchor, and a Spatial or registered Pane surface using one shared hierarchy. Spatial Focus MUST use the center canvas plus one shared context rail; Lens renderers MUST NOT add a competing fixed-width business sidebar. The conversation and composer MUST remain mounted or recoverable when the mode or Pane layout changes.

#### Scenario: User enters ordinary Agent mode
- **WHEN** a user opens `/agent` without trusted Spatial ingress
- **THEN** the conversation and composer are the primary visual surface
- **AND** the session rail and Pane entry remain discoverable without adding a second shell

#### Scenario: User enters Spatial Focus
- **WHEN** a trusted project or Spatial ingress selects Spatial Focus
- **THEN** the canvas becomes the primary surface and the conversation/composer remain available in the same layout state
- **AND** Detail, Inspector, Review and Evidence use the shared context rail rather than independent floating business panels

#### Scenario: User changes mode with an open Pane
- **WHEN** a user switches between Conversation, Split and Spatial Focus
- **THEN** the active Pane document, composer draft, selected safe refs and focus-return trigger remain recoverable
- **AND** no Task, proposal, Owner subscription or second event stream is created solely by the layout change

### Requirement: Shared UI slots SHALL use one token and chrome contract

The Agent shell and every registered Pane MUST use the shared design-system tokens and semantic chrome slots for surface, spacing, typography, radius, status color, focus, toolbar, empty state and recovery action. A Pane header MUST have one title, secondary technical metadata, status and bounded actions; an implementation MUST NOT introduce a local visual vocabulary for the same semantic state.

#### Scenario: A Pane frame renders
- **WHEN** a registered Pane is mounted on desktop or in a mobile Sheet
- **THEN** its title, status, metadata and actions use the shared Pane frame and toolbar slots
- **AND** duplicate eyebrow/title labels and ad-hoc spacing are absent

#### Scenario: A shared status is shown in multiple surfaces
- **WHEN** the same capability state is relevant to the composer, Pane and Spatial surface
- **THEN** one surface owns the primary explanation and other surfaces use a compact linked indicator
- **AND** the user is not shown repeated full warning blocks for the same state

#### Scenario: A visual state changes
- **WHEN** a control changes from ready to disabled, loading, stale or degraded
- **THEN** the state uses the shared semantic status mapping and focus treatment
- **AND** no gradient, heavy glass, decorative glow or status-only color dependency is introduced

### Requirement: Cross-region coordination SHALL be explicit and focus-safe

Selection, context attachment, Pane opening and Agent presentation intent MUST communicate only through validated safe refs and explicit user actions. Selecting an object MUST NOT automatically write to the composer, attach a Context Pack, submit a Task or move keyboard focus. Presentation suggestions MAY be displayed, but activation MUST revalidate the current session, source, capability, expiry and Pane registry.

#### Scenario: User selects a Spatial object
- **WHEN** a user selects a canonical or Draft object on the Spatial surface
- **THEN** the shared context rail updates with the selected safe projection
- **AND** the composer remains unchanged until the user explicitly adds the reference

#### Scenario: User activates a Pane suggestion
- **WHEN** a user explicitly activates a validated `open_pane` or `show_evidence` suggestion
- **THEN** the requested Pane opens or focuses through the canonical registry
- **AND** keyboard focus remains on the user-triggered control unless the existing responsive Sheet contract requires focus containment

#### Scenario: A suggestion is replayed or stale
- **WHEN** an intent is replayed, expired, scope-mismatched, unavailable or based on a stale Context Pack revision
- **THEN** the UI keeps the base output visible and shows a bounded rejection reason
- **AND** no Context, Proposal, Task or Owner mutation call is made

### Requirement: Unavailable and empty states SHALL provide truthful local recovery

`needs_contract`, `permission_required`, `offline`, `stale`, `unknown_accept` and degraded renderer states MUST remain visible at their point of use. Each state MUST explain user impact in localized domain language, expose at most one primary recovery action, and keep technical reason codes in a secondary disclosure. Empty conversation, empty session directory and empty Spatial projection MUST provide one real next action without fake data or duplicate composer affordances.

#### Scenario: A Spatial capability needs a contract
- **WHEN** the Spatial projection reports `needs_contract`
- **THEN** the canvas retains its structural surface and shows an inline status block with the impact and one contract/retry recovery action
- **AND** it does not render synthetic nodes, fake success or an unrelated global alert as the only explanation

#### Scenario: A selected projection is offline or stale
- **WHEN** a Pane or Lens cannot refresh its current projection
- **THEN** the UI preserves the last-confirmed safe summary when available, labels freshness truthfully and disables actions requiring a current revision
- **AND** the recovery action is retry, refresh or re-authorize according to the server-authored state

#### Scenario: A new session has no turns
- **WHEN** the conversation is empty
- **THEN** the empty state offers one real start action while the composer remains the single input surface
- **AND** it does not add demo turns, synthetic Spatial objects or a second attach-context control

#### Scenario: All registered capabilities are ready
- **WHEN** no capability reports an unavailable or degraded state
- **THEN** no availability warning block occupies shell space

### Requirement: User-facing copy SHALL be Chinese-first with technical metadata demoted

Navigation, controls, statuses, recovery explanations and empty-state guidance MUST use the active Chinese locale by default and provide the existing English locale through the same keys. `sessionRef`, Task, receipt, version, Pane/Lens type, contract identity and other stable technical values MAY remain English, but MUST be secondary muted mono metadata and MUST NOT be the primary label of a user-facing row.

#### Scenario: Agent shell renders in Chinese
- **WHEN** the active locale is `zh-CN`
- **THEN** primary labels, status explanations and recovery actions are Chinese and use stable generated message keys
- **AND** technical refs remain copyable secondary metadata

#### Scenario: User switches to English
- **WHEN** the user selects `en-US`
- **THEN** the same hierarchy, state semantics, aria labels and action availability remain unchanged
- **AND** only localized copy changes

#### Scenario: A new UI message is added
- **WHEN** a new Agent, Pane or Spatial message is required
- **THEN** it is added to the locale source modules and generated catalogs for both supported locales
- **AND** inline literals are not used as the primary delivery path

### Requirement: The unified shell SHALL meet the existing responsive and accessibility matrix

The implementation MUST preserve the existing responsive contract: at least 1440×960 desktop, 1024×768 tablet, 390×844 mobile, 200% effective-width verification, keyboard operation, reduced motion, focus restoration, focus containment for Sheets, and no page-level horizontal overflow. Visual consistency MUST be verified with the real `/agent` route and registered Pane states, not only isolated component snapshots.

#### Scenario: Desktop acceptance
- **WHEN** the unified shell is tested at 1440×960
- **THEN** conversation/composer, session rail, Spatial canvas and one shared context rail satisfy the intended hierarchy
- **AND** the shell supports opening, focusing, closing and recovering registered Panes without silent replacement

#### Scenario: Tablet and mobile acceptance
- **WHEN** the shell is tested at 1024×768 or 390×844
- **THEN** the context rail/session rail follows the Sheet rules and the composer remains usable
- **AND** the full Spatial editor is not mounted below the desktop threshold

#### Scenario: Keyboard and reduced-motion acceptance
- **WHEN** a keyboard-only user or a user with reduced motion operates the shell
- **THEN** every visible action has an accessible name and non-drag equivalent, overlays restore focus and camera/layout transitions settle without essential animation
- **AND** Axe serious/critical findings and page-level overflow are zero

### Requirement: Screenplay Room SHALL reuse unified shell semantics

Screenplay Room headers, toolbars, status, unavailable/empty states, recovery, context rail, technical metadata, icons, locale and responsive behavior SHALL use the existing shared Workbench contracts. Domain-specific Scene/Beat cards MAY add layout primitives but MUST NOT create a parallel token family or duplicate capability warning.

#### Scenario: Auctra becomes stale while a Scene is open

- **WHEN** the room projection or Scene draft revision becomes stale
- **THEN** the active Scene surface SHALL own the primary stale explanation and one refresh/compare action
- **AND** composer, rail and other panes SHALL use compact linked indicators rather than repeated warning cards.

