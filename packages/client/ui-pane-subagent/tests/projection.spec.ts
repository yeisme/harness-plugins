import { describe, expect, it } from 'vitest'
import { projectSubagentPane, type SubagentProjectionSource } from '../src/projection.js'

function source(overrides: Partial<SubagentProjectionSource> = {}): SubagentProjectionSource {
  return {
    rootSessionId: 'root',
    catalogs: {
      root: {
        state: 'ready',
        parentAvailable: true,
        entries: [
          { id: 'child-a', kind: 'child', mode: 'continuable', label: 'research-a', activity: 'running', hasChildren: false },
          { id: 'child-b', kind: 'child', mode: 'one-shot', label: 'writer', activity: 'inactive', hasChildren: false },
        ],
      },
    },
    summaries: {
      'child-a': {
        id: 'child-a',
        displayTitle: 'research-a',
        running: true,
        projectionValues: {
          tokenUsage: { uncachedInputTokens: 4000, outputTokens: 100, cacheReadTokens: 200, cacheWriteTokens: 50 },
        },
      },
      'child-b': { id: 'child-b', displayTitle: 'writer', running: false },
    },
    freshness: 'fresh',
    generation: 1,
    ...overrides,
  }
}

describe('projectSubagentPane', () => {
  it('folds direct child catalogs into a bounded tree', () => {
    const projection = projectSubagentPane(source())
    expect(projection.nodes.map(node => node.ref)).toEqual(['child-a', 'child-b'])
    expect(projection.runningCount).toBe(1)
    expect(projection.totalTokens).toBe(4350)
    expect(projection.nodes[0]?.label).toBe('research-a')
    expect(projection.nodes[0]?.status).toBe('running')
    expect(projection.nodes[1]?.status).toBe('inactive')
  })

  it('recurses only through child rows with hasChildren', () => {
    const input = source({
      catalogs: {
        root: {
          state: 'ready',
          entries: [
            { id: 'parent', kind: 'child', mode: 'continuable', label: 'parent', activity: 'running', hasChildren: true },
          ],
        },
        parent: {
          state: 'ready',
          entries: [
            { id: 'grandchild', kind: 'child', mode: 'one-shot', label: 'grandchild', activity: 'inactive', hasChildren: false },
          ],
        },
      },
    })
    const projection = projectSubagentPane(input)
    expect(projection.nodes.map(node => node.ref)).toEqual(['parent', 'grandchild'])
    expect(projection.nodes[1]?.depth).toBe(1)
  })

  it('skips unsafe refs and falls back to safe labels', () => {
    const input = source({
      catalogs: {
        root: {
          state: 'ready',
          entries: [
            { id: '../unsafe', kind: 'child', mode: 'one-shot', label: '/tmp/evil', activity: 'inactive', hasChildren: false },
            { id: 'ok', kind: 'child', mode: 'one-shot', label: '/abs/path', activity: 'inactive', hasChildren: false },
          ],
        },
      },
    })
    const projection = projectSubagentPane(input)
    expect(projection.nodes.map(node => node.ref)).toEqual(['ok'])
    expect(projection.nodes[0]?.label).toBe('ok')
  })
})

describe('projectSubagentPane outcome projection', () => {
  it('uses DSH-provided terminal outcomes when present', () => {
    const input = source({
      catalogs: {
        root: {
          state: 'ready',
          entries: [
            { id: 'done', kind: 'child', mode: 'one-shot', label: 'done', activity: 'inactive', hasChildren: false },
            { id: 'failed', kind: 'child', mode: 'continuable', label: 'failed', activity: 'inactive', hasChildren: false },
          ],
        },
      },
      summaries: {
        done: { id: 'done', displayTitle: 'done', running: false, outcome: 'completed' },
        failed: { id: 'failed', displayTitle: 'failed', running: false, outcome: 'failed' },
      },
    })
    const projection = projectSubagentPane(input)
    expect(projection.nodes[0]?.status).toBe('completed')
    expect(projection.nodes[1]?.status).toBe('failed')
  })
})
