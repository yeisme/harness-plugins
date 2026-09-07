# workbench-i18n-source-modules Specification

## Purpose
Define namespace-owned locale sources, deterministic composition, completeness, bootstrap, compatibility, and measurable migration gates for Workbench copy.

## Requirements

### Requirement: Locale copy SHALL have namespace-owned authoring fragments

The Workbench locale source SHALL be organized into stable domain namespaces for `zh-CN` and `en-US`. Each authored key SHALL have one owner fragment, and the key namespace SHALL match the declared fragment namespace.

#### Scenario: Chinese source is split without changing effective keys

- **WHEN** the existing locale catalog is moved from the monolithic source into domain fragments
- **THEN** the composed `zh-CN` key set SHALL equal the prior catalog key set exactly
- **AND** each key SHALL be attributable to exactly one namespace fragment

#### Scenario: Duplicate ownership is rejected

- **WHEN** two fragments declare the same fully qualified key
- **THEN** composition SHALL fail before generated assets are written
- **AND** the error SHALL identify the duplicate key and both fragment owners

### Requirement: Composition SHALL produce deterministic versioned assets

The locale composer SHALL emit the existing flat bundle shape, catalog shape, and typed Web message module using stable sorting and serialization. It SHALL NOT introduce runtime namespace fetches.

#### Scenario: Repeated composition is reproducible

- **WHEN** composition runs twice with unchanged source fragments
- **THEN** generated bundle bytes, catalog bytes, and digests SHALL be identical

#### Scenario: Stale generated assets are detected

- **WHEN** a source fragment changes without regenerating committed assets
- **THEN** `check:i18n` SHALL fail and identify the stale generated artifact

### Requirement: Placeholder and locale completeness rules SHALL be enforced

Every `zh-CN` catalog key SHALL have a value. An authored `en-US` entry SHALL use exactly the catalog placeholders and SHALL NOT introduce an unknown key. Missing `en-US` entries SHALL be reported as fallback candidates and SHALL resolve through the existing `en-US` to `zh-CN` fallback.

#### Scenario: Placeholder drift is rejected

- **WHEN** a fragment changes `{value}` to `{text}` for a registered key
- **THEN** composition or `check:i18n` SHALL fail before the bundle is accepted

#### Scenario: Missing English falls back safely

- **WHEN** an `en-US` key has no authored value
- **THEN** requesting `en-US` SHALL resolve that key to its `zh-CN` value
- **AND** the UI SHALL NOT render the raw key identifier

### Requirement: Bootstrap SHALL be a minimal offline-safe allowlist

The Web bootstrap source SHALL contain only copy required to render loading, offline, recovery, locale status, required navigation, and the Localization Pane shell before the server bundle is available. The provider SHALL expose degraded/offline status when the full bundle cannot be loaded.

#### Scenario: Server is unavailable during startup

- **WHEN** the locale bundle request fails
- **THEN** the browser SHALL render the bootstrap Chinese copy for the recovery path
- **AND** SHALL show a truthful degraded/offline state
- **AND** SHALL NOT claim that the full server bundle or project overlay was loaded

#### Scenario: Full page copy is not duplicated into bootstrap

- **WHEN** a new non-recovery page key is added
- **THEN** it SHALL be added to its domain fragment and composed bundle
- **AND** it SHALL not be silently copied into bootstrap without an explicit allowlist decision

### Requirement: Source modularization SHALL preserve the existing locale contract

Composition and source migration SHALL preserve locale normalization, bundle/catalog digests, project overlay key policy, protected keys, dynamic-value boundaries, and `locale.project_override.apply` Task semantics.

#### Scenario: Protected copy remains protected after composition

- **WHEN** a protected status, error, permission, security, or destructive-operation key is composed
- **THEN** its catalog entry SHALL remain `overridePolicy=protected`
- **AND** a project preview/apply SHALL continue to reject an override for that key

#### Scenario: Dynamic values remain untranslated

- **WHEN** a page renders an Owner name, ID, path, command, receipt, or user input
- **THEN** source modularization SHALL not route that value through a locale fragment as translatable copy
- **AND** the original value SHALL remain available for audit and operator action

### Requirement: Migration SHALL advance through measurable gates

The implementation SHALL track G0 baseline, G1 composition, G2 bootstrap, G3 core Web migration, and G4 full rendered-copy coverage as separate acceptance gates. A later gate SHALL NOT be declared complete using only source-file parity from an earlier gate.

#### Scenario: Core migration can ship independently

- **WHEN** G1 and G2 evidence pass but a remaining route lacks browser credential authority
- **THEN** the completed gates SHALL be recorded as passing
- **AND** the remaining route SHALL remain explicitly pending rather than being marked browser-verified
