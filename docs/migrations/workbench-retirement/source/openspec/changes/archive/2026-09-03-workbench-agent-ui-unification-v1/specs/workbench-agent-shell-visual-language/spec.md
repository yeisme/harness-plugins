## MODIFIED Requirements

### Requirement: Shell controls SHALL use shared primitives with ghost treatments and the row rhythm

Session filters, mode controls, header actions, composer actions, recovery actions and Pane actions in the `/agent` shell MUST be built from the design-system primitives (`SegmentedControl`, `Button`, `IconButton`, `TextArea`, `StatusChip`, `PaneChrome` or their registered composites). Header and secondary actions MUST use ghost styling with a 6–8px radius and shared focus/disabled tokens. Single-line tool and thinking rows MUST follow the 24px row rhythm, while larger state blocks MUST use the shared status/recovery slots rather than ad-hoc cards.

#### Scenario: The session filter is rendered
- **WHEN** the session rail renders its recent/pinned/unread/archived filter
- **THEN** the filter uses the shared `SegmentedControl` primitive and the current state is exposed through its accessible semantics
- **AND** an empty session list does not render a filter with no items to filter

#### Scenario: A header action is rendered
- **WHEN** an action such as attach-context, follow, retry, refresh or new-session is visible
- **THEN** it uses the shared primitive in ghost or primary form according to its semantic priority
- **AND** its accessible name, disabled reason and existing `aria`/`data-*` contracts remain stable

### Requirement: Visual restyling SHALL preserve accessible contracts and selectors

Visual restyling of the `/agent` shell MUST preserve existing aria attributes, accessible names, `data-*` selectors, i18n keys and state semantics. Restyling MUST NOT degrade truthful state display, keyboard behavior, reduced-motion behavior, focus restoration or the Chinese/English parity of generated messages. New shared components MUST wrap or replace local markup without creating a second transport or state owner.

#### Scenario: A restyled surface is tested
- **WHEN** existing component and browser tests run against the restyled shell
- **THEN** they pass without weakening aria, data-selector, capability or recovery assertions
- **AND** visual evidence shows one token vocabulary without boxed-card, gradient, heavy-glass or status-color-only treatments

#### Scenario: A technical ref is shown
- **WHEN** a sessionRef, Task, receipt or contract identity is rendered
- **THEN** it remains copyable secondary mono metadata
- **AND** the technical ref does not replace the localized human-readable title or recovery explanation
