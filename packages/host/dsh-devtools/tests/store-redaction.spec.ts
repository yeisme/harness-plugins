import { describe, expect, it } from 'vitest'
import { containsForbiddenContent, DevtoolsStore, logFingerprint, normalizeScriptUrl, safeIdentifier } from '../src/index.ts'

const capabilities = { logger: true, sessionTimeline: true, hostMetrics: true, cpuProfile: false, exactRpcCorrelation: false }

describe('DevtoolsStore and redaction', () => {
  it('serves monotonic bounded snapshots and validates requests', () => {
    let now = 1000
    const store = new DevtoolsStore({ now: () => now, bootId: 'boot', startedAt: 0 })
    store.append({ type: 'lifecycle', ts: now++, event: 'devtools.ready', severity: 'info', summary: 'ready' })
    store.append({ type: 'log', ts: now++, severity: 'warn', source: 'test', fingerprint: 'sha256:x', summary: 'redacted' })
    const first = store.snapshot({}, capabilities)
    expect(first).toMatchObject({ ok: true, bootId: 'boot', nextSeq: 2, truncated: false })
    expect(first.records.map(record => record.seq)).toEqual([1, 2])
    expect(store.snapshot({ afterSeq: 1, limit: 1 }, capabilities).records.map(record => record.seq)).toEqual([2])
    expect(() => store.snapshot({ limit: 501 }, capabilities)).toThrow(/limit/)
    expect(store.summary()).toMatchObject({ records: 2, logs: 1, errors: 0 })
  })

  it('does not derive fingerprints from raw values and detects forbidden exports', () => {
    const a = logFingerprint('llm', 'error', ['first secret prompt'])
    const b = logFingerprint('llm', 'error', ['second different prompt'])
    expect(a).toBe(b)
    expect(safeIdentifier('bad value with spaces')).toBe('unknown')
    expect(containsForbiddenContent({ Authorization: 'Bearer abc' })).toBe(true)
    expect(containsForbiddenContent({ summary: 'safe', path: 'relative/file.ts' })).toBe(false)
  })

  it('normalizes CPU profile script URLs', () => {
    expect(normalizeScriptUrl('/workspace/app/src/a.ts', '/workspace/app')).toBe('src/a.ts')
    expect(normalizeScriptUrl('/private/secret.ts', '/workspace/app')).toBe('<external>')
    expect(normalizeScriptUrl('node:internal/per_context/primordials')).toBe('node:internal/per_context/primordials')
  })
})
