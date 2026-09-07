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
      descriptorRef: 'action:eikona:1', owner: 'eikona', actionId: 'generate.preview', label: 'Generate preview', targetRef: 'artifact:one', targetVersion: '1', context, risk: 'medium', confirmation: 'confirm', expiresAt: '2026-08-22T00:00:00Z', preview: { summary: 'Generate one preview.' }, fields: [],
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

    const workspace = {
      status: 'ready' as const,
      safeMessage: 'Owner lifecycle descriptors are available.',
      artifacts: [{
        artifact: { schema: 'pane.artifact.v1alpha1', owner: 'eikona', kind: 'image', ref: 'artifact:one', version: '1', mediaType: 'image/png', title: 'Candidate image', evidenceRefs: [], capabilities: ['open'] },
        acceptedVersion: '1',
        candidates: [],
        actions: { adopt: { descriptorRef: action.descriptorRef } },
      }],
    }
    expect(validateCreatorOwnerSnapshot({ ...snapshot, artifactWorkspace: workspace })?.artifactWorkspace?.status).toBe('ready')
    expect(validateCreatorOwnerSnapshot({ ...snapshot, artifactWorkspace: { ...workspace, artifacts: [{ ...workspace.artifacts[0], actions: { adopt: { descriptorRef: 'action:missing' } } }] } })).toBeUndefined()
  })

  it('binds workspace fields and candidate proofs to the exact owner artifact versions', () => {
    const fields = [
      { key: 'body', label: 'Body', kind: 'textarea', required: true, maxLength: 16_384 },
      { key: 'content_revision', label: 'Revision', kind: 'text', required: true, maxLength: 160 },
      { key: 'candidate_ref', label: 'Candidate', kind: 'text', required: true, maxLength: 160 },
      { key: 'candidate_version', label: 'Candidate version', kind: 'text', required: true, maxLength: 160 },
    ]
    const action = { schema: PANE_ACTION_DESCRIPTOR_SCHEMA, descriptorRef: 'action:eikona:save', owner: 'eikona', actionId: 'artifact.save', label: 'Save', targetRef: 'artifact:text', targetVersion: '1', context, risk: 'low', confirmation: 'none', expiresAt: '2999-08-22T00:00:00Z', preview: { summary: 'Save artifact.' }, fields }
    const artifact = { schema: 'pane.artifact.v1alpha1', owner: 'eikona', kind: 'text', ref: 'artifact:text', version: '1', mediaType: 'text/markdown', title: 'Draft', evidenceRefs: [], capabilities: ['preview'] }
    const candidateArtifact = { ...artifact, ref: 'artifact:candidate', version: '2', title: 'Candidate' }
    const proof = { id: 'reference:candidate', kind: 'file', intent: 'content', scope: 'artifact/body', digest: 'digest:candidate', freshness: 'fresh' }
    const item = { artifact, acceptedVersion: '1', candidates: [{ ref: 'candidate:two', version: '2', title: 'Candidate', status: 'ready', artifact: candidateArtifact, referenceProof: proof }], actions: { saveDraft: { descriptorRef: action.descriptorRef, contentField: 'body', contentRevisionField: 'content_revision' }, attachContext: { descriptorRef: action.descriptorRef, candidateRefField: 'candidate_ref', candidateVersionField: 'candidate_version' } } }
    const snapshot = { schemaVersion: 'creator.owner.snapshot.v1alpha1', owner: 'eikona', transport: 'local', snapshotRef: 'snapshot:eikona:bindings', snapshotVersion: 1, cursor: 'cursor:eikona:bindings', sequence: 1, generatedAt: '2026-08-21T00:00:00Z', context, status: 'ready', freshness: 'fresh', summary: 'Eikona ready.', resources: [], actions: [action], artifactWorkspace: { status: 'ready', safeMessage: 'Workspace ready.', artifacts: [item] } }
    expect(validateCreatorOwnerSnapshot(snapshot)?.artifactWorkspace?.artifacts[0]?.candidates[0]?.version).toBe('2')
    expect(validateCreatorOwnerSnapshot({ ...snapshot, artifactWorkspace: { ...snapshot.artifactWorkspace, artifacts: [{ ...item, actions: { saveDraft: { descriptorRef: action.descriptorRef, contentField: 'missing', contentRevisionField: 'content_revision' } } }] } })).toBeUndefined()
    expect(validateCreatorOwnerSnapshot({ ...snapshot, artifactWorkspace: { ...snapshot.artifactWorkspace, artifacts: [{ ...item, actions: { saveDraft: { descriptorRef: action.descriptorRef, contentField: 'body' } } }] } })).toBeUndefined()
    expect(validateCreatorOwnerSnapshot({ ...snapshot, artifactWorkspace: { ...snapshot.artifactWorkspace, artifacts: [{ ...item, actions: { saveDraft: { descriptorRef: action.descriptorRef, contentField: 'candidate_ref', contentRevisionField: 'content_revision' } } }] } })).toBeUndefined()
    expect(validateCreatorOwnerSnapshot({ ...snapshot, artifactWorkspace: { ...snapshot.artifactWorkspace, artifacts: [{ ...item, candidates: [{ ...item.candidates[0], artifact: { ...candidateArtifact, owner: 'auctra' } }] }] } })).toBeUndefined()
    expect(validateCreatorOwnerSnapshot({ ...snapshot, artifactWorkspace: { ...snapshot.artifactWorkspace, artifacts: [{ ...item, candidates: [{ ...item.candidates[0], artifact: { ...candidateArtifact, version: '3' } }] }] } })).toBeUndefined()
    expect(validateCreatorOwnerSnapshot({ ...snapshot, artifactWorkspace: { ...snapshot.artifactWorkspace, artifacts: [{ ...item, candidates: [{ ...item.candidates[0], artifact: undefined }] }] } })).toBeUndefined()
    expect(validateCreatorOwnerSnapshot({ ...snapshot, artifactWorkspace: { ...snapshot.artifactWorkspace, artifacts: [{ ...item, actions: { writeback: { descriptorRef: action.descriptorRef, candidateRefField: 'candidate_ref', candidateVersionField: 'candidate_version' } } }] } })).toBeUndefined()
    const shortCandidate = { ...action, fields: fields.map(field => field.key === 'candidate_ref' ? { ...field, maxLength: 5 } : field) }
    expect(validateCreatorOwnerSnapshot({ ...snapshot, actions: [shortCandidate] })).toBeUndefined()
    for (const role of ['contentRevisionField', 'rangeField', 'annotationField']) {
      const runtimeItem = { ...item, actions: { saveDraft: { ...item.actions.saveDraft, [role]: 'runtime_value' } } }
      const withField = (field: unknown) => ({ ...snapshot, actions: [{ ...action, fields: [...fields, field] }], artifactWorkspace: { ...snapshot.artifactWorkspace, artifacts: [runtimeItem] } })
      expect(validateCreatorOwnerSnapshot(withField({ key: 'runtime_value', label: 'Runtime value', kind: 'select', required: true, options: [{ value: 'fixed', label: 'Fixed' }] })), role).toBeUndefined()
      expect(validateCreatorOwnerSnapshot(withField({ key: 'runtime_value', label: 'Runtime value', kind: 'text', required: true, maxLength: 1_024 })), role).toBeDefined()
    }
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
