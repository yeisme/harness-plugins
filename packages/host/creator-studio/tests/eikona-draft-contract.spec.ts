import { describe, expect, it } from 'vitest'
import { eikonaDraftSchema } from '../src/eikona-draft-contract.ts'

const draft = () => ({
  schemaVersion: 'eikona.studio_draft.v1', scope: { tenantRef: 'tenant', workspaceRef: 'workspace', projectRef: 'project' },
  id: 'primary', revision: 0,
  fields: { prompt: '', version: '不完整', size: '1024x', seed: '-', variables: [{ name: '', value: '河流\n晨光' }, { name: '', value: '' }] },
  checkpoint: { status: 'editing' },
})

describe('Eikona local draft contract', () => {
  it('preserves invalid unfinished input without treating it as a generation request', () => {
    expect(eikonaDraftSchema.parse(draft())).toEqual(draft())
  })
  it('does not persist execution consent or owner payloads', () => {
    for (const forbidden of ['confirmed', 'allowUnknownCost', 'executionAuthorized', 'providerPayload', 'token']) {
      expect(eikonaDraftSchema.safeParse({ ...draft(), [forbidden]: true }).success).toBe(false)
      expect(eikonaDraftSchema.safeParse({ ...draft(), checkpoint: { status: 'editing', [forbidden]: true } }).success).toBe(false)
    }
  })
  it('keeps uncertainty explicit and requires refs for observations', () => {
    expect(eikonaDraftSchema.safeParse({ ...draft(), checkpoint: { status: 'preparation_unconfirmed' } }).success).toBe(true)
    expect(eikonaDraftSchema.safeParse({ ...draft(), checkpoint: { status: 'approval_observed' } }).success).toBe(false)
    expect(eikonaDraftSchema.safeParse({ ...draft(), checkpoint: { status: 'approval_observed', preparationRef: `egp_${'a'.repeat(64)}`, digest: 'b'.repeat(64), approvalRef: `ega_${'c'.repeat(64)}` } }).success).toBe(true)
  })
  it('bounds aggregate UTF-8 size and invalid revision values', () => {
    const large = draft()
    large.fields.variables = Array.from({ length: 64 }, () => ({ name: '变量', value: '中'.repeat(4096) }))
    expect(eikonaDraftSchema.safeParse(large).success).toBe(false)
    for (const revision of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) expect(eikonaDraftSchema.safeParse({ ...draft(), revision }).success).toBe(false)
  })
})
