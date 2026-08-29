import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BRIDGE_V2_FIXTURE_VERSION,
  digestBridgeV2,
  parseBridgeFixtureCase,
  parseBridgeFixtureManifest,
  runBridgeFixtureCase,
  validateWorkbenchAiDramaBridgeV2,
} from '../src/index.js'

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'dsh-workbench-ai-drama-bridge-v2')

const manifestRaw: unknown = JSON.parse(readFileSync(join(fixtureDir, 'manifest.json'), 'utf8'))

describe('Bridge V2 conformance fixtures', () => {
  it('ships a parseable manifest pinned to the current fixture version', () => {
    const manifest = parseBridgeFixtureManifest(manifestRaw)
    expect(manifest).toBeDefined()
    expect(manifest?.fixtureVersion).toBe(BRIDGE_V2_FIXTURE_VERSION)
    expect(manifest?.contract).toBe('dsh.workbench_ai_drama_bridge.v2')
    expect(manifest?.cases.length).toBeGreaterThanOrEqual(30)
  })

  const manifest = parseBridgeFixtureManifest(manifestRaw)
  const filesOnDisk = new Set(readdirSync(join(fixtureDir, 'cases')))

  it('has a manifest entry and a file for every case, with no orphans', () => {
    for (const entry of manifest?.cases ?? []) {
      expect(filesOnDisk.has(`${entry.id}.json`), entry.id).toBe(true)
    }
    expect(filesOnDisk.size).toBe(manifest?.cases.length)
  })

  describe.each(manifest?.cases ?? [])('case $id', ({ id, actor, kind }) => {
    it(`[${kind}/${actor}] matches the expected outcome`, () => {
      const raw: unknown = JSON.parse(readFileSync(join(fixtureDir, 'cases', `${id}.json`), 'utf8'))
      const fixture = parseBridgeFixtureCase(raw)
      expect(fixture, id).toBeDefined()
      if (fixture === undefined) return
      const actual = runBridgeFixtureCase(fixture)
      expect(actual, `${id}: ${JSON.stringify(actual)} != ${JSON.stringify(fixture.expect)}`).toEqual(fixture.expect)
    })
  })

  it('keeps every fixture envelope digest-consistent with the canonical form', () => {
    for (const entry of manifest?.cases ?? []) {
      const raw = JSON.parse(readFileSync(join(fixtureDir, 'cases', `${entry.id}.json`), 'utf8')) as {
        category?: string
        given?: { envelope?: Record<string, unknown> }
      }
      // Tamper/structure cases intentionally break the envelope itself.
      if (raw.category === 'digest' || raw.category === 'closed_schema') continue
      const envelope = raw.given?.envelope
      if (envelope === undefined || typeof envelope.contractDigest !== 'string') continue
      const { contractDigest, ...body } = envelope
      expect(digestBridgeV2(body as never), entry.id).toBe(contractDigest)
    }
  })

  it('includes the required coverage families from the design', () => {
    const cases = (manifest?.cases ?? []).map(entry => JSON.parse(
      readFileSync(join(fixtureDir, 'cases', `${entry.id}.json`), 'utf8'),
    ) as { actor: string; category: string })
    const categories = new Set(cases.map(fixture => fixture.category))
    for (const required of ['intent_mapping', 'closed_schema', 'nonce', 'expiry', 'direction', 'target_surface', 'intent_enum', 'digest', 'version', 'replay', 'permission', 'capability', 'lifecycle', 'rollback']) {
      expect(categories.has(required), required).toBe(true)
    }
    // The Workbench consumer must be able to run its lane without DSH internals.
    expect(cases.some(fixture => fixture.actor === 'consumer')).toBe(true)
    expect(cases.some(fixture => fixture.actor === 'both')).toBe(true)
  })

  it('fixture envelopes never carry secrets, URLs, or raw prompts', () => {
    for (const entry of manifest?.cases ?? []) {
      const file = readFileSync(join(fixtureDir, 'cases', `${entry.id}.json`), 'utf8')
      expect(file, entry.id).not.toMatch(/https?:\/\/|Bearer\s|BEGIN PRIVATE|sk-[A-Za-z0-9]|\/home\/|\/etc\//)
    }
  })

  it('the canonical fixture envelope itself still validates', () => {
    const opened = JSON.parse(readFileSync(join(fixtureDir, 'cases', 'version-match-opens.json'), 'utf8')) as {
      given: { envelope: unknown }
    }
    expect(validateWorkbenchAiDramaBridgeV2(opened.given.envelope, () => 1_800_000_000_000).ok).toBe(true)
  })
})
