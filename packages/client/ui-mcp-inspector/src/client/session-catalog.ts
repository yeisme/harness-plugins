import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ToolHubCatalogV1, ToolHubItemV1, ToolHubRemoteFace } from './wire.ts'
import { ToolHubClientError } from './remote.ts'

const safeName = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_.:/@-]{1,200}$/.test(value) && !value.includes('://') && !value.startsWith('/')
const safeDescription = (value: unknown): string => typeof value === 'string' && !/(?:https?:\/\/|\/(?:home|Users|workspaces|tmp)\/|(?:token|password|secret)\s*[:=])/i.test(value) ? value.slice(0,500) : ''

/** No tool execution: the Session-addressed Host catalogs are the only source. */
export function sessionCatalogRemote(ctx: ClientContext, sessionId: string): ToolHubRemoteFace {
  const query = async (namespace: string): Promise<Record<string, unknown>> => {
    const root = ctx.get('remote' as never) as unknown as Record<string, unknown>
    let port: { list(input: { sessionId: string }, signal: AbortSignal): Promise<unknown> } | undefined
    try { port = ctx.get(`remote.${namespace}` as never) as unknown as typeof port } catch { /* Namespace may be late. */ }
    port ??= root?.[namespace] as typeof port
    if (typeof port?.list !== 'function') throw new ToolHubClientError('host_unavailable')
    const response = await port.list({ sessionId, ...(namespace === 'skills' ? { includeModelInvocable: true } : {}) }, new AbortController().signal) as { ok?: boolean; value?: Record<string, unknown> }
    if (!response?.ok || !response.value) throw new ToolHubClientError('catalog_unavailable')
    return response.value
  }
  return {
    async list() {
      const [toolResult, skillResult] = await Promise.allSettled([query('referenceTools'), query('skills')])
      const tools = toolResult.status === 'fulfilled' && Array.isArray(toolResult.value.tools) ? toolResult.value.tools as Record<string, unknown>[] : undefined
      const skills = skillResult.status === 'fulfilled' && Array.isArray(skillResult.value.skills) ? skillResult.value.skills as Record<string, unknown>[] : undefined
      if (!tools && !skills) throw new ToolHubClientError('catalog_unavailable')
      const items: ToolHubItemV1[] = []
      for (const tool of tools ?? []) {
        if (!safeName(tool.name)) continue
        const family = tool.name.startsWith('mcp__') ? 'mcp' : 'native'
        items.push({ id: `tool:${tool.name}`, name: tool.name, label: tool.name, description: safeDescription(tool.description), family, origin: family, source: 'session.tools', availability: 'available', enabled: true, canToggle: false })
      }
      for (const skill of skills ?? []) {
        if (!safeName(skill.name)) continue
        const enabled = skill.modelInvocable !== false
        items.push({ id: `skill:${skill.name}`, name: skill.name, label: skill.name, description: safeDescription(skill.description), family: 'skill', origin: 'skill', source: 'session.skills', availability: enabled ? 'available' : 'unavailable', enabled, canToggle: false, ...(enabled ? {} : { reasonCode: 'not_model_invocable' as const }) })
      }
      return { ok: true, specVersion: '1.0', complete: tools !== undefined && skills !== undefined && skillResult.status === 'fulfilled' && skillResult.value.catalogComplete === true && items.length <= 500, generation: 1, observedAt: Date.now(), skillsAvailable: skills !== undefined, toolsAvailable: tools !== undefined, mcpInventoryAvailable: false, healthAvailable: false, items: items.slice(0,500) } satisfies ToolHubCatalogV1
    },
    async setEnabled() { return { ok: false, code: 'toggle-unsupported', message: 'Use global tool management' } },
  }
}
