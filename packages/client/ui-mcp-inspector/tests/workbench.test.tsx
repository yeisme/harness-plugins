import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderToolsInspectorTree, type ToolsTranslator } from '../src/client/McpInspectorView.tsx'
import { zh } from '../src/client/locales.ts'
import type { ToolActivitySnapshot } from '../src/client/activity.ts'
import type { ToolHubCatalogV1 } from '../src/client/wire.ts'

const noop = () => {}
const activity: ToolActivitySnapshot = {
  calls: 3,
  errors: 1,
  running: 1,
  records: [
    { itemId: 'mcp:github', family: 'mcp', server: 'github', tool: 'list_prs', time: 50_000, durationMs: null, isError: false, running: true, sequence: 3 },
    { itemId: 'tool:read_file', family: 'native', tool: 'read_file', time: 40_000, durationMs: 1_200, isError: true, running: false, sequence: 2 },
    { itemId: null, family: 'skill', tool: 'skill', time: 30_000, durationMs: 100, isError: false, running: false, sequence: 1 },
  ],
}

function catalog(): ToolHubCatalogV1 {
  return {
    ok: true,
    specVersion: '1.0',
    complete: true,
    generation: 2,
    skillsAvailable: true,
    toolsAvailable: true,
    mcpInventoryAvailable: true,
    observedAt: 50_000,
    healthAvailable: true,
    items: [
      { id: 'mcp:github', family: 'mcp', origin: 'mcp', name: 'github', label: 'mcp__github', description: 'GitHub tools', source: 'mcp-client', availability: 'available', enabled: true, canToggle: true, toolCount: 2, server: 'github', health: { state: 'disconnected', observedAt: 1_000 } },
      { id: 'skill:writer', family: 'skill', origin: 'skill', name: 'writer', label: 'writer', description: 'Write docs', source: 'user-dsh', availability: 'disabled', enabled: false, canToggle: true, reasonCode: 'disabled_by_user', disabledReason: 'disabled by user preference' },
      { id: 'tool:read_file', family: 'native', origin: 'native', name: 'read_file', label: 'read_file', description: 'Read a file', source: 'tools', availability: 'available', enabled: true, canToggle: true },
    ],
  }
}

const base = {
  catalogState: { status: 'ready' as const, catalog: catalog() },
  query: '',
  family: 'all' as const,
  enabled: 'all' as const,
  activity,
  onQueryChange: noop,
  onFamilyChange: noop,
  onEnabledChange: noop,
  onToggle: noop,
}

describe('Tools workbench', () => {
  it('renders a dense catalog and keeps enablement distinct from MCP health', () => {
    const html = renderToStaticMarkup(renderToolsInspectorTree({ ...base, selectedId: 'mcp:github', activeSection: 'details', now: 70_000 }))
    expect(html).toContain('tools-workspace')
    expect(html).toContain('data-right-content="details"')
    expect(html).toContain('Enabled')
    expect(html).toContain('Disconnected · Status is stale')
    expect(html).toContain('Enablement affects future tool admission only')
    expect(html).toContain('aria-pressed="true"')
  })

  it('renders list and timeline activity without tool arguments or results', () => {
    const html = renderToStaticMarkup(renderToolsInspectorTree({ ...base, activeSection: 'activity', activityMode: 'timeline', now: 60_000 }))
    expect(html).toContain('tools-timeline-track')
    expect(html).toContain('mcp__github / list_prs')
    expect(html).toContain('read_file')
    expect(html).toContain('Skill invocation')
    expect(html).not.toMatch(/arguments|provider payload|raw prompt/i)
  })

  it('uses the zh locale for every visible control and status surface', () => {
    const translator: ToolsTranslator = key => zh[key]
    const html = renderToStaticMarkup(renderToolsInspectorTree({ ...base, t: translator, activeSection: 'activity', now: 60_000 }))
    expect(html).toContain('目录完整')
    expect(html).toContain('搜索名称、描述或来源')
    expect(html).toContain('本会话 3 调用')
    expect(html).toContain('时间线')
    expect(html).not.toContain('Catalog complete')
  })

  it('keeps activity visible when the catalog endpoint is missing', () => {
    const html = renderToStaticMarkup(renderToolsInspectorTree({
      ...base,
      catalogState: { status: 'error', message: 'endpoint_not_found', code: 'endpoint_not_found' },
      activeSection: 'activity',
      canRefresh: true,
    }))
    expect(html).toContain('Tool catalog service is not installed or is version-incompatible')
    expect(html).toContain('mcp__github / list_prs')
    expect(html).toContain('<code>endpoint_not_found</code>')
    expect(html).not.toMatch(/HTTP 404|transport failure|authorization/)
  })
})
