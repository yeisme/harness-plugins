import { PANE_ACTION_DESCRIPTOR_SCHEMA, PANE_ARTIFACT_SCHEMA, type PaneActionDescriptorV1 } from '@yeisme/dsh-pane-protocol'
import type { CreatorStudioContextV1, CreatorStudioOwner, CreatorStudioSnapshotV1 } from '@yeisme/dsh-creator-studio-host/contracts'

export const creatorContext: CreatorStudioContextV1 = {
  tenantRef: 'tenant:one',
  workspaceRef: 'workspace:one',
  sessionRef: 'session:one',
  principalRef: 'principal:one',
  revision: '1',
  membershipRevision: '1',
  installationRef: 'install:web',
  pluginDigest: 'digest:creator',
  policyRevision: '1',
  runtimeGeneration: 'runtime:1',
}

export function action(owner: CreatorStudioOwner, task: string, actionId = `${owner}.create`): PaneActionDescriptorV1 {
  return {
    schema: PANE_ACTION_DESCRIPTOR_SCHEMA,
    descriptorRef: `action:${owner}:${task}:1`,
    owner,
    actionId,
    label: `Create ${task}`,
    targetRef: 'project:one',
    targetVersion: '1',
    context: creatorContext,
    risk: 'low',
    confirmation: 'none',
    expiresAt: '2999-01-01T00:00:00Z',
    preview: { summary: `Create one ${task} candidate.` },
    fields: [{ key: 'brief', label: 'Brief', kind: 'textarea', required: true, maxLength: 2_000 }],
    presentation: { task, owner, group: 'creator.tasks' },
  }
}

export function creatorSnapshot(): CreatorStudioSnapshotV1 {
  const owners = (['eikona', 'scaena', 'sonora', 'auctra', 'pinax', 'anatomia'] as const).map(owner => ({
    schemaVersion: 'creator.owner.snapshot.v1alpha1' as const,
    owner,
    transport: 'local' as const,
    snapshotRef: `snapshot:${owner}:1`,
    snapshotVersion: 1,
    cursor: `cursor:${owner}:1`,
    sequence: -1,
    generatedAt: '2026-08-21T00:00:00Z',
    context: creatorContext,
    status: 'ready' as const,
    freshness: 'fresh' as const,
    summary: `${owner} ready.`,
    resources: owner === 'eikona' ? [{
      ref: 'image:one', version: '1', kind: 'image', title: '雨夜城市', status: 'ready', summary: 'Accepted visual candidate.',
      artifact: { schema: PANE_ARTIFACT_SCHEMA, owner: 'eikona', kind: 'image', ref: 'artifact:image:one', version: '1', mediaType: 'image/png', title: '雨夜城市', evidenceRefs: ['evidence:image:one'], capabilities: ['open', 'preview', 'handoff'] },
      evidenceRefs: ['evidence:image:one'],
    }] : owner === 'sonora' ? [{
      ref: 'take:one', version: '1', kind: 'audio', title: '主角对白 Take 1', status: 'ready', summary: 'Rights cleared.', waveform: [0.2, 0.6, 0.9, 0.45, 0.7, 0.3], evidenceRefs: [],
    }] : [],
    actions: [action(owner, owner === 'eikona' ? 'image' : owner === 'scaena' ? 'video' : owner === 'sonora' ? 'audio' : owner === 'auctra' ? 'text' : owner === 'pinax' ? 'context' : 'analysis')],
    ...(owner === 'scaena' ? {
      production: {
        ref: 'production:one', version: '4', title: '雨夜来客', currentStage: 'shots' as const,
        stages: [
          { id: 'prepare' as const, label: '准备', status: 'ready' as const, progress: 1 },
          { id: 'text' as const, label: '文字', status: 'ready' as const, progress: 1 },
          { id: 'visual' as const, label: '视觉', status: 'ready' as const, progress: 1 },
          { id: 'shots' as const, label: '镜头', status: 'running' as const, progress: 0.55, itemCount: 8 },
          { id: 'review' as const, label: '审阅', status: 'pending' as const, progress: 0 },
          { id: 'export' as const, label: '导出', status: 'pending' as const, progress: 0 },
        ],
        blockers: [],
      },
      reviews: [{ ref: 'review:one', owner: 'eikona' as const, title: '镜头 04 视觉候选', status: 'pending' as const, risk: 'medium' as const, summary: 'Choose one visual candidate.', evidenceRefs: [] }],
      jobs: [{ ref: 'job:one', owner: 'sonora' as const, title: '对白渲染', status: 'running' as const, progress: 0.6, evidenceRefs: [] }],
    } : {}),
  }))
  return {
    schemaVersion: 'creator.studio.snapshot.v1alpha1',
    snapshotRef: 'creator:studio:runtime:1:1',
    snapshotVersion: 1,
    generatedAt: '2026-08-21T00:00:00Z',
    status: 'ready',
    freshness: 'fresh',
    reasonCode: 'owner_snapshot',
    safeMessage: 'All Creator Studio owners are ready.',
    context: creatorContext,
    owners,
    production: owners.find(owner => owner.owner === 'scaena')?.production,
    reviews: owners.find(owner => owner.owner === 'scaena')?.reviews ?? [],
    jobs: owners.find(owner => owner.owner === 'scaena')?.jobs ?? [],
  }
}
