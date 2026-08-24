/**
 * Client-side types for agent preset Preview panel.
 *
 * These types match the dsh.composition.preview.v0 envelope structure
 * but are filtered for safe client display.
 */

/**
 * Tool projection as shown in Preview panel.
 */
export interface ToolProjection {
  /** Tool name */
  name: string
  /** Schema digest (sha256) */
  schema_digest: string
  /** Source plugin identifier */
  source_plugin: string
  /** Source layer (preset/registry) */
  source_layer: 'preset' | 'registry'
}

/**
 * Prompt section projection as shown in Preview panel.
 * Deliberately omits section text content.
 */
export interface PromptSectionProjection {
  /** Section identifier */
  id: string
  /** Section content digest (sha256) */
  section_digest: string
  /** Source plugin identifier */
  source_plugin: string
}

/**
 * Projection unit as shown in Preview panel.
 */
export interface ProjectionUnit {
  /** Unit key */
  key: string
  /** Source identifier */
  source: string
}

/**
 * Permission档 display.
 */
export interface PermissionPreset {
  /** Sandbox mode */
  sandbox_mode: 'default' | 'strict' | 'open'
  /** Approval policy */
  approval_policy: 'default' | 'conservative' | 'permissive'
  /** Contrib source */
  contrib_source: 'official' | 'community' | 'local'
}

/**
 * Three-layer health status.
 */
export interface HealthStatus {
  /** Shape health: roster discovery says this preset is parseable */
  shape_ok: boolean
  /** Mount health: standingKeyFor succeeded */
  mount_ok: boolean
  /** Failure reason if mount failed */
  reason?: 'unscoped' | 'unusable_row' | 'root_realm_service' | 'broken' | string
  /** Provable mount reference (generation + stamp) when mount succeeded */
  provable_mount_ref?: string
}

/**
 * Drift status for copied presets.
 */
export interface DriftStatus {
  /** Drift state */
  state: 'none' | 'unknown' | 'diverged'
  /** Source preset id if lineage exists */
  source_id?: string
  /** Source digest from lineage */
  source_digest?: string
  /** Current copy digest */
  copy_digest?: string
}

/**
 * Composition projection summary for Preview display.
 */
export interface CompositionSummary {
  /** Tools list */
  tools: ToolProjection[]
  /** Prompt sections list */
  prompt_sections: PromptSectionProjection[]
  /** Projection units */
  projection_units: ProjectionUnit[]
  /** Permission preset */
  permissions: PermissionPreset
}

/**
 * Preset metadata shown in Preview.
 */
export interface PresetMetadata {
  /** Preset identifier */
  id: string
  /** Trust level */
  trust: 'official' | 'community' | 'local'
  /** Composition stamp */
  composition_stamp: string
  /** Generation count */
  generation: number
}

/**
 * Main composition projection for Preview panel.
 * Matches dsh.composition.preview.v0 envelope.
 */
export interface CompositionPreview {
  /** Preset metadata */
  preset: PresetMetadata
  /** Health status (three-layer) */
  health: HealthStatus
  /** Drift status */
  drift: DriftStatus
  /** Composition summary */
  composition: CompositionSummary
  /** Full capability digest (shown as first 12 chars) */
  capability_digest: string
  /** When this projection was generated */
  generated_at: string
}

/**
 * Ordo-injected maturity data (optional).
 * DSH does NOT compute this locally; only displays when Ordo provides it.
 */
export interface MaturitySlot {
  /** Four-dimensional maturity score (1-5) */
  dimensions: {
    effectiveness: number
    reliability: number
    security: number
    maintainability: number
  }
  /** Overall qualified status (Ordo-only) */
  qualified: boolean
  /** Risk classification (Ordo-only) */
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  /** Evidence reference */
  evidence_ref?: string
}

/**
 * Extended preview with optional Ordo maturity injection.
 */
export interface ExtendedCompositionPreview extends CompositionPreview {
  /** Maturity slot (only when Ordo projection is available) */
  maturity?: MaturitySlot
}

/**
 * Props for the Preview panel component.
 */
export interface PreviewPanelProps {
  /** Preset id to preview */
  presetId: string
  /** Whether panel is open */
  isOpen: boolean
  /** Close handler */
  onClose: () => void
  /** Optional trigger element for focus return */
  triggerRef?: React.RefObject<HTMLElement>
}

/**
 * Props for individual row/seat preview actions.
 */
export interface PreviewActionProps {
  /** Preset id */
  presetId: string
  /** Display name for button/tooltip */
  label?: string
  /** Optional custom click handler */
  onClick?: (presetId: string) => void
}
