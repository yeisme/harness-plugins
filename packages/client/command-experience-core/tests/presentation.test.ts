import { describe, expect, it } from 'vitest'
import {
  P1_CANDIDATE_NAMES,
  buildP0Catalog,
  executableResults,
  expectedPresentationFor,
  isP1CandidateWithoutHandler,
  projectCommandDetail,
  projectPaletteGroups,
  projectSlashAssistRows,
  rankCommandsForScope,
  resolveCanonicalIdentity,
  sharedActionIdentity,
  slashAssistLimitForViewport,
} from '../src/index'
import type { CommandExperienceEntryV1 } from '../src/types'

function entry(partial: Partial<CommandExperienceEntryV1> & Pick<CommandExperienceEntryV1, 'canonicalName'>): CommandExperienceEntryV1 {
  return {
    aliases: [],
    description: partial.description ?? partial.canonicalName,
    category: 'discovery',
    input: {},
    surfaces: ['web', 'tui'],
    actionKind: 'local',
    owner: 'client',
    danger: 'safe',
    availability: { state: 'available' },
    coverage: 'equivalent',
    ...partial,
  }
}

describe('command detail projection', () => {
  it('derives detail only from descriptor fields and never carries a handler', () => {
    const catalog = buildP0Catalog({
      availableActions: new Set(),
    })
    const archive = catalog.find((item) => item.canonicalName === 'archive')
    expect(archive).toBeDefined()
    const detail = projectCommandDetail(archive!)
    expect(detail).toEqual({
      canonicalName: 'archive',
      aliases: [],
      description: archive!.description,
      category: 'session',
      actionKind: 'owner-action',
      owner: 'dsh',
      danger: 'confirm',
      availability: {
        state: 'disabled',
        reason: 'missing owner action archive-session',
      },
      coverage: 'staged',
      expectedPresentation: 'selector',
    })
    expect(JSON.stringify(detail)).not.toMatch(/handler|import\(|https?:|apiKey/i)
    expect('handler' in detail).toBe(false)
  })

  it('maps selector, confirm, destructive, and inspect to expected presentation', () => {
    const catalog = buildP0Catalog({ availableActions: new Set(['delete-session', 'status']) })
    expect(expectedPresentationFor(catalog.find((item) => item.canonicalName === 'session')!)).toBe('selector')
    expect(expectedPresentationFor(catalog.find((item) => item.canonicalName === 'compact')!)).toBe('popover')
    expect(expectedPresentationFor(catalog.find((item) => item.canonicalName === 'delete')!)).toBe('selector')
    expect(expectedPresentationFor(catalog.find((item) => item.canonicalName === 'quit')!)).toBe('popover')
    expect(expectedPresentationFor(catalog.find((item) => item.canonicalName === 'status')!)).toBe('pane-preview')
    expect(expectedPresentationFor(catalog.find((item) => item.canonicalName === 'copy')!)).toBe('inline')
    expect(expectedPresentationFor(entry({
      canonicalName: 'wipe',
      danger: 'destructive',
      actionKind: 'owner-action',
      owner: 'dsh',
    }))).toBe('dialog')
  })

  it('resolves aliases to the canonical identity without a second handler', () => {
    const catalog = buildP0Catalog()
    expect(resolveCanonicalIdentity(catalog, 'files')?.canonicalName).toBe('explorer')
    expect(resolveCanonicalIdentity(catalog, 'exit')?.canonicalName).toBe('quit')
    expect(resolveCanonicalIdentity(catalog, 'sessions')?.canonicalName).toBe('session')
    expect(sharedActionIdentity('files', 'explorer', catalog)).toBe(true)
    expect(sharedActionIdentity('exit', 'quit', catalog)).toBe(true)
  })
})

describe('context ranking', () => {
  it('ranks exact match, executable session context, recent, then category/name', () => {
    const commands = [
      entry({ canonicalName: 'skills', category: 'discovery', description: 'Inspect skills' }),
      entry({
        canonicalName: 'git',
        category: 'discovery',
        description: 'Source control',
        availability: { state: 'disabled', reason: 'Source Control pane is not installed' },
      }),
      entry({
        canonicalName: 'session',
        aliases: ['sessions'],
        category: 'session',
        description: 'Manage sessions',
        actionKind: 'owner-action',
        owner: 'dsh',
      }),
      entry({ canonicalName: 'status', category: 'discovery', description: 'Show runtime status' }),
    ]
    const ranked = rankCommandsForScope(commands, {
      query: '/s',
      surface: 'web',
      recentCanonicalNames: ['status'],
      activeCategories: ['session'],
    })
    expect(ranked.map((row) => row.command.canonicalName)).toEqual([
      'session',
      'status',
      'skills',
      'git',
    ])
    expect(ranked.find((row) => row.command.canonicalName === 'git')?.command.availability.reason)
      .toBe('Source Control pane is not installed')
  })

  it('keeps disabled rows visible with a reason and out of executable results', () => {
    const catalog = buildP0Catalog()
    const ranked = rankCommandsForScope(catalog, { query: '/mcp', surface: 'web' })
    const mcp = ranked.find((row) => row.command.canonicalName === 'mcp')
    expect(mcp).toBeDefined()
    expect(mcp?.command.availability.state).toBe('disabled')
    expect(mcp?.command.availability.reason).toContain('MCP inspector')
    expect(executableResults(catalog).some((item) => item.canonicalName === 'mcp')).toBe(false)
  })

  it('caps slash assist and groups the full palette from the same ranking', () => {
    const catalog = buildP0Catalog({
      availableActions: new Set(['open-session', 'new-chat', 'set-model']),
    })
    const assist = projectSlashAssistRows(catalog, {
      query: '/',
      surface: 'web',
      activeCategories: ['session'],
      limit: 8,
    })
    expect(assist.length).toBeLessThanOrEqual(8)
    const groups = projectPaletteGroups(catalog, { surface: 'web' })
    const all = [...groups.values()].flat().map((row) => row.command.canonicalName)
    expect(all).toEqual(expect.arrayContaining(['help', 'session', 'model', 'compact', 'quit', 'init']))
    expect(slashAssistLimitForViewport(36)).toBe(8)
    expect(slashAssistLimitForViewport(24)).toBe(6)
    expect(slashAssistLimitForViewport(20)).toBe(4)
    expect(slashAssistLimitForViewport(12)).toBe(3)
  })

  it('does not publish P1 candidates without a live handler as executable', () => {
    const catalog = buildP0Catalog()
    for (const name of P1_CANDIDATE_NAMES) {
      expect(isP1CandidateWithoutHandler(name, catalog)).toBe(true)
      expect(executableResults(catalog).some((item) => item.canonicalName === name)).toBe(false)
      expect(resolveCanonicalIdentity(catalog, name)).toBeNull()
    }
  })

  it('is deterministic across repeated ranking of the live P0 catalog', () => {
    const catalog = buildP0Catalog({ availableActions: new Set(['open-session']) })
    const first = rankCommandsForScope(catalog, { query: '/s', surface: 'web' })
      .map((row) => row.command.canonicalName)
    const second = rankCommandsForScope(catalog, { query: '/s', surface: 'web' })
      .map((row) => row.command.canonicalName)
    expect(first).toEqual(second)
    expect(first[0]).toBe('session')
  })
})
