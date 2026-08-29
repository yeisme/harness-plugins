import { describe, expect, it } from 'vitest'
import { countByAvailability, countByFamily, filterCatalog } from '../src/client/filter.ts'
import type { ToolHubItemV1 } from '../src/client/wire.ts'

const items: readonly ToolHubItemV1[] = [
  { id: 'skill:writer', family: 'skill', origin: 'skill', name: 'writer', label: 'writer', description: 'Write docs', source: 'user', availability: 'available', enabled: true, canToggle: true },
  { id: 'mcp:github', family: 'mcp', origin: 'mcp', name: 'github', label: 'mcp__github', description: 'issues', source: 'mcp-client', availability: 'disabled', enabled: false, canToggle: true },
  { id: 'tool:read_file', family: 'native', origin: 'native', name: 'read_file', label: 'read_file', description: 'Read a file', source: 'tools', availability: 'available', enabled: true, canToggle: true },
  { id: 'tool:legacy', family: 'native', origin: 'native', name: 'legacy', label: 'legacy', description: '', source: 'tools', availability: 'unavailable', enabled: false, canToggle: false },
]

describe('filterCatalog', () => {
  it('filters by query, family, and enabled state', () => {
    expect(filterCatalog(items, { query: 'git', family: 'all', enabled: 'all' }).map(item => item.id)).toEqual(['mcp:github'])
    expect(filterCatalog(items, { query: '', family: 'skill', enabled: 'all' }).map(item => item.id)).toEqual(['skill:writer'])
    expect(filterCatalog(items, { query: '', family: 'all', enabled: 'disabled' }).map(item => item.id)).toEqual(['mcp:github'])
    expect(filterCatalog(items, { query: '', family: 'all', enabled: 'unavailable' }).map(item => item.id)).toEqual(['tool:legacy'])
  })

  it('counts families from the unfiltered catalog', () => {
    expect(countByFamily(items)).toEqual({ all: 4, mcp: 1, skill: 1, native: 2 })
    expect(countByAvailability(items)).toEqual({ all: 4, enabled: 2, disabled: 1, unavailable: 1 })
  })
})
