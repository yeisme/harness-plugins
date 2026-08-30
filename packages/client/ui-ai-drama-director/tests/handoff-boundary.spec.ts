import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/** exception-director 3.1/3.2/3.3 boundary guards. */
function source(relative: string): string {
  return readFileSync(resolve(process.cwd(), relative), 'utf8')
}

describe('handoff semantics (3.1)', () => {
  it('the payload allowlist carries refs only — no raw route, URL, or absolute path key can pass', async () => {
    const { DRAMA_HANDOFF_ALLOWED_KEYS } = await import('../src/client/handoff-gate.ts')
    for (const forbidden of ['route', 'url', 'path', 'href', 'content', 'body', 'payload', 'command']) {
      expect(DRAMA_HANDOFF_ALLOWED_KEYS.has(forbidden)).toBe(false)
    }
    for (const required of ['contextRef', 'artifactRef', 'receiptRef', 'nonce', 'expiresAt']) {
      expect(DRAMA_HANDOFF_ALLOWED_KEYS.has(required)).toBe(true)
    }
  })

  it('rejections stay fail-closed: no auto-retry or fuzzy-open in the gate', () => {
    const gate = source('src/client/handoff-gate.ts')
    expect(gate).toContain('no auto-retry and no fuzzy-open fallback')
  })
})

describe('legacy usage recording (3.2)', () => {
  it('the legacy show-control preset application emits a usage reason category', () => {
    const index = source('src/client/index.ts')
    expect(index).toContain("reasonCategory: 'show_control_preset'")
    const preset = source('src/client/preset.ts')
    expect(preset).toContain('DRAMA_SHOW_CONTROL_DEPRECATION')
    expect(preset).toContain('two plugin release windows')
  })
})

describe('boundary scan (3.3: no copied owner state machines)', () => {
  it('the drama client never embeds Workbench/Scaena/Ordo canonical machinery', () => {
    const files = ['src/client/index.ts', 'src/client/preset.ts', 'src/client/exception-projection.ts', 'src/client/decision-token.ts']
    for (const file of files) {
      const text = source(file)
      expect(text, `${file} scene graph`).not.toMatch(/scene[- ]?graph/i)
      expect(text, `${file} edit revision`).not.toMatch(/EditRevision/)
      expect(text, `${file} rebase machinery`).not.toMatch(/\brebase[A-Z]/)
      expect(text, `${file} scheduler`).not.toMatch(/\bcreateScheduler\b/)
      expect(text, `${file} writer lease`).not.toMatch(/writerLease/)
      expect(text, `${file} approval ledger`).not.toMatch(/approvalLedger/)
      expect(text, `${file} capacity reservation`).not.toMatch(/capacityReservation/)
      expect(text, `${file} terminal inference`).not.toMatch(/inferTerminalState/)
    }
  })
})
