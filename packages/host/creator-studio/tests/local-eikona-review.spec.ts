import { expect, it, vi } from 'vitest'
import { withLocalEikonaReview } from '../src/local-eikona-review.ts'
import type { CreatorOwnerAdapterV1, CreatorStudioContextV1 } from '../src/types.ts'
const context = { tenantRef: 'tenant:one', principalRef: 'user:one', workspaceRef: 'workspace:one', projectRef: 'project:one' } as CreatorStudioContextV1
it('pages project assets without dropping candidates and rejects a changed history or context', async () => {
  let changed = false
  const invoke = vi.fn(async (args: readonly string[]) => {
    if (args[0] === 'list') return { data: { total_count: 1, runs: [{ run_id: changed ? 'new_run' : 'run', project_id: 'project', status: 'succeeded', artifact_count: 3 }] } }
    if (args[0] === 'artifacts') return { data: { artifacts: [0, 1, 2].map(index => ({ artifact_id: `candidate_${index}`, mime_type: 'image/png' })) } }
    return { data: { review: { schema_version: 'eikona.review_projection.v1', run_id: 'run', project_id: 'project', observed_at: '2026-09-08T00:00:00Z',
      owner_decision: { state: 'pending' }, admission_state: { state: 'unknown' }, permission: { can_decide: true, can_supersede: false, role: 'operator' },
      candidates: [0, 1, 2].map(index => ({ candidate_id: `candidate_${index}`, label: `Candidate ${index}`, artifact_ref: `eikona://artifacts/run/candidate_${index}`, content_digest: 'a'.repeat(64), decision_version: 0 })),
    } } }
  })
  const base = { owner: 'eikona', transport: 'local', snapshot: vi.fn(), dispatch: vi.fn() } as unknown as CreatorOwnerAdapterV1
  const adapter = withLocalEikonaReview(base, invoke, async () => 'project')
  const first = await adapter.readEikonaAssetPage!({ limit: 2 }, context) as any
  expect(first.status).toBe('ready')
  expect(first.items).toHaveLength(2)
  expect(first.nextCursor).toBeTruthy()
  const next = await adapter.readEikonaAssetPage!({ limit: 2, cursor: first.nextCursor }, context) as any
  expect(next.items.map((item: any) => item.ref)).toEqual(['eikona://artifacts/run/candidate_2'])
  expect(next.nextCursor).toBeUndefined()
  expect(await adapter.readEikonaAssetPage!({ limit: 2, cursor: first.nextCursor }, { ...context, projectRef: 'project:other' })).toEqual({ status: 'permission_denied' })
  changed = true
  expect(await adapter.readEikonaAssetPage!({ limit: 2, cursor: first.nextCursor }, context)).toEqual({ status: 'unconfirmed' })
  expect(invoke.mock.calls.every(call => ['list', 'artifacts', 'review'].includes(call[0][0]!))).toBe(true)
})
