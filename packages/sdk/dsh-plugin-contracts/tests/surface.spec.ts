import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  DSH_PLUGIN_SURFACE_CONTRACT_V1,
  decodeDshPluginActionReceiptV1,
  decodeDshPluginSurfaceContributionV1,
  probeDshPluginSurfaceContributionV1,
  redactDshPluginSurfaceText,
  type DshPluginSurfaceContributionV1,
  type DshPluginViewKindV1,
} from '../src/index.js'

function fixture(): DshPluginSurfaceContributionV1 {
  return {
    contract_version: DSH_PLUGIN_SURFACE_CONTRACT_V1,
    id: 'personal-coding.core',
    owner: 'harness-plugins',
    generation: 7,
    surfaces: ['web', 'tui'],
    commands: [{
      id: 'ordo.run.launch',
      canonical_name: '/ordo run launch',
      aliases: [],
      owner: 'ordo',
      action_kind: 'ordo.run.launch',
      available: false,
      disabled_reason_code: 'ordo.run_launch.unavailable',
    }],
    views: [
      { id: 'coding.status', owner: 'harness-plugins', kind: 'status', title: 'Status', projection: { revision: 'r7', freshness: 'fresh', scalars: { ready: true } } },
      { id: 'coding.list', owner: 'harness-plugins', kind: 'list', title: 'Files', projection: { revision: 'r7', freshness: 'fresh', rows: [{ id: 'file-1', ref: 'file:1', summary: { text: 'src/index.ts', truncated: false } }] } },
      { id: 'coding.table', owner: 'harness-plugins', kind: 'table', title: 'Checks', projection: { revision: 'r7', freshness: 'fresh', rows: [] } },
      { id: 'coding.detail', owner: 'harness-plugins', kind: 'detail', title: 'Review', projection: { revision: 'r7', freshness: 'fresh', summary: { text: 'Ready', truncated: false } } },
      { id: 'coding.timeline', owner: 'harness-plugins', kind: 'timeline', title: 'Activity', projection: { revision: 'r7', freshness: 'fresh', rows: [] } },
      { id: 'coding.diff', owner: 'harness-plugins', kind: 'diff', title: 'Diff', projection: { revision: 'r7', freshness: 'fresh', evidence_ref: 'evidence:diff:7', rows: [] } },
    ],
    actions: [{
      id: 'candidate.apply',
      owner: 'dsh-tui',
      label: 'Apply candidate',
      effect: 'mutation',
      risk: 'high',
      preview_policy: 'owner_preview_required',
      action_ref: 'action:apply:7',
      expected_revision: 'r7',
      available: true,
    }],
    health: {
      status: 'available',
      stage: 'ready',
      code: 'personal_coding.ready',
      reason: 'All required contributions are available.',
      fix: 'No action required.',
      last_checked: '2026-09-02T00:00:00.000Z',
    },
    dispose_ref: 'dispose:personal-coding:7',
  }
}

describe('structured surface V1', () => {
  it('keeps all six view kinds and round-trips the host/TUI structural mirror', () => {
    expectTypeOf<DshPluginViewKindV1>().toEqualTypeOf<'status' | 'list' | 'table' | 'detail' | 'timeline' | 'diff'>()
    const input = fixture()
    const decoded = decodeDshPluginSurfaceContributionV1(JSON.parse(JSON.stringify(input)))
    expect(decoded).toEqual({ ok: true, value: input })
    if (decoded.ok) expect(decoded.value.actions[0]?.expected_revision).toBe('r7')
  })

  it('fails closed for unknown versions and view kinds', () => {
    expect(decodeDshPluginSurfaceContributionV1({ ...fixture(), contract_version: 'dsh.plugin.surface.v2' })).toMatchObject({ ok: false, code: 'surface.unknown_version' })
    const input = fixture()
    expect(decodeDshPluginSurfaceContributionV1({ ...input, views: [{ ...input.views[0], kind: 'canvas' }] })).toMatchObject({ ok: false, code: 'surface.unknown_view_kind' })
  })

  it('rejects renderer fields, sensitive keys and private absolute paths without echoing values', () => {
    const input = fixture()
    expect(decodeDshPluginSurfaceContributionV1({ ...input, html: '<script />' })).toMatchObject({ ok: false, code: 'surface.renderer_forbidden' })
    expect(decodeDshPluginSurfaceContributionV1({ ...input, views: [{ ...input.views[0], projection: { ...input.views[0]?.projection, scalars: { token: 'should-not-echo' } } }] })).toMatchObject({ ok: false, code: 'surface.sensitive_field' })
    const privatePath = decodeDshPluginSurfaceContributionV1({ ...input, views: [{ ...input.views[0], projection: { ...input.views[0]?.projection, ref: '/home/private/repo' } }] })
    expect(privatePath).toMatchObject({ ok: false, code: 'surface.private_path' })
    expect(JSON.stringify(privatePath)).not.toContain('/home/private/repo')
  })

  it('requires owner preview for every mutating effect', () => {
    const input = fixture()
    expect(decodeDshPluginSurfaceContributionV1({ ...input, actions: [{ ...input.actions[0], preview_policy: 'none' }] })).toMatchObject({ ok: false, code: 'surface.invalid_shape' })
  })

  it('probes missing/valid/invalid surfaces with the existing three-state contract', () => {
    expect(probeDshPluginSurfaceContributionV1(() => undefined)).toEqual({ status: 'needs_contract' })
    expect(probeDshPluginSurfaceContributionV1(fixture)).toMatchObject({ status: 'available' })
    expect(probeDshPluginSurfaceContributionV1(() => ({ ...fixture(), contract_version: 'future' }))).toEqual({
      status: 'unavailable',
      reason: 'surface.unknown_version: contribution.contract_version is not supported',
    })
  })
})

describe('action receipt V1', () => {
  it('preserves action ref, expected owner revision and opaque evidence refs', () => {
    const receipt = {
      contract_version: DSH_PLUGIN_SURFACE_CONTRACT_V1,
      action_id: 'candidate.apply',
      action_ref: 'action:apply:7',
      owner: 'dsh-tui',
      status: 'applied',
      revision: 'r8',
      receipt_ref: 'receipt:8',
      evidence_ref: 'evidence:8',
    }
    expect(decodeDshPluginActionReceiptV1(receipt)).toEqual({ ok: true, value: receipt })
  })
})

describe('redaction', () => {
  it('removes credentials, paths and stack lines from reasons', () => {
    const output = redactDshPluginSurfaceText('token=topsecret failed at /workspaces/private/repo\nstack line')
    expect(output).toBe('token=[REDACTED] failed at [PRIVATE_PATH]')
    expect(output).not.toContain('topsecret')
    expect(output).not.toContain('stack line')
  })
})
