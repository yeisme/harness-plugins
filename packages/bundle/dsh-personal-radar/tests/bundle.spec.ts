import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const bundleRoot = resolve(__dirname, '..')
const manifest = JSON.parse(readFileSync(resolve(bundleRoot, 'package.json'), 'utf8'))
const compatibility = JSON.parse(readFileSync(resolve(bundleRoot, 'dsh.compatibility.json'), 'utf8'))

describe('personal radar bundle declaration', () => {
  it('declares the dsh.bundle.patch contract', () => {
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(manifest.exports?.['./cordis.patch.yml']).toBe('./cordis.patch.yml')
  })

  it('publishes the client ModuleLoader entry', () => {
    expect(manifest.exports?.['./client']).toEqual({ types: './lib/types/client/index.d.ts', default: './lib/client.js' })
    expect(compatibility.contributions?.clientModuleLoaderId).toBe('@yeisme/dsh-personal-radar')
    expect(compatibility.contributions?.clientExport).toBe('./client')
  })

  it('tracks the radar handoff contract with a stable digest', () => {
    expect(compatibility.contracts?.[0]?.id).toBe('radar.mcp.handoff.v1')
    expect(compatibility.contracts?.[0]?.status).toBe('preferred')
    expect(compatibility.contractDigest).toMatch(/^[0-9a-f]{64}$/)
    expect(compatibility.pluginReleaseDigest).toMatch(/^[0-9a-f]{64}$/)
  })

  it('declares capability-probe host compatibility', () => {
    expect(compatibility.dshHostCompatibility?.strategy).toBe('capability_probe')
    expect(compatibility.dshHostCompatibility?.range).toContain('0.1.0-rc.6')
  })

  it('keeps the profile row id and conformance command in sync', () => {
    expect(compatibility.profile?.rowId).toBe('dsh-personal-radar')
    expect(compatibility.profile?.conformanceCommand).toContain('dsh-personal-radar')
  })
})
