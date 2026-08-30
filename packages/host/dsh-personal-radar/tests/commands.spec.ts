import { describe, expect, it } from 'vitest'
import { parseRadarCommand, radarIdempotencyKey } from '../src/commands.js'

describe('/drama radar command parser', () => {
  it('parses every documented subcommand into a typed intent', () => {
    const cases = [
      ['/drama radar save opp:a', 'save', ['opp:a'], undefined],
      ['/drama radar dismiss opp:a', 'dismiss', ['opp:a'], undefined],
      ['/drama radar open opp:a', 'open', ['opp:a'], undefined],
      ['/drama radar compare opp:a opp:b', 'compare', ['opp:a', 'opp:b'], undefined],
      ['/drama radar proposal opp:a', 'proposal', ['opp:a'], undefined],
      ['/drama radar workbench opp:a', 'workbench', ['opp:a'], undefined],
      ['/drama radar workbench edition:2026-08-30', 'workbench', [], 'edition:2026-08-30'],
    ] as const
    for (const [line, kind, refs, editionRef] of cases) {
      const parsed = parseRadarCommand(line)
      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.intent.kind).toBe(kind)
        expect([...parsed.intent.opportunityRefs]).toEqual([...refs])
        expect(parsed.intent.idempotencyKey).toBe(radarIdempotencyKey(kind, refs, editionRef))
      }
    }
  })

  it('parses bare /drama radar as the open-pane intent', () => {
    const parsed = parseRadarCommand('/drama radar')
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.intent.kind).toBe('open')
  })

  it('parses refresh unconfirmed and refresh confirm confirmed', () => {
    const plain = parseRadarCommand('/drama radar refresh')
    expect(plain.ok && plain.intent.confirmed === false).toBe(true)
    const confirmed = parseRadarCommand('/drama radar refresh confirm')
    expect(confirmed.ok && confirmed.intent.confirmed === true).toBe(true)
  })

  it('carries the edition ref for workbench edition handoffs', () => {
    const parsed = parseRadarCommand('/drama radar workbench edition:2026-08-30')
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.intent.editionRef).toBe('edition:2026-08-30')
  })

  it('returns usage guidance for unknown subcommands', () => {
    const parsed = parseRadarCommand('/drama radar frobnicate opp:a')
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.usage).toBe(true)
      expect(parsed.reason).toContain('unknown radar subcommand')
    }
  })

  it('returns usage guidance for missing or extra refs', () => {
    for (const line of ['/drama radar save', '/drama radar compare opp:a', '/drama radar open opp:a opp:b', '/drama radar refresh opp:a']) {
      const parsed = parseRadarCommand(line)
      expect(parsed.ok).toBe(false)
      if (!parsed.ok) expect(parsed.usage).toBe(true)
    }
  })

  it('fails closed on unsafe refs', () => {
    const parsed = parseRadarCommand('/drama radar save /etc/passwd')
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.reason).toContain('safety check')
  })

  it('rejects lines that do not start with /drama radar', () => {
    const parsed = parseRadarCommand('/radar save opp:a')
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.reason).toContain('/drama radar')
  })
})
