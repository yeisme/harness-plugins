import { describe, expect, it } from 'vitest'
import { RADAR_RECEIPT_SCHEMA, type RadarActionReceiptV1 } from '../src/contracts.js'
import {
  isRadarReconcilePending,
  recordRadarDispatch,
  reconcileRadarUnknown,
  shouldAutoReplayRadarIntent,
} from '../src/reconcile.js'
import { createFakeRadarProvider } from '../src/provider.js'
import { parseRadarCommand } from '../src/commands.js'

function receipt(key: string, outcome: RadarActionReceiptV1['outcome'], runRef?: string): RadarActionReceiptV1 {
  return {
    schema: RADAR_RECEIPT_SCHEMA,
    idempotencyKey: key,
    outcome,
    reason: `receipt for ${key}`,
    ...(runRef === undefined ? {} : { runRef }),
  }
}

describe('radar receipt reconcile', () => {
  it('never auto-replays unknown outcomes', () => {
    expect(shouldAutoReplayRadarIntent()).toBe(false)
  })

  it('dedupes duplicate intents by idempotency key without re-dispatch', () => {
    let ledger = { entries: {}, pendingUnknown: [] }
    const first = recordRadarDispatch(ledger, receipt('radar-save-opp:a', 'submitted', 'run:1'))
    expect(first.dispatched).toBe(true)
    const second = recordRadarDispatch(first.ledger, receipt('radar-save-opp:a', 'submitted', 'run:1'))
    expect(second.dispatched).toBe(false)
    expect(Object.keys(second.ledger.entries)).toHaveLength(1)
  })

  it('marks unknown outcomes pending and reconciles by owner run ref', async () => {
    let ledger = { entries: {}, pendingUnknown: [] }
    ledger = recordRadarDispatch(ledger, receipt('radar-save-opp:killed', 'unknown')).ledger
    expect(isRadarReconcilePending(ledger, 'radar-save-opp:killed')).toBe(true)
    expect(ledger.pendingUnknown).toEqual(['radar-save-opp:killed'])

    const fake = createFakeRadarProvider()
    fake.settleUnknown('radar-save-opp:killed', {
      outcome: 'submitted',
      reason: 'owner completed after reconnect',
      runRef: 'run:reconnect-1',
      feedbackRef: 'feedback:radar-save-opp:killed',
    })
    const reconciled = await reconcileRadarUnknown(ledger, 'radar-save-opp:killed', fake.lookupReceipt)
    expect(reconciled.entries['radar-save-opp:killed']?.receipt.outcome).toBe('reconciled')
    expect(reconciled.entries['radar-save-opp:killed']?.receipt.runRef).toBe('run:reconnect-1')
    expect(isRadarReconcilePending(reconciled, 'radar-save-opp:killed')).toBe(false)
  })

  it('stays unknown when the owner has no receipt for the key', async () => {
    let ledger = { entries: {}, pendingUnknown: [] }
    ledger = recordRadarDispatch(ledger, receipt('radar-save-opp:ghost', 'unknown')).ledger
    const fake = createFakeRadarProvider()
    const reconciled = await reconcileRadarUnknown(ledger, 'radar-save-opp:ghost', fake.lookupReceipt)
    expect(isRadarReconcilePending(reconciled, 'radar-save-opp:ghost')).toBe(true)
    expect(reconciled).toBe(ledger)
  })

  it('ignores reconcile for non-pending keys', async () => {
    let ledger = { entries: {}, pendingUnknown: [] }
    ledger = recordRadarDispatch(ledger, receipt('radar-save-opp:ok', 'submitted')).ledger
    const reconciled = await reconcileRadarUnknown(ledger, 'radar-save-opp:ok', async () => undefined)
    expect(reconciled).toBe(ledger)
  })
})

describe('radar kill/reconnect through the full intent path', () => {
  it('duplicate typed intent writes feedback exactly once', async () => {
    const { dispatchRadarIntent } = await import('../src/adapter.js')
    const fake = createFakeRadarProvider()
    const parsed = parseRadarCommand('/drama radar save opp:demo-1')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const first = await dispatchRadarIntent({ binary: 'radar' }, parsed.intent, fake.runner)
    expect(first.ok && first.receipt.outcome === 'submitted').toBe(true)
    const second = await dispatchRadarIntent({ binary: 'radar' }, parsed.intent, fake.runner)
    expect(second.ok).toBe(true)
    if (second.ok) expect(second.receipt.reason).toContain('duplicate idempotency key')
    expect(fake.receiptLog).toHaveLength(1)
  })

  it('simulated kill yields unknown, then owner reconcile resolves it', async () => {
    const { dispatchRadarIntent } = await import('../src/adapter.js')
    const fake = createFakeRadarProvider({ forcedOutcomes: ['unknown'] })
    const parsed = parseRadarCommand('/drama radar save opp:demo-9')
    if (!parsed.ok) throw new Error('parse failed')
    const killed = await dispatchRadarIntent({ binary: 'radar' }, parsed.intent, fake.runner)
    expect(killed.ok && killed.receipt.outcome === 'unknown').toBe(true)

    let ledger = recordRadarDispatch({ entries: {}, pendingUnknown: [] }, killed.ok ? killed.receipt : receipt('x', 'unknown')).ledger
    expect(isRadarReconcilePending(ledger, parsed.intent.idempotencyKey)).toBe(true)

    fake.settleUnknown(parsed.intent.idempotencyKey, {
      outcome: 'submitted',
      reason: 'owner receipt arrived after reconnect',
      runRef: 'run:reconnect-2',
    })
    ledger = await reconcileRadarUnknown(ledger, parsed.intent.idempotencyKey, fake.lookupReceipt)
    expect(ledger.entries[parsed.intent.idempotencyKey]?.receipt.outcome).toBe('reconciled')
  })
})
