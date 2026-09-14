/**
 * `toolHub` Remote wire types. JSON-serializable only.
 *
 * @module @yeisme/dsh-tool-hub-host/wire
 */

import type { ToolHubFamily, ToolHubItemId } from './ids.ts'

export type ToolHubAvailability = 'available' | 'disabled' | 'unavailable'
export type ToolHubOrigin = 'mcp' | 'skill' | 'native'
export type ToolHubReasonCodeV1 = 'disabled_by_user' | 'not_model_invocable' | 'loader_disabled'
export type ToolHubHealthStateV1 = 'connected' | 'disconnected' | 'syncing' | 'unknown'

export interface ToolHubHealthV1 {
  readonly state: ToolHubHealthStateV1
  readonly observedAt: number
}

/** Optional, safe discovery metadata supplied by a catalog owner or its maintained supplement. */
export interface ToolHubPurposeV1 {
  readonly zh: string
  readonly category: string
  readonly searchTerms: readonly string[]
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
  readonly purpose?: ToolHubPurposeV1
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

/** Compact connect-doc face: display vocabulary only (no URLs, tokens, or fetch surface). */
export interface ToolHubConnectFaceV1 {
  readonly id: string
  readonly publicName: string
  readonly kind: string
  readonly toolCount?: number
}

/** Additive `gateway_connect_doc.v1` read-only projection (digest_sha256_16). */
export interface ToolHubConnectDocOkV1 {
  readonly ok: true
  readonly docDigest: string
  readonly observedAt: number
  readonly faces: readonly ToolHubConnectFaceV1[]
}

export interface ConnectDocUnavailableFailureV1 {
  readonly ok: false
  readonly code: 'connect-doc-unavailable'
  readonly message: string
}

export type ToolHubConnectDocAnswerV1 = ToolHubConnectDocOkV1 | ConnectDocUnavailableFailureV1

export interface ToolHubRediscoverOkV1 {
  readonly ok: true
  readonly generation: number
  readonly docDigest: string
}

export interface ToolHubRediscoverFailureV1 {
  readonly ok: false
  readonly code: 'rediscover-in-progress' | 'rediscover-unavailable'
  readonly message: string
}

export type ToolHubRediscoverAnswerV1 = ToolHubRediscoverOkV1 | ToolHubRediscoverFailureV1

export const TOOL_HUB_SET_FAILURE_CODES = new Set([
  'item-unknown',
  'toggle-unsupported',
  'generation-conflict',
  'storage-unavailable',
  'catalog-unavailable',
])
