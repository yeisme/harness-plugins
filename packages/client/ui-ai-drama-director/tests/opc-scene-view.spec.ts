import { describe, expect, it } from 'vitest'
import { OPC_SCENE_SUMMARY_FIXTURE, type OpcScenePackageSummaryV1alpha1 } from '@yeisme/dsh-ai-drama-director'
import { deriveDramaScenePackageExceptionView } from '../src/client/opc-scene-view.ts'

function summary(overrides: Record<string, unknown>): OpcScenePackageSummaryV1alpha1 {
  return { ...OPC_SCENE_SUMMARY_FIXTURE, ...overrides } as OpcScenePackageSummaryV1alpha1
}

describe('deriveDramaScenePackageExceptionView (opc-scene 1.2, 2.3)', () => {
  it('projects Now/Why/Next from the owner summary without recomputing facts', () => {
    const view = deriveDramaScenePackageExceptionView({ summary: OPC_SCENE_SUMMARY_FIXTURE })
    expect(view.state).toBe('exception')
    expect(view.context).toMatchObject({
      showRef: 'show:101',
      episodeRef: 'ep:5',
      sceneRef: 'scene:12',
      packageRef: 'pkg:scene-12-r42',
      packageVersion: 'r42',
      stage: 'direction',
      readiness: 'blocked',
    })
    // Gates are copied verbatim — the model never flips a gate.
    expect(view.gates.map(gate => [gate.id, gate.state])).toEqual([
      ['direction_confirm', 'pending'],
      ['visual_foundation_accept', 'accepted'],
      ['export_confirm', 'pending'],
    ])
    expect(view.mutationsEnabled).toBe(true)
    expect(view.primaryAction).toMatchObject({
      actionId: 'act:confirm-direction',
      enabled: true,
      sideEffectClass: 'owner_write',
      requiresConfirmation: true,
    })
  })

  it('keeps gate and exception findings separate when both are present', () => {
    const view = deriveDramaScenePackageExceptionView({ summary: OPC_SCENE_SUMMARY_FIXTURE })
    const rights = view.exceptionCards.find(card => card.kind === 'rights')
    expect(rights).toMatchObject({ affectedRef: 'scene:12', packageVersion: 'r42', reasonCode: 'rights_review_pending', reconcileRef: 'recon:rights-r42' })
    // export_confirm gate stays its own fact; no card swallowed it.
    expect(view.gates.find(gate => gate.id === 'export_confirm')).toMatchObject({ state: 'pending' })
    expect(view.delivery?.productionReady).toBe(false)
  })

  it.each([
    ['stale', 'stale'],
    ['offline', 'offline'],
    ['partial', 'partial'],
    ['unknown', 'unknown'],
  ] as const)('maps owner freshness %s to typed state with mutations disabled and a visible reason', (freshness, state) => {
    const view = deriveDramaScenePackageExceptionView({ summary: summary({ freshness, exceptions: [] }) })
    expect(view.state).toBe(state)
    expect(view.mutationsEnabled).toBe(false)
    expect(view.primaryAction?.enabled).toBe(false)
    expect(view.primaryAction?.disabledReason).toBe('state:mutations_disabled')
    expect(view.exceptionCards[0]).toMatchObject({ kind: state === 'offline' ? 'owner_offline' : state, reasonCode: `state:${freshness}` })
    // Last-known safe refs survive degradation.
    expect(view.context?.packageRef).toBe('pkg:scene-12-r42')
    expect(view.context?.packageVersion).toBe('r42')
  })

  it('preserves last-known safe facts when the latest fetch has no summary', () => {
    const view = deriveDramaScenePackageExceptionView({ lastKnownSummary: OPC_SCENE_SUMMARY_FIXTURE })
    expect(view.state).toBe('unknown')
    expect(view.mutationsEnabled).toBe(false)
    expect(view.context?.sceneRef).toBe('scene:12')
    expect(view.handoff).toBeUndefined()
    expect(view.primaryAction).toBeUndefined()
  })

  it('shows a contract_mismatch state that keeps only last-known safe context', () => {
    const view = deriveDramaScenePackageExceptionView({ lastKnownSummary: OPC_SCENE_SUMMARY_FIXTURE, contractMismatch: true })
    expect(view.state).toBe('contract_mismatch')
    expect(view.mutationsEnabled).toBe(false)
    expect(view.exceptionCards).toHaveLength(1)
    expect(view.exceptionCards[0]).toMatchObject({ kind: 'contract_mismatch', reasonCode: 'state:contract_mismatch' })
    expect(view.context?.packageVersion).toBe('r42')
    expect(view.primaryAction).toBeUndefined()
  })

  it('clear state shows gates and no exception cards', () => {
    const view = deriveDramaScenePackageExceptionView({
      summary: summary({ exceptions: [], readiness: 'clear', gates: [
        { id: 'direction_confirm', state: 'accepted' },
        { id: 'visual_foundation_accept', state: 'accepted' },
        { id: 'export_confirm', state: 'accepted' },
      ] }),
    })
    expect(view.state).toBe('clear')
    expect(view.exceptionCards).toHaveLength(0)
    expect(view.mutationsEnabled).toBe(true)
  })

  it('never fabricates an action when the owner published none', () => {
    const view = deriveDramaScenePackageExceptionView({ summary: summary({ primaryAction: undefined }) })
    expect(view.primaryAction).toBeUndefined()
    expect(view.handoff?.workbenchDeepLink).toBe('workbench:open-scene:scene:12:r42')
  })

  it('disables owner recovery actions in degraded states instead of retrying', () => {
    const view = deriveDramaScenePackageExceptionView({ summary: summary({ freshness: 'stale' }) })
    const rights = view.exceptionCards.find(card => card.kind === 'rights')
    expect(rights?.recoveryAction?.enabled).toBe(false)
    expect(rights?.recoveryAction?.disabledReason).toBe('state:mutations_disabled')
  })

  it('marks cinematic reframes as requiring explicit upgrade confirmation; balanced does not', () => {
    const view = deriveDramaScenePackageExceptionView({ summary: OPC_SCENE_SUMMARY_FIXTURE })
    expect(view.reframes).toHaveLength(1)
    expect(view.reframes[0]).toMatchObject({
      aspect: '16:9',
      depth: 'cinematic',
      status: 'recommended',
      requiresUpgradeConfirmation: true,
      action: { actionId: 'act:review-reframe-16x9' },
    })
    const balanced = deriveDramaScenePackageExceptionView({
      summary: summary({ reframes: [{ ...OPC_SCENE_SUMMARY_FIXTURE.reframes[0]!, depth: 'balanced' }] }),
    })
    expect(balanced.reframes[0]?.requiresUpgradeConfirmation).toBe(false)
  })

  it('primary aspect stays a formal fact; secondary aspect only exists as a reframe variant', () => {
    const view = deriveDramaScenePackageExceptionView({ summary: OPC_SCENE_SUMMARY_FIXTURE })
    expect(view.aspect?.primary).toBe('9:16')
    const secondary = view.reframes.filter(reframe => reframe.aspect === '9:16')
    expect(secondary).toHaveLength(0)
  })

  it('role labels are the primary surface; name/version/digest only in detail', () => {
    const view = deriveDramaScenePackageExceptionView({ summary: OPC_SCENE_SUMMARY_FIXTURE })
    expect(view.roles.map(role => role.role)).toEqual(['director', 'continuity', 'producer', 'edit', 'sound'])
    expect(view.roles.every(role => Object.keys(role).length === 1)).toBe(true)
    expect(view.rolesDetail.find(role => role.role === 'continuity')).toMatchObject({ name: 'continuity-check', version: 'v3', digest: 'sha1:9f2a' })
  })

  it('projects delivery notes for partial package, checksum mismatch, and expired grant', () => {
    const partial = deriveDramaScenePackageExceptionView({ summary: OPC_SCENE_SUMMARY_FIXTURE })
    expect(partial.deliveryNotes).toContain('partial_package: production_ready=false')
    const mismatch = deriveDramaScenePackageExceptionView({
      summary: summary({ delivery: { ...OPC_SCENE_SUMMARY_FIXTURE.delivery, checksumStatus: 'mismatch' } }),
    })
    expect(mismatch.deliveryNotes).toContain('checksum_mismatch: owner recovery required')
    const expired = deriveDramaScenePackageExceptionView({
      summary: summary({ delivery: { ...OPC_SCENE_SUMMARY_FIXTURE.delivery, grant: { status: 'expired', expiresAt: 1 } } }),
    })
    expect(expired.deliveryNotes).toContain('grant_expired: reacquire grant only')
  })

  it('carries receipts with reconcile identity and copyable CLI/API details verbatim', () => {
    const view = deriveDramaScenePackageExceptionView({ summary: OPC_SCENE_SUMMARY_FIXTURE })
    expect(view.receipts).toEqual([
      { receiptRef: 'rcpt:action-77', reconcileRef: 'recon:action-77', outcome: 'succeeded' },
      { receiptRef: 'rcpt:action-78', outcome: 'unknown' },
    ])
    expect(view.handoff?.cliDetail).toBe(OPC_SCENE_SUMMARY_FIXTURE.primaryAction?.cliDetail)
    expect(view.handoff?.apiDetail).toBe(OPC_SCENE_SUMMARY_FIXTURE.primaryAction?.apiDetail)
  })
})

describe('dramaOpcSceneSurfaceAvailability (opc-scene 2.1 typed probe)', () => {
  it('gates the opc scene surfaces on the drama host transport', async () => {
    const { dramaOpcSceneSurfaceAvailability } = await import('../src/client/probe.ts')
    const entry = (available: boolean) => ({ available, reason: available ? 'ok' : 'missing drama owner projection' })
    const base = {
      available: true,
      paneWorkbench: entry(true),
      creatorStudio: entry(true),
      dramaHost: entry(true),
      showControl: entry(true),
      selectionAnnotation: entry(true),
      commandExperience: entry(true),
      commandRouter: entry(true),
      slashConflicts: [],
    }
    expect(dramaOpcSceneSurfaceAvailability(base as never)).toEqual({ disabled: false })
    expect(dramaOpcSceneSurfaceAvailability({ ...base, dramaHost: entry(false) } as never)).toEqual({
      disabled: true,
      reason: 'missing drama owner projection',
    })
    expect(dramaOpcSceneSurfaceAvailability({ ...base, paneWorkbench: entry(false) } as never).disabled).toBe(true)
  })
})
