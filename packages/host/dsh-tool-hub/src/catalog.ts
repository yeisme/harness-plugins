/**
 * Safe catalog projection from host skills/tools/MCP inventory.
 *
 * Never copies command lines, env, headers, cookies, tokens, or file paths.
 *
 * @module @yeisme/dsh-tool-hub-host/catalog
 */

import { MAX_CATALOG_ITEMS, MAX_DESCRIPTION_CHARS, MCP_CLIENT_MODULE } from './constants.ts'
import { boundLabel, mcpId, skillId, splitMcpToolName, toolId, type ToolHubItemId } from './ids.ts'
import type { ToolHubAvailability, ToolHubHealthStateV1, ToolHubHealthV1, ToolHubItemV1, ToolHubReasonCodeV1 } from './wire.ts'

const UNSAFE = /rawPrompt|privateArguments|providerPayload|authorization|cookie|token|command line|headers/i
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/

export interface SkillSummaryLike {
  readonly name?: unknown
  readonly description?: unknown
  readonly whenToUse?: unknown
  readonly source?: unknown
  readonly provider?: unknown
  readonly invocation?: { readonly modelInvocable?: unknown; readonly userInvocable?: unknown }
}

export interface ToolSchemaLike {
  readonly name?: unknown
  readonly description?: unknown
}

export interface PluginInventoryEntryLike {
  readonly entryId?: unknown
  readonly moduleName?: unknown
  readonly enabled?: unknown
  readonly fiberPhase?: unknown
}

export interface McpServerHealthLike {
  readonly serverName?: unknown
  readonly status?: unknown
  readonly lastSyncAt?: unknown
}

export interface CatalogSource {
  readonly skills?: readonly SkillSummaryLike[]
  readonly skillsComplete?: boolean
  readonly tools?: readonly ToolSchemaLike[]
  readonly pluginEntries?: readonly PluginInventoryEntryLike[]
  readonly mcpHealth?: readonly McpServerHealthLike[]
  readonly disabledIds: ReadonlySet<string>
}

export interface CatalogProjection {
  readonly items: readonly ToolHubItemV1[]
  readonly complete: boolean
  readonly skillsAvailable: boolean
  readonly toolsAvailable: boolean
  readonly mcpInventoryAvailable: boolean
  readonly healthAvailable: boolean
}

function safeName(value: unknown): string | undefined {
  return typeof value === 'string' && SAFE_NAME.test(value) ? value : undefined
}

function safeDescription(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (trimmed.length === 0 || UNSAFE.test(trimmed)) return ''
  return trimmed.length > MAX_DESCRIPTION_CHARS ? `${trimmed.slice(0, MAX_DESCRIPTION_CHARS - 1)}…` : trimmed
}

function availabilityFor(enabled: boolean, extra?: string, reasonCode?: ToolHubReasonCodeV1): {
  availability: ToolHubAvailability
  disabledReason?: string
  reasonCode?: ToolHubReasonCodeV1
} {
  if (enabled) return { availability: 'available' }
  return extra === undefined
    ? { availability: 'disabled', disabledReason: 'disabled by user preference', reasonCode: 'disabled_by_user' }
    : { availability: 'disabled', disabledReason: extra, ...(reasonCode === undefined ? {} : { reasonCode }) }
}

function healthByServer(values: readonly McpServerHealthLike[] | undefined): ReadonlyMap<string, ToolHubHealthV1> {
  const result = new Map<string, ToolHubHealthV1>()
  for (const value of values ?? []) {
    const server = safeName(value.serverName)
    const state = value.status
    const observedAt = value.lastSyncAt
    if (server === undefined || typeof observedAt !== 'number' || !Number.isFinite(observedAt)) continue
    if (state !== 'connected' && state !== 'disconnected' && state !== 'syncing' && state !== 'unknown') continue
    result.set(server, { state: state as ToolHubHealthStateV1, observedAt })
  }
  return result
}

function projectSkill(input: SkillSummaryLike, disabled: ReadonlySet<string>): ToolHubItemV1 | undefined {
  const name = safeName(input.name)
  if (name === undefined || UNSAFE.test(JSON.stringify(input))) return undefined
  const id = skillId(name)
  const modelInvocable = input.invocation?.modelInvocable !== false
  const userEnabled = !disabled.has(id)
  const enabled = modelInvocable && userEnabled
  const reason = modelInvocable
    ? (userEnabled ? undefined : 'disabled by user preference')
    : 'not model-invocable'
  const status = availabilityFor(enabled, reason, modelInvocable ? 'disabled_by_user' : 'not_model_invocable')
  return {
    id,
    family: 'skill',
    origin: 'skill',
    name,
    label: boundLabel(name, name),
    description: safeDescription(input.description) || safeDescription(input.whenToUse),
    source: boundLabel(input.source ?? input.provider, 'unknown', 80),
    availability: status.availability,
    enabled,
    canToggle: modelInvocable,
    ...(status.disabledReason === undefined ? {} : { disabledReason: status.disabledReason }),
    ...(status.reasonCode === undefined ? {} : { reasonCode: status.reasonCode }),
  }
}

function projectNativeTool(input: ToolSchemaLike, disabled: ReadonlySet<string>): ToolHubItemV1 | undefined {
  const name = safeName(input.name)
  if (name === undefined || UNSAFE.test(JSON.stringify(input))) return undefined
  if (name.startsWith('mcp__')) return undefined
  const id = toolId(name)
  const enabled = !disabled.has(id)
  const status = availabilityFor(enabled)
  return {
    id,
    family: 'native',
    origin: 'native',
    name,
    label: boundLabel(name, name),
    description: safeDescription(input.description),
    source: 'tools',
    availability: status.availability,
    enabled,
    canToggle: true,
    ...(status.disabledReason === undefined ? {} : { disabledReason: status.disabledReason }),
    ...(status.reasonCode === undefined ? {} : { reasonCode: status.reasonCode }),
  }
}

function projectMcpFromTools(
  tools: readonly ToolSchemaLike[],
  disabled: ReadonlySet<string>,
  health: ReadonlyMap<string, ToolHubHealthV1>,
): ToolHubItemV1[] {
  const byServer = new Map<string, { tools: string[]; descriptions: string[] }>()
  for (const tool of tools) {
    const name = typeof tool.name === 'string' ? tool.name : ''
    const parsed = splitMcpToolName(name)
    if (parsed === undefined) continue
    const group = byServer.get(parsed.server) ?? { tools: [], descriptions: [] }
    group.tools.push(parsed.tool)
    const description = safeDescription(tool.description)
    if (description.length > 0 && group.descriptions.length < 3) group.descriptions.push(description)
    byServer.set(parsed.server, group)
  }
  return [...byServer.entries()].map(([server, group]) => {
    const id = mcpId(server)
    const enabled = !disabled.has(id)
    const status = availabilityFor(enabled)
    const serverHealth = health.get(server)
    return {
      id,
      family: 'mcp' as const,
      origin: 'mcp' as const,
      name: server,
      label: `mcp__${server}`,
      description: group.descriptions[0] ?? `${group.tools.length} tools`,
      source: 'mcp-client',
      availability: status.availability,
      enabled,
      canToggle: true,
      toolCount: group.tools.length,
      server,
      ...(status.disabledReason === undefined ? {} : { disabledReason: status.disabledReason }),
      ...(status.reasonCode === undefined ? {} : { reasonCode: status.reasonCode }),
      ...(serverHealth === undefined ? {} : { health: serverHealth }),
    }
  })
}

function projectMcpFromInventory(
  entries: readonly PluginInventoryEntryLike[],
  disabled: ReadonlySet<string>,
  already: ReadonlySet<string>,
  health: ReadonlyMap<string, ToolHubHealthV1>,
): ToolHubItemV1[] {
  const items: ToolHubItemV1[] = []
  for (const entry of entries) {
    if (entry.moduleName !== MCP_CLIENT_MODULE) continue
    const configName = typeof entry.entryId === 'string' ? entry.entryId.replace(/^mcp-/, '') : undefined
    const server = safeName(configName)
    if (server === undefined) continue
    const id = mcpId(server)
    if (already.has(id)) continue
    const loaderEnabled = entry.enabled !== false
    const userEnabled = !disabled.has(id)
    const enabled = loaderEnabled && userEnabled
    const reason = loaderEnabled
      ? (userEnabled ? undefined : 'disabled by user preference')
      : 'MCP plugin entry is disabled in the loader'
    const status = availabilityFor(enabled, reason, loaderEnabled ? 'disabled_by_user' : 'loader_disabled')
    const serverHealth = health.get(server)
    items.push({
      id,
      family: 'mcp',
      origin: 'mcp',
      name: server,
      label: `mcp__${server}`,
      description: loaderEnabled ? 'MCP server' : 'MCP plugin entry is disabled in the loader',
      source: 'plugin-inventory',
      availability: status.availability,
      enabled,
      canToggle: loaderEnabled,
      toolCount: 0,
      server,
      ...(status.disabledReason === undefined ? {} : { disabledReason: status.disabledReason }),
      ...(status.reasonCode === undefined ? {} : { reasonCode: status.reasonCode }),
      ...(serverHealth === undefined ? {} : { health: serverHealth }),
    })
  }
  return items
}

export function projectCatalog(source: CatalogSource): CatalogProjection {
  const skillsAvailable = source.skills !== undefined
  const toolsAvailable = source.tools !== undefined
  const mcpInventoryAvailable = source.pluginEntries !== undefined
  const healthAvailable = source.mcpHealth !== undefined
  const health = healthByServer(source.mcpHealth)
  const skills = (source.skills ?? [])
    .map(item => projectSkill(item, source.disabledIds))
    .filter((item): item is ToolHubItemV1 => item !== undefined)
  const natives = (source.tools ?? [])
    .map(item => projectNativeTool(item, source.disabledIds))
    .filter((item): item is ToolHubItemV1 => item !== undefined)
  const mcpFromTools = toolsAvailable ? projectMcpFromTools(source.tools ?? [], source.disabledIds, health) : []
  const seenMcp = new Set(mcpFromTools.map(item => item.id))
  const mcpFromInventory = mcpInventoryAvailable
    ? projectMcpFromInventory(source.pluginEntries ?? [], source.disabledIds, seenMcp, health)
    : []
  const items = [...mcpFromTools, ...mcpFromInventory, ...skills, ...natives]
    .sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name))
    .slice(0, MAX_CATALOG_ITEMS)
  return {
    items,
    complete: (!skillsAvailable || source.skillsComplete !== false),
    skillsAvailable,
    toolsAvailable,
    mcpInventoryAvailable,
    healthAvailable,
  }
}

export function findCatalogItem(items: readonly ToolHubItemV1[], id: ToolHubItemId): ToolHubItemV1 | undefined {
  return items.find(item => item.id === id)
}
