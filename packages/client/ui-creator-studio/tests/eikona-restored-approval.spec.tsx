// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EikonaRestoredApproval } from '../src/eikona-restored-approval.tsx'
import { defaultCreatorStudioTranslator as t } from '../src/locales.ts'
afterEach(cleanup)
const binding = { approvalRef: `ega_${'a'.repeat(64)}`, preparationRef: `egp_${'b'.repeat(64)}`, digest: 'c'.repeat(64) }
const observation = { status: 'observed' as const, ...binding, projectId: 'project', revoked: true, expired: false, expiresAt: '2999-01-01T00:00:00Z', observedAt: '2026-09-09T00:00:00Z', consumedOperation: `own_${'d'.repeat(24)}` }
it('reads only after explicit action and displays original operation independently of revocation', async () => {
  const read = vi.fn(async () => observation)
  render(<EikonaRestoredApproval {...binding} read={read} t={t} />)
  expect(read).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '核对已保存批准' }))
  await screen.findByText(/Owner 已确认批准撤销/u)
  expect(screen.getByText(text => text.includes(observation.consumedOperation))).toBeTruthy()
  expect(read).toHaveBeenCalledExactlyOnceWith({ approvalRef: binding.approvalRef })
})
it('rejects a response with a different fixed preparation instead of displaying it', async () => {
  render(<EikonaRestoredApproval {...binding} read={async () => ({ ...observation, digest: 'e'.repeat(64) })} t={t} />)
  fireEvent.click(screen.getByRole('button', { name: '核对已保存批准' }))
  await screen.findByText(/未能确认批准状态/u)
  expect(screen.queryByText(/Owner 已确认批准撤销/u)).toBeNull()
})

it.each(['older', 'revocation', 'operation', 'project', 'expiry', 'unavailable'])('retains the last confirmed observation after %s regression', async scenario => {
  let calls = 0
  const read = vi.fn(async () => {
    if (++calls === 1) return observation
    switch (scenario) {
      case 'older': return { ...observation, observedAt: '2026-09-08T00:00:00Z' }
      case 'revocation': return { ...observation, revoked: false }
      case 'operation': return { ...observation, consumedOperation: `own_${'e'.repeat(24)}` }
      case 'project': return { ...observation, projectId: 'other' }
      case 'expiry': return { ...observation, expiresAt: '2998-01-01T00:00:00Z' }
      default: return { status: 'unavailable' as const }
    }
  })
  render(<EikonaRestoredApproval {...binding} read={read} t={t} />)
  fireEvent.click(screen.getByRole('button', { name: '核对已保存批准' }))
  await screen.findByText(/Owner 已确认批准撤销/u)
  fireEvent.click(screen.getByRole('button', { name: '核对已保存批准' }))
  await screen.findByText('本次核对未确认，以下保留上次成功观察。')
  expect(screen.getByText(/Owner 已确认批准撤销/u)).toBeTruthy()
  expect(screen.getByText(text => text.includes(observation.consumedOperation))).toBeTruthy()
  expect(screen.getByText(text => text.includes(observation.observedAt))).toBeTruthy()
  expect(read).toHaveBeenCalledTimes(2)
})
