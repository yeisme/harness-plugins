import { describe, expect, it } from 'vitest'
import { PaneCommandRegistry } from '../src/composition.js'
import { collectWorkspaceSearchCandidates, mergeOpenOnlyCommands, workspaceSearchStableKey } from '../src/search-identity.js'
import { highlightWorkspaceSearchText, matchWorkspaceSearchCandidate, rankWorkspaceSearchCandidates } from '../src/search-match.js'
import { projectWorkspaceSearch } from '../src/search-group.js'
import { PaneViewRegistry } from '../src/view-registry.js'
import { createPaneWorkspace, reducePaneWorkspace } from '../src/workspace.js'

function registryFixture(): PaneViewRegistry {
  const registry = new PaneViewRegistry({ capabilities: new Set() })
  registry.registerView({
    descriptor: {
      kind: 'git.status',
      label: 'Git',
      componentKey: 'git',
      role: 'content',
      preferredRegion: 'right',
      retention: 'snapshot',
      singleton: true,
      presentation: { owner: 'git', keywords: ['source control'], description: 'Source control' },
    },
    component: () => null,
  })
  registry.registerView({
    descriptor: {
      kind: 'media.gallery',
      label: '媒体库',
      componentKey: 'media',
      role: 'content',
      preferredRegion: 'right',
      retention: 'snapshot',
      singleton: true,
      presentation: { owner: 'media', keywords: ['gallery'] },
    },
    component: () => null,
  })
  registry.registerView({
    descriptor: {
      kind: 'legacy.compat',
      label: 'Legacy Compat',
      componentKey: 'legacy',
      role: 'utility',
      preferredRegion: 'bottom',
      retention: 'recreate',
      singleton: true,
      presentation: { owner: 'legacy', group: 'compatibility' },
    },
    component: () => null,
    showInPicker: false,
  })
  return registry
}

function commandFixture(): PaneCommandRegistry {
  const commands = new PaneCommandRegistry()
  commands.register({
    descriptor: {
      id: 'git.open',
      label: 'Open Git',
      presentation: { owner: 'git', task: 'open-only', icon: 'git.status' },
    },
    execute: () => {},
  })
  commands.register({
    descriptor: {
      id: 'git.commit',
      label: 'Commit',
      permission: 'git.write',
      presentation: { owner: 'git', task: 'side-effect' },
    },
    execute: () => {},
  })
  commands.register({
    descriptor: {
      id: 'media.open',
      label: '媒体库',
      presentation: { owner: 'other', task: 'open-only', icon: 'media.gallery' },
    },
    execute: () => {},
  })
  commands.register({
    descriptor: {
      id: 'legacy.open',
      label: 'Legacy Compat',
      presentation: { owner: 'legacy', group: 'compatibility', task: 'open-only', icon: 'legacy.compat' },
    },
    execute: () => {},
  })
  return commands
}

describe('workspace search identity', () => {
  it('keeps same-target open-only commands folded into the pane while namesakes and side-effect commands stay independent', () => {
    const registry = registryFixture()
    const commands = commandFixture()
    const opened = reducePaneWorkspace(createPaneWorkspace(), {
      type: 'open_view',
      request: { kind: 'git.status', resourceKey: 'view:git.status', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, title: 'Git' },
    }).state
    const candidates = collectWorkspaceSearchCandidates({
      registrations: registry.snapshot(),
      commands: commands.snapshot(),
      state: opened,
      profile: { schema: 'pane.management.v1', groups: [], favoritePaneKinds: ['git.status'], recentPaneKinds: ['git.status'] },
    })
    const gitPane = candidates.filter(item => item.kind === 'pane' && item.openTarget.viewKind === 'git.status')
    expect(gitPane).toHaveLength(1)
    expect(gitPane[0]?.mergedCommandIds).toContain('git.open')
    expect(candidates.some(item => item.commandId === 'git.open')).toBe(false)
    expect(candidates.some(item => item.commandId === 'git.commit' && item.sideEffect)).toBe(true)
    expect(candidates.some(item => item.commandId === 'media.open' && item.kind === 'command')).toBe(true)
    expect(candidates.filter(item => item.title === '媒体库').length).toBeGreaterThan(1)
  })

  it('does not merge commands that only share a title', () => {
    const merged = mergeOpenOnlyCommands([
      {
        kind: 'pane',
        stableKey: workspaceSearchStableKey('pane', 'files', 'explorer.files', 'view:explorer.files'),
        title: 'Explorer',
        semanticIcon: 'file',
        ownerRef: 'files',
        openTarget: { type: 'pane', owner: 'files', viewKind: 'explorer.files', resourceKey: 'view:explorer.files' },
        availability: 'available',
        aliases: ['Explorer'],
        keywords: [],
        opened: false,
        recent: false,
        frequent: false,
        compatibility: false,
        sideEffect: false,
        openOnly: false,
        mergedCommandIds: [],
      },
      {
        kind: 'command',
        stableKey: workspaceSearchStableKey('command', 'remote', 'remote.explorer'),
        title: 'Explorer',
        semanticIcon: 'file',
        ownerRef: 'remote',
        openTarget: { type: 'command', owner: 'remote', commandId: 'remote.explorer' },
        availability: 'available',
        aliases: ['Explorer'],
        keywords: [],
        commandId: 'remote.explorer',
        opened: false,
        recent: false,
        frequent: false,
        compatibility: false,
        sideEffect: false,
        openOnly: true,
        mergedCommandIds: [],
      },
    ])
    expect(merged).toHaveLength(2)
  })
})

describe('workspace search matching', () => {
  it('ranks exact, prefix, token, then fallback and highlights without HTML', () => {
    const registry = registryFixture()
    const candidates = collectWorkspaceSearchCandidates({
      registrations: registry.snapshot(),
      state: createPaneWorkspace(),
      profile: { schema: 'pane.management.v1', groups: [], favoritePaneKinds: [], recentPaneKinds: [] },
    })
    const ranked = rankWorkspaceSearchCandidates(candidates, 'git')
    expect(ranked[0]?.title).toBe('Git')
    expect(matchWorkspaceSearchCandidate(ranked[0]!, 'control')?.layer).toBe('token')
    expect(rankWorkspaceSearchCandidates(candidates, '媒体')[0]?.title).toBe('媒体库')
    const spans = matchWorkspaceSearchCandidate(ranked[0]!, 'git')?.spans ?? []
    const parts = highlightWorkspaceSearchText(ranked[0]!.title, spans)
    expect(parts.some(part => part.match && part.text.toLowerCase() === 'git')).toBe(true)
    expect(parts.every(part => !part.text.includes('<'))).toBe(true)
  })
})

describe('workspace search grouping', () => {
  it('omits empty recent, bounds empty-query groups, and reports found counts when totals are unknown', () => {
    const registry = registryFixture()
    const opened = reducePaneWorkspace(createPaneWorkspace(), {
      type: 'open_view',
      request: { kind: 'git.status', resourceKey: 'view:git.status', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, title: 'Git' },
    }).state
    const candidates = collectWorkspaceSearchCandidates({
      registrations: registry.snapshot(),
      commands: commandFixture().snapshot(),
      state: opened,
      profile: { schema: 'pane.management.v1', groups: [], favoritePaneKinds: ['git.status'], recentPaneKinds: [] },
    })
    const empty = projectWorkspaceSearch({ query: '', candidates })
    expect(empty.groups.some(group => group.id === 'recent')).toBe(false)
    expect(empty.groups.find(group => group.id === 'opened')?.items).toHaveLength(1)
    expect((empty.groups.find(group => group.id === 'frequent')?.items.length ?? 0)).toBeLessThanOrEqual(8)
    expect(empty.groups.find(group => group.id === 'compatibility')?.collapsed).toBe(true)

    const keyword = projectWorkspaceSearch({
      query: 'git',
      candidates,
      sessionLoadedCount: 3,
      sessionTotalUnknown: true,
    })
    expect(keyword.groups.find(group => group.id === 'pane')?.countLabelKind).toBe('exact')
    expect(keyword.visibleItems.every(item => item.kind !== 'command' || !item.compatibility)).toBe(true)
  })

  it('keeps global tools when the current project is selected and does not silently expand missing projects', () => {
    const registry = registryFixture()
    const candidates = collectWorkspaceSearchCandidates({
      registrations: registry.snapshot(),
      state: createPaneWorkspace(),
      profile: { schema: 'pane.management.v1', groups: [], favoritePaneKinds: [], recentPaneKinds: [] },
      projectRef: 'workspace:current',
    })
    const projection = projectWorkspaceSearch({
      query: 'git',
      candidates,
      filters: { category: 'all', projectRef: 'workspace:current', allAccessibleProjects: false, openedOnly: false, showCompatibility: false },
    })
    expect(projection.visibleItems.some(item => item.kind === 'pane' && item.title === 'Git')).toBe(true)
    expect(projection.activeFilterLabels).toContain('project:workspace:current')
  })

  it('filters a 5000-item local catalog without remote calls', () => {
    const started = Date.now()
    const candidates = Array.from({ length: 5_000 }, (_, index) => ({
      kind: 'pane' as const,
      stableKey: workspaceSearchStableKey('pane', 'catalog', `tool.${index}`, `view:tool.${index}`),
      title: index === 42 ? 'Exact Needle' : `Tool ${index}`,
      semanticIcon: 'window' as const,
      ownerRef: 'catalog',
      openTarget: { type: 'pane' as const, owner: 'catalog', viewKind: `tool.${index}`, resourceKey: `view:tool.${index}` },
      availability: 'available' as const,
      aliases: [`tool.${index}`],
      keywords: ['catalog'],
      opened: false,
      recent: false,
      frequent: index < 8,
      compatibility: false,
      sideEffect: false,
      openOnly: false,
      mergedCommandIds: [],
    }))
    const ranked = rankWorkspaceSearchCandidates(candidates, 'Exact Needle')
    expect(ranked[0]?.title).toBe('Exact Needle')
    expect(Date.now() - started).toBeLessThan(100)
  })

  it('keeps local 5000-item input-to-result p95 at or under 100ms', () => {
    const candidates = Array.from({ length: 5_000 }, (_, index) => ({
      kind: 'pane' as const,
      stableKey: workspaceSearchStableKey('pane', 'catalog', `tool.${index}`, `view:tool.${index}`),
      title: index === 42 ? 'Exact Needle' : `Tool ${index}`,
      semanticIcon: 'window' as const,
      ownerRef: 'catalog',
      openTarget: { type: 'pane' as const, owner: 'catalog', viewKind: `tool.${index}`, resourceKey: `view:tool.${index}` },
      availability: 'available' as const,
      aliases: [`tool.${index}`],
      keywords: ['catalog'],
      opened: false,
      recent: false,
      frequent: index < 8,
      compatibility: false,
      sideEffect: false,
      openOnly: false,
      mergedCommandIds: [],
    }))
    rankWorkspaceSearchCandidates(candidates, 'warmup')
    const samples: number[] = []
    const queries = ['Exact Needle', 'Tool 1999', 'tool.7', 'missing-target', '媒体']
    for (let index = 0; index < 20; index += 1) {
      const query = queries[index % queries.length]!
      const started = performance.now()
      const projection = projectWorkspaceSearch({ query, candidates })
      samples.push(performance.now() - started)
      if (query === 'Exact Needle') expect(projection.visibleItems[0]?.title).toBe('Exact Needle')
    }
    samples.sort((left, right) => left - right)
    const p95 = samples[Math.ceil(samples.length * 0.95) - 1]!
    // Evidence runner parses this line; keep the p95= token stable.
    console.info(`workspace-search local catalog p95=${p95.toFixed(2)}ms n=${samples.length}`)
    expect(p95, `p95=${p95.toFixed(2)}ms samples=${samples.map(value => value.toFixed(2)).join(',')}`).toBeLessThanOrEqual(100)
  })
})
