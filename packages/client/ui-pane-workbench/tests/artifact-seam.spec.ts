import { describe, expect, it, vi } from 'vitest'
import {
  PANE_ARTIFACT_SCHEMA,
  PANE_INTENT_SCHEMA,
  type ArtifactIntentV1,
  type ArtifactRefV1,
  type PaneActionReceiptV1,
  type PaneContextV1,
} from '@yeisme/dsh-pane-protocol'
import {
  beginArtifactGesture,
  buildArtifactGestureIntent,
  createArtifactDragPayload,
  deriveArtifactIdempotencyKey,
  dispatchArtifactHandoff,
  isArtifactIntentKind,
  parseArtifactDragPayload,
  probeArtifactHandoffChannel,
  recordArtifactHandoffEvidence,
  OFFICIAL_ARTIFACT_HANDOFF_CONTRACT,
  type ArtifactHandoffEvidenceV1,
} from '../src/artifacts.js'
import { PaneIntentDispatcher } from '../src/composition.js'

const sourceRef: ArtifactRefV1 = {
  schema: PANE_ARTIFACT_SCHEMA,
  owner: 'eikona',
  kind: 'image',
  ref: 'artifact:image:1',
  version: '1',
  mediaType: 'image/png',
  title: 'Frame one',
  evidenceRefs: [],
  capabilities: ['handoff'],
}

const context: PaneContextV1 = { workspaceRef: 'workspace:one', revision: '1' }

function intentFor(key: string): ArtifactIntentV1 {
  return {
    schema: PANE_INTENT_SCHEMA,
    intent: 'handoff',
    source: sourceRef,
    targetOwner: 'scaena',
    context,
    idempotencyKey: key,
  }
}

function acceptedReceipt(key: string): PaneActionReceiptV1 {
  return { status: 'accepted', receiptRef: `receipt:scaena:${key}`, owner: 'scaena', actionId: 'asset.attach', summary: 'Asset attached.' }
}

describe('artifact gesture idempotency keys', () => {
  it('derives one stable key per gesture, intent, and target', () => {
    const gesture = beginArtifactGesture()
    const first = deriveArtifactIdempotencyKey({ gesture, intent: 'handoff', targetOwner: 'scaena' })
    expect(deriveArtifactIdempotencyKey({ gesture, intent: 'handoff', targetOwner: 'scaena' })).toBe(first)
    expect(deriveArtifactIdempotencyKey({ gesture: beginArtifactGesture(), intent: 'handoff', targetOwner: 'scaena' })).not.toBe(first)
    expect(deriveArtifactIdempotencyKey({ gesture, intent: 'link', targetOwner: 'scaena' })).not.toBe(first)
    expect(deriveArtifactIdempotencyKey({ gesture, intent: 'handoff', targetOwner: 'pinax' })).not.toBe(first)
  })

  it('keeps derived keys inside the schema bounds for long owner ids', () => {
    const key = deriveArtifactIdempotencyKey({ gesture: beginArtifactGesture(), intent: 'attach_context', targetOwner: 'o'.repeat(120) })
    expect(key.length).toBeGreaterThanOrEqual(8)
    expect(key.length).toBeLessThanOrEqual(160)
    expect(buildArtifactGestureIntent({ gesture: beginArtifactGesture(), intent: 'attach_context', source: sourceRef, targetOwner: 'o'.repeat(120), context }).idempotencyKey.length).toBeLessThanOrEqual(160)
  })

  it('recognizes exactly the finite intent vocabulary', () => {
    for (const kind of ['open', 'compare', 'attach_context', 'transform', 'handoff', 'link']) {
      expect(isArtifactIntentKind(kind)).toBe(true)
    }
    expect(isArtifactIntentKind('teleport')).toBe(false)
    expect(isArtifactIntentKind(undefined)).toBe(false)
  })
})

describe('artifact drag payload gate', () => {
  it('round-trips a validated intent', () => {
    const intent = buildArtifactGestureIntent({ gesture: 'g-fixed', intent: 'handoff', source: sourceRef, targetOwner: 'scaena', context })
    const parsed = parseArtifactDragPayload(createArtifactDragPayload(intent))
    expect(parsed).toEqual({ ok: true, intent })
  })

  it('rejects non-JSON payloads without any state change', () => {
    expect(parseArtifactDragPayload(undefined)).toEqual({ ok: false, reason: 'payload_not_json' })
    expect(parseArtifactDragPayload('not-json{')).toEqual({ ok: false, reason: 'payload_not_json' })
  })

  it('rejects unknown intents and unsafe refs without any state change', () => {
    const unknownIntent = JSON.stringify({ ...intentFor('handoff-image-0001'), intent: 'teleport' })
    expect(parseArtifactDragPayload(unknownIntent)).toEqual({ ok: false, reason: 'payload_contract_mismatch' })
    const unsafeRef = JSON.stringify({
      ...intentFor('handoff-image-0001'),
      source: { ...sourceRef, ref: '/home/user/private/file.txt' },
    })
    expect(parseArtifactDragPayload(unsafeRef)).toEqual({ ok: false, reason: 'payload_contract_mismatch' })
  })
})

describe('official artifact seam probe', () => {
  it('falls back to the local contract path when no context or service exists', () => {
    expect(probeArtifactHandoffChannel(undefined)).toMatchObject({ channel: 'local-contract', missing: ['artifactHandoff'] })
    expect(probeArtifactHandoffChannel({ get: () => undefined })).toMatchObject({ channel: 'local-contract' })
    expect(probeArtifactHandoffChannel({ get: () => { throw new Error('unknown service') } })).toMatchObject({ channel: 'local-contract' })
  })

  it('fails closed on a partial seam: wrong contract or missing dispatch method', () => {
    const wrongContract = { get: () => ({ contract: 'ArtifactHandoffV0', dispatchArtifactIntent: async () => ({}) }) }
    expect(probeArtifactHandoffChannel(wrongContract)).toMatchObject({ channel: 'local-contract', missing: ['artifactHandoff.contract'] })
    const noMethod = { get: () => ({ contract: OFFICIAL_ARTIFACT_HANDOFF_CONTRACT }) }
    expect(probeArtifactHandoffChannel(noMethod)).toMatchObject({ channel: 'local-contract', missing: ['artifactHandoff.dispatchArtifactIntent'] })
  })

  it('switches to the official channel when the seam is present and complete', () => {
    const probe = probeArtifactHandoffChannel({
      get: () => ({ contract: OFFICIAL_ARTIFACT_HANDOFF_CONTRACT, dispatchArtifactIntent: async () => acceptedReceipt('k') }),
    })
    expect(probe.channel).toBe('official')
    expect(probe.missing).toEqual([])
    expect(typeof probe.official?.dispatchArtifactIntent).toBe('function')
  })
})

describe('channel-routed artifact handoff dispatch', () => {
  it('dispatches through the official seam and records official-channel evidence', async () => {
    const dispatchArtifactIntent = vi.fn(async () => acceptedReceipt('official-1'))
    const probe = probeArtifactHandoffChannel({ get: () => ({ contract: OFFICIAL_ARTIFACT_HANDOFF_CONTRACT, dispatchArtifactIntent }) })
    const local = { dispatch: vi.fn() }
    const evidence: ArtifactHandoffEvidenceV1[] = []
    const receipt = await dispatchArtifactHandoff(intentFor('handoff-image-1001'), { probe, local, onEvidence: record => evidence.push(record) })
    expect(receipt).toMatchObject({ status: 'accepted' })
    expect(dispatchArtifactIntent).toHaveBeenCalledOnce()
    expect(local.dispatch).not.toHaveBeenCalled()
    expect(evidence).toEqual([{ schema: 'pane.artifact-handoff-evidence.v1', kind: 'intent_dispatched', channel: 'official', reasonCategory: 'accepted' }])
  })

  it('settles official dispatch failures as unknown receipts without local fallback or retry', async () => {
    const dispatchArtifactIntent = vi.fn(async () => { throw new Error('private transport detail') })
    const probe = probeArtifactHandoffChannel({ get: () => ({ contract: OFFICIAL_ARTIFACT_HANDOFF_CONTRACT, dispatchArtifactIntent }) })
    const local = { dispatch: vi.fn() }
    const evidence: ArtifactHandoffEvidenceV1[] = []
    const receipt = await dispatchArtifactHandoff(intentFor('handoff-image-1002'), { probe, local, onEvidence: record => evidence.push(record) })
    expect(receipt).toMatchObject({ status: 'unknown', reconcileReason: 'official_dispatch_unknown' })
    expect(dispatchArtifactIntent).toHaveBeenCalledOnce()
    expect(local.dispatch).not.toHaveBeenCalled()
    expect(evidence).toEqual([{ schema: 'pane.artifact-handoff-evidence.v1', kind: 'intent_rejected', channel: 'official', reasonCategory: 'unknown' }])
  })

  it('dispatches through the local contract path when the seam is missing', async () => {
    const dispatcher = new PaneIntentDispatcher()
    const handle = vi.fn(async () => acceptedReceipt('local-1'))
    dispatcher.register({ id: 'creator.scaena-handoff', intents: ['handoff'], targetOwners: ['scaena'], handle })
    const evidence: ArtifactHandoffEvidenceV1[] = []
    const probe = probeArtifactHandoffChannel(undefined)
    const receipt = await dispatchArtifactHandoff(intentFor('handoff-image-1003'), { probe, local: dispatcher, onEvidence: record => evidence.push(record) })
    expect(receipt).toMatchObject({ status: 'accepted', owner: 'scaena' })
    expect(handle).toHaveBeenCalledOnce()
    expect(evidence).toEqual([{ schema: 'pane.artifact-handoff-evidence.v1', kind: 'intent_dispatched', channel: 'local-contract', reasonCategory: 'accepted' }])
  })
})

describe('target-side idempotency dedup', () => {
  it('dedups repeated drops of one gesture to a single admission', async () => {
    const dispatcher = new PaneIntentDispatcher()
    const handle = vi.fn(async () => acceptedReceipt('dup-1'))
    dispatcher.register({ id: 'creator.scaena-handoff', intents: ['handoff'], targetOwners: ['scaena'], handle })
    const intent = intentFor('handoff-image-2001')
    const first = await dispatcher.dispatch(intent)
    const second = await dispatcher.dispatch(intent)
    expect(handle).toHaveBeenCalledOnce()
    expect(second).toBe(first)
    expect(dispatcher.hasAdmission('handoff-image-2001')).toBe(true)
  })

  it('does not cache the no-handler reconcile receipt', async () => {
    const dispatcher = new PaneIntentDispatcher()
    const intent = intentFor('handoff-image-2002')
    await expect(dispatcher.dispatch(intent)).resolves.toMatchObject({ status: 'reconcile_required', reconcileReason: 'intent_handler_unavailable' })
    expect(dispatcher.hasAdmission('handoff-image-2002')).toBe(false)
    const handle = vi.fn(async () => acceptedReceipt('late-1'))
    dispatcher.register({ id: 'creator.scaena-handoff', intents: ['handoff'], targetOwners: ['scaena'], handle })
    await expect(dispatcher.dispatch(intent)).resolves.toMatchObject({ status: 'accepted' })
    expect(handle).toHaveBeenCalledOnce()
  })

  it('caches unknown settlements without retrying the handler', async () => {
    const dispatcher = new PaneIntentDispatcher()
    const handle = vi.fn(() => { throw new Error('private transport detail') })
    dispatcher.register({ id: 'creator.unknown', handle })
    const intent = intentFor('handoff-image-2003')
    const first = await dispatcher.dispatch(intent)
    const second = await dispatcher.dispatch(intent)
    expect(first).toMatchObject({ status: 'unknown', reconcileReason: 'intent_settlement_unknown' })
    expect(second).toBe(first)
    expect(handle).toHaveBeenCalledOnce()
  })

  it('bounds the admission ledger with oldest-first eviction', async () => {
    const dispatcher = new PaneIntentDispatcher()
    dispatcher.register({ id: 'creator.scaena-handoff', intents: ['handoff'], targetOwners: ['scaena'], handle: async () => acceptedReceipt('bounded') })
    for (let index = 0; index < 300; index += 1) {
      await dispatcher.dispatch(intentFor(`handoff-image-3${index.toString().padStart(4, '0')}`))
    }
    expect(dispatcher.admissionLedgerSize).toBeLessThanOrEqual(256)
    expect(dispatcher.hasAdmission('handoff-image-30000')).toBe(false)
    expect(dispatcher.hasAdmission('handoff-image-30299')).toBe(true)
  })
})

describe('redacted handoff evidence', () => {
  it('accepts category-only records and rejects unsafe free text', () => {
    expect(recordArtifactHandoffEvidence({ kind: 'channel_resolved', channel: 'official' })).toEqual({
      schema: 'pane.artifact-handoff-evidence.v1',
      kind: 'channel_resolved',
      channel: 'official',
    })
    expect(recordArtifactHandoffEvidence({ kind: 'intent_rejected', channel: 'local-contract', reasonCategory: 'reconcile_required' })).toMatchObject({ reasonCategory: 'reconcile_required' })
    expect(recordArtifactHandoffEvidence({ kind: 'intent_rejected', channel: 'local-contract', reasonCategory: 'see https://internal.example' })).toBeUndefined()
    expect(recordArtifactHandoffEvidence({ kind: 'not_a_kind' as never, channel: 'official' })).toBeUndefined()
  })
})
