/**
 * `toolHub` Remote client-side wire mirror.
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client/wire
 */

export type ToolHubFamily = 'mcp' | 'skill' | 'native'
export type ToolHubOrigin = 'mcp' | 'skill' | 'native'
export type ToolHubAvailability = 'available' | 'disabled' | 'unavailable'
export type ToolHubItemId = `skill:${string}` | `tool:${string}` | `mcp:${string}`
export type ToolHubReasonCodeV1 = 'disabled_by_user' | 'not_model_invocable' | 'loader_disabled'
export type ToolHubHealthStateV1 = 'connected' | 'disconnected' | 'syncing' | 'unknown'

export interface ToolHubHealthV1 {
  readonly state: ToolHubHealthStateV1
  readonly observedAt: number
}

export interface ToolHubItemV1 {
  readonly id: ToolHubItemId
  readonly family: ToolHubFamily
  readonly origin: ToolHubOrigin
  readonly name: string
  readonly label: string
  readonly description: string
  readonly source: string
  readonly availability: ToolHubAvailability
  readonly enabled: boolean
  readonly canToggle: boolean
  readonly disabledReason?: string
  readonly reasonCode?: ToolHubReasonCodeV1
  readonly health?: ToolHubHealthV1
  readonly toolCount?: number
  readonly server?: string
}

export interface ToolHubCatalogV1 {
  readonly ok: true
  readonly specVersion: '1.0'
  readonly complete: boolean
  readonly generation: number
  readonly skillsAvailable: boolean
  readonly toolsAvailable: boolean
  readonly mcpInventoryAvailable: boolean
  readonly observedAt?: number
  readonly healthAvailable?: boolean
  readonly items: readonly ToolHubItemV1[]
}

export interface ToolHubSetEnabledInputV1 {
  readonly id: string
  readonly enabled: boolean
  readonly ifGeneration: number
}

export interface ToolHubSetEnabledOkV1 {
  readonly ok: true
  readonly id: ToolHubItemId
  readonly enabled: boolean
  readonly generation: number
}

export interface CatalogUnavailableFailureV1 {
  readonly ok: false
  readonly code: 'catalog-unavailable'
  readonly message: string
}

export interface ItemUnknownFailureV1 {
  readonly ok: false
  readonly code: 'item-unknown'
  readonly message: string
}

export interface ToggleUnsupportedFailureV1 {
  readonly ok: false
  readonly code: 'toggle-unsupported'
  readonly message: string
}

export interface GenerationConflictFailureV1 {
  readonly ok: false
  readonly code: 'generation-conflict'
  readonly message: string
  readonly generation: number
}

export interface StorageUnavailableFailureV1 {
  readonly ok: false
  readonly code: 'storage-unavailable'
  readonly message: string
}

export type ToolHubCatalogAnswerV1 = ToolHubCatalogV1 | CatalogUnavailableFailureV1 | StorageUnavailableFailureV1

export type ToolHubSetEnabledAnswerV1 =
  | ToolHubSetEnabledOkV1
  | ItemUnknownFailureV1
  | ToggleUnsupportedFailureV1
  | GenerationConflictFailureV1
  | StorageUnavailableFailureV1
  | CatalogUnavailableFailureV1

export interface ToolHubRemoteFace {
  list(): Promise<ToolHubCatalogAnswerV1>
  setEnabled(input: ToolHubSetEnabledInputV1): Promise<ToolHubSetEnabledAnswerV1>
}

export const TOOL_HUB_SET_FAILURE_CODES = new Set([
  'item-unknown',
  'toggle-unsupported',
  'generation-conflict',
  'storage-unavailable',
  'catalog-unavailable',
])
