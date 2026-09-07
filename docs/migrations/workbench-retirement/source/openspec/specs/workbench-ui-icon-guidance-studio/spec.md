# workbench-ui-icon-guidance-studio Specification

## Purpose
Define how Studio surfaces apply the Workbench icon-guidance contract across desktop, touch, evidence, and uncertain-result states.

## Requirements

### Requirement: Studio controls SHALL use application-level icon guidance

Studio icon-only or meaningfully ambiguous controls MUST use a semantic Workbench icon and the R1 guidance contract. They MUST retain a persistent accessible name and expose supplemental explanation on hover and keyboard focus. Preview, pane, fullscreen, maximize/restore, rail, focus, evidence, receipt, reconnect, and inspector controls MUST NOT add native `title` text or arbitrary business-surface Lucide selection.

#### Scenario: A Studio control is actionable

- **WHEN** a registered Studio control is enabled
- **THEN** its label is localized and persistent
- **AND** its tooltip contains the action and only a registered shortcut when applicable
- **AND** its `aria-keyshortcuts` value is sourced from the same registry

#### Scenario: A Studio control is unavailable or blocked

- **WHEN** the capability or presentation state makes the control unavailable
- **THEN** the guidance explains the real reason and suppresses the shortcut
- **AND** any recovery action is a separate visible control
- **AND** the control does not infer or fabricate a mutation path

### Requirement: Studio touch layouts SHALL expose explanation without hover

Studio mobile layouts MUST keep critical status, limitation, and next-step copy visible or reachable through a tappable `ContextualHelp`. The Activity reconnect action MUST expose the no-task reason inline when no task is selected. Event and receipt evidence regions MUST remain keyboard-scrollable.

#### Scenario: No Activity task is selected on mobile

- **WHEN** the Activity timeline has no selected Design task
- **THEN** reconnect is disabled with its real reason
- **AND** the same reason is visible inline and available through `ContextualHelp`
- **AND** no retry or resubmit action is implied

#### Scenario: A user opens a Studio preview on a touch viewport

- **WHEN** a safe file projection is selected
- **THEN** preview copy, maximize/restore, fullscreen availability, and close remain reachable
- **AND** the explanation does not rely on pointer hover

### Requirement: Studio evidence SHALL preserve state and data boundaries

Studio guidance MUST consume existing Design capability, Task status, receipt, and safe file projections. It MUST preserve `unknown_accept` as query/reconcile-only and MUST NOT expose credentials, private paths, provider payloads, signed URLs, or browser Authorization headers.

#### Scenario: The task result is `unknown_accept`

- **WHEN** the Activity projection reports `unknown_accept`
- **THEN** the UI offers the existing reconcile/coordination route
- **AND** it does not show retry, resubmit, success, or cancellation claims

#### Scenario: Browser evidence is captured

- **WHEN** the Studio route is exercised at the required fixed desktop, tablet, mobile, and reduced-motion viewports
- **THEN** hover/focus, shortcut parity, touch explanation, Axe, overflow, console/network, and redaction results are recorded
- **AND** the evidence is labeled separately from Owner, Provider, deployment, and production readiness
