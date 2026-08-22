import { describe, expect, it } from 'vitest'
import { PANE_ACTION_DESCRIPTOR_SCHEMA } from '@yeisme/dsh-pane-protocol'
import { validateCreatorOwnerSnapshot, validateCreatorStudioContext } from '../src/validation.ts'

const context = {
  tenantRef: 'tenant:one', workspaceRef: 'workspace:one', sessionRef: 'session:one', principalRef: 'principal:one', revision: '1', membershipRevision: '1', installationRef: 'install:web', pluginDigest: 'digest:creator', policyRevision: '1', runtimeGeneration: 'runtime:1',
}

describe('Creator Studio Host validation', () => {
  it('requires the full frozen runtime binding', () => {
    expect(validateCreatorStudioContext(context)).toEqual(context)
    const { runtimeGeneration: _removed, ...drifted } = context
    expect(validateCreatorStudioContext(drifted)).toBeUndefined()
  })

  it('accepts a safe Eikona projection and rejects Scaena-only aggregation from another owner', () => {
    const action = {
      schema: PANE_ACTION_DESCRIPTOR_SCHEMA,
      descriptorRef: 'action:eikona:1', owner: 'eikona', actionId: 'generate.preview', label: 'Generate preview', targetRef: 'project:one', targetVersion: '1', context, risk: 'medium', confirmation: 'confirm', expiresAt: '2026-08-22T00:00:00Z', preview: { summary: 'Generate one preview.' }, fields: [],
    }
    const snapshot = {
      schemaVersion: 'creator.owner.snapshot.v1alpha1', owner: 'eikona', transport: 'local', snapshotRef: 'snapshot:eikona:1', snapshotVersion: 1, cursor: 'cursor:eikona:1', sequence: -1, generatedAt: '2026-08-21T00:00:00Z', context, status: 'ready', freshness: 'fresh', summary: 'Eikona ready.', resources: [], actions: [action],
    }
    expect(validateCreatorOwnerSnapshot(snapshot)?.owner).toBe('eikona')
    expect(validateCreatorOwnerSnapshot({ ...snapshot, production: { ref: 'production:1' } })).toBeUndefined()
    expect(validateCreatorOwnerSnapshot({ ...snapshot, summary: 'Bearer secret-value' })).toBeUndefined()
    expect(validateCreatorOwnerSnapshot({
      ...snapshot,
      actions: [{ ...action, context: { ...context, runtimeGeneration: 'runtime:2' } }],
    })).toBeUndefined()
  })
})
