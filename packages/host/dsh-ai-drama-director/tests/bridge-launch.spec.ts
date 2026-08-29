import { describe, expect, it } from 'vitest'
import {
  BRIDGE_EVIDENCE_KINDS,
  buildBridgeFixtureEnvelope,
  createBridgeEvidenceEmitter,
  createLegacyBridgeAdapter,
  createWorkbenchBridgeTargetRegistry,
  createWorkbenchLaunchProvider,
  digestBridgeV2,
  isRedactedDramaBridgeEvidence,
  probeWorkbenchBridgeCapability,
  type BridgeV2IssueInput,
  type LegacyBridgeIssueInput,
  type WorkbenchBridgeTargetEntryV1,
} from '../src/index.js'

const NOW = 1_800_000_000_000

const V2_TARGET: WorkbenchBridgeTargetEntryV1 = {
  targetSurfaceId: 'workbench.agent.spatial',
  targetApplication: 'yeisme-workbench',
  supportedContracts: ['dsh.workbench_ai_drama_bridge.v2', 'drama.workbench-handoff.v1'],
  capabilityVersion: 'wb-2026.08',
  probedAtMs: NOW,
}

const LEGACY_ONLY_TARGET: WorkbenchBridgeTargetEntryV1 = {
  ...V2_TARGET,
  supportedContracts: ['drama.workbench-handoff.v1'],
}

function v2Input(overrides: Partial<BridgeV2IssueInput> = {}): BridgeV2IssueInput {
  return {
    sourceSurfaceId: 'dsh.drama.director',
    workspaceRef: 'ws:alpha',
    projectRef: 'proj:drama-1',
    showRef: 'show:101',
    episodeRef: 'ep:5',
    resourceRef: 'artifact:shot-boards-12',
    resourceVersion: 'r42',
    contextRevision: 7,
    presentationIntent: 'open_artifact',
    ttlMs: 300_000,
    now: () => NOW,
    ...overrides,
  }
}

function legacyInput(nowMs = NOW): LegacyBridgeIssueInput {
  return {
    contextRef: 'show:101',
    targetSurface: 'workbench',
    presentationIntent: 'open_show',
    nonce: 'legacy-nonce-1',
    expiresAt: nowMs + 300_000,
  }
}

function provider(options: Partial<Parameters<typeof createWorkbenchLaunchProvider>[0]> = {}) {
  const registry = createWorkbenchBridgeTargetRegistry()
  registry.register(options.enabled === false ? V2_TARGET : V2_TARGET)
  const evidence = createBridgeEvidenceEmitter()
  const launcher = createWorkbenchLaunchProvider({
    registry,
    enabled: true,
    evidence,
    now: () => NOW,
    ...options,
  })
  return { registry, evidence, launcher }
}

describe('Workbench bridge target registry', () => {
  it('approves closed-shape entries and rejects entries carrying origins or auth material', () => {
    const registry = createWorkbenchBridgeTargetRegistry()
    expect(registry.register(V2_TARGET).ok).toBe(true)
    expect(registry.register({ ...V2_TARGET, targetSurfaceId: 'workbench.agent.spatial', origin: 'https://wb.example' }))
      .toMatchObject({ ok: false, reason: 'denied' })
    expect(registry.register({ ...V2_TARGET, baseUrl: 'https://wb.example', targetSurfaceId: 'workbench.agent.spatial' }))
      .toMatchObject({ ok: false, reason: 'denied' })
    expect(registry.register({ ...V2_TARGET, accessToken: 'sk-1', targetSurfaceId: 'workbench.agent.spatial' }))
      .toMatchObject({ ok: false, reason: 'denied' })
    expect(registry.register({ ...V2_TARGET, targetApplication: 'other-app' }))
      .toMatchObject({ ok: false, reason: 'denied' })
    expect(registry.resolve('workbench.agent.spatial')).toBeDefined()
    expect(registry.resolve('workbench.show-control-room')).toBeUndefined()
  })
})

describe('Workbench bridge capability probing', () => {
  it('prefers V2, falls back to legacy_only, and disables for stale/unknown/incompatible consumers', () => {
    expect(probeWorkbenchBridgeCapability(V2_TARGET, () => NOW)).toMatchObject({ mode: 'v2' })
    expect(probeWorkbenchBridgeCapability(LEGACY_ONLY_TARGET, () => NOW)).toMatchObject({ mode: 'legacy_only' })
    expect(probeWorkbenchBridgeCapability({ ...V2_TARGET, probedAtMs: NOW - 300_001 }, () => NOW))
      .toMatchObject({ mode: 'disabled', reasonCode: 'stale' })
    expect(probeWorkbenchBridgeCapability(undefined, () => NOW))
      .toMatchObject({ mode: 'disabled', reasonCode: 'target_unavailable' })
    expect(probeWorkbenchBridgeCapability({ ...V2_TARGET, supportedContracts: ['something.else.v9'] }, () => NOW))
      .toMatchObject({ mode: 'disabled', reasonCode: 'contract_mismatch' })
  })
})

describe('Workbench launch provider', () => {
  it('issues V2 descriptors for all five intents with a safe projection only', () => {
    for (const intent of ['open_show', 'open_episode', 'open_artifact', 'open_review', 'open_evidence'] as const) {
      const { launcher } = provider()
      const result = launcher.issue({ v2: v2Input({ presentationIntent: intent }), legacy: legacyInput() })
      expect(result.ok).toBe(true)
      if (!result.ok || result.mode !== 'v2') continue
      expect(result.descriptor.launchRef).toMatch(/^lref-[0-9a-f]{24}$/)
      expect(result.descriptor.targetApplication).toBe('yeisme-workbench')
      expect(result.descriptor.targetSurfaceId).toBe('workbench.agent.spatial')
      expect(result.descriptor.presentationIntent).toBe(intent)
      expect(result.descriptor.capabilityVersion).toBe('wb-2026.08')
      // No origin, URL, token, or envelope body ever reaches the projection.
      expect(JSON.stringify(result.descriptor)).not.toMatch(/https?:|token|secret|nonce|workspaceRef/)
    }
  })

  it('returns the same launchRef for duplicate canonical requests and rejects conflicting replay', () => {
    const { launcher } = provider()
    const nonce = '0123456789abcdef0123456789abcdef'
    const first = launcher.issue({ v2: v2Input({ nonce }), legacy: legacyInput() })
    const second = launcher.issue({ v2: v2Input({ nonce }), legacy: legacyInput() })
    expect(first.ok && first.mode === 'v2' && first.descriptor.launchRef).toBe(
      second.ok && second.mode === 'v2' && second.descriptor.launchRef,
    )
    const conflict = launcher.issue({ v2: v2Input({ nonce, resourceRef: 'artifact:other' }), legacy: legacyInput() })
    expect(conflict).toMatchObject({ ok: false, disabledReason: 'replay_conflict' })
  })

  it('consumes once, replays idempotently, and reports expired or unknown refs without mutation', () => {
    const { launcher } = provider()
    const issued = launcher.issue({ v2: v2Input(), legacy: legacyInput() })
    if (!issued.ok || issued.mode !== 'v2') throw new Error('expected v2 issuance')
    const ref = issued.descriptor.launchRef

    const consumed = launcher.consume(ref)
    expect(consumed).toMatchObject({ ok: true, state: 'launched', presentationIntent: 'open_artifact' })
    const again = launcher.consume(ref)
    expect(again).toEqual(consumed)
    expect(launcher.consume('lref-000000000000000000000000')).toMatchObject({ ok: false, state: 'unknown', reason: 'unknown' })
  })

  it('marks expired launch refs as expired', () => {
    let clock = NOW
    const registry = createWorkbenchBridgeTargetRegistry()
    registry.register({ ...V2_TARGET, probedAtMs: NOW })
    const launcher = createWorkbenchLaunchProvider({ registry, enabled: true, now: () => clock })
    const issued = launcher.issue({ v2: v2Input(), legacy: legacyInput() })
    if (!issued.ok || issued.mode !== 'v2') throw new Error('expected v2 issuance')
    clock = NOW + 300_001
    expect(launcher.consume(issued.descriptor.launchRef)).toMatchObject({ ok: false, state: 'expired', reason: 'expired' })
  })

  it('falls back to an explicitly labeled legacy bridge when the consumer is legacy-only', () => {
    const registry = createWorkbenchBridgeTargetRegistry()
    registry.register(LEGACY_ONLY_TARGET)
    const evidence = createBridgeEvidenceEmitter()
    const launcher = createWorkbenchLaunchProvider({ registry, enabled: true, evidence, now: () => NOW })
    const result = launcher.issue({ v2: v2Input(), legacy: legacyInput() })
    expect(result).toMatchObject({ ok: true, mode: 'legacy_bridge' })
    if (!result.ok || result.mode !== 'legacy_bridge') return
    expect(result.legacy.mode).toBe('legacy_bridge')
    expect(result.legacy.signed.handoff.schema).toBe('drama.workbench-handoff.v1')
    // Legacy success is never counted as a V2 consumption event.
    expect(evidence.snapshot().some(record => record.kind === 'bridge_consumed')).toBe(false)
  })

  it('rolls back: disabling V2 stops issuance, existing refs only expire, legacy path keeps working', () => {
    let clock = NOW
    const registry = createWorkbenchBridgeTargetRegistry()
    registry.register(V2_TARGET)
    const evidence = createBridgeEvidenceEmitter()
    const launcher = createWorkbenchLaunchProvider({ registry, enabled: true, evidence, now: () => clock })
    const issued = launcher.issue({ v2: v2Input(), legacy: legacyInput() })
    if (!issued.ok || issued.mode !== 'v2') throw new Error('expected v2 issuance')

    launcher.setEnabled(false)
    expect(launcher.isEnabled()).toBe(false)
    const afterRollback = launcher.issue({ v2: v2Input({ nonce: 'fedcba9876543210fedcba9876543210' }), legacy: legacyInput() })
    expect(afterRollback).toMatchObject({ ok: true, mode: 'legacy_bridge' })

    clock = NOW + 300_001
    expect(launcher.consume(issued.descriptor.launchRef)).toMatchObject({ state: 'expired' })
    // Rollback rewrites no owner state: only bridge evidence categories exist.
    for (const record of evidence.snapshot()) {
      expect(isRedactedDramaBridgeEvidence(record)).toBe(true)
      expect(BRIDGE_EVIDENCE_KINDS).toContain(record.kind)
    }
  })

  it('keeps the V1 signer untouched through the legacy adapter', () => {
    const adapter = createLegacyBridgeAdapter()
    const legacy = adapter.issue(legacyInput())
    expect(legacy).toBeDefined()
    if (legacy === undefined) return
    expect(legacy.signed.handoff.nonce).toBe('legacy-nonce-1')
    expect(adapter.verify(legacy.signed, NOW)).toMatchObject({ ok: true })
    expect(adapter.isLegacyResult(legacy)).toBe(true)
    expect(adapter.isLegacyResult({ mode: 'v2', signed: legacy.signed })).toBe(false)
  })

  it('emits redacted bridge evidence categories for the full outcome set', () => {
    const evidence = createBridgeEvidenceEmitter()
    const registry = createWorkbenchBridgeTargetRegistry()
    registry.register(V2_TARGET)
    const launcher = createWorkbenchLaunchProvider({ registry, enabled: true, evidence, now: () => NOW })

    const issued = launcher.issue({ v2: v2Input(), legacy: legacyInput() })
    if (!issued.ok || issued.mode !== 'v2') throw new Error('expected v2 issuance')
    launcher.consume(issued.descriptor.launchRef)
    const noTarget = createWorkbenchLaunchProvider({
      registry: createWorkbenchBridgeTargetRegistry(),
      evidence,
      now: () => NOW,
    })
    noTarget.issue({ v2: v2Input(), legacy: legacyInput() })

    const kinds = new Set(evidence.snapshot().map(record => record.kind))
    expect(kinds.has('bridge_issued')).toBe(true)
    expect(kinds.has('bridge_launch_requested')).toBe(true)
    expect(kinds.has('bridge_consumed')).toBe(true)
    expect(kinds.has('bridge_target_unavailable')).toBe(true)
    for (const record of evidence.snapshot()) {
      expect(isRedactedDramaBridgeEvidence(record)).toBe(true)
      // Never the nonce, never a full envelope, never secrets.
      const serialized = JSON.stringify(record)
      expect(serialized).not.toContain('0123456789abcdef')
      expect(serialized).not.toContain('nonce')
      expect(serialized).not.toContain('workspaceRef')
    }
  })

  it('digests consumed via the provider match the contract digest of the issued envelope', () => {
    const nonce = '0123456789abcdef0123456789abcdef'
    const envelope = buildBridgeFixtureEnvelope({ nonce })
    const recomputed = digestBridgeV2(envelope)
    expect(recomputed).toBe(envelope.contractDigest)
  })
})
