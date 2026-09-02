import { describe, expect, it } from 'vitest'
import { buildP0Catalog } from '@yeisme/dsh-client-ui-command-experience-core'
import { FIRST_SUPPORT_NAMES, runFirstSupportJourney, runFirstSupportMatrix } from '../src/index'

describe('first-support journeys', () => {
  const commands = buildP0Catalog({
    availableActions: new Set([
      'status', 'open-session', 'new-chat', 'fork-chat', 'rename-session',
      'compact-context', 'set-model', 'set-permissions',
    ]),
  })

  it('covers success, disabled, stale, permission, and owner-error for each first-support command', () => {
    const matrix = runFirstSupportMatrix(commands)
    expect(matrix).toHaveLength(FIRST_SUPPORT_NAMES.length * 5)
    for (const name of FIRST_SUPPORT_NAMES) {
      const rows = matrix.filter(row => row.name === name)
      expect(rows.map(row => row.outcome)).toEqual([
        'success', 'disabled', 'stale', 'permission', 'owner-error',
      ])
      const success = rows.find(row => row.outcome === 'success')!
      expect(success.dispatched).toBe(true)
      expect(success.activity[0]?.canonicalName).toBe(name)
      expect(success.receipt.status === 'success' || success.receipt.status === 'error' || success.receipt.status === 'stale').toBe(true)
      const disabled = rows.find(row => row.outcome === 'disabled')!
      expect(disabled.dispatched).toBe(false)
      const permission = rows.find(row => row.outcome === 'permission')!
      expect(permission.receipt.status).toBe('error')
      const stale = rows.find(row => row.outcome === 'stale')!
      expect(stale.receipt.status).toBe('stale')
    }
  })

  it('records canonical identity on Activity and never a second client log', () => {
    const result = runFirstSupportJourney({ commands, name: 'session', outcome: 'success' })
    expect(result.events.map(event => event.canonicalName)).toEqual(['session', 'session'])
    expect(result.events.every(event => event.type === 'command/run' || event.type === 'command/done')).toBe(true)
    expect(JSON.stringify(result)).not.toMatch(/raw prompt|provider payload|sk-|\/home\//)
  })
})
