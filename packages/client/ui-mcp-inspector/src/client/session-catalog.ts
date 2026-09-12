import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ToolHubCatalogV1, ToolHubItemV1, ToolHubRemoteFace } from './wire.ts'
import { ToolHubClientError, normalizeToolHubClientError } from './remote.ts'

const safeName = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_.:/@-]{1,200}$/.test(value) && !value.includes('://') && !value.startsWith('/')
// Keep the public owner description for the detail view. The explicit ellipsis
// is the only client-side cap; this is never a raw Skill/body reader.
const safeDescription = (value: unknown): string => typeof value === 'string' && !/(?:https?:\/\/|\/(?:home|Users|workspaces|tmp)\/|(?:token|password|secret)\s*[:=])/i.test(value) ? (value.length <= 4_000 ? value : `${value.slice(0, 3_999)}…`) : ''
const safeCategory = (value: unknown): string | undefined => typeof value === 'string' && /^[a-z][a-z0-9_-]{0,32}$/i.test(value) ? value : undefined
const safeTerms = (value: unknown): readonly string[] => Array.isArray(value) ? value.flatMap(term => typeof term === 'string' && term.length <= 80 && !/(token|secret|password)/i.test(term) ? [term] : []).slice(0, 8) : []

const maintainedPurpose: Readonly<Record<string, { readonly zh: string; readonly category: string; readonly searchTerms: readonly string[] }>> = {
  bash: { zh: '执行 shell 命令并查看输出', category: 'development', searchTerms: ['命令行', '终端', 'shell'] },
  read: { zh: '读取文本文件内容', category: 'files', searchTerms: ['读取文件', '查看文件'] },
  write: { zh: '创建或完整写入文本文件', category: 'files', searchTerms: ['写入文件', '保存文件'] },
  edit: { zh: '按文字片段编辑已有文件', category: 'files', searchTerms: ['修改文件', '替换文本'] },
  skill_search: { zh: '搜索可用技能目录', category: 'discovery', searchTerms: ['搜索技能', '技能目录'] },
  skill_load: { zh: '加载一个技能的完整说明', category: 'discovery', searchTerms: ['加载技能', '技能说明'] },
  dev_tool_search: { zh: '发现当前未提供的工具', category: 'discovery', searchTerms: ['发现工具', '工具目录'] },
}

function purposeOf(value: Record<string, unknown>): { readonly zh: string; readonly category: string; readonly searchTerms: readonly string[] } | undefined {
  const zh = safeDescription(value.purposeZh)
  const category = safeCategory(value.category)
  if (zh && category) return { zh, category, searchTerms: safeTerms(value.searchTerms) }
  return typeof value.name === 'string' ? maintainedPurpose[value.name] : undefined
}

/** No tool execution: the Session-addressed Host catalogs are the only source. */
export function sessionCatalogRemote(ctx: ClientContext, sessionId: string, options: { readonly requireResolvedScope?: boolean } = {}): ToolHubRemoteFace {
  const query = async (namespace: string): Promise<Record<string, unknown>> => {
    const root = ctx.get('remote' as never) as unknown as Record<string, unknown>
    let port: { list(input: { sessionId: string }, signal: AbortSignal): Promise<unknown> } | undefined
    try { port = ctx.get(`remote.${namespace}` as never) as unknown as typeof port } catch { /* Namespace may be late. */ }
    port ??= root?.[namespace] as typeof port
    if (typeof port?.list !== 'function') throw new ToolHubClientError('host_unavailable')
    const response = await port.list({ sessionId, ...(namespace === 'skills' ? { includeModelInvocable: true } : {}), ...(options.requireResolvedScope ? { requireResolvedScope: true } : {}) }, new AbortController().signal) as { ok?: boolean; value?: Record<string, unknown>; error?: unknown }
    if (!response?.ok || !response.value) {
      const denied = normalizeToolHubClientError(response?.error).accessDenied
      const error = response?.error as { details?: { reason?: unknown } } | undefined
      const unresolved = options.requireResolvedScope && error?.details?.reason === 'session_scope_unavailable'
      throw new ToolHubClientError(unresolved && !denied ? 'contract_mismatch' : 'catalog_unavailable', denied)
    }
    if (options.requireResolvedScope && response.value.scopeResolved !== true) throw new ToolHubClientError('contract_mismatch')
    return response.value
  }
  return {
    async list() {
      const [toolResult, skillResult] = await Promise.allSettled([query('referenceTools'), query('skills')])
      const tools = toolResult.status === 'fulfilled' && Array.isArray(toolResult.value.tools) ? toolResult.value.tools as Record<string, unknown>[] : undefined
      const skills = skillResult.status === 'fulfilled' && Array.isArray(skillResult.value.skills) ? skillResult.value.skills as Record<string, unknown>[] : undefined
      if (!tools && !skills) {
        const failures = [toolResult, skillResult].flatMap(result => result.status === 'rejected' && result.reason instanceof ToolHubClientError ? [result.reason] : [])
        throw new ToolHubClientError(failures.some(failure => failure.code === 'contract_mismatch') ? 'contract_mismatch' : 'catalog_unavailable', failures.some(failure => failure.accessDenied))
      }
      const items: ToolHubItemV1[] = []
      for (const tool of tools ?? []) {
        if (!safeName(tool.name)) continue
        const family = tool.name.startsWith('mcp__') ? 'mcp' : 'native'
        const purpose = purposeOf(tool)
        items.push({ id: `tool:${tool.name}`, name: tool.name, label: tool.name, description: safeDescription(tool.description), family, origin: family, source: 'session.tools', availability: 'available', enabled: true, canToggle: false, ...(purpose === undefined ? {} : { purpose }) })
      }
      for (const skill of skills ?? []) {
        if (!safeName(skill.name)) continue
        const enabled = skill.modelInvocable !== false
        const purpose = purposeOf(skill)
        items.push({ id: `skill:${skill.name}`, name: skill.name, label: skill.name, description: safeDescription(skill.description), family: 'skill', origin: 'skill', source: 'session.skills', availability: enabled ? 'available' : 'unavailable', enabled, canToggle: false, ...(enabled ? {} : { reasonCode: 'not_model_invocable' as const }), ...(purpose === undefined ? {} : { purpose }) })
      }
      return { ok: true, specVersion: '1.0', complete: tools !== undefined && skills !== undefined && skillResult.status === 'fulfilled' && skillResult.value.catalogComplete === true && items.length <= 500, generation: 1, observedAt: Date.now(), skillsAvailable: skills !== undefined, toolsAvailable: tools !== undefined, mcpInventoryAvailable: false, healthAvailable: false, items: items.slice(0,500) } satisfies ToolHubCatalogV1
    },
    async setEnabled() { return { ok: false, code: 'toggle-unsupported', message: 'Use global tool management' } },
  }
}
