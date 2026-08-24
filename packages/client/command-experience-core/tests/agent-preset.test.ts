import { describe, expect, it } from 'vitest'
import {
  flattenThreadProjection,
  isBareAgentCommand,
  resolveAgentToken,
  retainStaleThreadSelection,
  selectThreadRef,
} from '../src/agent-preset'

const tree = [
  {
    ref: 'thread:main',
    displayName: 'Main',
    parentRef: null,
    active: true,
    children: [
      {
        ref: 'thread:worker',
        displayName: 'Worker',
        parentRef: 'thread:main',
        children: [
          { ref: 'thread:leaf', displayName: 'Leaf', parentRef: 'thread:worker' },
        ],
      },
    ],
  },
]

const presets = [
  { ref: 'preset:review', name: 'review' },
  { ref: 'preset:writer', name: 'writer' },
]

describe('agent/preset adapters', () => {
  it('flattens recursive subagent projections without calling a preset API', () => {
    const flat = flattenThreadProjection(tree)
    expect(flat.map((node) => node.ref)).toEqual([
      'thread:main',
      'thread:worker',
      'thread:leaf',
    ])
    expect(isBareAgentCommand('agent', undefined)).toBe(true)
    expect(isBareAgentCommand('agent', 'review')).toBe(false)
  })

  it('does not auto-select a neighbor when the selected thread disappears', () => {
    const stale = retainStaleThreadSelection(tree, 'thread:gone')
    expect(stale.nextSelectedRef).toBeNull()
    expect(stale.refreshRequired).toBe(true)
    expect(selectThreadRef(tree, 'thread:gone').ok).toBe(false)
    expect(selectThreadRef(tree, 'thread:leaf')).toEqual({ ok: true, threadRef: 'thread:leaf' })
  })

  it('routes unique legacy /agent <preset> and fail-closes collisions', () => {
    expect(resolveAgentToken('review', tree, presets)).toEqual({
      kind: 'legacy-preset',
      presetRef: 'preset:review',
      replacement: '/preset',
    })
    expect(resolveAgentToken('thread:leaf', tree, presets)).toEqual({
      kind: 'thread',
      threadRef: 'thread:leaf',
    })
    const collisionPresets = [...presets, { ref: 'thread:leaf', name: 'leaf' }]
    const collision = resolveAgentToken('thread:leaf', tree, collisionPresets)
    expect(collision.kind).toBe('fail-closed')
    expect(collision.kind === 'fail-closed' && collision.reason).toContain('Ambiguous')
    expect(resolveAgentToken('nope', tree, presets).kind).toBe('fail-closed')
  })
})
