import { describe, expect, it } from 'vitest'
import { deriveExceptionFirstProjection } from '../src/client/exception-projection.ts'

describe('deriveExceptionFirstProjection (exception-director 1.2/1.3)', () => {
  it('surfaces the sorted primary blocker with a remaining count, never a wall', () => {
    const projection = deriveExceptionFirstProjection({
      state: 'ready',
      showTitle: 'Show A',
      blockerRefs: ['blk-c', 'blk-a', 'blk-b'],
      impactedEpisodeRefs: ['ep-1', 'ep-2', 'ep-1'],
      safeMessage: 'rights review pending',
      actions: [{ actionId: 'act-1', label: 'Approve rights', kind: 'submit' }],
    })
    expect(projection.primaryBlocker).toEqual({ ref: 'blk-a', remaining: 2 })
    expect(projection.impactScopeCount).toBe(2)
    expect(projection.ownerReason).toBe('rights review pending')
    expect(projection.nextAction).toMatchObject({ actionId: 'act-1', disabled: false })
    expect(projection.deepLinks).toEqual({ review: 'drama.review', run: 'drama.run', delivery: 'drama.delivery' })
    expect(projection.workbenchDeepLink).toBe(true)
    expect(projection.mutationsDisabled).toBe(false)
  })

  it('typed degradation states disable mutation without retrying or inferring', () => {
    for (const state of ['unknown', 'partial', 'stale', 'offline'] as const) {
      const projection = deriveExceptionFirstProjection({
        state,
        blockerRefs: ['blk-a'],
        actions: [{ actionId: 'act-1', label: 'Go', kind: 'submit' }],
      })
      expect(projection.state).toBe(state === 'offline' ? 'owner-unavailable' : state)
      expect(projection.mutationsDisabled).toBe(true)
      expect(projection.nextAction?.disabled).toBe(true)
      expect(projection.nextAction?.disabledReason).toContain('state:')
    }
    expect(deriveExceptionFirstProjection({}).state).toBe('unknown')
  })

  it('actions with owner disabled reasons surface the reason verbatim', () => {
    const projection = deriveExceptionFirstProjection({
      state: 'ready',
      actions: [{ actionId: 'act-1', label: 'Submit', kind: 'submit', disabledReason: 'awaiting rights clearance' }],
    })
    expect(projection.nextAction).toMatchObject({ actionId: 'act-1', disabled: true, disabledReason: 'awaiting rights clearance' })
  })

  it('no blockers means no blocker block and no workbench overflow link', () => {
    const projection = deriveExceptionFirstProjection({ state: 'ready', showTitle: 'Clean show' })
    expect(projection.primaryBlocker).toBeUndefined()
    expect(projection.workbenchDeepLink).toBe(false)
    expect(projection.nextAction).toBeUndefined()
  })
})
