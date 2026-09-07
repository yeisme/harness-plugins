# workbench-ui-icon-guidance Specification

## Purpose
Define semantic icon, shortcut, localized guidance, truthful state, keyboard, touch, and evidence behavior for Workbench application controls.

## Requirements

### Requirement: Workbench icon controls SHALL use semantic guidance

Workbench Shell, Agent, and Gateway icon-only or meaningfully ambiguous controls MUST use a typed semantic icon and an application-level guidance contract. The contract MUST provide a persistent accessible name and MUST expose the action explanation through the approved tooltip primitive on pointer hover and keyboard focus. New business-surface code MUST NOT select arbitrary Lucide components or add native `title` text as the primary explanation.

#### Scenario: An icon-only action is rendered

- **WHEN** a Shell, Agent, or Gateway surface renders an icon-only action
- **THEN** it resolves the icon through the typed Workbench registry
- **AND** it has a persistent accessible name, visible focus treatment, and supplemental hover/focus guidance
- **AND** its touch target is at least 44px in both dimensions

#### Scenario: A control has a visible text label

- **WHEN** a control already has an unambiguous visible action label
- **THEN** the UI does not add redundant tooltip text by default
- **AND** it may add `ContextualHelp` only when the action, limitation, or safety boundary needs explanation

### Requirement: Shortcut guidance SHALL come from a canonical registry

The UI MUST expose typed shortcut definitions containing a stable ID, normalized `aria-keyshortcuts`, platform display text, and scope. Tooltip or control copy MUST display a shortcut only when the action references a registered shortcut and the current state is actionable. Feature code MUST NOT inline shortcut display strings or raw `aria-keyshortcuts` values.

#### Scenario: A registered shortcut is actionable

- **WHEN** an enabled control references a shortcut registered for its current scope
- **THEN** its guidance includes the registry-provided platform display text
- **AND** its control exposes the registry-provided `aria-keyshortcuts` value

#### Scenario: A shortcut is not registered or the action is unavailable

- **WHEN** a control has no registered shortcut or is not currently actionable
- **THEN** its guidance does not imply that an unregistered or disabled keyboard action will work
- **AND** the UI displays the current reason or limitation instead

### Requirement: Guidance copy SHALL be localized and protected

All new action labels, tooltip text, shortcut display text, and critical state/reason copy MUST use `icon.*`, `tooltip.*`, `shortcut.*`, or `guidance.*` locale keys. Every new key MUST have `zh-CN` and `en-US` values or an explicit safe bootstrap fallback. Permission, error, unavailable, blocked, unknown, and destructive-operation copy MUST remain protected from project-level copy overrides.

#### Scenario: The locale bundle is available

- **WHEN** the active locale is `zh-CN` or `en-US`
- **THEN** the same guidance key resolves to the matching locale text
- **AND** no raw enum, English-only fallback, provider payload, credential, private path, or signed URL is shown

#### Scenario: The authoritative locale bundle is unavailable

- **WHEN** the locale bundle cannot be loaded
- **THEN** the bootstrap guidance remains actionable and safe
- **AND** critical status, permission, error, and destructive-operation wording is not replaced by arbitrary project copy

### Requirement: Guidance SHALL represent server-authored state truthfully

Guidance MUST reuse the existing Workbench status, capability, action availability, safe reason, and recovery projections. It MUST distinguish pending, stale, partial, permission-required, needs-contract, unavailable, blocked, failed, and `unknown_accept` states when those values are present. It MUST NOT infer success, retry availability, cancellation, health, or readiness from local cache, animation completion, missing fields, or HTTP success alone.

#### Scenario: An action is blocked or unavailable

- **WHEN** the safe projection declares permission, contract, unavailable, or blocked state
- **THEN** the icon guidance explains the declared reason
- **AND** it shows only a separately rendered recovery or inspection action declared by the projection
- **AND** it does not present an unexplained disabled icon or fabricate a mutation path

#### Scenario: A mutation result is unknown

- **WHEN** the state is `unknown_accept`
- **THEN** the guidance says that the result is unknown and offers query or reconcile only
- **AND** it does not display retry, resubmit, success, or cancellation language

### Requirement: Tooltip and help behavior SHALL work on keyboard and touch layouts

The guidance system MUST expose the same explanation on pointer hover and keyboard focus, preserve focus-visible behavior, and keep disabled reasons available to assistive technology. On touch/mobile layouts, critical state and reason MUST remain visible or be reachable through a keyboard-focusable/tappable `ContextualHelp`; the user MUST NOT need hover to understand why an action is unavailable. Nonessential tooltip motion MUST follow the shared reduced-motion contract.

#### Scenario: A user focuses an icon action with the keyboard

- **WHEN** the user tabs to an icon-only action
- **THEN** the control receives a visible focus ring
- **AND** the same guidance available on hover is exposed to the focused control
- **AND** closing or leaving an overlay does not lose the documented focus return behavior

#### Scenario: A user views an unavailable action on mobile

- **WHEN** a mobile viewport cannot provide hover
- **THEN** the unavailable state and reason remain visible or are available through `ContextualHelp`
- **AND** the next action, if declared, is a separate reachable control
- **AND** enabling reduced motion does not remove the state, reason, focus, or recovery action

### Requirement: The first migration SHALL preserve domain and evidence boundaries

The guidance layer MUST remain UI-only. It MUST consume typed safe projections and declared actions without creating browser-to-Owner calls, reading private data, storing credentials or provider payloads, or owning Task/Agent/Gateway state transitions. The change MUST provide focused and fixed-viewport evidence separately from Owner, Provider, deployment, and production acceptance.

#### Scenario: A surface lacks a safe action projection

- **WHEN** a surface cannot obtain a declared capability or safe action descriptor
- **THEN** the UI renders a truthful unavailable, forbidden, stale, or needs-contract explanation
- **AND** it does not enable a guessed action or fall back to raw response data

#### Scenario: Browser evidence is captured

- **WHEN** the first migration is verified at fixed desktop, tablet, mobile, and reduced-motion viewports
- **THEN** hover/focus/keyboard/touch behavior, Axe checks, overflow, console/network, and redaction results are recorded
- **AND** the evidence does not claim Owner, Provider, deployment, or production readiness
