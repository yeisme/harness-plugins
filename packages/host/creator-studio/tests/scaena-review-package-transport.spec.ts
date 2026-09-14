import { expect, it, vi } from 'vitest'
import { ScaenaPackageEventsClient, verifyScaenaPackagePin } from '../src/scaena-review-package-transport.ts'
import type { ScaenaPackageProjection } from '../src/scaena-package-contract.ts'

const digest = `sha256:${'e'.repeat(64)}`

function projection(overrides: Partial<ScaenaPackageProjection> = {}): ScaenaPackageProjection {
  return { schema_version: 'scaena.storyboard.review_package_projection.v1', package_ref: 'review-package:one', project_ref: 'project:one',
    episode_ref: 'episode:one', scenario: 'short_drama', state: 'reviewing', episode_graph_ref: 'graph:one',
    graph_version: 2, package_version: 3, episode_completed: false, input_source_kind: 'local_attestation', input_digest: digest,
    blockers: [], allowed_actions: [], export: { formal_allowed: false, draft_allowed: true }, ...overrides } as ScaenaPackageProjection
}

function eventsInvoke(handler: (args: readonly string[]) => unknown) { return vi.fn(async (args: readonly string[]) => handler(args)) }

const watchEnvelope = (facts: Record<string, unknown>) => ({ spec_version: '1.0', mode: 'json', command: 'scaena.storyboard.package.watch', status: 'success', facts })

it('consumes refs-only events with numeric cursor resume', async () => {
  const invoke = eventsInvoke(args => {
    const index = args.indexOf('--cursor')
    const cursor = index >= 0 ? args[index + 1] : undefined
    return cursor === '4'
      ? watchEnvelope({ package_ref: 'review-package:one', event_count: 0, events: [], cursor: '4' })
      : watchEnvelope({ package_ref: 'review-package:one', event_count: 2, events: ['3 visual_job_resolved', '4 scene_visual_accepted'], cursor: '4' })
  })
  const client = new ScaenaPackageEventsClient(invoke as never, '/local/project')
  const page = await client.read({ packageRef: 'review-package:one', cursor: '2' })
  expect(page).toMatchObject({ status: 'ready', packageRef: 'review-package:one' })
  if (page.status !== 'ready') return
  expect(page.events).toEqual([{ seq: 3, kind: 'visual_job_resolved' }, { seq: 4, kind: 'scene_visual_accepted' }])
  expect(page.nextCursor).toBe('4')
  expect(invoke).toHaveBeenCalledWith(['storyboard', 'package', 'watch', 'review-package:one', '--project', '/local/project', '--timeout', '1s', '--poll-interval', '1s', '--cursor', '2'], 30_000)
  // 从新 cursor 续读：空页不再携带 nextCursor。
  const tail = await client.read({ packageRef: 'review-package:one', cursor: '4' })
  expect(tail).toMatchObject({ status: 'ready' })
  if (tail.status === 'ready') expect(tail.nextCursor).toBeUndefined()
})

it('rejects payloads, non-numeric cursors, replay violations and identity mismatches', async () => {
  const payload = new ScaenaPackageEventsClient(eventsInvoke(() => watchEnvelope({ package_ref: 'review-package:one', events: ['3 scene_accepted {"payload":1}'], cursor: '3' })) as never, '/local/project')
  expect(await payload.read({ packageRef: 'review-package:one' })).toEqual({ status: 'unknown', reason: 'contract_mismatch' })
  const nonNumeric = new ScaenaPackageEventsClient(eventsInvoke(() => watchEnvelope({ package_ref: 'review-package:one', events: [], cursor: '3' })) as never, '/local/project')
  expect(await nonNumeric.read({ packageRef: 'review-package:one', cursor: 'page_1' })).toEqual({ status: 'rejected', reason: 'invalid_input' })
  // 回放了 ≤ cursor 的事件：违反 numeric resume 语义 → unconfirmed。
  const replayed = new ScaenaPackageEventsClient(eventsInvoke(() => watchEnvelope({ package_ref: 'review-package:one', events: ['2 scene_accepted', '5 scene_accepted'], cursor: '5' })) as never, '/local/project')
  expect(await replayed.read({ packageRef: 'review-package:one', cursor: '4' })).toEqual({ status: 'unknown', reason: 'unconfirmed' })
  // 包身份漂移 → unconfirmed。
  const foreign = new ScaenaPackageEventsClient(eventsInvoke(() => watchEnvelope({ package_ref: 'review-package:other', events: ['1 created'], cursor: '1' })) as never, '/local/project')
  expect(await foreign.read({ packageRef: 'review-package:one' })).toEqual({ status: 'unknown', reason: 'unconfirmed' })
  // owner 拒绝/不可用也分类透出。
  const unavailable = new ScaenaPackageEventsClient(eventsInvoke(() => { throw new Error('cli down') }) as never, '/local/project')
  expect(await unavailable.read({ packageRef: 'review-package:one' })).toEqual({ status: 'unknown', reason: 'unavailable' })
})

it('verifies fixed-version pins and refuses to open drifted packages as valid', () => {
  const pin = { packageRef: 'review-package:one', packageVersion: 3, graphVersion: 2 }
  expect(verifyScaenaPackagePin(pin, projection())).toMatchObject({ status: 'verified' })
  expect(verifyScaenaPackagePin(pin, projection({ package_version: 4 }))).toMatchObject({ status: 'unconfirmed', reason: 'package_version_drift', observed: { packageVersion: 4 } })
  expect(verifyScaenaPackagePin(pin, projection({ graph_version: 3 }))).toMatchObject({ status: 'unconfirmed', reason: 'graph_version_drift' })
  expect(verifyScaenaPackagePin(pin, projection({ package_ref: 'review-package:two' }))).toMatchObject({ status: 'unconfirmed', reason: 'package_ref_drift' })
  expect(verifyScaenaPackagePin(pin, undefined)).toMatchObject({ status: 'unconfirmed', reason: 'projection_unavailable' })
})
