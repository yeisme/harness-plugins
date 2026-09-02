import { readFile } from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(resolve(packageDir, 'package.json'), 'utf8'))
const patch = await readFile(resolve(packageDir, 'cordis.patch.yml'), 'utf8')

test('base composition is stable, minimal and duplicate-free', () => {
  const members = [...patch.matchAll(/^#   (\S+) (\S+)$/gm)].map(match => [match[1], match[2]])
  assert.deepEqual(members, [
    ['dsh-command-experience', '@yeisme/dsh-command-experience'],
    ['dsh-workbench-core', '@yeisme/dsh-workbench-core'],
    ['dsh-desktop-workbench', '@yeisme/dsh-desktop-workbench'],
    ['dsh-semantic-file-editor', '@yeisme/dsh-semantic-file-editor'],
    ['dsh-terminal', '@yeisme/dsh-terminal/host'],
    ['dsh-devtools', '@yeisme/dsh-devtools'],
    ['ordo-agent-ops', '@yeisme/dsh-ordo-agent-ops'],
  ])
  assert.deepEqual([...patch.matchAll(/^\s*- id:\s*(.+)$/gm)].map(match => match[1]?.trim()), ['dsh-personal-coding-base'])
  assert.equal(members.some(([id]) => /creator|drama|domain|radar/.test(id)), false)
})

test('base metadata separates critical and optional contributions', () => {
  assert.equal(manifest.dsh.personalCoding.packId, 'base')
  assert.equal(manifest.dsh.personalCoding.tier, 'base')
  assert.equal(manifest.dsh.personalCoding.critical, true)
  assert.deepEqual(manifest.dsh.personalCoding.optionalContributions, ['ordo-agent-ops'])
  assert.equal(manifest.dsh.personalCoding.criticalContributions.includes('dsh-terminal'), true)
})
