# workbench-agent-shell-visual-language Specification Delta

## ADDED Requirements

### Requirement: The agent shell SHALL render timeline content as hairline sections, not boxed cards

The `/agent` conversation timeline MUST NOT render run, proposal, result, thinking, or tool entries with the `border + background + radius + shadow` boxed-card combination. Sections MUST be separated by hairline dividers and whitespace; semantic emphasis MUST use a 2px accent or status left bar. Status banners MUST use status-colored text or a small status dot with a thin divider, and MUST NOT render large status-colored background fills.

#### Scenario: A run card is rendered in the timeline
- **WHEN** a run, proposal, or result entry renders in the conversation timeline
- **THEN** it is separated by hairline dividers without a boxed border-plus-background card
- **AND** any semantic emphasis uses a 2px left bar or a status dot with text

#### Scenario: A warning or error banner is rendered
- **WHEN** a `StateBanner` communicates a warning, error, or blocked state
- **THEN** it uses status-colored text and a thin divider instead of a filled status background
- **AND** the underlying truthful state (for example `unknown_accept` or `needs_contract`) remains fully visible and is not weakened

### Requirement: Shell badges and chips SHALL use dot-and-text or hairline treatments

Badges, kind chips, basis-ref chips, context chips, and unread indicators in the `/agent` shell MUST use a status dot plus text or a hairline-background pill. Solid accent pills and filled background chips MUST NOT be used for status or metadata. Shared status rendering SHOULD reuse the design-system `StatusChip`.

#### Scenario: An unread count is shown in the session rail
- **WHEN** a session has unread activity
- **THEN** the indicator is a dot with a count, not a solid filled accent pill

#### Scenario: Tool availability chips are shown above the composer
- **WHEN** action descriptors such as `needs_contract` are listed above the composer
- **THEN** each chip uses a status dot plus text or a hairline pill
- **AND** the declared availability meaning is preserved

### Requirement: The shell SHALL keep availability display on demand and free of redundant affordances

The `/agent` shell MUST NOT render a permanent row of action-descriptor chips above the composer. Unavailable or `needs_contract` capabilities MUST remain truthfully reachable through a single compact indicator in the composer footer that expands to detail on demand. The shell MUST NOT duplicate the same affordance across header, empty state, and composer, and MUST NOT render filter controls when there is nothing to filter.

#### Scenario: Capabilities are missing contracts
- **WHEN** one or more action descriptors report `needs_contract` or another unavailable state
- **THEN** the composer footer shows one compact indicator with the count and dominant state
- **AND** expanding the indicator reveals each descriptor with its truthful status and declared recovery path
- **AND** no permanent chips row occupies space above the composer

#### Scenario: The session list is empty
- **WHEN** the session rail has no persisted sessions to filter
- **THEN** the filter control is not rendered
- **AND** the search and new-session actions remain available

#### Scenario: The empty conversation state is shown
- **WHEN** the conversation has no turns yet
- **THEN** the empty state renders one primary call to action without duplicating composer hints or attach-context affordances already present in the composer

### Requirement: Capability availability SHALL be presented in user-meaningful impact language

Availability surfaced to users MUST be expressed as domain-level impact with localized, human-readable domain names (for example 角色/场景/剧集), a truthful dominant status, and the declared recovery path. Raw operation identifiers (`character.get`) and reason codes (`needs_contract`) MUST NOT be primary user-facing content; they MAY appear only inside a clearly separated technical-details disclosure for operators. When every capability is ready, the surface MUST render nothing.

#### Scenario: Capabilities from several domains are unavailable
- **WHEN** capabilities spanning the character, scene, and episode domains report unavailable states
- **THEN** the summary and detail list each domain by its localized human-readable name with its dominant status
- **AND** no raw operation id or reason code appears in the primary list
- **AND** the technical-details disclosure still lists every operation id with its truthful status chip and reason code

#### Scenario: An operator opens technical details
- **WHEN** a user expands the technical-details disclosure
- **THEN** each affected operation id is shown with its availability chip, reason code, and declared recovery hint
- **AND** the disclosure is collapsed by default

#### Scenario: All capabilities are ready
- **WHEN** every action descriptor reports `ready`
- **THEN** no availability indicator, summary, or list occupies space in the shell

### Requirement: Shell controls SHALL use shared primitives with ghost treatments and the row rhythm

Session filters, header actions, composer actions, and pane actions in the `/agent` shell MUST be built from design-system primitives (`SegmentedControl`, `Button`, `IconButton`, `TextArea`). Header and secondary actions MUST use ghost styling that reveals a hover background, with a 6–8px radius. Single-line tool and thinking rows MUST follow the 24px row rhythm.

#### Scenario: The session filter is rendered
- **WHEN** the session rail renders its recent/pinned/unread/archived filter
- **THEN** the filter uses the shared `SegmentedControl` primitive
- **AND** selection state is exposed through the primitive's accessible semantics

#### Scenario: A header action is rendered
- **WHEN** a header action such as attach-context, follow, or new-chat renders
- **THEN** it uses a shared primitive in ghost form with hover-revealed background
- **AND** its accessible name and aria/data attributes remain unchanged

### Requirement: The composer MAY float with restrained elevation

The composer container MAY visually float above the canvas using a radius of at most 12px, a thin border, and a light shadow. It MUST NOT use heavy radius, glass blur, gradients, or decorative elevation.

#### Scenario: The composer renders at rest
- **WHEN** the composer is displayed in the `/agent` shell
- **THEN** its container radius is at most 12px with a thin border and light shadow
- **AND** no backdrop blur, gradient, or heavy shadow is applied

### Requirement: Agent shell icons SHALL resolve through the semantic registry

Code under `workbench/agent/**` MUST NOT import `lucide-react` directly. Pane icons, including the former private pane-icon mapping, MUST resolve through the design-system icon registry semantic names.

#### Scenario: A pane renders its icon
- **WHEN** an agent pane renders its pane-type icon
- **THEN** the icon resolves through the design-system registry
- **AND** no direct `lucide-react` import remains under `workbench/agent/**`

### Requirement: Visual restyling SHALL preserve accessible contracts and selectors

Visual restyling of the `/agent` shell MUST preserve existing aria attributes, accessible names, `data-*` selectors, and i18n keys. Restyling MUST NOT degrade truthful state display, keyboard behavior, or reduced-motion behavior.

#### Scenario: A restyled surface is tested
- **WHEN** existing component and e2e tests run against the restyled shell
- **THEN** they pass without changes to aria or data selector assertions
- **AND** visual evidence shows no boxed cards, gradients, or glass treatments in the main shell
