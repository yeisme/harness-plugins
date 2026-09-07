# workbench-agent-composer-triggers Specification

## Purpose
TBD - created by archiving change workbench-agent-composer-triggers-r1. Update Purpose after archive.
## Requirements
### Requirement: The composer SHALL open the command menu on a leading slash

Typing `/` as the first token of an empty draft or at the start of a line MUST open the same command menu as the composer `+` button. Typed characters after `/` MUST filter the command list. The menu MUST support arrow-key navigation, Enter to select, and Escape to close while preserving the typed text. Selecting a command MUST execute only the declared existing callback and MUST remove the `/query` text from the draft. A `/` that is not a leading token (for example inside a URL or path) MUST NOT open the menu.

#### Scenario: A user types a slash in an empty composer
- **WHEN** the user types `/` in an empty composer
- **THEN** the command menu opens with all declared commands
- **AND** typing additional characters filters the list

#### Scenario: A user dismisses the command menu
- **WHEN** the user presses Escape with the command menu open
- **THEN** the menu closes, focus returns to the composer, and the typed text is preserved

#### Scenario: A slash appears inside text
- **WHEN** the user types `/` inside an existing word, URL, or path
- **THEN** the command menu does not open

### Requirement: The composer SHALL provide an at-mention picker over server-authorized safe refs

Typing `@` MUST open a picker listing only server-authorized context objects (the attached context pack's `objects`, each rendered with its `summaryLabel`, `type`, and mono `ref`). The picker MUST NOT list objects that have no server-authorized source. When no context pack is attached, the picker MUST render a truthful empty state with the declared prepare action instead of fabricating objects.

#### Scenario: A user mentions an object
- **WHEN** the user types `@` and selects an object from the picker
- **THEN** the object becomes an explicit reference chip in the draft, deduplicated by ref, with an accessible remove action
- **AND** the `@query` text is replaced by the chip

#### Scenario: No context pack is attached
- **WHEN** the user opens the `@` picker without an attached context pack
- **THEN** the picker shows a truthful empty state and the prepare-context action
- **AND** no fabricated object entries are rendered

### Requirement: At-mention selections SHALL drive the next explicit context preparation

The explicit reference set chosen through `@` mentions MUST replace the hardcoded selection fixture as the `selections` of the next user-initiated context-pack preparation. When the user has made no `@` selection, the existing default preparation behavior MUST remain unchanged. Mentioning MUST NOT silently prepare, attach, refresh, or submit anything.

#### Scenario: A user prepares context after mentioning objects
- **WHEN** the user has selected one or more `@` references and triggers prepare context
- **THEN** the prepare request carries exactly the selected refs as selections
- **AND** the attachment still completes only through the existing server-authorized flow

#### Scenario: A user prepares context without any mention
- **WHEN** the user triggers prepare context without any `@` selection
- **THEN** the request behaves exactly as before this capability existed

### Requirement: Hash and dollar triggers SHALL NOT be fabricated

The composer MUST NOT implement `#` or `$` pickers until a backing server contract exists. Typing `#` or `$` MUST insert plain text without opening any picker.

#### Scenario: A user types a hash or dollar sign
- **WHEN** the user types `#` or `$` in the composer
- **THEN** the character is inserted as plain text
- **AND** no picker, menu, or suggestion opens

