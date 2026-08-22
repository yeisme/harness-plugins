import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('bundle patch inserts one agent-context row', () => {
  const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
  assert.match(patch, /id: pane-agent-context/)
  assert.match(patch, /@yeisme\/dsh-pane-agent-context/)
  assert.doesNotMatch(patch, /dsh-better-sidebar/)
})

test('package.json points dsh.bundle.patch at the yaml file', async () => {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  const plugin = await import('../index.mjs')
  assert.equal(plugin.name, 'pane-agent-context')
  assert.deepEqual(plugin.inject, [])
})
