import { describe, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { apply, inject, name } from '../src/client/index.ts'
import { deriveMcpActivity } from '../src/client/activity.ts'
import { renderToolsInspectorTree } from '../src/client/McpInspectorView.tsx'
import type { ActivityRunningCall, ActivityToolResultNode } from '../src/client/activity.ts'

function collect(node: unknown, into: { text: string[]; tags: string[]; handlers: string[] }): void {
  if (node == null || typeof node === 'boolean') return
  if (typeof node === 'string' || typeof node === 'number') {
    into.text.push(String(node))
    return
  }
  if (Array.isArray(node)) {
    for (const child of node) collect(child, into)
    return
  }
  if (typeof node !== 'object' || !('props' in node)) return
  const element = node as { type: unknown; props: Record<string, unknown> }
  if (typeof element.type === 'string') into.tags.push(element.type)
  for (const key of Object.keys(element.props)) {
    if (key.startsWith('on') && typeof element.props[key] === 'function') into.handlers.push(key)
  }
  collect(element.props.children, into)
}

describe('Tools pane registration', () => {
  function harness(initial?: unknown) {
    const disposeView = vi.fn()
    const pane = { registerView: vi.fn(() => disposeView), openView: vi.fn() }
    const disposeLocale = vi.fn()
    const disposeEvents = vi.fn()
    let serviceChanged = (_name: string, _value: unknown) => {}
    const ctx = {
      locale: { register: () => disposeLocale, bind: () => (key: string) => key === 'view.tools' ? 'Tools' : key },
      get: (key: string) => key === 'paneWorkbench' ? initial === true ? pane : initial : {},
      on: (_event: string, fn: typeof serviceChanged) => { serviceChanged = fn; return disposeEvents },
      slots: { inject: vi.fn(), register: vi.fn() },
    }
    return { ctx, pane, disposeView, disposeLocale, disposeEvents, change: (value: unknown) => serviceChanged('paneWorkbench', value) }
  }

  test('registers one picker-visible Tools pane without a conversation tab', () => {
    const h = harness(true)
    const dispose = apply(h.ctx as never)
    expect(name).toBe('client-ui-mcp-inspector')
    expect(inject).toEqual(['locale', 'sessions'])
    expect(h.pane.registerView).toHaveBeenCalledOnce()
    expect(h.pane.registerView.mock.calls[0]?.[0]).toMatchObject({
      descriptor: { kind: 'mcp-inspector', label: 'Tools', preferredRegion: 'right', retention: 'recreate', singleton: true },
      i18n: { namespace: 'mcpInspector', labelKey: 'view.tools' },
    })
    expect(h.ctx.slots.inject).not.toHaveBeenCalled()
    expect(h.pane.openView).not.toHaveBeenCalled()
    dispose()
    expect(h.disposeView).toHaveBeenCalledOnce()
    expect(h.disposeLocale).toHaveBeenCalledOnce()
    expect(h.disposeEvents).toHaveBeenCalledOnce()
  })

  test('handles missing, late, replaced and unloaded pane services', () => {
    const h = harness()
    const dispose = apply(h.ctx as never)
    expect(h.pane.registerView).not.toHaveBeenCalled()
    h.change({ registerView: () => {} })
    h.change(h.pane)
    h.change(h.pane)
    expect(h.pane.registerView).toHaveBeenCalledOnce()
    h.change(undefined)
    expect(h.disposeView).toHaveBeenCalledOnce()
    h.change(h.pane)
    expect(h.pane.registerView).toHaveBeenCalledTimes(2)
    dispose()
    expect(h.disposeView).toHaveBeenCalledTimes(2)
  })
})

describe('Tools inspector tree', () => {
  test('shows catalog-unavailable degrade and session MCP activity', () => {
    const nodes: ActivityToolResultNode[] = [
      {
        kind: 'tool-result',
        seq: 1,
        time: 2_000,
        call: { name: 'mcp__github__create_issue' },
        callTime: 1_000,
        isError: true,
      },
    ]
    const runningCalls: ActivityRunningCall[] = [{ name: 'mcp__github__list_prs', time: 3_000 }]
    const tree = renderToolsInspectorTree({
      catalogState: { status: 'unavailable', message: 'catalog: unavailable in this version' },
      query: '',
      family: 'all',
      enabled: 'all',
      servers: deriveMcpActivity(nodes, runningCalls),
      onQueryChange: () => {},
      onFamilyChange: () => {},
      onEnabledChange: () => {},
      onToggle: () => {},
    })
    const collected = { text: [] as string[], tags: [] as string[], handlers: [] as string[] }
    collect(tree, collected)
    const html = renderToStaticMarkup(tree)
    expect(html).toContain('Tool catalog is unavailable')
    expect(html).toContain('catalog_unavailable')
    expect(html).not.toContain('catalog: unavailable in this version')
    expect(html).not.toContain('transport failure')
    expect(html).toContain('Tools')
    expect(html).toContain('mcp__github')
    expect(html).toContain('running')
    expect(html).toContain('error')
    expect(html).not.toMatch(/connected|healthy/i)
    expect(collected.tags).toContain('input')
    expect(collected.tags).toContain('button')
    expect(collected.tags).toContain('style')
    expect(collected.tags).toContain('header')
  })

  test('renders searchable catalog rows with enable/disable, never invoke', () => {
    const tree = renderToolsInspectorTree({
      catalogState: {
        status: 'ready',
        catalog: {
          ok: true,
          specVersion: '1.0',
          complete: true,
          generation: 1,
          skillsAvailable: true,
          toolsAvailable: true,
          mcpInventoryAvailable: false,
          items: [
            {
              id: 'skill:writer',
              family: 'skill',
              origin: 'skill',
              name: 'writer',
              label: 'writer',
              description: 'Write docs',
              source: 'user-dsh',
              availability: 'available',
              enabled: true,
              canToggle: true,
            },
            {
              id: 'mcp:github',
              family: 'mcp',
              origin: 'mcp',
              name: 'github',
              label: 'mcp__github',
              description: '2 tools',
              source: 'mcp-client',
              availability: 'available',
              enabled: true,
              canToggle: true,
              toolCount: 2,
              server: 'github',
            },
          ],
        },
      },
      query: 'write',
      family: 'all',
      enabled: 'all',
      servers: [],
      onQueryChange: () => {},
      onFamilyChange: () => {},
      onEnabledChange: () => {},
      onToggle: () => {},
    })
    const collected = { text: [] as string[], tags: [] as string[], handlers: [] as string[] }
    collect(tree, collected)
    const html = renderToStaticMarkup(tree)
    expect(html).toContain('writer')
    expect(html).toContain('Disable')
    expect(html).not.toContain('mcp__github')
    expect(html).not.toMatch(/invoke|call tool/i)
  })
})
