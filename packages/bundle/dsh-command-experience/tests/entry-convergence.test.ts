import { describe, expect, it } from 'vitest'
import {
  bundleEntryLedger,
  createConvergenceDirectory,
  ledgerIsClosed,
  paletteExecuteRecord,
  registerConvergedSource,
  unloadConvergedSource,
} from '@yeisme/dsh-client-ui-command-experience-core'

describe('bundle entry convergence', () => {
  it('records Palette execution success for every converged id', () => {
    expect(ledgerIsClosed()).toBe(true)
    const directory = createConvergenceDirectory()
    const installed = bundleEntryLedger().map(row => row.bundleId)
    registerConvergedSource(directory, installed)
    const converged = bundleEntryLedger().filter(row => row.disposition === 'converged')
    for (const row of converged) {
      for (const seed of row.commands) {
        const record = paletteExecuteRecord(directory, seed.canonicalName)
        expect(record.found, seed.canonicalName).toBe(true)
        expect(record.executed, seed.canonicalName).toBe(true)
        expect(record.receiptStatus, seed.canonicalName).toBe('success')
        expect(record.activityCanonicalName, seed.canonicalName).toBe(seed.canonicalName)
        expect(record.owner, seed.canonicalName).toBe(seed.owner)
        expect(record.danger, seed.canonicalName).toBe(seed.danger)
        expect(record.oldPath, seed.canonicalName).toBe(row.oldPath)
      }
    }
    unloadConvergedSource(directory)
    for (const row of converged) {
      for (const seed of row.commands) {
        expect(paletteExecuteRecord(directory, seed.canonicalName).found).toBe(false)
      }
    }
  })
})
