# workbench-ui-visual-language Specification

## Purpose
TBD - created by archiving change workbench-ui-visual-refresh-r1. Update Purpose after archive.
## Requirements
### Requirement: Workbench UI SHALL use a shared radius scale

The Workbench Web UI MUST express corner radius through the shared semantic scale: `--wb-radius-sm` (6px, chips and badges), `--wb-radius-control` (10px, buttons, inputs, select triggers, list rows), `--wb-radius-panel` (12px, pane containers and panels), `--wb-radius-overlay` (14px, dialogs, command palette, popovers, sheets), and `--wb-radius-pill` (switches and small badges only). Component and feature CSS MUST NOT introduce literal radius values outside this scale.

#### Scenario: A new panel is added
- **WHEN** a feature adds a pane container or panel
- **THEN** it uses the panel radius token
- **AND** it does not introduce a literal `border-radius` value

#### Scenario: A new overlay is added
- **WHEN** a feature adds a dialog, popover, or sheet
- **THEN** it uses the overlay radius token
- **AND** pill radius is not applied to large containers or primary buttons

### Requirement: Workbench UI SHALL layer surfaces in four levels

The Workbench Web UI MUST express surface hierarchy as four ordered levels — canvas, rail/sidebar, panel, and elevated/popover — each successively lighter, consumed through `--wb-surface-*` semantic tokens. Pane containers and independent panels MUST render with the panel radius, a 1px low-alpha border, and the shared elevation treatment. Nested card walls (border + background + radius + shadow stacked inside a panel) MUST NOT be introduced.

#### Scenario: The agent shell renders its regions
- **WHEN** the agent workspace renders rail, sidebar, conversation, and pane dock
- **THEN** each region maps to its surface level through semantic tokens
- **AND** the levels remain visually ordered from darkest to lightest

#### Scenario: Content is grouped inside a panel
- **WHEN** content inside a panel needs grouping
- **THEN** whitespace and hairline separators are used instead of nested rounded cards with shadows

### Requirement: Overlays SHALL use soft dark elevation

Dialogs, command palettes, popovers, menus, and sheets MUST consume the shared `--wb-elevation-*` tokens, which provide soft multi-layer dark shadows, plus the shared elevated border token. Glass blur, radial gradients, and decorative colored shadows MUST NOT be used in the persistent shell.

#### Scenario: A dialog opens over the workspace
- **WHEN** a dialog or command palette opens
- **THEN** it renders with the overlay radius, the elevated border, and the shared modal elevation
- **AND** no backdrop blur or gradient is introduced

### Requirement: Accent color SHALL be applied sparingly through tints

Solid accent fills MUST be reserved for the primary call to action. Selection, focus, active tabs, and links MUST use the shared accent tint (`--wb-accent-tint`, a 12–16% color-mix), text color, or the focus ring. Status chips and badges MUST use a tinted background (~14% color-mix of the status color) with colored text, not solid status fills or outlined pills.

#### Scenario: A row is selected in a list
- **WHEN** a list or rail row becomes selected
- **THEN** it renders a rounded row with the accent tint or selected surface
- **AND** the accent color is not applied as a large solid fill

#### Scenario: A status badge renders
- **WHEN** a status or permission badge renders
- **THEN** it uses a tinted background with colored text at the small radius
- **AND** the status meaning remains distinguishable without color alone

### Requirement: List and pane icons MAY use tinted icon tiles

Icons that lead list items, pane tabs, or file entries MAY render inside an 8px rounded tile whose background is a low-alpha color-mix of the semantic color. Icons MUST still resolve through the shared icon registry, and emoji or filled brand icons MUST NOT be used.

#### Scenario: A pane list renders leading icons
- **WHEN** a pane catalog or file list renders leading icons
- **THEN** icons resolve through the semantic registry
- **AND** tiles, when present, use the shared small radius and a low-alpha tint background

### Requirement: The visual refresh SHALL provide refreshed visual evidence

The project MUST regenerate the component gallery screenshot baselines (three viewports plus reduced-motion) after the refresh, MUST review key surfaces (agent shell, command palette, dialog, and one console surface) side by side against the Eikona reference image, and MUST record the review in the change's review report. The visual blacklist remains in force: no hero sections, KPI card walls, meaningless gradients, heavy glass, random emoji, nested card walls, or unexplained disabled actions.

#### Scenario: A reviewer audits the refreshed shell
- **WHEN** the reviewer compares the refreshed agent shell against the reference image
- **THEN** the radius scale, surface layering, and accent tint usage match the documented scale
- **AND** every visual blacklist item remains absent

