import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { CpuProfiler, DevtoolsService, DevtoolsStore } from '../src/index.ts'

describe('terminal renderer', () => {
  it('writes redacted diagnostics without user values', () => {
    const lines: string[] = []
    const service = new DevtoolsService(new DevtoolsStore(), new CpuProfiler(() => false), { logger: true, sessionTimeline: true, hostMetrics: true, exactRpcCorrelation: false }, { write: line => { lines.push(line) } }, 'debug')
    service.ingestLog({ sn: 1, ts: 1, name: 'provider', type: 'error', level: 0, args: ['Bearer secret-token', { prompt: 'private' }] })
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('source=provider')
    expect(lines[0]).not.toContain('Bearer')
    expect(lines[0]).not.toContain('private')
  })

  it('keeps the Host implementation off process stdout', () => {
    const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8')
    expect(source).not.toContain('process.stdout')
    expect(source).toContain('process.stderr.write')
  })
})
