import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
// The bundle shares its package name with the host pack, so a bare
// self-import resolves to the bundle entry; reference the host pack directly.
import * as director from '../../../host/dsh-ai-drama-director/src/index.js'

describe('dsh-ai-drama-director bundle contract', () => {
  it('ships the legacy V1 surface unchanged alongside the additive V2 bridge surface', () => {
    // V1 (frozen during the compatibility window)
    expect(director.DRAMA_WORKBENCH_HANDOFF_SCHEMA).toBe('drama.workbench-handoff.v1')
    expect(typeof director.createWorkbenchHandoff).toBe('function')
    expect(typeof director.verifyWorkbenchHandoff).toBe('function')
    expect(director.WORKBENCH_HANDOFF_INTENTS).toContain('open_show')
    // V2 (additive)
    expect(director.BRIDGE_V2_CONTRACT).toBe('dsh.workbench_ai_drama_bridge.v2')
    expect(typeof director.createWorkbenchAiDramaBridgeV2).toBe('function')
    expect(typeof director.validateWorkbenchAiDramaBridgeV2).toBe('function')
    expect(typeof director.createWorkbenchLaunchProvider).toBe('function')
    expect(typeof director.createLegacyBridgeAdapter).toBe('function')
    expect(director.BRIDGE_V2_LENS_MAP.open_show.lens).toBe('creative_production')
    expect(director.BRIDGE_V2_REASON_CODES).toContain('legacy_bridge')
    expect(director.LEGACY_BRIDGE_COMPAT_WINDOW_RELEASES).toBeGreaterThanOrEqual(2)
  })

  it('publishes the cross-repository conformance fixtures with a versioned manifest', () => {
    const fixtureDir = join(__dirname, '..', '..', '..', 'host', 'dsh-ai-drama-director', 'fixtures', 'dsh-workbench-ai-drama-bridge-v2')
    const manifest = JSON.parse(readFileSync(join(fixtureDir, 'manifest.json'), 'utf8'))
    expect(manifest.fixtureVersion).toBe(director.BRIDGE_V2_FIXTURE_VERSION)
    expect(manifest.contract).toBe('dsh.workbench_ai_drama_bridge.v2')
    expect(manifest.cases.length).toBeGreaterThanOrEqual(30)
    // Consumer-side cases are runnable without DSH internal modules.
    expect(manifest.cases.some((entry: { actor: string }) => entry.actor === 'consumer')).toBe(true)
  })

  it('keeps the install declaration stable so existing consumers compile without source changes', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'))
    expect(pkg.dsh.client.platform).toBe('web')
    expect(pkg.dsh.client.inject).toEqual([
      '@deepseek-ai/dsh-client-locale',
      '@deepseek-ai/dsh-client-runtime',
    ])
    // The launcher and Workbench V2 consumer are optional at install time:
    // the bundle must not hard-require a V2 consumer.
    expect(JSON.stringify(pkg.peerDependencies)).not.toContain('yeisme-workbench')
    expect(existsSync(join(__dirname, '..', 'cordis.patch.yml'))).toBe(true)
  })

  it('keeps generated manifest, profile patch, and compatibility metadata in sync', () => {
    const result = spawnSync(process.execPath, ['scripts/generate-bundle-metadata.mjs', '--check'], {
      cwd: join(__dirname, '..'),
      encoding: 'utf8',
    })
    expect(result.status, result.stderr).toBe(0)

    const compatibility = JSON.parse(readFileSync(join(__dirname, '..', 'dsh.compatibility.json'), 'utf8'))
    expect(compatibility).toMatchObject({
      schemaVersion: 'yeisme.dsh-bundle-compatibility.v1',
      package: { name: '@yeisme/dsh-ai-drama-director', version: '0.1.0-rc.1' },
      profile: {
        patch: './cordis.patch.yml',
        rowId: 'dsh-ai-drama-director',
        conformanceCommand: 'pnpm --dir packages/bundle/dsh-ai-drama-director run test:profile',
      },
    })
    expect(compatibility.contracts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'dsh.workbench_ai_drama_bridge.v2', status: 'preferred' }),
      expect.objectContaining({ id: 'drama.workbench-handoff.v1', status: 'legacy', compatibilityWindowReleases: 2 }),
    ]))
    expect(compatibility.contractDigest).toMatch(/^[0-9a-f]{64}$/u)
    expect(compatibility.pluginReleaseDigest).toMatch(/^[0-9a-f]{64}$/u)
  })
})
