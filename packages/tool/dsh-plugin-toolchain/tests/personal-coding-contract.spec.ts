import { describe, expect, it } from 'vitest'
import { findWorkspaceRoot } from '../src/workspace.js'
import { runPersonalCodingContractCheck } from '../src/checkers/personal-coding-contract.js'

describe('personal-coding-contract', () => {
  it('passes the real generated base graph, pack metadata, structured fixture and health isolation', () => {
    const root = findWorkspaceRoot(import.meta.dirname)
    const result = runPersonalCodingContractCheck(root)
    expect(result.status, JSON.stringify(result.findings, null, 2)).toBe('pass')
    expect(result.checkedCount).toBeGreaterThan(7)
    expect(result.notes[0]).toMatch(/^base client bytes:/)
  })
})
