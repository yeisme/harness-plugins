import { describe, expect, it } from 'vitest'
import { lineageLabel, sessionLineageLabel } from '../../src/client/lineage.ts'

describe('rewrite lineage', () => {
  it('labels a child session with parent and origin without inventing RPC state', () => {
    expect(lineageLabel({ sessionId: 'child-1', parentSessionId: 's1', origin: 'retry' })).toEqual({
      sessionId: 'child-1',
      parentSessionId: 's1',
      origin: 'retry',
      text: 'From s1 · retry',
    })
    expect(lineageLabel({ sessionId: 's1' }).text).toBe('Original session')
  })

  it('maps a session-list row without inventing parent or origin', () => {
    expect(sessionLineageLabel({ sessionId: 'child-2', parentSessionId: 's1', origin: 'edit' }).text).toBe('From s1 · edit')
    expect(sessionLineageLabel({ sessionId: 's1' }).text).toBe('Original session')
  })
})
