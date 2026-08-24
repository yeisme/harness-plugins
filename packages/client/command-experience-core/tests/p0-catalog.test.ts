import { describe, expect, it } from 'vitest'
import {
  auditCoverageLedger,
  buildP0Catalog,
  inspectCommandsMutateState,
  sharedActionIdentity,
} from '../src/p0-catalog'

describe('P0 catalog adapters', () => {
  it('projects discovery commands as inspect/local without mutation', () => {
    const catalog = buildP0Catalog()
    for (const name of ['help', 'commands', 'status', 'plugins', 'mcp', 'skills']) {
      expect(inspectCommandsMutateState(name)).toBe(false)
      const entry = catalog.find((item) => item.canonicalName === name)
      expect(entry).toBeDefined()
      expect(entry?.description.length).toBeGreaterThan(0)
      expect(entry?.availability.state === 'available' || entry?.availability.reason).toBeTruthy()
    }
  })

  it('disables model/work owner actions when the capability is missing', () => {
    const catalog = buildP0Catalog({ availableActions: new Set(['open-thread']) })
    const model = catalog.find((item) => item.canonicalName === 'model')
    expect(model?.availability).toEqual({
      state: 'disabled',
      reason: 'missing owner action set-model',
    })
    const mention = catalog.find((item) => item.canonicalName === 'mention')
    expect(mention?.availability.state).toBe('disabled')
    const agent = catalog.find((item) => item.canonicalName === 'agent')
    expect(agent?.availability.state).toBe('available')
  })

  it('keeps lifecycle aliases on one action identity', () => {
    const catalog = buildP0Catalog()
    expect(sharedActionIdentity('quit', 'exit', catalog)).toBe(true)
    expect(sharedActionIdentity('agent', 'subagents', catalog)).toBe(true)
    expect(sharedActionIdentity('new', 'fork', catalog)).toBe(false)
    const logout = catalog.find((item) => item.canonicalName === 'logout')
    expect(logout?.danger).toBe('confirm')
  })

  it('rejects ledger rows that have no owner or verify command', () => {
    const issues = auditCoverageLedger([
      { command: '/help', coverage: 'adapted', owner: 'client', seam: 'local', verifyCommand: 'vitest' },
      { command: '/help', coverage: 'adapted', owner: 'client', seam: 'local', verifyCommand: 'vitest' },
      { command: '/later', coverage: 'staged', owner: '', seam: '', verifyCommand: '' },
    ])
    expect(issues).toEqual([
      'duplicate /help',
      '/later missing owner',
      '/later missing seam',
      '/later missing verify command',
    ])
  })
})
