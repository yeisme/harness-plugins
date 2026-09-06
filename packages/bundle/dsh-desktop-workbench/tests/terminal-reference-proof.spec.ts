import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { terminalReferenceProof as browserProof } from '../src/client/apply.ts'

describe('terminal reference proof', () => {
  it('uses one SHA-256 tuple on both sides and changes when same-sized scrollback changes', async () => {
    const status = { kind: 'running' }
    const first = { text: 'alpha\n', totalLines: 1, lineBegin: 0, lineEnd: 1, truncated: false }
    const changed = { ...first, text: 'omega\n' }
    const browser = await browserProof({ terminalId: 'terminal-1', type: 'bash', status }, first)
    const expectedDigest = createHash('sha256').update(JSON.stringify({
      id: 'terminal-1', type: 'bash', status,
      totalLines: first.totalLines, lineBegin: first.lineBegin, lineEnd: first.lineEnd,
      truncated: first.truncated, text: first.text,
    })).digest('hex')
    const changedBrowser = await browserProof({ terminalId: 'terminal-1', type: 'bash', status }, changed)

    expect(browser).toEqual({ version: `sha256:${expectedDigest}`, digest: expectedDigest })
    expect(browser.version).toBe(`sha256:${browser.digest}`)
    expect(browser.digest).toMatch(/^[0-9a-f]{64}$/u)
    expect(changedBrowser).not.toEqual(browser)
  })
})
