/**
 * @yeisme/dsh-tool-hub-host.
 *
 * Safe skills/MCP/native catalog projection plus user enablement preferences.
 * Does not enable or disable Cordis Loader rows; toggles are a preference
 * overlay enforced through `ctx.tools.guard` when that seam exists.
 *
 * @module @yeisme/dsh-tool-hub-host
 */

export {
  TOOL_HUB_CAPABILITY,
  TOOL_HUB_DOMAIN,
  TOOL_HUB_HOST_VERSION,
  TOOL_HUB_PREFS_KEY,
  TOOL_HUB_REMOTE_SERVICE_KEY,
  TOOL_HUB_SPEC_VERSION,
  MCP_CLIENT_MODULE,
} from './constants.ts'

export {
  boundLabel,
  isToolHubItemId,
  mcpId,
  parseToolHubItemId,
  skillId,
  splitMcpToolName,
  toolId,
} from './ids.ts'
export type { ToolHubFamily, ToolHubItemId } from './ids.ts'

export type {
  CatalogUnavailableFailureV1,
  GenerationConflictFailureV1,
  ItemUnknownFailureV1,
  StorageUnavailableFailureV1,
  ToggleUnsupportedFailureV1,
  ToolHubAvailability,
  ToolHubHealthStateV1,
  ToolHubHealthV1,
  ToolHubCatalogAnswerV1,
  ToolHubCatalogV1,
  ToolHubItemV1,
  ToolHubOrigin,
  ToolHubReasonCodeV1,
  ToolHubSetEnabledAnswerV1,
  ToolHubSetEnabledInputV1,
  ToolHubSetEnabledOkV1,
} from './wire.ts'
export { TOOL_HUB_SET_FAILURE_CODES } from './wire.ts'

export { projectCatalog, findCatalogItem } from './catalog.ts'
export type { CatalogProjection, CatalogSource, McpServerHealthLike, PluginInventoryEntryLike, SkillSummaryLike, ToolSchemaLike } from './catalog.ts'

export { toolHubDomainSpec, toolHubPrefsRowSchema } from './domain.ts'
export type { PrefsKey, ToolHubDomainSpec, ToolHubPrefsRowV1 } from './domain.ts'

export { ToolHubSidecar, createToolHubSidecar } from './service.ts'
export type { ToolHubCatalogPort, ToolHubSidecarDeps, ToolHubTablePort } from './service.ts'

export { ToolHubRemoteService, toolHubRemoteMarkers } from './remote.ts'

export {
  apply,
  createHostCatalogPort,
  createStorageDomainTablePort,
  denyReason,
  inject,
  mountToolHub,
  name,
} from './plugin.ts'
export type { MountedToolHub, ToolHubDomainHandle } from './plugin.ts'
