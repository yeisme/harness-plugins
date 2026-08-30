import { describe, expect, it } from 'vitest'
import { buildDecisionRequest, deriveDecisionTokenView, refreshDecisionOutcome, type DecisionDescriptorLike } from '../src/client/decision-token.ts'

const future = new Date(Date.now() + 60_000).toISOString()
const past = new Date(Date.now() - 60_000).toISOString()

function descriptor(overrides: Partial<DecisionDescriptorLike> = {}): DecisionDescriptorLike {
  return {
    descriptorRef: 'decision-token-1',
    owner: 'ordo',
    actionId: 'drama.cost.approve',
    targetRef: 'delivery:item-1',
    targetVersion: 'v3',
    expiresAt: future,
    confirmation: 'confirm',
    preview: { summary: 'approve cost estimate', cost: { currency: 'CNY', amount: 120, estimate: true } },
    ...overrides,
  }
}

describe('deriveDecisionTokenView (2.1 exact preview + expiry gate)', () => {
  it('submittable tokens carry the server-minted ref and exact target/effect facts', () => {
    const view = deriveDecisionTokenView('cost', descriptor())
    expect(view).toMatchObject({ kind: 'cost', token: 'decision-token-1', owner: 'ordo' })
    expect(view.target).toEqual({ ref: 'delivery:item-1', version: 'v3' })
    expect(view.mutationsDisabled).toBe(false)
    expect(view.summary).toContain('cost')
  })

  it('expired or unminted tokens disable mutation with the reason', () => {
    expect(deriveDecisionTokenView('rights', descriptor({ expiresAt: past }))).toMatchObject({ state: 'expired', mutationsDisabled: true })
    expect(deriveDecisionTokenView('rights', descriptor({ descriptorRef: '' }))).toMatchObject({ state: 'missing-token', token: undefined, mutationsDisabled: true })
  })

  it('declared kinds must match the preview facts (cost without numbers, rights without status)', () => {
    const bare = { summary: 'nothing' }
    expect(deriveDecisionTokenView('cost', descriptor({ preview: bare }))).toMatchObject({ state: 'preview-inconsistent' })
    expect(deriveDecisionTokenView('rights', descriptor({ preview: bare }))).toMatchObject({ state: 'preview-inconsistent' })
    expect(deriveDecisionTokenView('canonical-accept', descriptor({ preview: bare })).state).toBe('submittable')
  })
})

describe('buildDecisionRequest (2.1 CAS echo)', () => {
  it('echoes the minted token and target verbatim with a bounded idempotency key', () => {
    const view = deriveDecisionTokenView('cost', descriptor())
    const built = buildDecisionRequest(view, { context: { workspace: 'w1' }, values: { approved: true }, idempotencyKey: 'key-12345678' })
    expect('request' in built).toBe(true)
    if ('request' in built) {
      expect(built.request).toMatchObject({ descriptorRef: 'decision-token-1', expectedTargetVersion: 'v3', idempotencyKey: 'key-12345678' })
    }
  })

  it('refuses disabled tokens and out-of-bounds idempotency keys', () => {
    const expired = deriveDecisionTokenView('cost', descriptor({ expiresAt: past }))
    expect(buildDecisionRequest(expired, { context: {}, values: {}, idempotencyKey: 'key-12345678' })).toMatchObject({ error: expect.stringContaining('expired') })
    const view = deriveDecisionTokenView('cost', descriptor())
    expect(buildDecisionRequest(view, { context: {}, values: {}, idempotencyKey: 'short' })).toMatchObject({ error: expect.stringContaining('8-160') })
  })
})

describe('refreshDecisionOutcome (2.2 idempotent refresh)', () => {
  it('drift is stale-disable; terminal receipts return as-is; already-decided only refetches', () => {
    expect(refreshDecisionOutcome({ status: 'ok' }, { digestChanged: true })).toEqual({ action: 'stale-disable' })
    expect(refreshDecisionOutcome({ status: 'ok' }, { contextRevisionChanged: true })).toEqual({ action: 'stale-disable' })
    expect(refreshDecisionOutcome({ status: 'ok' }, {})).toEqual({ action: 'return-original' })
    expect(refreshDecisionOutcome(undefined, { ownerReportsAlreadyDecided: true })).toEqual({ action: 'refetch' })
    expect(refreshDecisionOutcome(undefined, {})).toEqual({ action: 'refetch' })
  })
})
