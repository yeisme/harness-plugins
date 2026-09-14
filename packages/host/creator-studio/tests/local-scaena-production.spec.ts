import { expect, it, vi } from 'vitest'
import { withLocalScaenaProduction, scaenaCockpitToProduction } from '../src/local-scaena-production.ts'
import type { CreatorOwnerAdapterV1, CreatorOwnerSnapshotV1, CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = { tenantRef: 't1', workspaceRef: 'w1', projectRef: 'p1', principalRef: 'u1',
  membershipRevision: 'm1', installationRef: 'i1', pluginDigest: 'd1', policyRevision: 'pol1', runtimeGeneration: '1', revision: 'r1' }

const cockpit = { data: { contract_id: 'scaena.production.cockpit.v1', schema_version: '1.0.0', project_ref: 'project:one', status: 'active',
  stages: {
    prepare: { status: 'completed', blocker_count: 0, pending_review_count: 0 },
    text: { status: 'completed', blocker_count: 0, pending_review_count: 0 },
    visual: { status: 'running', blocker_count: 0, pending_review_count: 0 },
    shots: { status: 'needs_review', blocker_count: 0, pending_review_count: 2 },
    review: { status: 'ready', blocker_count: 0, pending_review_count: 0 },
    export: { status: 'blocked', blocker_count: 1, pending_review_count: 0 },
  },
  blockers: ['blocked:export'], generated_at: '2026-09-14T11:00:00Z' } }

function baseAdapter(): CreatorOwnerAdapterV1 {
  let version = 0
  return {
    owner: 'scaena', transport: 'local', configured: true,
    snapshot: async (): Promise<CreatorOwnerSnapshotV1> => ({ schemaVersion: 'creator.owner.snapshot.v1alpha1', owner: 'scaena', transport: 'local',
      snapshotRef: `scaena:base:${++version}`, snapshotVersion: version, cursor: 'c', sequence: version, generatedAt: new Date().toISOString(), context,
      status: 'ready', freshness: 'fresh', summary: 'base', resources: [], actions: [] }),
    dispatch: async () => ({ status: 'rejected', owner: 'scaena', receiptRef: 'scaena:base:unsupported', summary: 'unsupported' }),
  }
}

it('maps the owner cockpit stages into the pane production projection without inventing states', () => {
  const production = scaenaCockpitToProduction(cockpit.data)
  expect(production.stages.map(stage => stage.id)).toEqual(['prepare', 'text', 'visual', 'shots', 'review', 'export'])
  expect(production.stages.map(stage => stage.status)).toEqual(['ready', 'ready', 'running', 'attention', 'ready', 'blocked'])
  expect(production.currentStage).toBe('export')
  expect(production.blockers.map(blocker => blocker.title)).toEqual(['blocked:export', 'blocked:export'])
  const missing = scaenaCockpitToProduction({ ...cockpit.data, stages: { prepare: cockpit.data.stages.prepare! } })
  expect(missing.stages.find(stage => stage.id === 'text')).toMatchObject({ status: 'pending' })
})

it('adds the production projection to the snapshot and degrades to base when the cockpit is unreadable', async () => {
  const ready = vi.fn(async (args: readonly string[]) => (args[1] === 'cockpit' ? cockpit : { data: {} }))
  const adapter = withLocalScaenaProduction(baseAdapter(), ready as never, '/local/project')
  const snapshot = await adapter.snapshot(context)
  expect(snapshot.production?.currentStage).toBe('export')
  expect(snapshot.status).toBe('ready')
  const failing = withLocalScaenaProduction(baseAdapter(), vi.fn(async () => { throw new Error('scaena_cli_unavailable') }) as never, '/local/project')
  const degraded = await failing.snapshot(context)
  expect(degraded.production).toBeUndefined()
  expect(degraded.status).toBe('ready')
})

it('exposes the three read-only faces with honest pass-through', async () => {
  const invoke = vi.fn(async (args: readonly string[]) => {
    if (args[1] === 'cockpit') return cockpit
    if (args[1] === 'portfolio') return { data: { contract_id: 'scaena.production.portfolio.v1', schema_version: '1.0.0', status: 'empty' } }
    if (args[1] === 'evidence-export') return { data: { contract_id: 'scaena.production.evidence_export.v1', schema_version: '1.0.0', project_ref: 'project:one', status: 'active', readiness_status: 'ready', run_refs: ['run:1'] } }
    if (args[2] === 'show') throw new Error('package missing')
    if (args[2] === 'watch') return { facts: { package_ref: 'review-package:one', events: ['7 created'], cursor: '7' } }
    return { data: {} }
  })
  const adapter = withLocalScaenaProduction(baseAdapter(), invoke as never, '/local/project')
  expect(await adapter.readScaenaProduction!({ view: 'portfolio' }, context)).toEqual({ status: 'empty', view: 'portfolio', reason: 'owner_reported_no_projects' })
  expect(await adapter.readScaenaProduction!({ view: 'cockpit' }, context)).toMatchObject({ status: 'ready' })
  expect(await adapter.readScaenaProduction!({ view: 'not-a-view' } as never, context)).toEqual({ status: 'rejected', reason: 'invalid_input' })
  // 包读取失败 → 交付页 unavailable，不伪造。
  expect(await adapter.readScaenaDelivery!({ packageRef: 'review-package:one' }, context)).toEqual({ status: 'unknown', reason: 'unavailable' })
  expect(await adapter.readScaenaDelivery!({ packageRef: 'bad ref' }, context)).toEqual({ status: 'rejected', reason: 'invalid_input' })
  expect(await adapter.readScaenaPackageEvents!({ packageRef: 'review-package:one' }, context)).toMatchObject({ status: 'ready', events: [{ seq: 7, kind: 'created' }] })
  expect(await adapter.readScaenaPackageEvents!({ packageRef: 'review-package:one', cursor: 'zzz' }, context)).toEqual({ status: 'rejected', reason: 'invalid_input' })
})
