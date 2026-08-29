import { describe, expect, it } from 'vitest'
import { findCatalogItem, projectCatalog } from '../src/catalog.ts'
import { mcpId, skillId, toolId } from '../src/ids.ts'
import { createHostCatalogPort } from '../src/plugin.ts'

describe('projectCatalog', () => {
  it('projects skills, native tools, and MCP servers without secrets', () => {
    const projection = projectCatalog({
      skills: [
        { name: 'writer', description: 'Write docs', source: 'user-dsh', invocation: { modelInvocable: true, userInvocable: true } },
        { name: 'hidden', description: 'secret', invocation: { modelInvocable: false, userInvocable: true } },
      ],
      skillsComplete: true,
      tools: [
        { name: 'read_file', description: 'Read a file' },
        { name: 'mcp__github__create_issue', description: 'Create an issue' },
        { name: 'mcp__github__list_prs', description: 'List PRs' },
      ],
      pluginEntries: [
        { entryId: 'mcp-web', moduleName: '@deepseek-ai/dsh-mcp-client', enabled: true, fiberPhase: 'active' },
      ],
      mcpHealth: [
        { serverName: 'github', status: 'connected', lastSyncAt: 1_000 },
        { serverName: 'web', status: 'syncing', lastSyncAt: 2_000 },
        { serverName: 'unsafe', status: 'connected', lastSyncAt: Number.NaN, command: 'secret' },
      ],
      disabledIds: new Set([skillId('writer')]),
    })
    expect(projection.skillsAvailable).toBe(true)
    expect(projection.toolsAvailable).toBe(true)
    expect(projection.mcpInventoryAvailable).toBe(true)
    const writer = findCatalogItem(projection.items, skillId('writer'))
    expect(writer).toMatchObject({ enabled: false, canToggle: true, family: 'skill', reasonCode: 'disabled_by_user' })
    const hidden = findCatalogItem(projection.items, skillId('hidden'))
    expect(hidden).toMatchObject({ enabled: false, canToggle: false, reasonCode: 'not_model_invocable' })
    const github = findCatalogItem(projection.items, mcpId('github'))
    expect(github).toMatchObject({ family: 'mcp', toolCount: 2, canToggle: true, health: { state: 'connected', observedAt: 1_000 } })
    const web = findCatalogItem(projection.items, mcpId('web'))
    expect(web).toMatchObject({ family: 'mcp', source: 'plugin-inventory', health: { state: 'syncing' } })
    const read = findCatalogItem(projection.items, toolId('read_file'))
    expect(read).toMatchObject({ family: 'native', enabled: true })
    expect(JSON.stringify(projection.items)).not.toMatch(/authorization|cookie|token/i)
    expect(projection.healthAvailable).toBe(true)
  })

  it('drops unsafe or unparseable names', () => {
    const projection = projectCatalog({
      skills: [{ name: 'Bad_Name!', description: 'no' }, { name: 'ok', description: 'cookie token leak' }],
      tools: [{ name: 'mcp__broken' }, { name: 'mcp__a__b__c' }],
      disabledIds: new Set(),
    })
    expect(projection.items.map(item => item.id)).toEqual(['mcp:a'])
  })

  it('omits health honestly when the provider is absent', () => {
    const projection = projectCatalog({ tools: [{ name: 'mcp__github__list' }], disabledIds: new Set() })
    expect(projection.healthAvailable).toBe(false)
    expect(findCatalogItem(projection.items, mcpId('github'))?.health).toBeUndefined()
  })

  it('reads only the optional MCP health projection from the host context', async () => {
    const ctx = {
      get(name: string) {
        if (name === 'mcpServers') return { list: async () => [{ serverName: 'github', status: 'connected', lastSyncAt: 5_000, authorization: 'secret' }] }
        if (name === 'tools') return { schemas: () => [{ name: 'mcp__github__list' }] }
        throw new Error('missing')
      },
    }
    const source = await createHostCatalogPort(ctx as never).collect()
    expect(source.mcpHealth).toEqual([{ serverName: 'github', status: 'connected', lastSyncAt: 5_000, authorization: 'secret' }])
    const projection = projectCatalog({ ...source, disabledIds: new Set() })
    expect(findCatalogItem(projection.items, mcpId('github'))?.health).toEqual({ state: 'connected', observedAt: 5_000 })
    expect(JSON.stringify(projection)).not.toMatch(/authorization|secret/)
  })
})
