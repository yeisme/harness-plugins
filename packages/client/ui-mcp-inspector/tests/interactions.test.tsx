// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToolsInspectorContent, renderToolsInspectorTree } from '../src/client/McpInspectorView.tsx'
import { ToolsViewState } from '../src/client/workspace-state.ts'
import { zh } from '../src/client/locales.ts'

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
    { id: 'mcp:github' as const, family: 'mcp' as const, origin: 'mcp' as const, name: 'github', label: 'mcp__github', description: 'GitHub', source: 'mcp-client', availability: 'available' as const, enabled: true, canToggle: true, purpose: { zh: '查询代码托管信息', category: 'operations', searchTerms: ['代码'] } },
    { id: 'skill:writer' as const, family: 'skill' as const, origin: 'skill' as const, name: 'writer', label: 'writer', description: 'Write', source: 'user', availability: 'disabled' as const, enabled: false, canToggle: true },
  ],
}

function props(overrides: Record<string, unknown> = {}) {
  return {
    catalogState: { status: 'ready' as const, catalog },
    query: '',
    family: 'all' as const,
    enabled: 'all' as const,
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

  it('uses the maintained Chinese purpose in a Chinese catalog row while details retain the source description', () => {
    render(renderToolsInspectorTree(props({ preferChinesePurpose: true, t: (key: keyof typeof zh) => zh[key] })))
    expect(screen.getByText('查询代码托管信息')).toBeTruthy()
  })

  it('moves narrow detail focus to its own Back control so Escape restores the row', async () => {
    const state = new ToolsViewState()
    const controllerState = { status: 'ready' as const, catalog }
    const controller = {
      getSnapshot: () => controllerState,
      pendingIdSnapshot: () => undefined,
      subscribe: () => () => {},
      refresh: async () => {},
      setEnabled: async () => ({ ok: false as const, code: 'toggle-unsupported' as const, message: 'no' }),
      dispose: () => {},
    }
    render(<ToolsInspectorContent controller={controller as never} viewState={state} />)
    const row = screen.getByRole('button', { name: 'View details for mcp__github' })
    fireEvent.click(row)
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const back = screen.getByRole('button', { name: 'Back to catalog' })
    expect(document.activeElement).toBe(back)
    fireEvent.keyDown(back, { key: 'Escape' })
    await new Promise(resolve => requestAnimationFrame(resolve))
    expect(document.activeElement).toBe(row)
  })

})
