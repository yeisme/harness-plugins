import { describe, expect, it } from 'vitest'
import { buildBrowserUiAction, gateBrowserUiAction, mapBrowserReceipt } from '../src/actions.js'

const binding = { tenantRef: 't:1', workspaceRef: 'w:1', principalRef: 'p:1', contextRevision: 1, sessionRef: 's:1' }
const descriptor = { actionId: 'navigate', label: '打开', kind: 'navigate' as const, requiresConfirmation: 'none' as const, disabledReason: undefined }

describe('owner-authored browser actions (browser-pane 2.8)', () => {
  it('builds typed requests with deterministic idempotency keys and bounded drafts', () => {
    const request = buildBrowserUiAction({ actionId: 'navigate', binding, pageRef: 'page:1', navigationDraft: 'example.com', idempotencySeed: 7 })
    expect(request).toMatchObject({ actionId: 'navigate', pageRef: 'page:1', idempotencyKey: 'bp-navigate-7', navigationDraft: 'example.com' })
    expect(buildBrowserUiAction({ actionId: 'reload', binding, pageRef: undefined, idempotencySeed: 8 }).idempotencyKey).toBe('bp-reload-8')
  })

  it('gating: owner-disabled and phase-locked actions render disabled with reasons', () => {
    expect(gateBrowserUiAction(undefined, true)).toMatchObject({ enabled: false, reason: 'action_not_offered' })
    expect(gateBrowserUiAction({ ...descriptor, disabledReason: 'needs permission' }, true)).toMatchObject({ enabled: false, label: '打开', reason: 'needs permission' })
    expect(gateBrowserUiAction(descriptor, false)).toMatchObject({ enabled: false, reason: 'phase_locked' })
    expect(gateBrowserUiAction(descriptor, true)).toMatchObject({ enabled: true, reason: undefined })
  })

  it('receipts map honestly; unknown never auto-retries', () => {
    expect(mapBrowserReceipt({ status: 'ok', receiptRef: 'r:1', reasonCode: undefined })).toEqual({ kind: 'submitted', receiptRef: 'r:1' })
    expect(mapBrowserReceipt({ status: 'rejected', receiptRef: 'r:2', reasonCode: 'policy' })).toEqual({ kind: 'rejected', reasonCode: 'policy' })
    expect(mapBrowserReceipt({ status: 'needs_confirm', receiptRef: 'r:3', reasonCode: undefined })).toEqual({ kind: 'needs_confirm' })
    expect(mapBrowserReceipt({ status: 'unknown', receiptRef: 'r:4', reasonCode: 'timeout' })).toEqual({ kind: 'unknown', reasonCode: 'timeout' })
    expect(mapBrowserReceipt({ status: 'weird', receiptRef: 'r:5', reasonCode: undefined })).toEqual({ kind: 'unknown', reasonCode: undefined })
  })
})
