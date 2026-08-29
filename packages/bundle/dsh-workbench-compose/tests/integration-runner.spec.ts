import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const packageRoot = resolve(import.meta.dirname, '..')

describe('web pane experience integration evidence runner', () => {
  it('is the package integration entrypoint and generates the required redacted six-piece evidence', () => {
    const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }
    const source = readFileSync(resolve(packageRoot, 'scripts/run-experience-integration.mjs'), 'utf8')

    expect(manifest.scripts?.['test:integration']).toBe('node scripts/run-experience-integration.mjs')
    expect(source).toContain("schema_version: 'yeisme.integration_test_evidence.v1'")
    for (const file of ['summary.json', 'command.txt', 'stdout.log', 'stderr.log', 'env.json', 'artifacts']) {
      expect(source).toContain(file)
    }
    expect(source).toContain('tests/official-host.spec.tsx')
    expect(source).toContain('tests/handoff-gate.spec.ts')
    expect(source).toContain('tests/scenario-mapping.spec.ts')
    expect(source).toContain("absolute_paths_persisted: false")
    expect(source).toContain("raw_payloads_persisted: false")
  })
})
