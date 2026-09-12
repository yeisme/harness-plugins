import { createElement, type ComponentType, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { SessionToolsWorkspace } from '../src/client/workspace-state.ts'
import { apply } from '../src/client/index.ts'
import { en } from '../src/client/locales.ts'
import { ToolHubSidecar } from '../../../host/dsh-tool-hub/src/service.ts'
import { PaneWorkbenchController } from '../../ui-pane-workbench/src/controller.ts'
import { PaneViewRegistry } from '../../ui-pane-workbench/src/view-registry.ts'
import { searchSourcesFor, type SearchCenterOwnerSource } from '../../ui-pane-workbench/src/search-source-registry.ts'
import type { PaneViewSpecV1 } from '../../ui-pane-workbench/src/workspace.ts'

describe('real Tools owner to Search registration', () => {
  it('registers strict session search and opens the bound owner pane, then revokes removed sessions', async () => {
    const views = new PaneViewRegistry({ capabilities: new Set() })
    const controller = new PaneWorkbenchController({ registry: views })
    const sources = searchSourcesFor(controller)
    const pane = { controller, registerView: (input: unknown) => views.registerView(input), registerSearchSource: (source: SearchCenterOwnerSource) => sources.register(source), openView: (input: PaneViewSpecV1) => controller.openView(input) }
    let ids = ['a', 'b']
    let changed = () => {}
    const offSessions = vi.fn()
    const sessions = { list: { getSnapshot: () => ({ ids, byId: {} }), subscribe: (fn: () => void) => { changed = fn; return offSessions } } }
    let toolsPresent = true
    const tools = vi.fn(async (_input: unknown) => ({ ok: true, value: { scopeResolved: true, tools: toolsPresent ? [{ name: 'read' }] : [] } }))
    const skills = vi.fn(async (_input: unknown) => ({ ok: true, value: { scopeResolved: true, catalogComplete: true, skills: [] } }))
    const execute = vi.fn()
    const slots = { inject: (_name: string, setup: () => () => void) => setup(), register: () => () => {} }
    const ctx = {
      locale: { register: () => () => {}, bind: () => (key: string) => en[key as keyof typeof en] ?? key },
      get: (key: string) => ({ paneWorkbench: pane, sessions, slots, remote: { referenceTools: { list: tools, execute }, skills: { list: skills } } } as Record<string, unknown>)[key],
      provide: () => () => {}, on: () => () => {},
    }
    const dispose = apply(ctx as never)
    const request = { query: 'read', scope: { kind: 'session' as const, ref: 'a' }, kinds: ['native-tool' as const], filters: {}, sort: 'relevance' as const }
    const page = await sources.query('dsh.tools.session', request, new AbortController().signal)
    expect(page.status).toBe('ready')
    expect(page.results).toHaveLength(1)
    expect(tools).toHaveBeenCalledWith({ sessionId: 'a', requireResolvedScope: true }, expect.any(AbortSignal))
    expect(await sources.open(page.results[0]!)).toEqual({ status: 'opened' })
    const view = Object.values(controller.getSnapshot().views).find(view => view.kind === 'mcp-inspector')!
    expect(view.resourceKey).toBe('session:a')
    expect(view.metadata).toMatchObject({ sessionId: 'a' })
    const component = views.get('mcp-inspector')!.component as (props: { view: typeof view }) => ReactElement<{ workspace: SessionToolsWorkspace }>
    const workspace = component({ view }).props.workspace
    toolsPresent = false
    await workspace.get('a').controller.refresh()
    expect(await sources.open(page.results[0]!)).toEqual({ status: 'unavailable' })
    expect(await sources.query('dsh.tools.session', request, new AbortController().signal)).toMatchObject({ status: 'ready', results: [] })
    ids = ['b']; changed()
    expect(await sources.open(page.results[0]!)).toEqual({ status: 'unavailable' })
    expect(await sources.query('dsh.tools.session', request, new AbortController().signal)).toMatchObject({ status: 'denied', results: [] })
    expect(execute).not.toHaveBeenCalled()
    dispose(); expect(offSessions).toHaveBeenCalledOnce()
    expect(sources.getSnapshot()).toEqual([])
    controller.dispose()
  })
  it.each([false, true])('uses the original owner and opens disabled Skill details without a write (read-only port: %s)', async readOnly => {
    const put = vi.fn(async () => {})
    const collect = vi.fn(async () => ({ skills: [{ name: 'review', description: 'Review repo', source: 'fixture-provider', invocation: { modelInvocable: true } }], skillsComplete: true,
      tools: [{ name: 'read_file', description: 'Read metadata' }, { name: 'mcp__repo__read', description: 'MCP metadata' }], pluginEntries: [], mcpHealth: [] }))
    const owner = new ToolHubSidecar({ table: { get: () => ({ disabled: ['skill:review'], version: 'fixture:1', updatedAt: 0 }), put }, catalog: { collect } })
    const enable = vi.spyOn(owner, 'setEnabled')
    const remote = { list: () => owner.list(), ...(readOnly ? {} : { setEnabled: owner.setEnabled.bind(owner) }) }
    const views = new PaneViewRegistry({ capabilities: new Set() })
    const controller = new PaneWorkbenchController({ registry: views })
    const sources = searchSourcesFor(controller)
    const pane = { controller, registerView: (input: unknown) => views.registerView(input), registerSearchSource: (source: SearchCenterOwnerSource) => sources.register(source), openView: (input: PaneViewSpecV1) => controller.openView(input) }
    const sessionSnapshot = { ids: [], byId: {} }
    const sessions = { list: { getSnapshot: () => sessionSnapshot, subscribe: () => () => {} } }
    const slots = { inject: (_name: string, setup: () => () => void) => setup(), register: () => () => {} }
    const ctx = {
      locale: { register: () => () => {}, bind: () => (key: string) => en[key as keyof typeof en] ?? key },
      get: (key: string) => ({ paneWorkbench: pane, sessions, slots, remote: { toolHub: remote }, 'remote.toolHub': remote } as Record<string, unknown>)[key],
      provide: () => () => {}, on: () => () => {},
    }
    const dispose = apply(ctx as never)
    expect(sources.getSnapshot()).toMatchObject([{ id: 'dsh.tools.installed', resourceKinds: ['skill', 'native-tool'], scopes: ['profile'], preview: false }, { id: 'dsh.tools.session', scopes: ['session'], preview: false }])
    const request = { query: 'review', scope: { kind: 'profile' as const }, kinds: ['skill' as const, 'native-tool' as const], filters: {}, sort: 'relevance' as const }
    const page = await sources.query('dsh.tools.installed', request, new AbortController().signal)
    expect(page.status).toBe('ready')
    expect(page.results).toHaveLength(1)
    const result = page.results[0]!
    expect(result).toMatchObject({ adapter: 'source', kind: 'skill', resource: { status: 'disabled', availability: 'available', revision: 'catalog:1', sourceLabel: 'fixture-provider' } })
    expect(await sources.open(result)).toEqual({ status: 'opened' })
    const view = Object.values(controller.getSnapshot().views).find(view => view.kind === 'tools-manager')!
    expect(view.resourceKey).toBe('tools-manager')
    const component = views.get('tools-manager')!.component as ComponentType<{ view: typeof view }>
    const html = renderToStaticMarkup(createElement(component, { view }))
    expect(html).toContain('data-active-section="details"')
    expect(html).toContain('review')
    expect(html).toContain('fixture-provider')
    expect(enable).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
    const count = collect.mock.calls.length
    expect(await sources.query('dsh.tools.installed', { ...request, scope: { kind: 'workspace', ref: 'w1' } }, new AbortController().signal)).toMatchObject({ status: 'disabled', reason: 'scope_unsupported' })
    expect(collect).toHaveBeenCalledTimes(count)
    dispose()
    expect(sources.getSnapshot()).toEqual([])
    expect(await sources.open(result)).toEqual({ status: 'unavailable' })
    controller.dispose()
  })
})
