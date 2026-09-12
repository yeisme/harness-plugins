import { expect, it, vi } from 'vitest'
import { createSelectableEikonaReviewAdapter } from '../src/eikona-selection-adapter.ts'
import type { EikonaDiscoveryClient } from '../src/eikona-discovery-client.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'
const context: CreatorStudioContextV1 = { tenantRef: 'tenant:test', workspaceRef: 'workspace:test', projectRef: 'project:test', sessionRef: 'session:test', principalRef: 'principal:test', membershipRevision: '1', installationRef: 'installation:test', pluginDigest: 'digest:test', policyRevision: '1', runtimeGeneration: '1', revision: '1' }
const selection = (id = 'one') => ({ artifactRef: `eikona://artifacts/run/${id}`, contentDigest: 'a'.repeat(64) })
const review = { status: 'ready', runId: 'run', projectId: 'project', observedAt: '2026-09-08T00:00:00Z', ownerDecision: 'pending', admissionState: 'unknown', canDecide: true, canSupersede: false,
  candidates: ['one', 'two'].map(candidateId => ({ candidateId, label: candidateId, ...selection(candidateId), decisionVersion: 0, decisionState: 'pending' })) }
function setup() {
  const readReview = vi.fn(async () => review), submitAdoption = vi.fn()
  const inspect = vi.fn(async () => ({ status: 'inspected', observedAt: review.observedAt, schemaDigest: `sha256:${'a'.repeat(64)}`, readsEnabled: true,
    operations: [{ action: 'eikona.review.decide', contractId: 'eikona.review.decide.v1', readiness: 'requires_authorization', supportsExpectedContentDigest: true, supportsRequireNoDecision: true }] }))
  const adapter = createSelectableEikonaReviewAdapter({ readReview, inspect, submitAdoption } as unknown as EikonaDiscoveryClient, true)
  return { adapter, readReview, submitAdoption }
}
it('verifies selection without submitting, supports clear, and isolates every context field', async () => {
  const { adapter, submitAdoption } = setup()
  expect(await adapter.selectEikonaCandidate!({ selection: selection() }, context)).toEqual({ status: 'selected', selection: selection() })
  expect((await adapter.snapshot(context)).actions).toHaveLength(1)
  for (const key of Object.keys(context) as (keyof CreatorStudioContextV1)[]) {
    expect((await adapter.snapshot({ ...context, [key]: 'other' })).actions).toHaveLength(0)
  }
  expect(await adapter.selectEikonaCandidate!({ selection: null }, context)).toEqual({ status: 'cleared' })
  expect((await adapter.snapshot(context)).actions).toHaveLength(0)
  expect(submitAdoption).not.toHaveBeenCalled()
})
it('does not let a late first selection replace the latest choice', async () => {
  const { adapter, readReview } = setup()
  let finish!: (value: typeof review) => void
  readReview.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const first = adapter.selectEikonaCandidate!({ selection: selection() }, context)
  expect(await adapter.selectEikonaCandidate!({ selection: selection('two') }, context)).toMatchObject({ status: 'selected' })
  finish(review)
  expect(await first).toEqual({ status: 'superseded' })
  expect((await adapter.snapshot(context)).actions[0]?.targetRef).toBe(selection('two').artifactRef)
})
it('invalidates the prior choice on malformed, unverified or denied selection', async () => {
  for (const mode of ['malformed', 'digest', 'denied']) {
    const { adapter, readReview } = setup()
    await adapter.selectEikonaCandidate!({ selection: selection() }, context)
    if (mode === 'denied') readReview.mockResolvedValueOnce({ status: 'permission_denied' } as never)
    const result = await adapter.selectEikonaCandidate!(mode === 'malformed' ? { selection: selection(), url: 'https://invalid.example' } : { selection: { ...selection('two'), ...(mode === 'digest' ? { contentDigest: 'b'.repeat(64) } : {}) } }, context)
    expect(result.status).toBe(mode === 'malformed' ? 'invalid_input' : mode === 'digest' ? 'unconfirmed' : 'permission_denied')
    expect((await adapter.snapshot(context)).actions).toHaveLength(0)
  }
})
it('bounds the cache and does not revive an evicted pending selection', async () => {
  const { adapter, readReview } = setup()
  let finish!: (value: typeof review) => void
  readReview.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const first = adapter.selectEikonaCandidate!({ selection: selection() }, context)
  for (let index = 0; index < 64; index++) await adapter.selectEikonaCandidate!({ selection: selection() }, { ...context, sessionRef: `session:${index}` })
  finish(review)
  expect(await first).toEqual({ status: 'superseded' })
  expect((await adapter.snapshot(context)).actions).toHaveLength(0)
})
