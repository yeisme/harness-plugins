import { describe, expect, it } from 'vitest'
import { listPersonalCodingPacks, resolvePersonalCodingPacks, type PluginCatalog } from '../src/index.js'

const catalog: PluginCatalog = {
  schemaVersion: 1,
  generator: 'fixture',
  generatedAt: '2026-09-02T00:00:00.000Z',
  bundleCount: 3,
  installableCount: 2,
  bundles: [
    { id: 'base-bundle', name: '@yeisme/base', description: '', path: 'packages/bundle/base-bundle', installable: true, preset: true, pluginDependencies: [], installRows: [], personalCoding: { packId: 'base', tier: 'base', critical: true, dependencies: [], criticalContributions: ['commands'], optionalContributions: [], sourcePath: 'packages/bundle/base-bundle' } },
    { id: 'browser-bundle', name: '@yeisme/browser', description: '', path: 'packages/bundle/browser-bundle', installable: true, preset: false, pluginDependencies: [], installRows: [], personalCoding: { packId: 'browser', tier: 'optional', critical: false, dependencies: ['base'], criticalContributions: [], optionalContributions: ['browser'], sourcePath: 'packages/bundle/browser-bundle' } },
    { id: 'broken-bundle', name: '@yeisme/broken', description: '', path: 'packages/bundle/broken-bundle', installable: false, preset: false, pluginDependencies: [], installRows: [], personalCoding: { packId: 'broken', tier: 'optional', critical: false, dependencies: [], criticalContributions: [], optionalContributions: ['broken'], sourcePath: 'packages/bundle/broken-bundle' } },
  ],
}

describe('personal coding pack resolution', () => {
  it('always includes base and de-duplicates explicit packs in stable order', () => {
    expect(resolvePersonalCodingPacks(catalog, ['browser', 'browser'])).toMatchObject({ ok: true, bundles: [{ id: 'base-bundle' }, { id: 'browser-bundle' }] })
    expect(listPersonalCodingPacks(catalog).map(entry => entry.personalCoding?.packId)).toEqual(['base', 'broken', 'browser'])
  })

  it('fails closed for unknown and uninstallable packs with available ids', () => {
    expect(resolvePersonalCodingPacks(catalog, ['missing'])).toEqual({ ok: false, code: 'pack.unknown', packId: 'missing', availableIds: ['base', 'browser'] })
    expect(resolvePersonalCodingPacks(catalog, ['broken'])).toEqual({ ok: false, code: 'pack.uninstallable', packId: 'broken', availableIds: ['base', 'browser'] })
  })

  it('requires declared pack dependencies in the selected set', () => {
    const withoutBase = { ...catalog, bundles: catalog.bundles.filter(entry => entry.id !== 'base-bundle') }
    expect(resolvePersonalCodingPacks(withoutBase, ['browser'])).toMatchObject({ ok: false, code: 'pack.missing_dependency', packId: 'browser' })
  })
})
