import { expect, it, vi } from 'vitest'
import { ScaenaProductionReads } from '../src/scaena-production-reads.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = { tenantRef: 't1', workspaceRef: 'w1', projectRef: 'p1', principalRef: 'u1',
  membershipRevision: 'm1', installationRef: 'i1', pluginDigest: 'd1', policyRevision: 'pol1', runtimeGeneration: '1', revision: 'r1' }

function portfolioEnvelope(count: number, overrides: Record<string, unknown> = {}) {
  return { spec_version: '1.0', mode: 'json', command: 'scaena.production.portfolio', status: 'success', data: {
    contract_id: 'scaena.production.portfolio.v1', schema_version: '1.0.0', status: 'ok', generated_at: '2026-09-14T10:00:00Z',
    projects: Array.from({ length: count }, (_, index) => ({
      project_ref: `project:${index}`, title: `Project ${index}`, phase: 'production', readiness: index % 2 === 0 ? 'blocked' : 'review',
      blocker_count: index, pending_review_count: 1, package_readiness: 'ready',
      owner_availability: { auctra: 'available', eikona: index === 0 ? 'unavailable' : 'available' },
      evidence_refs: [`evidence:portfolio:${index}`],
      next_action: { id: 'open_cockpit', label_key: 'production.portfolio.open_cockpit', http_method_or_command: 'GET /v1/production/cockpit' },
    })), ...overrides,
  } }
}

const cockpitEnvelope = { data: { contract_id: 'scaena.production.cockpit.v1', schema_version: '1.0.0', project_ref: 'project:0', status: 'partial',
  stages: {
    prepare: { status: 'completed', blocker_count: 0, pending_review_count: 0 },
    text: { status: 'completed', blocker_count: 0, pending_review_count: 0 },
    visual: { status: 'running', blocker_count: 0, pending_review_count: 0, primary_refs: ['request:1'] },
    shots: { status: 'blocked', blocker_count: 2, pending_review_count: 1 },
    export: { status: 'not_started', blocker_count: 0, pending_review_count: 0 },
  }, blockers: ['blocked:shots'], generated_at: '2026-09-14T10:00:00Z' } }

const evidenceEnvelope = { data: { contract_id: 'scaena.production.evidence_export.v1', schema_version: '1.0.0', project_ref: 'project:0', status: 'active',
  readiness_status: 'blocked', blocking_reasons: ['rights_incomplete'],
  run_refs: ['run:1', 'run:2'], receipt_refs: ['receipt:1'], package_refs: ['review-package:one'], artifact_refs: ['artifact:a'] } }

function readsFor(handler: (args: readonly string[]) => unknown) {
  const invoke = vi.fn(async (args: readonly string[]) => handler(args))
  return { invoke, reads: new ScaenaProductionReads(invoke as never, '/local/project') }
}

it('pages the portfolio with explicit owner-list cursors and marks partial availability stale', async () => {
  const { invoke, reads } = readsFor(args => (args[1] === 'portfolio' ? portfolioEnvelope(25) : cockpitEnvelope))
  const first = await reads.read(context, { view: 'portfolio' })
  expect(first).toMatchObject({ status: 'ready', view: 'portfolio', freshness: 'stale' })
  if (first.status !== 'ready') return
  expect(first.projects).toHaveLength(20)
  expect(first.nextCursor).toBe('scaena.production.portfolio:20')
  expect(first.projects[0]).toMatchObject({ projectRef: 'project:0', blockerCount: 0, nextActionId: 'open_cockpit' })
  const second = await reads.read(context, { view: 'portfolio', cursor: first.nextCursor })
  expect(second).toMatchObject({ status: 'ready' })
  if (second.status !== 'ready') return
  expect(second.projects).toHaveLength(5)
  expect(second.nextCursor).toBeUndefined()
  expect(invoke).toHaveBeenCalledWith(['production', 'portfolio', '--project', '/local/project'])
})

it('rejects malformed cursors before any owner call and refuses cursors on single-project views', async () => {
  const { invoke, reads } = readsFor(() => portfolioEnvelope(1))
  expect(await reads.read(context, { view: 'portfolio', cursor: 'not-a-cursor' })).toEqual({ status: 'rejected', reason: 'invalid_input' })
  expect(await reads.read(context, { view: 'cockpit', cursor: 'scaena.production.portfolio:0' })).toEqual({ status: 'rejected', reason: 'invalid_input' })
  expect(invoke).not.toHaveBeenCalled()
})

it('projects the fixed six-stage cockpit vocabulary and degrades missing stages honestly', async () => {
  const { reads } = readsFor(() => cockpitEnvelope)
  const page = await reads.read(context, { view: 'cockpit' })
  expect(page).toMatchObject({ status: 'ready', view: 'cockpit', freshness: 'stale' })
  if (page.status !== 'ready') return
  expect(page.stages?.map(stage => stage.id)).toEqual(['prepare', 'text', 'visual', 'shots', 'review', 'export'])
  expect(page.stages?.find(stage => stage.id === 'review')).toMatchObject({ status: 'not_started', blockerCount: 0 })
  expect(page.stages?.find(stage => stage.id === 'shots')).toMatchObject({ status: 'blocked', blockerCount: 2 })
})

it('reports owner-empty and error states instead of fake successes', async () => {
  const empty = readsFor(() => ({ data: { contract_id: 'scaena.production.portfolio.v1', schema_version: '1.0.0', status: 'empty' } }))
  expect(await empty.reads.read(context, { view: 'portfolio' })).toEqual({ status: 'empty', view: 'portfolio', reason: 'owner_reported_no_projects' })
  const noReviews = readsFor(() => ({ data: { contract_id: 'scaena.production.review_queue.v1', schema_version: '1.0.0', project_ref: 'project:0', status: 'active', items: [] } }))
  expect(await noReviews.reads.read(context, { view: 'reviews' })).toEqual({ status: 'empty', view: 'reviews', reason: 'owner_reported_no_reviews' })
  const failure = readsFor(() => ({ error: { code: 'INVALID_ARGUMENT', message: 'bad request' } }))
  expect(await failure.reads.read(context, { view: 'cockpit' })).toEqual({ status: 'rejected', reason: 'owner_rejected' })
  const unavailable = readsFor(() => { throw new Error('scaena_cli_unavailable') })
  expect(await unavailable.reads.read(context, { view: 'cockpit' })).toEqual({ status: 'rejected', reason: 'unavailable' })
})

it('rejects unknown critical contract versions instead of guessing the wire', async () => {
  const { reads } = readsFor(() => ({ data: { contract_id: 'scaena.production.portfolio.v2', schema_version: '2.0.0', status: 'ok' } }))
  expect(await reads.read(context, { view: 'portfolio' })).toEqual({ status: 'unknown', reason: 'contract_mismatch' })
})

it('keeps completed delivery refs with blocking reasons on the evidence-export view', async () => {
  const { reads } = readsFor(() => evidenceEnvelope)
  const page = await reads.read(context, { view: 'evidence-export' })
  expect(page).toMatchObject({ status: 'ready', view: 'evidence-export', freshness: 'stale' })
  if (page.status !== 'ready') return
  expect(page.delivery).toMatchObject({ readinessStatus: 'blocked', blockingReasons: ['rights_incomplete'],
    runRefs: ['run:1', 'run:2'], receiptRefs: ['receipt:1'], packageRefs: ['review-package:one'], artifactRefs: ['artifact:a'] })
})
