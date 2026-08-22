import { describe, expect, it } from 'vitest'
import { PANE_CONFORMANCE_CASES } from '../src/conformance.ts'
import { PaneEventEnvelopeSchema } from '../src/index.js'

describe('pane conformance fixtures', () => {
  it('covers the required recovery and admission cases', () => {
    const ids = PANE_CONFORMANCE_CASES.map(item => item.id)
    expect(ids).toEqual([
      'snapshot-required',
      'snapshot-live',
      'duplicate-sequence',
      'sequence-gap',
      'expired-cursor-context-switch',
      'permission-denied',
      'contract-mismatch',
      'offline',
      'unknown-receipt',
      'action-receipt-approval',
      'idempotent-duplicate-receipt-sequence',
    ])
  })

  it('keeps every envelope parseable except the contract-mismatch payload', () => {
    for (const item of PANE_CONFORMANCE_CASES) {
      for (const event of item.events) {
        const parsed = PaneEventEnvelopeSchema.safeParse(event)
        if (item.id === 'contract-mismatch' && event === item.events.at(-1)) {
          expect(parsed.success).toBe(false)
          continue
        }
        expect(parsed.success, item.id).toBe(true)
      }
    }
  })
})
