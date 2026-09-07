# workbench-ui-foundation Specification

## Purpose
Define the shared semantic tokens, icons, availability truth, responsive details, motion, control behavior, evidence, and Owner boundaries used across Workbench UI surfaces.

## Requirements

### Requirement: Workbench UI SHALL use a shared semantic foundation

The Workbench Web UI MUST provide one project-owned semantic token contract for canvas, surface, elevated surface, text, border, focus, accent, status, spacing, typography, radius, elevation, and motion. New shared components MUST consume semantic tokens and MUST NOT introduce feature-local hardcoded colors, spacing scales, or animation timings. Console, Spatial, Studio, and Eikona surfaces MAY map the semantic tokens to different visual treatments, but MUST preserve the same state and accessibility meanings.

#### Scenario: A new feature adds a shared panel
- **WHEN** a feature adds a panel, button, status, overlay, or Inspector using the shared foundation
- **THEN** it consumes the project semantic token contract
- **AND** it does not add a feature-local color, radius, spacing, or motion family

#### Scenario: A surface uses a different visual theme
- **WHEN** Studio or Spatial uses a surface-specific background or accent
- **THEN** it maps the shared semantic roles to that surface
- **AND** `blocked`, `unavailable`, `unknown`, `focus`, and `ready` retain their shared meanings

### Requirement: Workbench UI SHALL resolve icons through a semantic registry

The Workbench Web UI MUST expose a typed Icon registry over the existing Lucide icon source. The registry MUST provide semantic names for navigation, resource types, states, actions, and layout controls, plus `WorkbenchIcon`, `StatusIcon`, and `ActionIcon` wrappers. New domain feature code MUST NOT select business icons ad hoc from the underlying icon library. Primitive implementations MAY use explicit generic control icons such as close, chevron, and check.

#### Scenario: A feature renders a blocked resource
- **WHEN** the feature receives a `blocked` resource state
- **THEN** it resolves the state through the shared status mapping
- **AND** the rendered result includes a semantically appropriate icon, status text, and accessible description

#### Scenario: An icon-only action is rendered
- **WHEN** a feature renders an icon-only action
- **THEN** the action has a stable accessible name, visible focus state, and Tooltip when the action is not self-evident
- **AND** a disabled action exposes its disabled reason without relying on color alone

### Requirement: Workbench UI SHALL represent server-authored availability truthfully

Shared UI composites MUST distinguish `ready`, `running`, `stale`, `needs_contract`, `permission_required`, `unavailable`, `blocked`, `failed`, and `unknown_accept` when those states are present in the safe projection or action descriptor. The UI MUST NOT infer success, permission, health, terminal operation state, or retry availability from local cache, animation completion, HTTP success alone, or a missing field.

#### Scenario: An action is unavailable because a contract is missing
- **WHEN** an action descriptor returns `needs_contract`
- **THEN** the UI shows the missing contract or recovery reason
- **AND** it offers only the declared recovery or inspection action
- **AND** it does not render a fake disabled mutation with no explanation or a success state

#### Scenario: A mutation result is unknown
- **WHEN** the server returns `unknown_accept`
- **THEN** the UI preserves the operation/receipt context and offers reconcile or status inspection
- **AND** it does not automatically replay the mutation or render `cancelled`/`success` without server confirmation

### Requirement: Inspector and ContextDeck SHALL have one responsive interaction contract

The shared Inspector pattern MUST provide desktop pinned/overlay, tablet drawer, and mobile Sheet modes without duplicating the detail content. It MUST keep a single primary scroll region, preserve the page-owned selection and scope, restore focus to the opening trigger on close, and use modal behavior only for confirmation-class overlays. A non-modal context Inspector MUST NOT obscure the main workspace with an unnecessary scrim.

#### Scenario: Desktop selection opens an Inspector
- **WHEN** a user selects a resource at a viewport of at least 1280px
- **THEN** the shared Inspector opens at the configured desktop width
- **AND** the list/canvas retains its scope, filter, and selection context
- **AND** closing the Inspector returns focus to the opening trigger

#### Scenario: Mobile selection opens details
- **WHEN** a user selects a resource below the mobile breakpoint
- **THEN** the same Inspector content is presented through a Sheet or equivalent mobile panel
- **AND** the panel is keyboard reachable, scrollable, closable, and does not expose free docking controls

### Requirement: Workbench UI motion SHALL explain state changes and respect reduced motion

Shared UI motion MUST use CSS, Radix state attributes, or existing approved browser primitives by default. Standard motion MUST use the shared 120ms/180ms/240ms duration scale and calm easing. Motion MUST be short, interruptible, spatially coherent, and limited to state changes such as enter, exit, expand, collapse, selection, loading, success, failure, and recovery. The UI MUST support `prefers-reduced-motion: reduce` without removing content, status, focus, errors, or recovery actions.

#### Scenario: A Popover opens from an icon button
- **WHEN** the user opens a Popover or Menu
- **THEN** it enters from the trigger direction with the shared short transition
- **AND** Escape, outside click, focus behavior, and content availability are independent of animation completion

#### Scenario: Reduced motion is enabled
- **WHEN** the operating system requests reduced motion
- **THEN** nonessential transform and scale are removed or completed immediately
- **AND** the same content, state text, focus ring, error message, and recovery action remain available

#### Scenario: A list is filtered
- **WHEN** a list or table changes because of a filter or refresh
- **THEN** any transition uses stable keys and opacity/small transform only
- **AND** it does not animate the entire table height, move the focus target unexpectedly, or create layout shift

### Requirement: Shared controls SHALL define keyboard, focus, and boundary behavior

Every shared interactive control MUST specify its primitive, states, keyboard behavior, loading/empty/error/blocked behavior, focus return, and responsive substitution. Dialogs, Sheets, Popovers, Menus, and Tooltips MUST use the approved accessible primitives rather than hand-rolled focus traps or overlay positioning. Icon-only, disabled, destructive, and async controls MUST have an explicit accessible and recovery contract.

#### Scenario: A user navigates an Inspector with the keyboard
- **WHEN** the user tabs into an Inspector, Sheet, or Dialog
- **THEN** the focus order stays within the active surface according to its modal/non-modal contract
- **AND** Escape and the close control are available
- **AND** closing returns focus to the trigger or the documented fallback

#### Scenario: An async action is pending
- **WHEN** a declared action is submitting or reconciling
- **THEN** duplicate destructive submission is prevented
- **AND** the UI communicates the pending state without claiming a terminal result
- **AND** the user can reach the receipt, retry, or reconcile path declared by the server projection

### Requirement: The UI Foundation SHALL provide deterministic state evidence

The project MUST provide a read-only component gallery or fixed visual-test entry point that renders representative shared components and their `default`, `hover`, `focus`, `selected`, `loading`, `empty`, `error`, `blocked`, `unavailable`, `unknown`, mobile, and reduced-motion states. The evidence path MUST use safe fixtures or redacted projections and MUST NOT require Owner, Provider, credential, or production access.

#### Scenario: A reviewer opens the shared component evidence path
- **WHEN** the reviewer selects a shared component state
- **THEN** the component can be inspected at fixed desktop and mobile viewports
- **AND** the state does not depend on an external Owner or Provider call
- **AND** the control remains keyboard and accessibility testable

#### Scenario: Visual evidence is captured
- **WHEN** Playwright, component tests, or the project visual harness captures the foundation state
- **THEN** the evidence covers normal and reduced-motion modes for touched transitions
- **AND** console errors, failed requests, raw credentials, private paths, and provider payloads are absent

### Requirement: The UI Foundation SHALL remain additive to domain and Owner boundaries

The shared UI Foundation MUST consume typed safe projections, action descriptors, receipts, evidence refs, and declared capabilities. It MUST NOT add browser-to-Owner calls, read private Owner data, store credential or raw payload, create a second domain state machine, or expose an action that is not declared by the server-authoritative contract.

#### Scenario: A feature lacks a safe projection
- **WHEN** a page cannot obtain a safe projection or declared capability
- **THEN** the shared UI renders a truthful unavailable, forbidden, stale, or needs-contract state
- **AND** it does not fall back to raw response data, local fixtures, arbitrary URLs, or a second Owner client

#### Scenario: A shared component is reused by a domain page
- **WHEN** a domain page uses `StatusChip`, `DataState`, `InspectorLayout`, or `ContextDeck`
- **THEN** the page supplies typed view data and declared actions
- **AND** the shared component does not own the domain mutation, canonical state, permission decision, or receipt lifecycle
