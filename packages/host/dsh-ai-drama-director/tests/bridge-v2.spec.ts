import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import {
  BRIDGE_V2_CONTRACT,
  BRIDGE_V2_INTENTS,
  BRIDGE_V2_LENS_MAP,
  BRIDGE_V2_DEFAULT_TTL_MS,
  BRIDGE_V2_MIN_TTL_MS,
  BRIDGE_V2_MAX_TTL_MS,
  buildBridgeFixtureEnvelope,
  canonicalizeBridgeV2,
  createWorkbenchAiDramaBridgeV2,
  digestBridgeV2,
  generateBridgeV2Nonce,
  validateWorkbenchAiDramaBridgeV2,
} from '../src/index.js'

const NOW = 1_800_000_000_000
const now = () => NOW

function validEnvelope(overrides: Record<string, unknown> = {}) {
  return buildBridgeFixtureEnvelope(overrides) as unknown as Record<string, unknown>
}

describe('Bridge V2 closed contract', () => {
  it('accepts the canonical fixture envelope and verifies its digest', () => {
    const envelope = validEnvelope()
    const result = validateWorkbenchAiDramaBridgeV2(envelope, now)
    expect(result.ok).toBe(true)
  })

  it('computes a SHA-256 digest over the schema-ordered canonical form', () => {
    const envelope = buildBridgeFixtureEnvelope()
    const canonical = canonicalizeBridgeV2(envelope)
    expect(createHash('sha256').update(canonical).digest('hex')).toBe(envelope.contractDigest)
    expect(canonical.startsWith('contractVersion=')).toBe(true)
    // Optional fields are simply absent, never empty placeholders.
    expect(canonical).not.toContain('receiptRef=')
  })

  it('rejects unknown keys, raw URLs, credentials, absolute paths, prompts, provider payloads, and private tool args', () => {
    const cases: readonly Record<string, unknown>[] = [
      { ...validEnvelope(), extraKey: 'x' },
      { ...validEnvelope(), workspaceRef: 'https://evil.example/workbench' },
      { ...validEnvelope(), projectRef: 'authorization: Bearer abc' },
      { ...validEnvelope(), showRef: '/etc/passwd' },
      { ...validEnvelope(), resourceRef: 'token=sk-live-123' },
      { ...validEnvelope(), resourceVersion: 'cookie: session=1' },
      { ...validEnvelope(), artifactRef: 'prompt: write me a finale' },
      { ...validEnvelope(), receiptRef: 'file:///home/user/secret' },
      { ...validEnvelope(), episodeRef: '-----BEGIN PRIVATE KEY-----' },
      { ...validEnvelope(), providerPayload: { model: 'x' } },
      { ...validEnvelope(), toolArguments: ['--dangerously'] },
    ]
    for (const envelope of cases) {
      const result = validateWorkbenchAiDramaBridgeV2(envelope, now)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.detail).not.toMatch(/https?:|token|cookie|BEGIN|prompt/i)
    }
  })

  it('returns contract_mismatch for wrong identity, direction, target surface, intent, or nonce format', () => {
    expect(validateWorkbenchAiDramaBridgeV2(validEnvelope({ contractVersion: 'dsh.workbench_ai_drama_bridge.v3' }), now))
      .toMatchObject({ ok: false, reason: 'contract_mismatch' })
    expect(validateWorkbenchAiDramaBridgeV2(validEnvelope({ direction: 'workbench_to_dsh' }), now))
      .toMatchObject({ ok: false, reason: 'contract_mismatch' })
    expect(validateWorkbenchAiDramaBridgeV2(validEnvelope({ targetSurfaceId: 'workbench.show-control-room' }), now))
      .toMatchObject({ ok: false, reason: 'contract_mismatch' })
    expect(validateWorkbenchAiDramaBridgeV2(validEnvelope({ presentationIntent: 'open_bts' }), now))
      .toMatchObject({ ok: false, reason: 'contract_mismatch' })
    expect(validateWorkbenchAiDramaBridgeV2(validEnvelope({ nonce: 'NOT-A-NONCE' }), now))
      .toMatchObject({ ok: false, reason: 'contract_mismatch' })
    expect(validateWorkbenchAiDramaBridgeV2(validEnvelope({ nonce: 'ABCDEF0123456789abcdef0123456789' }), now))
      .toMatchObject({ ok: false, reason: 'contract_mismatch' })
  })

  it('returns expired for a past expiry and malformed for digest damage', () => {
    expect(validateWorkbenchAiDramaBridgeV2(validEnvelope({ expiresAtUnixMs: NOW - 1 }), now))
      .toMatchObject({ ok: false, reason: 'expired' })
    const damaged = validEnvelope()
    damaged.contractDigest = '0'.repeat(64)
    expect(validateWorkbenchAiDramaBridgeV2(damaged, now)).toMatchObject({ ok: false, reason: 'malformed' })
  })

  it('mints 32-lowercase-hex nonces and bounds the TTL', () => {
    const nonce = generateBridgeV2Nonce()
    expect(nonce).toMatch(/^[0-9a-f]{32}$/)
    const issued = createWorkbenchAiDramaBridgeV2({
      sourceSurfaceId: 'dsh.drama.director',
      workspaceRef: 'ws:alpha',
      projectRef: 'proj:drama-1',
      showRef: 'show:101',
      resourceRef: 'artifact:x',
      contextRevision: 3,
      presentationIntent: 'open_show',
      now,
    })
    expect(issued.ok).toBe(true)
    if (issued.ok) {
      expect(issued.envelope.expiresAtUnixMs).toBe(NOW + BRIDGE_V2_DEFAULT_TTL_MS)
      expect(issued.envelope.nonce).toMatch(/^[0-9a-f]{32}$/)
    }
    const tiny = createWorkbenchAiDramaBridgeV2({
      sourceSurfaceId: 'dsh.drama.director',
      workspaceRef: 'ws:alpha',
      projectRef: 'proj:drama-1',
      showRef: 'show:101',
      resourceRef: 'artifact:x',
      contextRevision: 3,
      presentationIntent: 'open_show',
      ttlMs: BRIDGE_V2_MIN_TTL_MS - 1,
      now,
    })
    const huge = createWorkbenchAiDramaBridgeV2({
      sourceSurfaceId: 'dsh.drama.director',
      workspaceRef: 'ws:alpha',
      projectRef: 'proj:drama-1',
      showRef: 'show:101',
      resourceRef: 'artifact:x',
      contextRevision: 3,
      presentationIntent: 'open_show',
      ttlMs: BRIDGE_V2_MAX_TTL_MS + 1,
      now,
    })
    expect(tiny.ok && tiny.envelope.expiresAtUnixMs).toBe(NOW + BRIDGE_V2_MIN_TTL_MS)
    expect(huge.ok && huge.envelope.expiresAtUnixMs).toBe(NOW + BRIDGE_V2_MAX_TTL_MS)
  })

  it('maps every closed intent to its declared Workbench lens deterministically', () => {
    expect(BRIDGE_V2_INTENTS).toHaveLength(5)
    expect(BRIDGE_V2_LENS_MAP.open_show).toMatchObject({ lens: 'creative_production', focus: 'show_overview' })
    expect(BRIDGE_V2_LENS_MAP.open_episode).toMatchObject({ lens: 'creative_production', focus: 'episode_timeline' })
    expect(BRIDGE_V2_LENS_MAP.open_artifact).toMatchObject({ lens: 'creative_production', focus: 'referenced_artifact' })
    expect(BRIDGE_V2_LENS_MAP.open_review).toMatchObject({ lens: 'review' })
    expect(BRIDGE_V2_LENS_MAP.open_evidence).toMatchObject({ lens: 'evidence' })
    expect(BRIDGE_V2_CONTRACT).toBe('dsh.workbench_ai_drama_bridge.v2')
  })

  it('digests exclude contractDigest itself and stay stable under key insertion order', () => {
    const envelope = buildBridgeFixtureEnvelope()
    const reordered = Object.fromEntries(
      Object.keys(envelope).reverse().map(key => [key, (envelope as unknown as Record<string, unknown>)[key]]),
    )
    const { contractDigest: digestA, ...bodyA } = envelope
    const { contractDigest: digestB, ...bodyB } = reordered as typeof envelope
    void digestA
    void digestB
    expect(digestBridgeV2(bodyA)).toBe(digestBridgeV2(bodyB))
  })
})
