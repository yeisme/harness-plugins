import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  CREATIVE_PIPELINE_CONTRACT_V1,
  decodeCreativePipelineEdgeProjectionV1,
  decodeCreativePipelineNodeProjectionV1,
  decodeCreativePipelineRunProjectionV1,
  decodeCreativePipelineRunStateV1,
  decodeWorkSurfaceCapsuleV1,
  redactCreativePipelineText,
  type CreativePipelineEdgeProjectionV1,
  type CreativePipelineNodeProjectionV1,
  type CreativePipelineRunProjectionV1,
  type CreativePipelineRunStateKindV1,
  type WorkSurfaceCapsuleV1,
} from '../src/index.js'

function nodeFixture(): CreativePipelineNodeProjectionV1 {
  return {
    id: 'node-shot-01',
    kind: 'shot',
    ref: 'media:shot:01',
    summary: { text: 'Shot 01  establishing', truncated: false },
    version: 'v3',
    status: 'ready',
    layout: { x: 120, y: 80, width: 240, height: 160 },
    freshness: 'fresh',
  }
}

function referenceEdgeFixture(): CreativePipelineEdgeProjectionV1 {
  return { id: 'edge-ref-1', kind: 'reference', source: 'node-scene-01', target: 'node-shot-01', label: 'contains' }
}

function executionEdgeFixture(): CreativePipelineEdgeProjectionV1 {
  return {
    id: 'edge-exec-1',
    kind: 'execution',
    source: 'node-shot-01',
    target: 'node-op-render',
    input_purpose: 'keyframe',
    output_version: 'v3',
    owner_projection_ref: 'owner:eikona:projection:9',
  }
}

function runProjectionFixture(): CreativePipelineRunProjectionV1 {
  return {
    run_ref: 'run:ordo:42',
    revision: 'r12',
    freshness: 'fresh',
    state: { state: 'blocked', reason: 'Owner adapter unavailable.', impact: 'Edge edge-exec-1 cannot dispatch.', next_action: 'Reconcile with the owner adapter.' },
    actions: [
      { action: 'pause', available: false, disabled_reason_code: 'run.not_running', action_ref: 'action:pause:12', expected_revision: 'r12' },
      { action: 'reconcile', available: true, action_ref: 'action:reconcile:12', expected_revision: 'r12' },
    ],
    progress: { completed: 2, total: 5 },
  }
}

function capsuleFixture(): WorkSurfaceCapsuleV1 {
  return {
    contract_version: CREATIVE_PIPELINE_CONTRACT_V1,
    project_ref: 'project:athel:7',
    surface: 'workbench',
    unsaved_draft: true,
    pending_review: true,
    run: { state: 'running', progress: { completed: 1, total: 4 } },
    menu: {
      project: { text: 'Athel EP3', truncated: false },
      surface: 'workbench',
      work_context: { text: 'production', truncated: false },
      run_state: 'running',
      next_action: { text: 'Review the pending draft.', truncated: false },
    },
  }
}

describe('creative pipeline node projection V1', () => {
  it('keeps the five node kinds and round-trips a valid node', () => {
    expectTypeOf<CreativePipelineNodeProjectionV1['kind']>().toEqualTypeOf<'asset' | 'character' | 'scene' | 'shot' | 'candidate'>()
    const input = nodeFixture()
    const decoded = decodeCreativePipelineNodeProjectionV1(JSON.parse(JSON.stringify(input)))
    expect(decoded).toEqual({ ok: true, value: input })
  })

  it('rejects unknown fields and unknown node kinds', () => {
    expect(decodeCreativePipelineNodeProjectionV1({ ...nodeFixture(), prompt_draft: 'extra' })).toMatchObject({ ok: false, code: 'pipeline.invalid_shape' })
    expect(decodeCreativePipelineNodeProjectionV1({ ...nodeFixture(), kind: 'material' })).toMatchObject({ ok: false, code: 'pipeline.unknown_enum' })
  })

  it('rejects sensitive keys without echoing values', () => {
    const result = decodeCreativePipelineNodeProjectionV1({ ...nodeFixture(), raw_prompt: 'do-not-echo' })
    expect(result).toMatchObject({ ok: false, code: 'pipeline.sensitive_field' })
    expect(JSON.stringify(result)).not.toContain('do-not-echo')
  })

  it('rejects absolute paths and unsafe refs', () => {
    expect(decodeCreativePipelineNodeProjectionV1({ ...nodeFixture(), ref: '/home/private/render.png' })).toMatchObject({ ok: false, code: 'pipeline.private_path' })
    expect(decodeCreativePipelineNodeProjectionV1({ ...nodeFixture(), ref: 'media:../../secret' })).toMatchObject({ ok: false, code: 'pipeline.private_path' })
    expect(decodeCreativePipelineNodeProjectionV1({ ...nodeFixture(), summary: { text: 'C:/Users/private/out.png', truncated: false } })).toMatchObject({ ok: false, code: 'pipeline.private_path' })
  })

  it('rejects over-long text and requires a reason for unavailable nodes', () => {
    expect(decodeCreativePipelineNodeProjectionV1({ ...nodeFixture(), summary: { text: 'x'.repeat(4097), truncated: true } })).toMatchObject({ ok: false, code: 'pipeline.out_of_bounds' })
    expect(decodeCreativePipelineNodeProjectionV1({ ...nodeFixture(), status: 'unavailable' })).toMatchObject({ ok: false, code: 'pipeline.invalid_shape' })
    const unavailable = decodeCreativePipelineNodeProjectionV1({ ...nodeFixture(), status: 'unavailable', unavailable_reason: 'Owner snapshot missing.' })
    expect(unavailable).toMatchObject({ ok: true })
  })
})

describe('creative pipeline edge projection V1', () => {
  it('keeps reference edges relationship-only and execution edges with purpose/version/owner ref', () => {
    const reference = referenceEdgeFixture()
    expect(decodeCreativePipelineEdgeProjectionV1(JSON.parse(JSON.stringify(reference)))).toEqual({ ok: true, value: reference })
    const execution = executionEdgeFixture()
    expect(decodeCreativePipelineEdgeProjectionV1(JSON.parse(JSON.stringify(execution)))).toEqual({ ok: true, value: execution })
  })

  it('rejects execution fields on reference edges and unknown edge kinds', () => {
    expect(decodeCreativePipelineEdgeProjectionV1({ ...referenceEdgeFixture(), input_purpose: 'keyframe' })).toMatchObject({ ok: false, code: 'pipeline.invalid_shape' })
    expect(decodeCreativePipelineEdgeProjectionV1({ ...executionEdgeFixture(), kind: 'dataflow' })).toMatchObject({ ok: false, code: 'pipeline.unknown_enum' })
  })

  it('keeps incompatible execution edges as drafts with a redacted reason', () => {
    const draft = { ...executionEdgeFixture(), draft: { reason: 'input keyframe cannot accept version v3\nstack trace' } }
    const decoded = decodeCreativePipelineEdgeProjectionV1(JSON.parse(JSON.stringify(draft)))
    expect(decoded.ok).toBe(true)
    if (decoded.ok && decoded.value.kind === 'execution') expect(decoded.value.draft?.reason).toBe('input keyframe cannot accept version v3')
  })

  it('rejects unsafe owner projection refs', () => {
    expect(decodeCreativePipelineEdgeProjectionV1({ ...executionEdgeFixture(), owner_projection_ref: '/var/owner/proj' })).toMatchObject({ ok: false, code: 'pipeline.private_path' })
  })
})

describe('creative pipeline run projection V1', () => {
  it('decodes every run state kind', () => {
    expectTypeOf<CreativePipelineRunStateKindV1>().toEqualTypeOf<'running' | 'paused' | 'blocked' | 'stale' | 'unknown' | 'needs_contract' | 'partial'>()
    for (const state of ['running', 'paused', 'blocked', 'stale', 'unknown', 'needs_contract', 'partial'] as const) {
      const input = { state, reason: `state ${state}`, impact: 'bounded impact', next_action: 'bounded hint' }
      expect(decodeCreativePipelineRunStateV1(input)).toMatchObject({ ok: true, value: { state } })
    }
    expect(decodeCreativePipelineRunStateV1({ state: 'retrying', reason: 'r', impact: 'i', next_action: 'n' })).toMatchObject({ ok: false, code: 'pipeline.unknown_enum' })
  })

  it('round-trips a valid run projection with server-authored actions', () => {
    const input = runProjectionFixture()
    expect(decodeCreativePipelineRunProjectionV1(JSON.parse(JSON.stringify(input)))).toEqual({ ok: true, value: input })
  })

  it('rejects unknown action kinds and unavailable actions without a reason code', () => {
    const input = runProjectionFixture()
    expect(decodeCreativePipelineRunProjectionV1({ ...input, actions: [{ ...input.actions[1], action: 'retry' }] })).toMatchObject({ ok: false, code: 'pipeline.unknown_enum' })
    const missingReason = { action: 'pause', available: false, action_ref: 'action:pause:12', expected_revision: 'r12' }
    expect(decodeCreativePipelineRunProjectionV1({ ...input, actions: [missingReason] })).toMatchObject({ ok: false, code: 'pipeline.invalid_shape' })
  })

  it('rejects out-of-bounds progress and sensitive keys in state text', () => {
    const input = runProjectionFixture()
    expect(decodeCreativePipelineRunProjectionV1({ ...input, progress: { completed: 6, total: 5 } })).toMatchObject({ ok: false, code: 'pipeline.invalid_shape' })
    expect(decodeCreativePipelineRunProjectionV1({ ...input, state: { ...input.state, provider_payload: {} } })).toMatchObject({ ok: false, code: 'pipeline.sensitive_field' })
    expect(decodeCreativePipelineRunStateV1({ ...input.state, reason: 'x'.repeat(4097) })).toMatchObject({ ok: false, code: 'pipeline.out_of_bounds' })
  })

  it('redacts credential shapes and private paths from state text', () => {
    const decoded = decodeCreativePipelineRunStateV1({ state: 'blocked', reason: 'token=abc123 at /home/owner/key', impact: 'edge blocked', next_action: 'reconcile' })
    expect(decoded.ok).toBe(true)
    if (decoded.ok) {
      expect(decoded.value.reason).toBe('token=[REDACTED] at [PRIVATE_PATH]')
    }
  })
})

describe('work surface capsule V1', () => {
  it('round-trips a valid capsule with both surfaces', () => {
    const input = capsuleFixture()
    expect(decodeWorkSurfaceCapsuleV1(JSON.parse(JSON.stringify(input)))).toEqual({ ok: true, value: input })
    const agent = { ...input, surface: 'agent' as const, menu: { ...input.menu, surface: 'agent' as const } }
    expect(decodeWorkSurfaceCapsuleV1(JSON.parse(JSON.stringify(agent)))).toMatchObject({ ok: true })
  })

  it('fails closed for unknown contract versions, surfaces and fields', () => {
    const input = capsuleFixture()
    expect(decodeWorkSurfaceCapsuleV1({ ...input, contract_version: 'dsh.creative-pipeline.v2' })).toMatchObject({ ok: false, code: 'pipeline.unknown_version' })
    expect(decodeWorkSurfaceCapsuleV1({ ...input, surface: 'terminal' })).toMatchObject({ ok: false, code: 'pipeline.unknown_enum' })
    expect(decodeWorkSurfaceCapsuleV1({ ...input, permissions: ['write'] })).toMatchObject({ ok: false, code: 'pipeline.invalid_shape' })
    expect(decodeWorkSurfaceCapsuleV1({ ...input, project_ref: '/workspaces/private' })).toMatchObject({ ok: false, code: 'pipeline.private_path' })
  })

  it('redacts menu summary text and bounds run progress', () => {
    const input = capsuleFixture()
    expect(decodeWorkSurfaceCapsuleV1({ ...input, run: { state: 'running', progress: { completed: 9, total: 4 } } })).toMatchObject({ ok: false, code: 'pipeline.invalid_shape' })
    expect(decodeWorkSurfaceCapsuleV1({ ...input, menu: { ...input.menu, project: { text: 'x'.repeat(4097), truncated: true } } })).toMatchObject({ ok: false, code: 'pipeline.out_of_bounds' })
  })
})

describe('redactCreativePipelineText', () => {
  it('strips multi-line content, credentials and private paths', () => {
    expect(redactCreativePipelineText('authorization: bearer xyz\nsecond line')).toBe('authorization=[REDACTED] xyz')
    expect(redactCreativePipelineText('failed at /root/.config/key')).toBe('failed at [PRIVATE_PATH]')
  })
})
