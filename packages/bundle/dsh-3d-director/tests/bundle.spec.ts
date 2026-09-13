import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as host from '../../../host/dsh-3d-director/src/index.js'

const bundleRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('dsh-3d-director bundle contract', () => {
  it('exposes the scene graph gateway surface from the host pack', () => {
    expect(host.SCENE_3D_DIRECTOR_SERVICE_KEY).toBe('scene3dDirector')
    expect(host.SCENE_3D_EXPECTED_CONTEXT).toBe('scene3dDirectorExpectedContext')
    expect(host.SCENE_3D_CONTEXT_SCHEMA).toBe('dsh.scene-3d-context.v1alpha1')
    expect(typeof host.SceneGraphGateway).toBe('function')
    expect(typeof host.validateScene3DContext).toBe('function')
  })

  it('keeps the install declaration stable so existing consumers compile without source changes', () => {
    const pkg = JSON.parse(readFileSync(join(bundleRoot, 'package.json'), 'utf8'))
    expect(pkg.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(pkg.dsh.client.platform).toBe('web')
    expect(pkg.dsh.client.inject).toEqual([
      '@deepseek-ai/dsh-client-locale',
      '@deepseek-ai/dsh-client-runtime',
    ])
    expect(pkg.dependencies['@yeisme/dsh-3d-director-host']).toBe('workspace:*')
    expect(pkg.dependencies['@yeisme/dsh-client-ui-3d-director']).toBe('workspace:*')
    expect(existsSync(join(bundleRoot, 'cordis.patch.yml'))).toBe(true)
  })

  it('ships a single additive profile row', () => {
    const patch = readFileSync(join(bundleRoot, 'cordis.patch.yml'), 'utf8')
    expect(patch).toContain('id: dsh-3d-director')
    expect(patch).toContain("name: '@yeisme/dsh-3d-director'")
    expect(patch.match(/- insert:/gu)?.length).toBe(1)
  })

  it('keeps generated manifest, profile patch, and compatibility metadata in sync', () => {
    const result = spawnSync(process.execPath, ['scripts/generate-bundle-metadata.mjs', '--check'], {
      cwd: bundleRoot,
      encoding: 'utf8',
    })
    expect(result.status, result.stderr).toBe(0)

    const compatibility = JSON.parse(readFileSync(join(bundleRoot, 'dsh.compatibility.json'), 'utf8'))
    expect(compatibility).toMatchObject({
      schemaVersion: 'yeisme.dsh-bundle-compatibility.v1',
      package: { name: '@yeisme/dsh-3d-director', version: '0.1.0-rc.1' },
      dshHostCompatibility: { strategy: 'capability_probe' },
      profile: {
        patch: './cordis.patch.yml',
        rowId: 'dsh-3d-director',
      },
    })
    // Contract ledger is ADD-only: both v1alpha1 contracts stay listed.
    expect(compatibility.contracts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'dsh.scene-3d.v1alpha1', status: 'preferred' }),
      expect.objectContaining({ id: 'dsh.scene-3d-context.v1alpha1', status: 'preferred' }),
    ]))
    expect(compatibility.contractDigest).toMatch(/^[0-9a-f]{64}$/u)
    expect(compatibility.pluginReleaseDigest).toMatch(/^[0-9a-f]{64}$/u)
  })
})
