import { describe, expect, it } from 'vitest'
import {
  HOST_DIRECTORY_SOURCE,
  HOST_SOURCE_PRIORITY,
  PANE_DIRECTORY_SOURCE,
  PANE_SOURCE_PRIORITY,
  createLiveSlashDirectory,
  mergeLiveDirectory,
  reservedSlashNames,
} from '../src/live-directory'
import { buildP0Catalog } from '../src/p0-catalog'
import type { CommandExperienceEntryV1 } from '../src/types'

function entry(name: string, extra: Partial<CommandExperienceEntryV1> = {}): CommandExperienceEntryV1 {
  return {
    canonicalName: name,
    aliases: [],
    description: `${name} command`,
    category: 'pane',
    input: {},
    surfaces: ['web'],
    actionKind: 'navigation',
    owner: 'host',
    danger: 'safe',
    availability: { state: 'available' },
    coverage: 'adapted',
    ...extra,
  }
}

describe('live slash directory', () => {
  it('keeps reserved P0 names when a pane tries to claim them', () => {
    const p0 = buildP0Catalog()
    const snapshot = mergeLiveDirectory([
      { source: 'p0', priority: 100, commands: p0 },
      { source: PANE_DIRECTORY_SOURCE, priority: PANE_SOURCE_PRIORITY, commands: [entry('mcp')] },
    ], reservedSlashNames(p0))

    expect(snapshot.rpcIssued).toBe(false)
    const kept = snapshot.commands.find((item) => item.canonicalName === 'mcp' && item.input.schemaKey === 'inspect:mcp')
    expect(kept).toBeDefined()
    const rejected = snapshot.commands.filter((item) => item.canonicalName === 'mcp' && item !== kept)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]?.availability.reason).toContain('reserved')
    expect(snapshot.conflicts.some((conflict) => conflict.canonicalName === 'mcp')).toBe(true)
  })

  it('disables later pane collisions instead of throwing', () => {
    const snapshot = mergeLiveDirectory([
      { source: PANE_DIRECTORY_SOURCE, priority: PANE_SOURCE_PRIORITY, commands: [entry('creator')] },
      { source: 'pane-other', priority: 40, commands: [entry('creator', { description: 'other' })] },
    ], new Set())

    expect(() => snapshot.commands).not.toThrow()
    const disabled = snapshot.commands.find((item) => item.availability.state === 'disabled')
    expect(disabled?.availability.reason).toContain('conflict')
    expect(snapshot.conflicts).toHaveLength(1)
  })

  it('hot-unplugs a pane source without RPC and keeps P0', () => {
    const directory = createLiveSlashDirectory({
      availableActions: new Set(),
      surfaces: new Set(['paneWorkbench', 'explorer']),
    })
    let ticks = 0
    const unsubscribe = directory.subscribe(() => {
      ticks += 1
    })
    directory.setSource({
      source: PANE_DIRECTORY_SOURCE,
      priority: PANE_SOURCE_PRIORITY,
      commands: [entry('creator')],
    })
    expect(directory.snapshot().commands.some((item) => item.canonicalName === 'creator')).toBe(true)
    directory.removeSource(PANE_DIRECTORY_SOURCE)
    expect(directory.snapshot().commands.some((item) => item.canonicalName === 'creator')).toBe(false)
    expect(directory.snapshot().commands.some((item) => item.canonicalName === 'pane')).toBe(true)
    expect(ticks).toBe(2)
    unsubscribe()
  })

  it('projects host commands beside P0 without claiming reserved names', () => {
    const p0 = buildP0Catalog()
    const snapshot = mergeLiveDirectory([
      { source: 'p0', priority: 100, commands: p0 },
      {
        source: HOST_DIRECTORY_SOURCE,
        priority: HOST_SOURCE_PRIORITY,
        commands: [entry('yeisme-foo', { category: 'discovery', actionKind: 'inspect' })],
      },
    ], reservedSlashNames(p0))
    expect(snapshot.commands.some((item) => item.canonicalName === 'yeisme-foo')).toBe(true)
  })
})
