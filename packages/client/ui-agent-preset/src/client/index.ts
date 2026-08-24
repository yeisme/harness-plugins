/**
 * Client-side entry point for @yeisme/dsh-client-ui-agent-preset.
 *
 * Exports React components for the read-only Preview panel:
 * - PreviewPanel: Main modal for displaying composition preview
 * - PreviewAction: Button component that opens the preview
 *
 * Also exports types for consumer integration.
 */

export { PreviewPanel, PreviewAction } from './PreviewPanel'
export type {
  ToolProjection,
  PromptSectionProjection,
  ProjectionUnit,
  PermissionPreset,
  HealthStatus,
  DriftStatus,
  CompositionSummary,
  PresetMetadata,
  CompositionPreview,
  MaturitySlot,
  ExtendedCompositionPreview,
  PreviewPanelProps,
  PreviewActionProps
} from './types'

/**
 * Slot registration for preset rows and seats.
 *
 * This allows the picker to inject Preview actions into AgentPresetRow
 * and AgentPresetSeat components.
 */
export function registerPreviewSlots(): void {
  // TODO: Register with @deepseek-ai/dsh-client-ui-agent-preset slots
  // Will be integrated via dsh.client.ui.slots when available
  // This is a placeholder for the registration mechanism
}

/**
 * Initialize the preview UI client.
 */
export function initPreviewUI(): void {
  registerPreviewSlots()
}
