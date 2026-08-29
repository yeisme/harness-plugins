import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  classifyChangedPath,
  createHmrPatch,
  declaredRuntimeArtifacts,
  dependencyClosure,
  dependentClosure,
  discoverWorkspacePackages,
  isBundleManifest,
  parseDevArgs,
  resolveExternalBundles,
  workspaceBundles,
} from './dsh-dev.mjs'

async function writePackage(root, family, dirName, manifest, files = {}) {
  const dir = join(root, 'packages', family, dirName)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  for (const [name, content] of Object.entries(files)) {
    const filename = join(dir, name)
    await mkdir(join(filename, '..'), { recursive: true })
    await writeFile(filename, content)
  }
  return dir
}

test('parseDevArgs keeps dev flags separate from DSH web arguments', () => {
  assert.deepEqual(parseDevArgs([
    '--profile', 'web-dev',
    '--plugin', '../one',
    '--plugin', '../two',
    '--skip-install',
    '--no-open', '--port', '8080',
  ]), {
    profile: 'web-dev',
    plugins: ['../one', '../two'],
    check: false,
    prepareOnly: false,
    skipBuild: false,
    skipInstall: true,
    help: false,
    appArgs: ['--no-open', '--port', '8080'],
  })
  assert.throws(() => parseDevArgs(['--check', '--prepare-only']), /mutually exclusive/)
  assert.throws(() => parseDevArgs(['--plugin']), /requires a value/)
  assert.equal(parseDevArgs(['--', '--check']).check, true)
})

test('workspace discovery finds bundles and builds dependency/dependent closures', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-dev-workspace-'))
  try {
    await writePackage(root, 'host', 'shared', { name: '@test/shared', version: '0.0.0', scripts: { build: 'true' } })
    await writePackage(root, 'client', 'ui', { name: '@test/ui', version: '0.0.0', dependencies: { '@test/shared': 'workspace:*' }, scripts: { build: 'true' } })
    await writePackage(root, 'bundle', 'demo', {
      name: '@test/demo',
      version: '0.0.0',
      dependencies: { '@test/ui': 'workspace:*' },
      dsh: { bundle: { patch: './cordis.patch.yml' } },
      scripts: { build: 'true' },
    }, { 'cordis.patch.yml': '[]\n' })
    const packages = await discoverWorkspacePackages(root)
    assert.deepEqual(workspaceBundles(packages).map(pkg => pkg.name), ['@test/demo'])
    const demoId = workspaceBundles(packages)[0].id
    const sharedId = [...packages.values()].find(pkg => pkg.name === '@test/shared').id
    assert.deepEqual([...dependencyClosure(packages, [demoId])].map(id => packages.get(id).name).sort(), ['@test/demo', '@test/shared', '@test/ui'])
    assert.deepEqual([...dependentClosure(packages, [sharedId])].map(id => packages.get(id).name).sort(), ['@test/demo', '@test/shared', '@test/ui'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('external plugin validation accepts only bundle packages and rejects workspace name collisions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-dev-external-'))
  try {
    const bundleDir = join(root, 'bundle')
    await mkdir(bundleDir)
    await writeFile(join(bundleDir, 'package.json'), JSON.stringify({ name: '@test/external', dsh: { bundle: { patch: './cordis.patch.yml' } } }))
    const bundles = await resolveExternalBundles(['./bundle'], root, new Map())
    assert.equal(bundles[0].name, '@test/external')
    await assert.rejects(resolveExternalBundles(['./bundle'], root, new Map([['packages/bundle/external', { name: '@test/external' }]])), /already exists/)
    await writeFile(join(bundleDir, 'package.json'), JSON.stringify({ name: '@test/plain' }))
    await assert.rejects(resolveExternalBundles(['./bundle'], root, new Map()), /declares no dsh.bundle.patch/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('HMR patch watches runtime roots and ignores build-loop noise', () => {
  const patch = createHmrPatch(
    '/workspace/project',
    [{ dir: '/plugins/example', manifest: {} }],
    new Map([['demo', { dir: '/workspace/project/packages/bundle/demo', manifest: {} }]]),
  )
  assert.equal(patch[0].id, 'hmr')
  assert.equal(patch[0].config.followSymlinks, false)
  assert.ok(patch[0].config.root.includes('/workspace/project/packages/bundle/demo'))
  assert.ok(patch[0].config.root.includes('/plugins/example'))
  assert.equal(patch[0].config.root.includes('/workspace/project'), false)
  assert.ok(patch[0].config.ignored.includes('**/temp/**'))
})

test('change classification separates source, config and ignored output', () => {
  assert.equal(classifyChangedPath('bundle/demo/src/index.ts'), 'source')
  assert.equal(classifyChangedPath('bundle/demo/cordis.patch.yml'), 'config')
  assert.equal(classifyChangedPath('bundle/demo/package.json'), 'config')
  assert.equal(classifyChangedPath('bundle/demo/lib/index.js'), 'ignore')
  assert.equal(classifyChangedPath('bundle/demo/tests/index.spec.ts'), 'ignore')
  assert.equal(classifyChangedPath('bundle/demo/README.md'), 'ignore')
})

test('runtime artifact discovery follows package entry contracts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-dev-runtime-'))
  try {
    await mkdir(join(root, 'lib'), { recursive: true })
    await writeFile(join(root, 'lib', 'index.mjs'), 'export default {}\n')
    await writeFile(join(root, 'lib', 'client.cjs'), 'module.exports = {}\n')
    const artifacts = declaredRuntimeArtifacts({
      dir: root,
      manifest: {
        main: './lib/index.mjs',
        exports: { './client': { default: './lib/client.cjs', types: './lib/client.d.ts' } },
      },
    })
    assert.deepEqual(artifacts.sort(), [join(root, 'lib', 'client.cjs'), join(root, 'lib', 'index.mjs')].sort())
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('bundle declaration is additive and explicit', () => {
  assert.equal(isBundleManifest({ dsh: { bundle: { patch: './cordis.patch.yml' } } }), true)
  assert.equal(isBundleManifest({ dsh: { bundle: { patch: '' } } }), false)
  assert.equal(isBundleManifest({}), false)
})
