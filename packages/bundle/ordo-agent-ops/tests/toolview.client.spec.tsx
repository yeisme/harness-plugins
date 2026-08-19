// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OrdoAgentOpsToolView } from '../src/client/toolview.tsx'
import type { OrdoAgentOpsActionDescriptor, OrdoAgentOpsActionReceipt, OrdoAgentOpsRef } from '../src/host/types.ts'

const ref = (value: string): OrdoAgentOpsRef => value as OrdoAgentOpsRef

describe('OrdoAgentOpsToolView', () => {
  it('fails closed without a server-authored action descriptor', () => {
    render(<OrdoAgentOpsToolView />)

    expect(screen.getByText('Action unavailable')).toBeTruthy()
    expect(screen.getByText(/No server-authored action descriptor/)).toBeTruthy()
    expect(document.querySelector('button')).toBeNull()
  })

  it('renders only owner-authored action and receipt facts', () => {
    const action: OrdoAgentOpsActionDescriptor = {
      actionType: 'ordo.reconcile.request',
      decisionRef: ref('decision-1'),
      targetRef: ref('run-1'),
      targetVersion: 4,
      ownerRef: ref('owner-1'),
      safeEffect: 'Request owner reconciliation',
      expiresAt: '2026-08-17T00:00:00.000Z',
      previewDigest: 'preview-digest',
      contractDigest: 'contract-digest',
    }
    const receipt: OrdoAgentOpsActionReceipt = {
      receiptRef: ref('receipt-1'),
      state: 'accepted',
      safeSummary: 'Owner accepted the request',
    }

    render(<OrdoAgentOpsToolView action={action} receipt={receipt} />)

    expect(screen.getByText('Owner action preview')).toBeTruthy()
    expect(screen.getByText(/Target run-1: Request owner reconciliation/)).toBeTruthy()
    expect(screen.getByText(/Receipt receipt-1: accepted/)).toBeTruthy()
    expect(document.body.textContent).not.toContain('decisionRef')
  })
})
