import { describe, expect, test } from 'vitest'
import { apply, inject, McpInspectorView, name } from '../src/client/index.ts'
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

describe('apply conversation.view registration', () => {
  test('registers a read-only MCP tab and no invoke affordance', () => {
    const registered: Array<{ meta: Record<string, unknown>; view: unknown }> = []
    const ctx = {
      effect: (fn: () => unknown) => {
        fn()
        return () => {}
      },
      locale: {
        register: () => () => {},
        bind: () => (key: string) => (key === 'view.mcp' ? 'MCP' : key),
      },
      slots: {
        inject: (slot: string, setup: () => unknown) => {
          expect(slot).toBe('conversation.view')
          setup()
        },
        register: (meta: Record<string, unknown>, view: unknown) => {
          registered.push({ meta, view })
          return () => {}
        },
      },
    }
    apply(ctx as never)
    expect(name).toBe('client-ui-mcp-inspector')
    expect(inject).toEqual(['slots', 'locale'])
    expect(registered).toHaveLength(1)
    expect(registered[0].meta).toMatchObject({
      name: 'conversation.view',
      id: 'mcp-inspector',
    })
    expect(typeof registered[0].meta.label).toBe('function')
    expect((registered[0].meta.label as () => string)()).toBe('MCP')
    expect(registered[0].view).toBe(McpInspectorView)
  })
})

describe('McpInspectorView', () => {
  test('shows catalog-unavailable degrade and never claims connection status', () => {
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
    const tree = McpInspectorView({
      useSession: select =>
        select({
          nodes,
          runningCalls,
        } as never),
    } as never)
    const collected = { text: [] as string[], tags: [] as string[], handlers: [] as string[] }
    collect(tree, collected)
    const text = collected.text.join(' ')
    expect(text).toContain('catalog: unavailable in this version')
    expect(collected.text).toContain('mcp__')
    expect(collected.text).toContain('github')
    expect(text).toContain('running')
    expect(text).toContain('error')
    expect(text).not.toMatch(/connected|healthy/i)
    expect(collected.tags).not.toContain('button')
    expect(collected.handlers).toEqual([])
  })
})
