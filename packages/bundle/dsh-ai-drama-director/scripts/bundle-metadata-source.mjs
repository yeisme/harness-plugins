import { createHash } from 'node:crypto'

export const BUNDLE_PACKAGE_NAME = '@yeisme/dsh-ai-drama-director'
export const BUNDLE_VERSION = '0.1.0-rc.1'
export const PROFILE_ROW = Object.freeze({
  id: 'dsh-ai-drama-director',
  name: BUNDLE_PACKAGE_NAME,
})

const PROFILE_CONFORMANCE_COMMAND = 'pnpm --dir packages/bundle/dsh-ai-drama-director run test:profile'
const LEGACY_CONTRACT = 'drama.workbench-handoff.v1'
const V2_CONTRACT = 'dsh.workbench_ai_drama_bridge.v2'

export function createDirectorBundleMetadata(fixtureManifest) {
  assertRecord(fixtureManifest, 'fixture manifest')
  if (fixtureManifest.contract !== V2_CONTRACT) {
    throw new Error(`fixture manifest contract must be ${V2_CONTRACT}`)
  }
  if (typeof fixtureManifest.fixtureVersion !== 'string' || fixtureManifest.fixtureVersion.length === 0) {
    throw new Error('fixture manifest must declare fixtureVersion')
  }

  const manifest = {
    name: BUNDLE_PACKAGE_NAME,
    version: BUNDLE_VERSION,
    description: 'DSH AI Drama Director bundle: /drama commands, Director preset, and the Workbench V2 bridge (legacy-compatible)',
    main: 'lib/index.mjs',
    scripts: {
      'generate:metadata': 'node scripts/generate-bundle-metadata.mjs',
      'check:metadata': 'node scripts/generate-bundle-metadata.mjs --check',
      test: 'pnpm run build && pnpm run smoke:bundle',
      'test:declaration': 'vitest run',
      'test:profile': 'node scripts/run-profile-conformance.mjs',
      'test:production': 'node scripts/run-production-conformance.mjs',
      typecheck: 'tsc -p tsconfig.json --noEmit',
      build: 'pnpm run check:metadata && tsc -p tsconfig.json && tsdown',
      bundle: 'tsdown',
      'smoke:bundle': 'node scripts/smoke-bundle.mjs',
    },
    keywords: ['dsh', 'drama', 'director', 'show', 'episode'],
    author: '',
    license: 'MIT',
    type: 'module',
    types: 'lib/types/index.d.ts',
    publishConfig: { access: 'public' },
    repository: {
      type: 'git',
      url: 'git+https://github.com/yeisme/harness-plugins.git',
      directory: 'packages/bundle/dsh-ai-drama-director',
    },
    files: [
      'lib/index.mjs',
      'lib/client.js',
      'lib/types/**/*.js',
      'lib/types/**/*.d.ts',
      'cordis.patch.yml',
      'dsh.compatibility.json',
      'README.md',
    ],
    exports: {
      '.': { types: './lib/index.d.mts', default: './lib/index.mjs' },
      './client': { types: './lib/types/client/index.d.ts', default: './lib/client.js' },
      './cordis.patch.yml': './cordis.patch.yml',
      './dsh.compatibility.json': './dsh.compatibility.json',
      './package.json': './package.json',
    },
    dsh: {
      bundle: { patch: './cordis.patch.yml' },
      client: {
        inject: ['@deepseek-ai/dsh-client-locale', '@deepseek-ai/dsh-client-runtime'],
        platform: 'web',
        immediately: true,
      },
    },
    dependencies: {
      '@yeisme/dsh-client-ui-ai-drama-director': 'workspace:*',
      '@yeisme/dsh-ai-drama-director': 'workspace:*',
    },
    peerDependencies: {
      '@deepseek-ai/cordis': '^4.0.1',
      '@deepseek-ai/dsh-client-runtime': '0.1.0-rc.6',
      '@deepseek-ai/dsh-client-ui-primitives': '0.1.0-rc.6',
    },
    devDependencies: {
      '@deepseek-ai/cordis': '^4.0.1',
      '@deepseek-ai/dsh-client-runtime': '0.1.0-rc.6',
      '@deepseek-ai/dsh-client-ui-primitives': '0.1.0-rc.6',
      jsdom: '^30.0.1',
      tsdown: '^0.22.14',
      typescript: '^5.9.3',
      vitest: '^3.2.7',
    },
  }

  const contracts = [
    {
      id: V2_CONTRACT,
      status: 'preferred',
      fixtureVersion: fixtureManifest.fixtureVersion,
    },
    {
      id: LEGACY_CONTRACT,
      status: 'legacy',
      compatibilityWindowReleases: 2,
      removalRequiresSeparateChange: true,
    },
  ]
  const contractDigest = sha256(canonicalJson(contracts))
  const profilePatch = renderProfilePatch(PROFILE_ROW)
  const compatibilityBase = {
    schemaVersion: 'yeisme.dsh-bundle-compatibility.v1',
    package: { name: BUNDLE_PACKAGE_NAME, version: BUNDLE_VERSION },
    dshHostCompatibility: {
      range: '>=0.1.0-rc.6 <0.2.0',
      strategy: 'capability_probe',
      requiredClientRuntime: '0.1.0-rc.6',
    },
    contributions: {
      hostPluginName: 'dsh-ai-drama-director',
      clientModuleLoaderId: BUNDLE_PACKAGE_NAME,
      clientExport: './client',
    },
    profile: {
      patch: './cordis.patch.yml',
      rowId: PROFILE_ROW.id,
      conformanceCommand: PROFILE_CONFORMANCE_COMMAND,
    },
    contracts,
    contractDigest,
  }
  const pluginReleaseDigest = sha256(canonicalJson({ manifest, profilePatch, compatibility: compatibilityBase }))
  const compatibility = { ...compatibilityBase, pluginReleaseDigest }

  return { manifest, profilePatch, compatibility }
}

export function renderMetadataFiles(fixtureManifest) {
  const metadata = createDirectorBundleMetadata(fixtureManifest)
  return new Map([
    ['package.json', `${JSON.stringify(metadata.manifest, null, 2)}\n`],
    ['cordis.patch.yml', metadata.profilePatch],
    ['dsh.compatibility.json', `${JSON.stringify(metadata.compatibility, null, 2)}\n`],
  ])
}

export function installProfileRow(profileRows, row = PROFILE_ROW) {
  const current = profileRows.find(entry => entry.id === row.id)
  if (current !== undefined) {
    if (current.name !== row.name) throw new Error(`profile row conflict for ${row.id}`)
    return [...profileRows]
  }
  return [...profileRows, { ...row }]
}

export function uninstallProfileRow(profileRows, rowId = PROFILE_ROW.id) {
  return profileRows.filter(entry => entry.id !== rowId)
}

function renderProfilePatch(row) {
  return [
    '# Generated by scripts/generate-bundle-metadata.mjs. Do not edit by hand.',
    '- insert:',
    `    - id: ${row.id}`,
    `      name: '${row.name}'`,
    '',
  ].join('\n')
}

function canonicalJson(value) {
  return JSON.stringify(sortValue(value))
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, sortValue(child)]))
  }
  return value
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function assertRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
}
