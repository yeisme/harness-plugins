# dsh-3d-director-gltf-workbench Specification

## ADDED Requirements

### Requirement: Shot anchored 3D preview
The system SHALL represent each editable preview through a Shot reference and SHALL expose camera, frame range, keyframes, object transforms, and visibility as the v1 editable surface.

#### Scenario: Select a Shot
- **WHEN** a user selects a Shot from the canvas or navigation
- **THEN** the 3D viewport, timeline, inspector, and canvas binding SHALL converge on the same Shot revision.

### Requirement: glTF and GLB capability contract
The system SHALL accept glTF JSON and GLB containers, report capability per official extension, and SHALL preserve unsupported extension payloads as opaque data when round-trip is possible.

#### Scenario: Unsupported extension is imported
- **WHEN** an asset contains an extension without editable support
- **THEN** the asset SHALL remain loadable, the capability SHALL be marked `opaque-preserved`, and the UI SHALL explain that the extension is not editable.

### Requirement: Versioned scene graph snapshots
The system SHALL persist edits as versioned workbench scene graph revisions and SHALL export only validated glTF/GLB snapshots.

#### Scenario: Export loses fidelity
- **WHEN** an export cannot preserve a resource or extension
- **THEN** export SHALL be blocked with a capability gap and SHALL NOT silently discard data.

### Requirement: Auditable generation change sets
The system SHALL represent node-level and whole-scene generation as separate auditable change sets containing safe input references, artifact/preview references, a digest, status, and rollback reference.

#### Scenario: Accept generated change
- **WHEN** the user accepts a generated change set
- **THEN** the system SHALL create a new scene graph revision and retain the prior revision for rollback.

### Requirement: Canvas and viewport synchronization
The system SHALL synchronize selection, focus, Shot identity, and revision status between the infinite canvas and the 3D viewport without transmitting credentials, raw prompts, provider payloads, or arbitrary fetch targets.

#### Scenario: Focus an object from the canvas
- **WHEN** a user selects a scene object node on the infinite canvas
- **THEN** the 3D viewport SHALL focus and highlight the corresponding object, and the inspector SHALL show the same Shot revision.

### Requirement: Conflict freeze
The system SHALL validate the base revision before mutation and SHALL freeze writes on mismatch until an owner reconcile action is available.

#### Scenario: Remote revision changed
- **WHEN** the owner revision differs from the workbench base revision
- **THEN** mutation controls SHALL be disabled, the difference SHALL be summarized, and no automatic overwrite or retry SHALL occur.
