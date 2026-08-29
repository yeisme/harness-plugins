import { describe, expect, it } from 'vitest'
import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'
import { mcpInspectorStyles } from '../src/client/styles.ts'
import { renderToolsInspectorTree } from '../src/client/McpInspectorView.tsx'

describe('mcp inspector visual adoption', () => {
  it('scopes visual-kit tokens to the inspector root', () => {
    const base = buildPanelStyles({ scope: 'mcp-inspector' })
    expect(mcpInspectorStyles.startsWith(base)).toBe(true)
    expect(mcpInspectorStyles).toContain('[data-mcp-inspector] .vk-header')
    expect(mcpInspectorStyles).toContain('[data-mcp-inspector] .vk-empty')
    expect(mcpInspectorStyles).toContain('grid-template-columns:minmax(0,58fr) minmax(320px,42fr)')
    expect(mcpInspectorStyles).toContain('@container(max-width:1099px)')
    expect(mcpInspectorStyles).toContain('@container(max-width:699px)')
    expect(mcpInspectorStyles).not.toContain('height:100%;overflow:hidden')
    expect(mcpInspectorStyles.split('--dsw-alias-bg-base').length - 1).toBe(1)
    expect(mcpInspectorStyles).not.toContain('opacity: 0.7')
  })

  it('renders DSH chrome for the honest empty state', () => {
    const tree = renderToolsInspectorTree({
      catalogState: { status: 'unavailable', message: 'catalog_unavailable', code: 'catalog_unavailable' },
      query: '',
      family: 'all',
      enabled: 'all',
      servers: [],
      onQueryChange: () => {},
      onFamilyChange: () => {},
      onEnabledChange: () => {},
      onToggle: () => {},
    }) as { props: Record<string, unknown> }
    expect(tree.props['data-mcp-inspector']).toBe('')
    expect(tree.props['aria-label']).toBe('Tools')
  })
})
