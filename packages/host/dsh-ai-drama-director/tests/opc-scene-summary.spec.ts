import { describe, expect, it } from 'vitest'
import {
  OPC_SCENE_PACKAGE_SUMMARY_SCHEMA,
  OPC_SCENE_SUMMARY_FIXTURE,
  isSafeOpcSceneRef,
  validateOpcScenePackageSummary,
  type OpcScenePackageSummaryV1alpha1,
} from '../src/opc-scene-summary.ts'

function variant(overrides: Record<string, unknown>): OpcScenePackageSummaryV1alpha1 {
  return { ...OPC_SCENE_SUMMARY_FIXTURE, ...overrides } as OpcScenePackageSummaryV1alpha1
}

describe('validateOpcScenePackageSummary (opc-scene 1.1)', () => {
  it('accepts the canonical redacted fixture', () => {
    expect(validateOpcScenePackageSummary(OPC_SCENE_SUMMARY_FIXTURE)).toBe(true)
  })

  it('rejects the wrong schema and non-object payloads', () => {
    expect(validateOpcScenePackageSummary(null)).toBe(false)
    expect(validateOpcScenePackageSummary('nope')).toBe(false)
    expect(validateOpcScenePackageSummary({ ...OPC_SCENE_SUMMARY_FIXTURE, schema: 'scaena.other.v1' })).toBe(false)
  })

  it('requires all three normal human gates exactly once', () => {
    expect(validateOpcScenePackageSummary(variant({ gates: OPC_SCENE_SUMMARY_FIXTURE.gates.slice(0, 2) }))).toBe(false)
    expect(
      validateOpcScenePackageSummary(variant({ gates: [...OPC_SCENE_SUMMARY_FIXTURE.gates, { id: 'direction_confirm', state: 'pending' }] })),
    ).toBe(false)
  })

  it('rejects raw prompt, provider payload, credential, signed URL, and absolute path anywhere in the blob', () => {
    const unsafePayloads: Record<string, unknown>[] = [
      { stage: '/home/user/scene.prompt' },
      { exceptions: [{ ...OPC_SCENE_SUMMARY_FIXTURE.exceptions[0]!, reasonCode: 'provider payload: model=glm raw prompt here' }] },
      { primaryAction: { ...OPC_SCENE_SUMMARY_FIXTURE.primaryAction!, label: 'use api_key=sk-live' } },
      { workbenchDeepLink: 'https://workbench.local/open?X-Goog-Signature=abc' },
      { evidence: { ...OPC_SCENE_SUMMARY_FIXTURE.evidence, refs: ['/var/evidence/run.jsonl'] } },
      { delivery: { ...OPC_SCENE_SUMMARY_FIXTURE.delivery, manifestRef: 'file:///etc/manifest' } },
    ]
    for (const payload of unsafePayloads) {
      expect(validateOpcScenePackageSummary(variant(payload))).toBe(false)
    }
  })

  it('rejects shell fragments and signed-URL params in copyable CLI/API details', () => {
    expect(
      validateOpcScenePackageSummary(variant({ primaryAction: { ...OPC_SCENE_SUMMARY_FIXTURE.primaryAction!, cliDetail: 'scaena ok; rm -rf /' } })),
    ).toBe(false)
    expect(
      validateOpcScenePackageSummary(variant({ primaryAction: { ...OPC_SCENE_SUMMARY_FIXTURE.primaryAction!, apiDetail: 'GET /sig=deadbeef' } })),
    ).toBe(false)
  })

  it('rejects unknown freshness, readiness, aspect, and finding kinds', () => {
    expect(validateOpcScenePackageSummary(variant({ freshness: 'probably-fine' as never }))).toBe(false)
    expect(validateOpcScenePackageSummary(variant({ readiness: 'maybe' as never }))).toBe(false)
    expect(validateOpcScenePackageSummary(variant({ primaryAspect: '4:3' as never }))).toBe(false)
    expect(
      validateOpcScenePackageSummary(variant({ exceptions: [{ kind: 'vibes' as never, affectedRef: 'scene:12', reasonCode: 'x', evidenceRefs: [] }] })),
    ).toBe(false)
  })

  it('rejects structurally incomplete receipts, delivery, and evidence blocks', () => {
    expect(validateOpcScenePackageSummary(variant({ receipts: [{ receiptRef: 'rcpt:1', outcome: 'maybe' as never }] }))).toBe(false)
    expect(validateOpcScenePackageSummary(variant({ delivery: { packaging: 'formal', productionReady: 'yes' as never } }))).toBe(false)
    expect(validateOpcScenePackageSummary(variant({ evidence: { refs: [], digest: 'sha1:x', counts: { runs: -1 }, reasonCodes: [] } }))).toBe(false)
  })

  it('keeps role name/version/digest optional but bounded and safe', () => {
    expect(
      validateOpcScenePackageSummary(variant({ roles: [{ role: 'director', name: 'director core', version: 'v1', digest: 'sha1:aa' }] })),
    ).toBe(true)
    expect(validateOpcScenePackageSummary(variant({ roles: [{ role: 'stunt' as never }] }))).toBe(false)
    expect(validateOpcScenePackageSummary(variant({ roles: [{ role: 'director', name: '/etc/passwd' }] }))).toBe(false)
  })
})

describe('isSafeOpcSceneRef', () => {
  it('accepts opaque owner tokens and rejects unsafe strings', () => {
    expect(isSafeOpcSceneRef('pkg:scene-12-r42')).toBe(true)
    expect(isSafeOpcSceneRef('/abs/path')).toBe(false)
    expect(isSafeOpcSceneRef('token=abc')).toBe(false)
    expect(isSafeOpcSceneRef('')).toBe(false)
  })
})
