import type { DshPluginActionReceiptV1, DshPluginSurfaceContributionV1 } from '@yeisme/dsh-plugin-contracts'

const CONTRACT_VERSION = 'dsh.plugin.surface.v1' as const
const REVISION = 'example-r1'
const ACTION_REF = 'example:refresh:r1'

/** Host 与 client 共用的纯数据示例；宿主负责渲染，不携带组件或回调。 */
export function createExampleStructuredSurfaceV1(options: { readonly available?: boolean } = {}): DshPluginSurfaceContributionV1 {
  const available = options.available !== false
  return {
    contract_version: CONTRACT_VERSION,
    id: 'example.structured-surface',
    owner: 'dsh-plugin-example',
    generation: 1,
    surfaces: ['web', 'tui'],
    commands: [{
      id: 'example.inspect',
      canonical_name: '/example',
      aliases: [],
      owner: 'dsh-plugin-example',
      action_kind: 'example.inspect',
      available,
      ...(available ? {} : { disabled_reason_code: 'example.source.unavailable' }),
    }],
    views: [
      {
        id: 'example.list',
        owner: 'dsh-plugin-example',
        kind: 'list',
        title: 'Example items',
        projection: { revision: REVISION, freshness: available ? 'fresh' : 'unknown', rows: [{ id: 'item-1', summary: { text: 'First bounded item', truncated: false } }] },
      },
      {
        id: 'example.detail',
        owner: 'dsh-plugin-example',
        kind: 'detail',
        title: 'Example detail',
        projection: { revision: REVISION, freshness: available ? 'fresh' : 'unknown', summary: { text: 'Host-rendered detail projection.', truncated: false } },
      },
      {
        id: 'example.diff',
        owner: 'dsh-plugin-example',
        kind: 'diff',
        title: 'Example diff',
        projection: { revision: REVISION, freshness: available ? 'fresh' : 'unknown', evidence_ref: 'evidence:example:diff:r1', rows: [] },
      },
    ],
    actions: [{
      id: 'example.refresh',
      owner: 'dsh-plugin-example',
      label: 'Refresh example',
      effect: 'mutation',
      risk: 'low',
      preview_policy: 'owner_preview_required',
      action_ref: ACTION_REF,
      expected_revision: REVISION,
      available,
      ...(available ? {} : { disabled_reason_code: 'example.source.unavailable' }),
    }],
    health: {
      status: available ? 'available' : 'disabled',
      stage: available ? 'ready' : 'probe',
      code: available ? 'example.ready' : 'example.source.unavailable',
      reason: available ? 'Example source is available.' : 'Example source is unavailable.',
      fix: available ? 'No action required.' : 'Install or enable the example source capability.',
      last_checked: '2026-09-02T00:00:00.000Z',
    },
    dispose_ref: 'dispose:example:surface:1',
  }
}

export interface ExampleActionPreviewV1 {
  readonly preview_ref: string
  readonly action_ref: string
  readonly expected_revision: string
  readonly effect: 'mutation'
}

export function previewExampleActionV1(): ExampleActionPreviewV1 {
  return { preview_ref: 'preview:example:refresh:r1', action_ref: ACTION_REF, expected_revision: REVISION, effect: 'mutation' }
}

export function applyExampleActionV1(input: { readonly action_ref: string; readonly expected_revision: string }): DshPluginActionReceiptV1 {
  if (input.action_ref !== ACTION_REF || input.expected_revision !== REVISION) {
    return {
      contract_version: CONTRACT_VERSION,
      action_id: 'example.refresh',
      action_ref: input.action_ref,
      owner: 'dsh-plugin-example',
      status: 'stale',
      revision: REVISION,
      receipt_ref: 'receipt:example:stale',
      reason_code: 'example.revision_mismatch',
    }
  }
  return {
    contract_version: CONTRACT_VERSION,
    action_id: 'example.refresh',
    action_ref: input.action_ref,
    owner: 'dsh-plugin-example',
    status: 'applied',
    revision: 'example-r2',
    receipt_ref: 'receipt:example:refresh:r2',
  }
}
