// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToolsInspectorTree } from '../src/client/McpInspectorView.tsx'

afterEach(cleanup)

const catalog = {
  ok: true as const,
  specVersion: '1.0' as const,
  complete: true,
  generation: 1,
  skillsAvailable: true,
  toolsAvailable: true,
  mcpInventoryAvailable: false,
  items: [
    { id: 'mcp:github' as const, family: 'mcp' as const, origin: 'mcp' as const, name: 'github', label: 'mcp__github', description: 'GitHub', source: 'mcp-client', availability: 'available' as const, enabled: true, canToggle: true },
    { id: 'skill:writer' as const, family: 'skill' as const, origin: 'skill' as const, name: 'writer', label: 'writer', description: 'Write', source: 'user', availability: 'disabled' as const, enabled: false, canToggle: true },
  ],
}

function props(overrides: Record<string, unknown> = {}) {
  return {
    catalogState: { status: 'ready' as const, catalog },
    query: '',
    family: 'all' as const,
    enabled: 'all' as const,
    activity: { calls: 1, errors: 0, running: 1, records: [{ itemId: 'mcp:github' as const, family: 'mcp' as const, server: 'github', tool: 'list_prs', time: 2_000, durationMs: null, isError: false, running: true, sequence: 1 }] },
    onQueryChange: vi.fn(),
    onFamilyChange: vi.fn(),
    onEnabledChange: vi.fn(),
    onToggle: vi.fn(),
    onRefresh: vi.fn(),
    onClearFilters: vi.fn(),
    onSelectItem: vi.fn(),
    onActiveSectionChange: vi.fn(),
    onActivityModeChange: vi.fn(),
    onActivityFilterChange: vi.fn(),
    ...overrides,
  }
}

describe('Tools workbench controls', () => {
  it('wires search, family, availability, details and toggle actions', () => {
    const input = props()
    render(renderToolsInspectorTree(input))
    fireEvent.change(screen.getByLabelText('Search tools and skills'), { target: { value: 'git' } })
    fireEvent.click(screen.getByRole('button', { name: /MCP 1/ }))
    fireEvent.change(screen.getByLabelText('Catalog state'), { target: { value: 'disabled' } })
    fireEvent.click(screen.getByRole('button', { name: 'View details for mcp__github' }))
    fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
    expect(input.onQueryChange).toHaveBeenCalledWith('git')
    expect(input.onFamilyChange).toHaveBeenCalledWith('mcp')
    expect(input.onEnabledChange).toHaveBeenCalledWith('disabled')
    expect(input.onSelectItem).toHaveBeenCalledWith('mcp:github')
    expect(input.onToggle).toHaveBeenCalledWith('mcp:github', false)
  })

  it('wires activity view/filter controls and safe recheck recovery', () => {
    const input = props({ activeSection: 'activity', canRefresh: true, catalogState: { status: 'error', message: 'endpoint_not_found', code: 'endpoint_not_found' } })
    render(renderToolsInspectorTree(input))
    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }))
    fireEvent.click(screen.getByRole('button', { name: 'Running' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Recheck' })[0])
    expect(input.onActivityModeChange).toHaveBeenCalledWith('timeline')
    expect(input.onActivityFilterChange).toHaveBeenCalledWith('running')
    expect(input.onRefresh).toHaveBeenCalled()
    expect(screen.queryByText(/HTTP 404|transport failure/)).toBeNull()
  })
})
