import { createHash } from 'node:crypto'

export const BUNDLE_PACKAGE_NAME = '@yeisme/dsh-3d-director'
export const BUNDLE_VERSION = '0.1.0-rc.1'
export const PROFILE_ROW = Object.freeze({
  id: 'dsh-3d-director',
  name: BUNDLE_PACKAGE_NAME,
})

const CONFORMANCE_COMMAND = 'pnpm --dir packages/bundle/dsh-3d-director run test'

// Contract ledger is ADD-only: new entries append, existing entries are never
// renamed, retyped, or removed inside this source.
const SCENE_CONTRACT = 'dsh.scene-3d.v1alpha1'
const CONTEXT_CONTRACT = 'dsh.scene-3d-context.v1alpha1'

export function create3DDirectorBundleMetadata() {
  const manifest = {
    name: BUNDLE_PACKAGE_NAME,
    version: BUNDLE_VERSION,
    description: 'DSH 3D Director bundle: scene graph gateway (scene3dDirector) plus the Shot-anchored 3D viewport client face',
    main: 'lib/index.mjs',
    scripts: {
      'generate:metadata': 'node scripts/generate-bundle-metadata.mjs',
      'check:metadata': 'node scripts/generate-bundle-metadata.mjs --check',
      test: 'pnpm run build && pnpm run smoke:bundle',
      'test:declaration': 'vitest run',
      typecheck: 'tsc -p tsconfig.json --noEmit',
      build: 'pnpm run check:metadata && tsc -p tsconfig.json && tsdown',
      bundle: 'tsdown',
      'smoke:bundle': 'node scripts/smoke-bundle.mjs',
    },
    keywords: ['dsh', '3d', 'director', 'gltf', 'glb', 'shot'],
    author: '',
    license: 'MIT',
    type: 'module',
    types: 'lib/types/index.d.ts',
    publishConfig: { access: 'public' },
    repository: {
      type: 'git',
      url: 'git+https://github.com/yeisme/harness-plugins.git',
      directory: 'packages/bundle/dsh-3d-director',
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
      '@yeisme/dsh-3d-director-host': 'workspace:*',
      '@yeisme/dsh-client-ui-3d-director': 'workspace:*',
    },
    peerDependencies: {
      '@deepseek-ai/cordis': '^4.0.1',
      '@deepseek-ai/dsh-client-runtime': '0.1.0-rc.6',
      '@deepseek-ai/dsh-client-ui-primitives': '0.1.0-rc.6',
      '@deepseek-ai/dsh-typert-protocol': '^0.1.0-rc.6',
    },
    devDependencies: {
      // Pinned exactly like the host pack: a split cordis copy breaks the
      // Context identity the gateway constructor is typed against.
      '@deepseek-ai/cordis': '4.0.1',
      '@deepseek-ai/dsh-client-runtime': '0.1.0-rc.6',
      '@deepseek-ai/dsh-client-ui-primitives': '0.1.0-rc.6',
      '@deepseek-ai/dsh-typert-protocol': '^0.1.0-rc.6',
      jsdom: '^30.0.1',
      tsdown: '^0.22.14',
      typescript: '^5.9.3',
      vitest: '^3.2.7',
    },
  }

  const contracts = [
    { id: SCENE_CONTRACT, status: 'preferred' },
    { id: CONTEXT_CONTRACT, status: 'preferred' },
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
      hostPluginName: 'dsh-3d-director',
      clientModuleLoaderId: BUNDLE_PACKAGE_NAME,
      clientExport: './client',
    },
    profile: {
      patch: './cordis.patch.yml',
      rowId: PROFILE_ROW.id,
      conformanceCommand: CONFORMANCE_COMMAND,
    },
    contracts,
    contractDigest,
  }
  const pluginReleaseDigest = sha256(canonicalJson({ manifest, profilePatch, compatibility: compatibilityBase }))
  const compatibility = { ...compatibilityBase, pluginReleaseDigest }

  return { manifest, profilePatch, compatibility }
}

export function renderMetadataFiles() {
  const metadata = create3DDirectorBundleMetadata()
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
