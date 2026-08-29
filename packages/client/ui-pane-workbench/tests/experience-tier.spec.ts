// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { PANE_CORE_HOST_CONTRACT } from '../src/core-pane.js'
import {
  CAPABILITY_MATRIX_EVIDENCE_SCHEMA,
  createExperienceTierTracker,
  geometryDisabledReasonKey,
  isRedactedCapabilityMatrixEvidence,
  probeWorkspaceSeams,
  projectCapabilityMatrix,
  recordCapabilityMatrixEvidence,
  resolveExperienceTier,
  WORKSPACE_CAPABILITY_MATRIX_SCHEMA,
  WORKSPACE_SEAM_IDS,
  WORKSPACE_SEAM_UNLOCK_ANCHORS,
  type CapabilityMatrixEvidenceRecordV1,
  type WorkspaceProbeStateV1,
  type WorkspaceSeamProbeSetV1,
} from '../src/experience-tier.js'

function probeSet(patches: Partial<Record<(typeof WORKSPACE_SEAM_IDS)[number], WorkspaceProbeStateV1>> = {}): WorkspaceSeamProbeSetV1 {
  const base = Object.fromEntries(WORKSPACE_SEAM_IDS.map(seam => [seam, 'missing'])) as Record<(typeof WORKSPACE_SEAM_IDS)[number], WorkspaceProbeStateV1>
  return Object.freeze({ ...base, ...patches })
}

const TIER1_PROBES = probeSet({
  'workspace.core-pane.v1': 'available',
  'shell.workspace.right': 'available',
  'shell.workspace.bottom': 'available',
  'command-surface': 'available',
})

describe('resolveExperienceTier', () => {
  it('judges Tier 0 on a release host and reports standard reason keys', () => {
    const result = resolveExperienceTier(probeSet())
    expect(result.tier).toBe(0)
    expect(result.reasons['workspace.core-pane.v1']).toBe('reason.workspaceSeamMissing')
    expect(result.reasons['shell.workspace.right']).toBe('reason.workspaceSeamMissing')
    expect(result.reasons['command-surface']).toBe('reason.commandSurfaceMissing')
    expect(Object.keys(result.reasons)).toHaveLength(WORKSPACE_SEAM_IDS.length)
  })

  it('judges a residual workspaceLayout as contract_mismatch, never partially usable (rc.9)', () => {
    const result = resolveExperienceTier(probeSet({
      'workspace.core-pane.v1': 'contract_mismatch',
      'shell.workspace.right': 'available',
      'shell.workspace.bottom': 'available',
    }))
    expect(result.tier).toBe(0)
    expect(result.reasons['workspace.core-pane.v1']).toBe('reason.contractMismatch')
    expect(result.reasons['shell.workspace.right']).toBeUndefined()
  })

  it('judges Tier 1 when core pane and both workspace slots are available', () => {
    const result = resolveExperienceTier(TIER1_PROBES)
    expect(result.tier).toBe(1)
    expect(result.reasons['terminal-host-v2']).toBe('reason.terminalSeamMissing')
    expect(result.reasons['preview-resource-v1']).toBe('reason.previewSeamMissing')
    expect(result.reasons['artifact-intent-official']).toBe('reason.artifactSeamMissing')
  })

  it('keeps Tier 1 when the command surface is missing (pane entries stay usable)', () => {
    const result = resolveExperienceTier(probeSet({
      'workspace.core-pane.v1': 'available',
      'shell.workspace.right': 'available',
      'shell.workspace.bottom': 'available',
      'command-surface': 'contract_mismatch',
    }))
    expect(result.tier).toBe(1)
    expect(result.reasons['command-surface']).toBe('reason.contractMismatch')
  })

  it('judges Tier 2 only when every Tier 2 seam is available', () => {
    const tier2 = resolveExperienceTier(probeSet({
      ...Object.fromEntries(WORKSPACE_SEAM_IDS.map(seam => [seam, 'available'])),
    }))
    expect(tier2.tier).toBe(2)
    expect(Object.keys(tier2.reasons)).toHaveLength(0)

    const terminalMismatch = resolveExperienceTier(probeSet({
      'workspace.core-pane.v1': 'available',
      'shell.workspace.right': 'available',
      'shell.workspace.bottom': 'available',
      'terminal-host-v2': 'contract_mismatch',
      'preview-resource-v1': 'available',
      'artifact-intent-official': 'available',
    }))
    expect(terminalMismatch.tier).toBe(1)
    expect(terminalMismatch.reasons['terminal-host-v2']).toBe('reason.contractMismatch')
  })

  it('gates host geometry with the standard Tier 0 reason', () => {
    expect(geometryDisabledReasonKey(0)).toBe('reason.geometryTier0')
    expect(geometryDisabledReasonKey(resolveExperienceTier(probeSet()))).toBe('reason.geometryTier0')
    expect(geometryDisabledReasonKey(1)).toBeUndefined()
    expect(geometryDisabledReasonKey(2)).toBeUndefined()
  })
})

describe('probeWorkspaceSeams', () => {
  function ctxWith(services: Record<string, unknown>) {
    return { get: (name: string) => services[name] }
  }

  it('maps the core pane host probe, including the residual rc.9 middle state', () => {
    const ctx = ctxWith({})
    expect(probeWorkspaceSeams(ctx as never, { missing: [] })['workspace.core-pane.v1']).toBe('available')
    expect(probeWorkspaceSeams(ctx as never, { missing: ['workspaceLayout'] })['workspace.core-pane.v1']).toBe('missing')
    expect(probeWorkspaceSeams(ctx as never, { missing: [PANE_CORE_HOST_CONTRACT] })['workspace.core-pane.v1']).toBe('contract_mismatch')
    const hostFailure = probeWorkspaceSeams(ctx as never, { missing: ['host'] })
    expect(hostFailure['workspace.core-pane.v1']).toBe('missing')
    expect(hostFailure['shell.workspace.right']).toBe('missing')
    expect(hostFailure['shell.workspace.bottom']).toBe('missing')
  })

  it('probes the command surface structurally and fails closed on throws', () => {
    expect(probeWorkspaceSeams(ctxWith({ commands: { list: () => [] } }) as never, { missing: [] })['command-surface']).toBe('available')
    expect(probeWorkspaceSeams(ctxWith({ commands: { execute: () => ({}) } }) as never, { missing: [] })['command-surface']).toBe('contract_mismatch')
    expect(probeWorkspaceSeams(ctxWith({}) as never, { missing: [] })['command-surface']).toBe('missing')
    const throwing = { get: () => { throw new Error('context disposed') } }
    expect(probeWorkspaceSeams(throwing as never, { missing: [] })['command-surface']).toBe('missing')
  })

  it('probes Tier 2 seams by contract shape instead of version strings', () => {
    const ctx = ctxWith({
      'dsh.terminalHost': { capability: 'terminal-host', attachTerminal: () => ({}) },
      'dsh.previewResource': {
        capabilities: ['PreviewResourceV1'],
        openPreview: async () => ({}),
        readPreview: async () => ({}),
        releasePreview: async () => undefined,
      },
      'dsh.artifactIntents': { capabilities: ['ArtifactIntentV1'] },
    })
    const probes = probeWorkspaceSeams(ctx as never, { missing: [] })
    expect(probes['terminal-host-v2']).toBe('available')
    expect(probes['preview-resource-v1']).toBe('available')
    expect(probes['artifact-intent-official']).toBe('available')

    const residual = probeWorkspaceSeams(ctxWith({
      'dsh.terminalHost': { capability: 'terminal-host' },
      'dsh.previewResource': { capabilities: ['PreviewResourceV1'] },
      'dsh.artifactIntents': { capabilities: [] },
    }) as never, { missing: [] })
    expect(residual['terminal-host-v2']).toBe('contract_mismatch')
    expect(residual['preview-resource-v1']).toBe('contract_mismatch')
    expect(residual['artifact-intent-official']).toBe('contract_mismatch')
  })

  it('applies owner overrides last and ignores invalid override values', () => {
    const probes = probeWorkspaceSeams(ctxWith({}) as never, { missing: ['host'] }, {
      'terminal-host-v2': 'available',
      'command-surface': 'bogus' as never,
    })
    expect(probes['terminal-host-v2']).toBe('available')
    expect(probes['command-surface']).toBe('missing')
  })
})

describe('createExperienceTierTracker', () => {
  it('caches the probe per session: interaction reads never re-probe', () => {
    const probe = vi.fn(() => TIER1_PROBES)
    const tracker = createExperienceTierTracker({ probe })
    expect(tracker.getSnapshot().tier).toBe(1)
    tracker.getSnapshot()
    tracker.getSnapshot()
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('re-judges and broadcasts on hot-plug invalidation only when the snapshot changed', () => {
    let probes = probeSet()
    const probe = vi.fn(() => probes)
    const tracker = createExperienceTierTracker({ probe })
    const listener = vi.fn()
    tracker.subscribe(listener)
    expect(tracker.getSnapshot().tier).toBe(0)
    tracker.invalidate()
    expect(listener).not.toHaveBeenCalled()
    probes = TIER1_PROBES
    const next = tracker.invalidate()
    expect(next.tier).toBe(1)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(probe).toHaveBeenCalledTimes(3)
  })

  it('emits tier_resolved evidence on first resolve and on tier change only', () => {
    let probes = probeSet()
    const records: CapabilityMatrixEvidenceRecordV1[] = []
    const tracker = createExperienceTierTracker({
      probe: () => probes,
      onEvidence: record => records.push(record),
    })
    tracker.getSnapshot()
    tracker.invalidate()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ schema: CAPABILITY_MATRIX_EVIDENCE_SCHEMA, kind: 'tier_resolved', tier: 0 })
    probes = TIER1_PROBES
    tracker.invalidate()
    expect(records).toHaveLength(2)
    expect(records[1]).toMatchObject({ kind: 'tier_resolved', tier: 1 })
  })

  it('survives throwing listeners and stops notifying after dispose', () => {
    const tracker = createExperienceTierTracker({ probe: () => probeSet() })
    const listener = vi.fn()
    tracker.subscribe(() => { throw new Error('listener failed') })
    tracker.subscribe(listener)
    tracker.getSnapshot()
    expect(() => tracker.invalidate()).not.toThrow()
    tracker.dispose()
    tracker.invalidate()
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('capability matrix evidence', () => {
  it('keeps payloads categorical and rejects unknown vocabulary', () => {
    expect(recordCapabilityMatrixEvidence({ kind: 'unlock_hint_clicked', seam: 'terminal-host-v2' })).toEqual({
      schema: CAPABILITY_MATRIX_EVIDENCE_SCHEMA,
      kind: 'unlock_hint_clicked',
      seamCategory: 'terminal_host',
    })
    expect(recordCapabilityMatrixEvidence({ kind: 'disabled_reason_shown', seam: 'workspace.core-pane.v1', reason: 'reason.contractMismatch' })).toMatchObject({
      seamCategory: 'workspace_core_pane',
      reasonCategory: 'contract_mismatch',
    })
    expect(recordCapabilityMatrixEvidence({ kind: 'free_text' as never })).toBeUndefined()
    expect(recordCapabilityMatrixEvidence({ kind: 'tier_resolved', tier: 3 as never })).toBeUndefined()
    expect(recordCapabilityMatrixEvidence({ kind: 'unlock_hint_clicked', seam: 'https://example.invalid' as never })).toBeUndefined()
    expect(recordCapabilityMatrixEvidence({ kind: 'disabled_reason_shown', reason: 'reason.tokenLeak' as never })).toBeUndefined()
  })

  it('guard accepts produced records and rejects unsafe payloads', () => {
    const record = recordCapabilityMatrixEvidence({ kind: 'tier_resolved', tier: 2 })
    expect(record).toBeDefined()
    expect(isRedactedCapabilityMatrixEvidence(record)).toBe(true)
    expect(isRedactedCapabilityMatrixEvidence({ schema: CAPABILITY_MATRIX_EVIDENCE_SCHEMA, kind: 'tier_resolved', note: 'https://example.invalid' })).toBe(false)
    expect(isRedactedCapabilityMatrixEvidence({ schema: CAPABILITY_MATRIX_EVIDENCE_SCHEMA, kind: 'tier_resolved', note: '/etc/passwd' })).toBe(false)
  })
})

describe('projectCapabilityMatrix', () => {
  it('projects only tier, probe states, reason keys, and symbolic unlock anchors', () => {
    const matrix = projectCapabilityMatrix(resolveExperienceTier(TIER1_PROBES))
    expect(matrix.schema).toBe(WORKSPACE_CAPABILITY_MATRIX_SCHEMA)
    expect(matrix.tier).toBe(1)
    expect(matrix.rows).toHaveLength(WORKSPACE_SEAM_IDS.length)
    const coreRow = matrix.rows.find(row => row.seam === 'workspace.core-pane.v1')
    expect(coreRow).toMatchObject({ state: 'available', unlockAnchor: WORKSPACE_SEAM_UNLOCK_ANCHORS['workspace.core-pane.v1'] })
    expect(coreRow?.reasonKey).toBeUndefined()
    const terminalRow = matrix.rows.find(row => row.seam === 'terminal-host-v2')
    expect(terminalRow).toMatchObject({ state: 'missing', reasonKey: 'reason.terminalSeamMissing' })
    for (const row of matrix.rows) {
      expect(row.unlockAnchor).toMatch(/^[a-z][a-z0-9-]*$/)
    }
    expect(JSON.stringify(matrix)).not.toMatch(/https?:|file:|\/etc\/|\/workspaces|[A-Za-z]:[\\/]/)
  })
})
