import { describe, expect, it } from 'vitest'
import {
  OPC_SCENE_PACKAGE_SUMMARY_SCHEMA,
  OPC_SCENE_SUMMARY_FIXTURE,
  SCAENA_CANONICAL_OPC_SCENE_PACKAGE_SUMMARY_SCHEMA,
  normalizeScaenaCanonicalOpcScenePackageSummary,
  projectScaenaCanonicalOpcCrossEntryIdentity,
  validateOpcScenePackageSummary,
  verifyScaenaCanonicalOpcCrossEntryConformance,
} from '../src/index.ts'

const canonicalFixture = {
  schema_version: SCAENA_CANONICAL_OPC_SCENE_PACKAGE_SUMMARY_SCHEMA,
  project_ref: 'project:mist-harbor',
  show_ref: 'show:mist-harbor',
  episode_ref: 'episode:s01e03',
  scene_ref: 'scene:s01e03-sc04',
  package_ref: 'storyboard_package:scene:s01e03-sc04:v7',
  package_version: 7,
  surface_state: 'review',
  current_stage: 'review_required',
  freshness: 'fresh',
  human_gates: [
    {
      gate_id: 'direction_confirm',
      state: 'satisfied',
      receipt_ref: 'receipt:direction:scene:s01e03-sc04:v7',
    },
    { gate_id: 'visual_foundation_accept', state: 'pending' },
    { gate_id: 'export_confirm', state: 'pending' },
  ],
  primary_action: {
    schema_version: 'scaena.workbench.action_descriptor.v1',
    action_id: 'storyboard.package.confirm_recommendation',
    owner: 'scaena',
    owner_authority: 'scaena:storyboard.package',
    permission: 'approve',
    expected_version: '7',
    idempotency_required: true,
    target_ref: 'storyboard_package:scene:s01e03-sc04:v7',
    side_effect_class: 'local_state',
    confirmation_required: true,
  },
  observed_at: '2026-09-03T05:00:00Z',
  future_field: { nested: true },
}

function redactedConformanceFixture(overrides: Record<string, unknown> = {}) {
  return {
    contract_version: SCAENA_CANONICAL_OPC_SCENE_PACKAGE_SUMMARY_SCHEMA,
    cases: [{ kind: 'summary', payload: canonicalFixture }],
    dsh_expectations: {
      package_ref: 'storyboard_package:scene:s01e03-sc04:v7',
      package_version: 7,
      expected_action: {
        action_id: 'storyboard.package.confirm_recommendation',
        target_ref: 'storyboard_package:scene:s01e03-sc04:v7',
        expected_version: '7',
        side_effect_class: 'local_state',
        confirmation_required: true,
        idempotency_required: true,
      },
      expected_gate_receipts: {
        direction_confirm: 'receipt:direction:scene:s01e03-sc04:v7',
        visual_foundation_accept: null,
        export_confirm: null,
      },
      ...overrides,
    },
  }
}

describe('Scaena canonical OPC compatibility adapter', () => {
  it('keeps the released legacy schema constant and validator unchanged', () => {
    expect(OPC_SCENE_PACKAGE_SUMMARY_SCHEMA).toBe('scaena.opc-scene-package-summary.v1alpha1')
    expect(SCAENA_CANONICAL_OPC_SCENE_PACKAGE_SUMMARY_SCHEMA).toBe('scaena.opc.scene_package_summary.v1alpha1')
    expect(validateOpcScenePackageSummary(OPC_SCENE_SUMMARY_FIXTURE)).toBe(true)
  })

  it('copies canonical action and gate receipt identity without enum translation', () => {
    const summary = normalizeScaenaCanonicalOpcScenePackageSummary(canonicalFixture)
    const identity = projectScaenaCanonicalOpcCrossEntryIdentity(summary)
    expect(identity).toMatchObject({
      packageRef: 'storyboard_package:scene:s01e03-sc04:v7',
      packageVersion: '7',
      primaryAction: {
        actionId: 'storyboard.package.confirm_recommendation',
        targetRef: 'storyboard_package:scene:s01e03-sc04:v7',
        expectedVersion: '7',
        sideEffectClass: 'local_state',
        confirmationRequired: true,
        idempotencyRequired: true,
      },
      gateReceipts: {
        direction_confirm: 'receipt:direction:scene:s01e03-sc04:v7',
      },
      receiptRefs: [],
    })
    expect(identity.primaryAction).not.toHaveProperty('idempotencyKey')
    expect(identity).not.toHaveProperty('readiness')
    expect(summary).not.toHaveProperty('future_field')
    expect(summary.surfaceState).toBe('review')
    expect(summary.primaryAction?.sideEffectClass).toBe('local_state')
  })

  it('accepts camelCase ingress and optional receipt/reconcile identity', () => {
    const camel = {
      schemaVersion: SCAENA_CANONICAL_OPC_SCENE_PACKAGE_SUMMARY_SCHEMA,
      projectRef: 'project:mist-harbor',
      episodeRef: 'episode:s01e03',
      packageRef: 'storyboard_package:scene:s01e03-sc04:v7',
      packageVersion: 7,
      surfaceState: 'review',
      currentStage: 'review_required',
      freshness: 'fresh',
      humanGates: [{ gateId: 'direction_confirm', state: 'pending' }],
      primaryAction: {
        actionId: 'storyboard.package.confirm_recommendation',
        owner: 'scaena',
        ownerAuthority: 'scaena:storyboard.package',
        permission: 'approve',
        expectedVersion: '7',
        idempotencyRequired: true,
        targetRef: 'storyboard_package:scene:s01e03-sc04:v7',
        reconcileRef: 'reconcile:storyboard:s01e03-sc04:v7',
        sideEffectClass: 'local_state',
        confirmationRequired: true,
      },
      receiptRefs: ['receipt:action:s01e03-sc04:v7'],
      observedAt: '2026-09-03T05:00:00Z',
      anotherFuture: { nested: true },
    }
    const identity = projectScaenaCanonicalOpcCrossEntryIdentity(
      normalizeScaenaCanonicalOpcScenePackageSummary(camel),
    )
    expect(identity.receiptRefs).toEqual(['receipt:action:s01e03-sc04:v7'])
    expect(identity.reconcileRef).toBe('reconcile:storyboard:s01e03-sc04:v7')
    expect(identity.primaryAction?.sideEffectClass).toBe('local_state')
  })

  it.each([
    [{ ...canonicalFixture, schema_version: 'scaena.other.v1' }, 'schema_version'],
    [{ ...canonicalFixture, package_ref: undefined }, 'package_ref'],
    [{ ...canonicalFixture, package_version: '7' }, 'package_version'],
    [{ ...canonicalFixture, provider_payload: { prompt: 'hidden' } }, 'forbidden field'],
    [{ ...canonicalFixture, api_key: 'sk-live' }, 'forbidden field'],
    [{ ...canonicalFixture, raw_prompt: 'do not copy' }, 'forbidden field'],
    [{ ...canonicalFixture, primary_action: { ...canonicalFixture.primary_action, idempotency_required: undefined } }, 'idempotency_required'],
    [{ ...canonicalFixture, human_gates: [{ gate_id: 'direction_confirm', state: 'satisfied' }] }, 'receipt_ref'],
    [{ ...canonicalFixture, project_ref: 'token:mist-harbor' }, 'safe opaque ref'],
  ])('fails closed for invalid canonical payload %#', (payload, message) => {
    expect(() => normalizeScaenaCanonicalOpcScenePackageSummary(payload)).toThrow(message)
  })

  it('verifies one redacted package revision through the shipped comparison entry', () => {
    const result = verifyScaenaCanonicalOpcCrossEntryConformance(redactedConformanceFixture())
    expect(result.compared).toMatchObject({
      packageRef: 'storyboard_package:scene:s01e03-sc04:v7',
      packageVersion: '7',
      actionId: 'storyboard.package.confirm_recommendation',
      targetRef: 'storyboard_package:scene:s01e03-sc04:v7',
      expectedVersion: '7',
      sideEffectClass: 'local_state',
      confirmationRequired: true,
      idempotencyRequired: true,
      gateReceipts: {
        direction_confirm: 'receipt:direction:scene:s01e03-sc04:v7',
      },
      receiptRefs: [],
    })
  })

  it('names the mismatched identity field without synthesizing owner state', () => {
    expect(() =>
      verifyScaenaCanonicalOpcCrossEntryConformance(
        redactedConformanceFixture({
          expected_action: {
            action_id: 'storyboard.package.export_formal',
            target_ref: 'storyboard_package:scene:s01e03-sc04:v7',
            expected_version: '7',
            side_effect_class: 'local_state',
            confirmation_required: true,
            idempotency_required: true,
          },
        }),
      ),
    ).toThrow('action_id mismatch')
  })
})
