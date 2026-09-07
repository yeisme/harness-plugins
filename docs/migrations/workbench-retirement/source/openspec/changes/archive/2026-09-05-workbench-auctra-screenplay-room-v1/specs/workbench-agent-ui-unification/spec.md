## ADDED Requirements

### Requirement: Screenplay Room SHALL reuse unified shell semantics

Screenplay Room headers, toolbars, status, unavailable/empty states, recovery, context rail, technical metadata, icons, locale and responsive behavior SHALL use the existing shared Workbench contracts. Domain-specific Scene/Beat cards MAY add layout primitives but MUST NOT create a parallel token family or duplicate capability warning.

#### Scenario: Auctra becomes stale while a Scene is open

- **WHEN** the room projection or Scene draft revision becomes stale
- **THEN** the active Scene surface SHALL own the primary stale explanation and one refresh/compare action
- **AND** composer, rail and other panes SHALL use compact linked indicators rather than repeated warning cards.
