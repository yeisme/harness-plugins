import { describe, expect, it } from 'vitest'
import { PANE_ACTION_DESCRIPTOR_SCHEMA } from '@yeisme/dsh-pane-protocol'
import { validateCreatorAssetPage, validateCreatorAssetQuery, validateCreatorOwnerAssetList, validateCreatorOwnerSnapshot, validateCreatorStudioContext } from '../src/validation.ts'

const context = {
  tenantRef: 'tenant:one', workspaceRef: 'workspace:one', projectRef: 'project:one', sessionRef: 'session:one', principalRef: 'principal:one', revision: '1', membershipRevision: '1', installationRef: 'install:web', pluginDigest: 'digest:creator', policyRevision: '1', runtimeGeneration: 'runtime:1',
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

  it('validates bounded asset queries and pages', () => {
    expect(validateCreatorAssetQuery({ scope: 'current_project', limit: 100 })).toEqual({ scope: 'current_project', limit: 100 })
    expect(validateCreatorAssetQuery({ scope: 'all_projects', limit: 201 })).toBeUndefined()
    expect(validateCreatorAssetPage({
      schemaVersion: 'creator.asset.page.v1alpha1', scope: 'all_projects', status: 'ready', freshness: 'fresh', reasonCode: 'asset_page', safeMessage: 'Assets ready.', items: [], unavailableOwners: [],
    })?.status).toBe('ready')
    expect(validateCreatorOwnerAssetList({ status: 'permission_denied', safeMessage: 'Denied.', items: [] })?.status).toBe('permission_denied')
    expect(validateCreatorOwnerAssetList({ status: 'permission_denied', safeMessage: 'Denied.', items: [{ owner: 'eikona' }] })).toBeUndefined()
  })
})
