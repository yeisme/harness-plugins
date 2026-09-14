import { expect, it, vi } from 'vitest'
import { readScaenaDeliveryPage, scaenaExportGate } from '../src/scaena-export-delivery.ts'
import type { ScaenaPackageProjection } from '../src/scaena-package-contract.ts'

const digest = `sha256:${'d'.repeat(64)}`

function packageShow(state: Partial<ScaenaPackageProjection> = {}) {
  return { data: { schema_version: 'scaena.storyboard.review_package_projection.v1', package_ref: 'review-package:one', project_ref: 'project:one',
    episode_ref: 'episode:one', scenario: 'short_drama', state: 'reviewing', episode_graph_ref: 'graph:one',
    graph_version: 2, package_version: 3, episode_completed: false, input_source_kind: 'local_attestation', input_digest: digest,
    blockers: ['SCN_VISUAL_ACCEPTANCE_REQUIRED'], allowed_actions: ['export_draft'],
    export: { formal_allowed: false, draft_allowed: true, blockers: ['SCN_VISUAL_ACCEPTANCE_REQUIRED'] }, ...state } }
}

const evidenceExport = (readiness: string, overrides: Record<string, unknown> = {}) => ({ data: {
  contract_id: 'scaena.production.evidence_export.v1', schema_version: '1.0.0', project_ref: 'project:one', status: 'active',
  readiness_status: readiness, blocking_reasons: readiness === 'ready' ? [] : ['rights_incomplete', 'SCN_VISUAL_ACCEPTANCE_REQUIRED'],
  run_refs: ['run:1', 'run:2'], receipt_refs: ['receipt:export:1'], package_refs: ['review-package:one'], artifact_refs: ['artifact:a', 'artifact:b'], ...overrides } })

function invokeFor(handler: (args: readonly string[]) => unknown) { return vi.fn(async (args: readonly string[]) => handler(args)) }

it('derives the delivery page from owner receipts and artifact refs, never from UI state', async () => {
  const invoke = invokeFor(args => (args[1] === 'evidence-export' ? evidenceExport('blocked') : packageShow()))
  const page = await readScaenaDeliveryPage(invoke as never, '/local/project', { packageRef: 'review-package:one' })
  expect(page).toMatchObject({ status: 'ready', packageRef: 'review-package:one', deliveryReadiness: 'blocked', freshness: 'stale' })
  if (page.status !== 'ready') return
  // 部分成功保留：缺口不清空已完成成果与回执。
  expect(page.completedRunRefs).toEqual(['run:1', 'run:2'])
  expect(page.completedReceiptRefs).toEqual(['receipt:export:1'])
  expect(page.completedPackageRefs).toEqual(['review-package:one'])
  expect(page.artifactRefs).toEqual(['artifact:a', 'artifact:b'])
  expect(page.blockingReasons).toEqual(['rights_incomplete', 'SCN_VISUAL_ACCEPTANCE_REQUIRED'])
  expect(page.exportFormalAllowed).toBe(false)
  expect(page.exportDraftAllowed).toBe(true)
  expect(page.summary).toContain('not ready')
})

it('marks fresh only when owner readiness and formal export gating agree', async () => {
  const invoke = invokeFor(args => (args[1] === 'evidence-export' ? evidenceExport('ready') : packageShow({ export: { formal_allowed: true, draft_allowed: true }, blockers: [] })))
  const page = await readScaenaDeliveryPage(invoke as never, '/local/project', { packageRef: 'review-package:one' })
  expect(page).toMatchObject({ status: 'ready', freshness: 'fresh', exportFormalAllowed: true })
  const gate = scaenaExportGate(packageShow({ export: { formal_allowed: true, draft_allowed: false }, blockers: [] }).data as ScaenaPackageProjection)
  expect(gate).toMatchObject({ formalAllowed: true, draftAllowed: false, blockers: [] })
})

it('degrades honestly when either owner read fails, and validates the package ref', async () => {
  expect(await readScaenaDeliveryPage(invokeFor(() => { throw new Error('cli down') }) as never, '/local/project', { packageRef: 'review-package:one' }))
    .toEqual({ status: 'unknown', reason: 'unavailable' })
  expect(await readScaenaDeliveryPage(invokeFor(() => packageShow()) as never, '/local/project', { packageRef: 'bad ref!' }))
    .toEqual({ status: 'rejected', reason: 'invalid_input' })
  const mismatched = invokeFor(args => (args[1] === 'evidence-export' ? evidenceExport('ready') : packageShow({ package_ref: 'review-package:other' })))
  // 包投影身份不符 → readScaenaPackageProjection 返回 undefined → unavailable。
  expect(await readScaenaDeliveryPage(mismatched as never, '/local/project', { packageRef: 'review-package:one' })).toEqual({ status: 'unknown', reason: 'unavailable' })
})

it('is stateless: repeated reads after closing and reopening keep owner facts without local cancellation', async () => {
  let reads = 0
  const invoke = invokeFor(args => {
    if (args[1] === 'evidence-export') { reads++; return evidenceExport(reads > 1 ? 'ready' : 'blocked') }
    return packageShow()
  })
  const first = await readScaenaDeliveryPage(invoke as never, '/local/project', { packageRef: 'review-package:one' })
  // “关闭 Pane”后重开：无本地运行态可取消，交付事实每次从 owner 重读。
  const second = await readScaenaDeliveryPage(invoke as never, '/local/project', { packageRef: 'review-package:one' })
  expect(first).toMatchObject({ status: 'ready', deliveryReadiness: 'blocked' })
  expect(second).toMatchObject({ status: 'ready', deliveryReadiness: 'ready' })
})
