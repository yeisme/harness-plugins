# workbench-ui-controls Specification Delta

## ADDED Requirements

### Requirement: Shared control primitives SHALL have one canonical implementation

The Workbench Web UI MUST provide a single canonical implementation for each shared control type under `apps/web/src/design-system/primitives/`. Feature code MUST NOT introduce a parallel hand-rolled implementation of a control that the design system provides, and MUST NOT import L0 base libraries (`@radix-ui/*`, `cmdk`) outside the design system. Duplicated legacy implementations (tablists, command palettes, dialogs, search boxes, native selects) MUST be migrated to the canonical controls, and each migration MUST remove the superseded implementation in the same change.

#### Scenario: A feature needs a dropdown
- **WHEN** a feature needs single-select dropdown behavior
- **THEN** it consumes the shared `Select` primitive from the design system
- **AND** it does not render a native `<select>` or a hand-rolled popover list

#### Scenario: A legacy hand-rolled tablist is replaced
- **WHEN** a hand-rolled tablist is migrated to the shared `Tabs` primitive
- **THEN** the legacy markup and its CSS are removed in the same change
- **AND** keyboard navigation, focus behavior, and truthful state display are not degraded

#### Scenario: Feature code imports a base primitive directly
- **WHEN** code outside `design-system/` imports `@radix-ui/*` or `cmdk` directly
- **THEN** the primitives contract test fails
- **AND** the only permitted exceptions are entries in an explicit, shrinking migration allowlist

### Requirement: Buttons and icon actions SHALL expose explicit variants, states, and disabled reasons

The shared `Button` and `IconButton` primitives MUST support explicit `variant` and `size` enumerations instead of stacked boolean props. An icon-only action MUST have a stable accessible name. A control disabled because of business state MUST expose a `disabledReason` rendered through the shared tooltip, and MUST NOT rely on color or opacity alone.

#### Scenario: A destructive action is rendered
- **WHEN** a feature renders an irreversible or destructive action
- **THEN** it uses the `danger` variant of the shared `Button`
- **AND** asynchronous pending, receipt, and reconcile states remain expressed by the `ActionRecovery` composite rather than a fake success state on the button

#### Scenario: An action is disabled by permission or contract state
- **WHEN** an action is disabled because of `permission_required`, `needs_contract`, or another server-projected reason
- **THEN** the control renders the disabled state with the declared reason
- **AND** the reason is reachable by keyboard and assistive technology

### Requirement: Text entry controls SHALL share one input, search, and multiline contract

The design system MUST provide `Input`, `TextArea`, and `SearchBox` primitives with a shared state matrix (default, hover, focus-visible, disabled, readonly, invalid, loading). `SearchBox` MUST provide a clear control, an optional loading indicator, and an optional focus hotkey registered in the shared shortcuts registry; it MUST NOT bind global key handlers on its own. All user-visible control copy MUST go through the project i18n catalogs.

#### Scenario: A search field has an active query
- **WHEN** a `SearchBox` contains a non-empty value
- **THEN** a keyboard-reachable clear control with an accessible name is rendered
- **AND** pressing Escape clears the value and keeps focus in the field

#### Scenario: A search field uses a focus hotkey
- **WHEN** a `SearchBox` declares a focus hotkey
- **THEN** the hotkey is registered in `design-system/guidance/shortcuts.ts`
- **AND** the control does not attach its own window-level keydown listener

### Requirement: Selection controls SHALL cover single, multiple, and searchable selection through approved primitives

The design system MUST provide `Select`, `MultiSelect`, `Combobox`, `Checkbox`, `RadioGroup`, and `Switch` built on approved accessible primitives. `Combobox` MUST be the single entry point for searchable or asynchronously loaded option lists, with explicit `loading`, `empty`, and `error` props instead of inferred states. `Switch` MUST be reserved for immediately effective settings; actions requiring confirmation or asynchronous receipts MUST use other controls.

#### Scenario: A user selects many items from a long list
- **WHEN** a feature offers selection from a large or asynchronously loaded option set
- **THEN** it uses the shared `Combobox`
- **AND** loading, empty, and error states are rendered from explicit props, never guessed from promise state

#### Scenario: A multi-select summarizes its value
- **WHEN** a `MultiSelect` has selected values
- **THEN** the trigger renders a localized summary instead of a wall of chips
- **AND** the popup offers select-all and clear actions

#### Scenario: A switch writes asynchronously
- **WHEN** a `Switch` change triggers an asynchronous write
- **THEN** the control renders a loading state that prevents repeated toggling
- **AND** failure rollback follows the server projection or receipt rather than a locally assumed outcome

### Requirement: Tabs and pane chrome SHALL use one shared implementation and interaction contract

The design system MUST provide a shared `Tabs` primitive built on the approved tabs primitive, supporting `line` and `pill` variants, automatic and manual activation, and overflow handling that scrolls or collapses into a menu without truncating tab labels. Pane chrome (`PaneChrome`, `PaneTabs`, `PaneToolbar`) MUST be composed from shared controls; pane layout, docking, and lifecycle semantics remain governed by the pane interaction model and are not redefined by the control library.

#### Scenario: A pane dock renders tabs
- **WHEN** the agent pane dock renders pane tabs
- **THEN** it uses the shared `PaneTabs` built on the shared `Tabs` primitive
- **AND** open, close, focus, and overflow behavior follows the pane interaction model

#### Scenario: Tabs overflow the available width
- **WHEN** the tab strip exceeds its container width
- **THEN** overflow tabs remain reachable through scrolling or an overflow menu
- **AND** no tab label is silently truncated or dropped

### Requirement: Overlay controls SHALL use approved accessible primitives with shared motion recipes

`Dialog`, `Popover`, `DropdownMenu`, `Tooltip`, and the `CommandPalette` composite MUST be built on approved accessible primitives and MUST consume the shared motion recipe classes. Destructive or confirmation dialogs MUST use alertdialog semantics with explicit confirm and cancel actions. Tooltips MUST be the only informational hint mechanism; native `title` attributes MUST NOT be used. There MUST be exactly one `CommandPalette` implementation composed from the shared `Dialog` and `Combobox`.

#### Scenario: A confirmation dialog opens
- **WHEN** a destructive or irreversible action requires confirmation
- **THEN** the shared `Dialog` renders with alertdialog semantics and explicit confirm and cancel controls
- **AND** closing the dialog returns focus to the opening trigger

#### Scenario: A command palette is opened from any surface
- **WHEN** a user opens a command palette in the shell, a pane, or a domain workspace
- **THEN** the same shared `CommandPalette` composite handles the interaction
- **AND** filtering, keyboard navigation, and dismissal behavior are identical across surfaces

### Requirement: Shared controls SHALL consume semantic tokens and the density rhythm only

Control styles MUST consume `--wb-*` semantic tokens exclusively. Control CSS MUST NOT contain literal hex or rgba color values, references to physical `--color-*` tokens, literal animation durations, or private spacing scales beyond the shared 4px-based rhythm. Control typography MUST follow the shared type steps and the 24px row rhythm.

#### Scenario: A new control is added to the design system
- **WHEN** a new primitive adds a stylesheet
- **THEN** every color, spacing, radius, elevation, and motion value resolves to a `--wb-*` token
- **AND** the primitives contract test rejects literal colors, physical token references, and literal durations

### Requirement: Shared controls SHALL define keyboard, focus, and boundary behavior

Every shared interactive control MUST document and test its keyboard interaction, focus order, focus return, and boundary behavior. Keyboard behavior MUST come from the approved base primitives; feature code MUST NOT hand-roll focus traps, overlay positioning, or global keydown routing. State MUST NOT be communicated by color alone.

#### Scenario: A user navigates a select with the keyboard
- **WHEN** a user operates a `Select`, `Combobox`, or `DropdownMenu` with the keyboard
- **THEN** typeahead, arrow-key navigation, Home/End, and Escape behave according to the approved primitive
- **AND** on close, focus returns to the trigger

#### Scenario: A control renders a disabled or error state
- **WHEN** a control is disabled, invalid, or loading
- **THEN** the state is expressed through a combination of text, icon, or structure in addition to color
- **AND** assistive technology announces the state and its reason where one exists

### Requirement: The control library SHALL provide deterministic gallery evidence and regression gates

Every shared control MUST register fixtures in the design-system gallery covering its full state matrix, including mobile and reduced-motion variants, using safe static fixtures without Owner, Provider, or credential access. The project MUST maintain a primitives contract test that rejects new direct base-library imports, hand-rolled tablists, and native selects outside the design system, with any migration allowlist shrinking to zero before the change closes.

#### Scenario: A reviewer inspects a control state
- **WHEN** a reviewer opens the gallery entry for a shared control
- **THEN** every documented state is inspectable at fixed desktop and mobile viewports
- **AND** the fixtures require no external Owner, Provider, or production access

#### Scenario: A regression gate runs in CI
- **WHEN** the primitives contract test runs
- **THEN** new direct `@radix-ui/*` or `cmdk` imports outside the design system fail the suite
- **AND** hand-rolled tablists and native `<select>` elements outside the design system fail the suite once the migration allowlist is empty
