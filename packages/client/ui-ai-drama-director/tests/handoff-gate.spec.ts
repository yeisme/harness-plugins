import { describe, expect, it } from 'vitest'
import {
  createWorkbenchHandoff,
  digestWorkbenchHandoff,
  type DramaEvidenceRecordV1,
  type SignedWorkbenchHandoffV1,
} from '@yeisme/dsh-ai-drama-director'
import { createDramaEvidenceEmitter } from '../src/client/evidence.js'
import {
  createDramaHandoffGate,
  resolveDramaHandoffTarget,
  DRAMA_HANDOFF_TARGET_VIEWS,
} from '../src/client/handoff-gate.js'
import { createBoundedDedupStore, createDramaNonceStore } from '../src/client/nonce-store.js'

const NOW = 1_700_000_000_000

function signedHandoff(overrides: {
  readonly nonce?: string
  readonly expiresAt?: number
  readonly intent?: 'open_show' | 'open_episode' | 'open_review' | 'open_artifact' | 'open_evidence'
} = {}): SignedWorkbenchHandoffV1 {
  const signed = createWorkbenchHandoff({
    contextRef: 'show:1',
    targetSurface: 'workbench',
    presentationIntent: overrides.intent ?? 'open_review',
    nonce: overrides.nonce ?? 'nonce:1',
    expiresAt: overrides.expiresAt ?? NOW + 60_000,
  })
  if (signed === undefined) throw new Error('fixture handoff failed to sign')
  return signed
}

function gateWith(records: DramaEvidenceRecordV1[], now: () => number = () => NOW) {
  const emitter = createDramaEvidenceEmitter(record => records.push(record))
  const gate = createDramaHandoffGate({ emitter, now })
  return { gate, emitter }
}

describe('handoff consumption gate', () => {
  it('accepts a valid signed handoff and extracts the intent', () => {
    const records: DramaEvidenceRecordV1[] = []
    const { gate } = gateWith(records)
    const result = gate.consume(signedHandoff())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.intent).toBe('open_review')
      expect(result.handoff.contextRef).toBe('show:1')
    }
    expect(records).toHaveLength(0)
  })

  it('rejects malformed envelopes as contract failures', () => {
    const records: DramaEvidenceRecordV1[] = []
    const { gate } = gateWith(records)
    for (const input of [undefined, null, 'x', {}, { handoff: {} }, { handoff: {}, digest: 1 }]) {
      const result = gate.consume(input)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.category).toBe('contract')
    }
    expect(records.every(record => record.kind === 'handoff_contract_mismatch')).toBe(true)
  })

  it('rejects an expired handoff and records handoff_expired', () => {
    const records: DramaEvidenceRecordV1[] = []
    const { gate } = gateWith(records)
    const result = gate.consume(signedHandoff({ expiresAt: NOW - 1 }))
    expect(result).toMatchObject({ ok: false, category: 'expired' })
    expect(records.map(record => record.kind)).toEqual(['handoff_expired'])
  })

  it('rejects a tampered payload as a digest mismatch', () => {
    const records: DramaEvidenceRecordV1[] = []
    const { gate } = gateWith(records)
    const signed = signedHandoff()
    const tampered = { ...signed, handoff: { ...signed.handoff, contextRef: 'show:2' } }
    const result = gate.consume(tampered)
    expect(result).toMatchObject({ ok: false, category: 'digest' })
    expect(records[0]).toMatchObject({ kind: 'handoff_contract_mismatch', reasonCategory: 'digest' })
  })

  it('rejects handoffs carrying content fields beyond opaque refs', () => {
    const records: DramaEvidenceRecordV1[] = []
    const { gate } = gateWith(records)
    const signed = signedHandoff()
    const withContent = {
      ...signed,
      handoff: { ...signed.handoff, title: 'Pilot Episode', url: 'https://example.invalid/x' },
    }
    const result = gate.consume(withContent)
    expect(result).toMatchObject({ ok: false, category: 'payload' })
    expect(records[0]?.reasonCategory).toBe('payload')
    expect(JSON.stringify(records)).not.toContain('Pilot Episode')
    expect(JSON.stringify(records)).not.toContain('example.invalid')
  })

  it('rejects intents outside the whitelist without burning the nonce', () => {
    const records: DramaEvidenceRecordV1[] = []
    const { gate } = gateWith(records)
    const base = signedHandoff({ nonce: 'nonce:intent' })
    const badHandoff = { ...base.handoff, presentationIntent: 'delete-show' }
    const bad = { handoff: badHandoff, digest: digestWorkbenchHandoff(badHandoff) }

    const rejected = gate.consume(bad)
    expect(rejected).toMatchObject({ ok: false, category: 'intent' })
    expect(records[0]?.reasonCategory).toBe('intent')

    // The bad-intent submission did not consume the nonce: a valid handoff
    // with the same nonce still passes.
    const good = signedHandoff({ nonce: 'nonce:intent' })
    expect(gate.consume(good).ok).toBe(true)
  })

  it('rejects a replayed nonce and records the replay category', () => {
    const records: DramaEvidenceRecordV1[] = []
    const { gate } = gateWith(records)
    const signed = signedHandoff({ nonce: 'nonce:replay' })
    expect(gate.consume(signed).ok).toBe(true)
    const replay = gate.consume(signed)
    expect(replay).toMatchObject({ ok: false, category: 'nonce_replay' })
    expect(records.some(record => record.reasonCategory === 'nonce_replay')).toBe(true)
  })
})

describe('bounded nonce store', () => {
  it('sweeps expired entries on mark and via sweep()', () => {
    let tick = NOW
    const store = createDramaNonceStore({ now: () => tick })
    expect(store.mark('nonce:old', NOW + 10)).toBe('new')
    expect(store.size).toBe(1)

    tick = NOW + 20
    expect(store.mark('nonce:new', NOW + 1_000)).toBe('new')
    expect(store.size).toBe(1)
    // The expired nonce is swept, so it would read as new again — the
    // handoff expiry check is the hard rejection for that path.
    expect(store.check('nonce:old')).toBe('new')
  })

  it('evicts the oldest entry at capacity', () => {
    const store = createBoundedDedupStore({ capacity: 2, now: () => NOW })
    store.mark('k1')
    store.mark('k2')
    store.mark('k3')
    expect(store.size).toBe(2)
    expect(store.check('k1')).toBe('new')
    expect(store.check('k3')).toBe('replay')
  })

  it('deduplicates artifact-intent idempotency keys per gesture', () => {
    // A repeated drop of the same gesture collapses to one admission.
    const ledger = createBoundedDedupStore({ capacity: 8, now: () => NOW })
    const gestureKey = 'drama:attach_context:artifact:9:v3:gesture:abc123'
    expect(ledger.mark(gestureKey)).toBe('new')
    expect(ledger.mark(gestureKey)).toBe('replay')
    expect(ledger.mark(gestureKey)).toBe('replay')
    expect(ledger.mark('drama:attach_context:artifact:9:v3:gesture:def456')).toBe('new')
    expect(ledger.size).toBe(2)
  })
})

describe('resolveDramaHandoffTarget', () => {
  it('routes every whitelisted intent to its declared target view', () => {
    const available = () => ({ disabled: false })
    for (const [intent, view] of Object.entries(DRAMA_HANDOFF_TARGET_VIEWS)) {
      const result = resolveDramaHandoffTarget(intent as keyof typeof DRAMA_HANDOFF_TARGET_VIEWS, available)
      expect(result).toEqual({ ok: true, view })
    }
  })

  it('fails closed with install guidance when the target view is unavailable', () => {
    const result = resolveDramaHandoffTarget('open_review', () => ({
      disabled: true,
      reason: 'missing creator-studio projection',
    }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.category).toBe('target_missing')
      expect(result.reason).toContain('missing creator-studio projection')
      expect(result.reason).toContain('Review')
    }
  })
})

describe('evidence redaction on the gate path', () => {
  it('records only categories, never payload content', () => {
    const records: DramaEvidenceRecordV1[] = []
    const { gate } = gateWith(records)
    gate.consume({ handoff: { sneak: 'token=abc' }, digest: 'x' })
    gate.consume(signedHandoff({ expiresAt: NOW - 5 }))
    for (const record of records) {
      expect(record.schema).toBe('drama.evidence.v1')
      expect(JSON.stringify(record)).not.toMatch(/token|https?:|show:1|nonce:/i)
    }
  })
})
