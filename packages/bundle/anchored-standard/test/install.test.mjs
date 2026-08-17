import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { installBundledPresets } from '../installer.mjs'

const tempDirs = []

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'anchored-standard-'))
  tempDirs.push(dir)
  return dir
}

test('copies every bundled preset into the user preset root', async () => {
  const root = await makeTempDir()
  const presetRoot = join(root, '.agent-presets')
  const ctx = { logger: { info() {}, warn() {}, error() {} } }

  const installed = installBundledPresets(ctx, presetRoot).sort()

  assert.deepEqual(installed, ['anchored-standard', 'whoami-standard', 'zero-anchored-standard'])
  const dirs = await readdir(presetRoot)
  assert.ok(dirs.includes('anchored-standard'))
  assert.ok(dirs.includes('whoami-standard'))
  assert.ok(dirs.includes('zero-anchored-standard'))
  const files = await readdir(join(presetRoot, 'anchored-standard'))
  assert.ok(files.includes('agent.cordis.yml'))
})

test('does not overwrite an existing preset directory', async () => {
  const root = await makeTempDir()
  const presetRoot = join(root, '.agent-presets')
  const existing = join(presetRoot, 'anchored-standard')
  await mkdir(existing, { recursive: true })
  await writeFile(join(existing, 'keep.txt'), 'user edit')
  const ctx = { logger: { info() {}, warn() {}, error() {} } }

  const installed = installBundledPresets(ctx, presetRoot)

  assert.ok(!installed.includes('anchored-standard'))
  assert.equal(await readFile(join(existing, 'keep.txt'), 'utf8'), 'user edit')
})

test('rewrites shared module references to anchored-standard', async () => {
  const root = await makeTempDir()
  const presetRoot = join(root, '.agent-presets')
  const ctx = { logger: { info() {}, warn() {}, error() {} } }
  installBundledPresets(ctx, presetRoot)

  const zero = await readFile(join(presetRoot, 'zero-anchored-standard', 'agent.cordis.yml'), 'utf8')
  assert.match(zero, /\.\.\/anchored-standard\//)
  assert.doesNotMatch(zero, /\.\.\/preset\//)
})

test('cleanup temp dirs', async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})
