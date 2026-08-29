/**
 * Host plugin: optional storageDomain + skills/tools/pluginInventory → toolHub Remote + tool guard.
 *
 * @module @yeisme/dsh-tool-hub-host/plugin
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import { toolHubDomainSpec, type ToolHubDomainSpec, type ToolHubPrefsRowV1 } from './domain.ts'
import { ToolHubRemoteService } from './remote.ts'
import { ToolHubSidecar, type ToolHubCatalogPort, type ToolHubTablePort } from './service.ts'
import { mcpId, skillId, splitMcpToolName, toolId } from './ids.ts'

export const name = 'dsh-tool-hub-host'
export const inject = ['typert'] as const

export type ToolHubDomainHandle = Domain<ToolHubDomainSpec>

interface SkillsFace {
  snapshot?(options?: unknown): Promise<{ skills?: readonly unknown[]; complete?: boolean }>
  list?(options?: unknown): Promise<readonly unknown[]>
}

interface ToolsFace {
  schemas?(scope?: unknown): readonly { name?: unknown; description?: unknown }[]
  guard?(guard: (execution: { name?: unknown; arguments?: unknown }) => string | undefined): () => void
}

interface PluginInventoryFace {
  list?(): { entries?: readonly unknown[] } | Promise<{ entries?: readonly unknown[] }>
}

interface McpServersFace {
  list?(): readonly unknown[] | Promise<readonly unknown[]>
}

interface StorageDomainFace {
  open(spec: ToolHubDomainSpec): Promise<ToolHubDomainHandle>
}

interface TypertRegistryFace {
  register(contribution: {
    readonly package: string
    readonly face: 'host'
    readonly schemas: readonly unknown[]
    readonly model: {
      readonly services: readonly unknown[]
      readonly events: readonly unknown[]
      readonly objects: readonly unknown[]
    }
    readonly invocations: readonly unknown[]
  }): () => void | Promise<void>
}

/**
 * Strict Host contribution used by the real DSH Gateway. Linked development
 * packages may resolve a different physical copy of dsh-typert-protocol, so
 * decorator-private SRC markers alone are not a reliable cross-package seam.
 */
const toolHubTypertContribution = {
  package: '@yeisme/dsh-tool-hub-host',
  face: 'host',
  schemas: [],
  model: {
    services: [{
      key: 'toolHub',
      exportName: 'ToolHubRemoteService',
      summary: 'Safe skills, MCP, and native tool catalog projection.',
      tags: [],
      members: [
        { kind: 'method', name: 'list', signature: 'list(): Promise<ToolHubCatalogAnswerV1>' },
        { kind: 'method', name: 'setEnabled', signature: 'setEnabled(input: ToolHubSetEnabledInputV1): Promise<ToolHubSetEnabledAnswerV1>' },
      ],
      types: [],
    }],
    events: [],
    objects: [],
  },
  invocations: [
    {
      id: '@yeisme/dsh-tool-hub-host#toolHub/list',
      service: 'toolHub',
      namespace: 'toolHub',
      method: 'list',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'src-json' },
    },
    {
      id: '@yeisme/dsh-tool-hub-host#toolHub/setEnabled',
      service: 'toolHub',
      namespace: 'toolHub',
      method: 'setEnabled',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }],
      result: { mode: 'src-json' },
    },
  ],
} as const

function optionalGet<T>(ctx: Context, key: string): T | undefined {
  try {
    return ctx.get(key as never) as T | undefined
  } catch {
    return undefined
  }
}

export function createStorageDomainTablePort(domain: ToolHubDomainHandle): ToolHubTablePort {
  const table = domain.table('prefs')
  return {
    get: key => table.get(key),
    put: (key, row) => table.put(key, row),
  }
}

export function createHostCatalogPort(ctx: Context): ToolHubCatalogPort {
  return {
    async collect() {
      const skills = optionalGet<SkillsFace>(ctx, 'skills')
      const tools = optionalGet<ToolsFace>(ctx, 'tools')
      const inventory = optionalGet<PluginInventoryFace>(ctx, 'pluginInventory')
      const mcpServers = optionalGet<McpServersFace>(ctx, 'mcpServers')
      let skillItems: readonly unknown[] | undefined
      let skillsComplete: boolean | undefined
      if (skills?.snapshot !== undefined) {
        const snapshot = await skills.snapshot()
        skillItems = snapshot.skills
        skillsComplete = snapshot.complete
      } else if (skills?.list !== undefined) {
        skillItems = await skills.list()
        skillsComplete = true
      }
      let pluginEntries: readonly unknown[] | undefined
      if (inventory?.list !== undefined) {
        const listed = await inventory.list()
        pluginEntries = listed.entries
      }
      const mcpHealth = mcpServers?.list === undefined ? undefined : await mcpServers.list()
      return {
        ...(skillItems === undefined ? {} : { skills: skillItems as never, skillsComplete: skillsComplete !== false }),
        ...(tools?.schemas === undefined ? {} : { tools: tools.schemas() }),
        ...(pluginEntries === undefined ? {} : { pluginEntries: pluginEntries as never }),
        ...(mcpHealth === undefined ? {} : { mcpHealth: mcpHealth as never }),
      }
    },
  }
}

function denyReason(sidecar: ToolHubSidecar, execution: { name?: unknown; arguments?: unknown }): string | undefined {
  const name = typeof execution.name === 'string' ? execution.name : ''
  if (name === 'skill') {
    const skillName = typeof execution.arguments === 'object' && execution.arguments !== null
      ? (execution.arguments as { name?: unknown }).name
      : undefined
    if (typeof skillName === 'string' && sidecar.isDisabled(skillId(skillName))) {
      return `skill ${skillName} is disabled in the Tools hub`
    }
    return undefined
  }
  const mcp = splitMcpToolName(name)
  if (mcp !== undefined && sidecar.isDisabled(mcpId(mcp.server))) {
    return `MCP server ${mcp.server} is disabled in the Tools hub`
  }
  if (name.length > 0 && sidecar.isDisabled(toolId(name))) {
    return `tool ${name} is disabled in the Tools hub`
  }
  return undefined
}

export interface MountedToolHub {
  readonly remote: ToolHubRemoteService
  readonly sidecar: ToolHubSidecar
  readonly dispose: () => Promise<void>
}

export async function mountToolHub(ctx: Context): Promise<MountedToolHub> {
  const storage = optionalGet<StorageDomainFace>(ctx, 'storageDomain')
  let table: ToolHubTablePort | undefined
  let close: (() => Promise<void>) | undefined
  if (storage?.open !== undefined) {
    const domain = await storage.open(toolHubDomainSpec)
    table = createStorageDomainTablePort(domain)
    close = () => domain.close()
  }
  const sidecar = new ToolHubSidecar({
    ...(table === undefined ? {} : { table }),
    catalog: createHostCatalogPort(ctx),
  })
  const remote = new ToolHubRemoteService(ctx, sidecar)
  const unregisterTypert = optionalGet<TypertRegistryFace>(ctx, 'typert')?.register(toolHubTypertContribution)
  const tools = optionalGet<ToolsFace>(ctx, 'tools')
  const unguard = tools?.guard?.(execution => denyReason(sidecar, execution))
  return {
    remote,
    sidecar,
    dispose: async () => {
      unguard?.()
      await unregisterTypert?.()
      await close?.()
    },
  }
}

export async function apply(ctx: Context): Promise<void> {
  const mounted = await mountToolHub(ctx)
  ctx.effect(() => () => {
    void mounted.dispose()
  }, 'dsh-tool-hub-host: close')
}

export { denyReason }
export type { ToolHubPrefsRowV1 }
