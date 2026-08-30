// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { PaneActivityRail, deriveRailCategories } from '../src/chrome/rail.js'
import { PaneViewRegistry } from '../src/view-registry.ts'
import { pluginDefinition } from './fixtures.js'
import type { PaneViewInstanceV1, PaneWorkspaceV1 } from '../src/workspace.js'

afterEach(cleanup)

function view(id: string, kind: string, groupId = 'g1'): PaneViewInstanceV1 {
  return { id, kind, groupId, role: 'content', title: `View ${id}`, status: 'ready', pinned: false }
}

function workspace(views: readonly PaneViewInstanceV1[], activeTabId?: string): PaneWorkspaceV1 {
  const group = { id: 'g1', region: 'right' as const, role: 'content' as const, tabs: views.map(v => v.id), activeTabId, locked: false }
  return {
    regions: { right: { visible: true, root: { type: 'group', groupId: 'g1' } }, bottom: { visible: false, root: { type: 'group', groupId: 'g2' } } },
    groups: { g1: group, g2: { ...group, id: 'g2' } },
    views: Object.fromEntries(views.map(v => [v.id, v])),
    activeGroupId: 'g1',
    maximizedGroupId: undefined,
  } as PaneWorkspaceV1
}

function registryWith(kinds: readonly string[]): PaneViewRegistry {
  const registry = new PaneViewRegistry({ capabilities: new Set<string>() })
  for (const kind of kinds) {
    const definition = pluginDefinition(kind, { kind })
    registry.registerView({ descriptor: definition.views[0]!, component: () => null })
  }
  return registry
}

const controller = { dispatch: vi.fn(), subscribeWorkspace: () => () => {}, getSnapshot: workspace([]) } as never

describe('deriveRailCategories (V3 2.3 provider-category aggregation)', () => {
  it('returns nothing for zero open views', () => {
    expect(deriveRailCategories([], workspace([]), registryWith(['k.terminal']))).toEqual([])
  })

  it('one category per kind regardless of resource count (no rail bloat)', () => {
    const views = [view('t1', 'k.terminal'), view('t2', 'k.terminal'), view('t3', 'k.terminal'), view('m1', 'k.media')]
    const categories = deriveRailCategories(views, workspace(views), registryWith(['k.terminal', 'k.media']))
    expect(categories.map(c => c.kind)).toEqual(['k.terminal', 'k.media'])
    expect(categories[0]!.views).toHaveLength(3)
    expect(categories[0]!.icon).toBe('terminal')
    expect(categories[1]!.views).toHaveLength(1)
  })

  it('activation targets the category active member, else the first', () => {
    const views = [view('t1', 'k.terminal'), view('t2', 'k.terminal')]
    const registry = registryWith(['k.terminal'])
    const withActive = workspace(views, 't2')
    const categories = deriveRailCategories(views, withActive, registry)
    expect(categories[0]!.targetViewId).toBe('t2')
    const withoutActive = workspace(views)
    expect(deriveRailCategories(views, withoutActive, registry)[0]!.targetViewId).toBe('t1')
  })

  it('drops categories whose provider disposed (kind no longer registered)', () => {
    const views = [view('t1', 'k.terminal'), view('o1', 'k.gone')]
    const categories = deriveRailCategories(views, workspace(views), registryWith(['k.terminal']))
    expect(categories.map(c => c.kind)).toEqual(['k.terminal'])
  })

  it('core rail kinds are excluded from category aggregation (they have dedicated buttons)', () => {
    const views = [view('e1', 'dsh.explorer'), view('g1', 'dsh.source-control'), view('t1', 'k.terminal')]
    const categories = deriveRailCategories(views, workspace(views), registryWith(['dsh.explorer', 'dsh.source-control', 'k.terminal']))
    expect(categories.map(c => c.kind)).toEqual(['k.terminal'])
  })
})

describe('PaneActivityRail rendering (V3 2.3)', () => {
  it('renders one aggregated button with count badge for multi-resource kinds', () => {
    const views = [view('t1', 'k.terminal'), view('t2', 'k.terminal'), view('t3', 'k.terminal')]
    const state = workspace(views, 't2')
    const { container } = render(createElement(PaneActivityRail, {
      registry: registryWith(['k.terminal']),
      controller,
      state,
      bodyVisible: true,
      onOpenPicker: () => {},
    }))
    const categoryButtons = container.querySelectorAll('[data-pane-kind-category]')
    expect(categoryButtons).toHaveLength(0) // placeholder until data attr asserted below
    const badges = container.querySelectorAll('.pwr-icon-badge')
    expect(badges).toHaveLength(1)
    expect(badges[0]!.textContent).toBe('3')
    expect(badges[0]!.getAttribute('aria-hidden')).toBe('true')
    // one button per kind: exactly one category-level activate dispatch target
    const activeButtons = container.querySelectorAll('.pwr-active')
    expect(activeButtons).toHaveLength(1)
  })
})
