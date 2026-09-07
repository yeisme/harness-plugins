#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const beforeRoot = process.argv[2]
if (!beforeRoot) throw new Error('Usage: node scripts/export-pane-editor-shortcuts-patch.mjs <pre-change-source-directory>')
const source = resolve(root, 'temp/dsh-unified-host-source')
const output = resolve(root, 'upstream-prs/pane-editor-shortcuts')
const changed = ['packages/client/ui-layout/src/client/keyboard.ts', 'packages/client/ui-layout/src/client/Workbench.tsx', 'packages/client/ui-layout/tests/keyboard.client.spec.ts', 'packages/client/ui-layout/README.md', 'packages/client/locale/src/locales/en.ts', 'packages/client/locale/src/locales/zh.ts']
const added = []
let patch = ''
for (const path of changed) {
  const before = resolve(beforeRoot, path), after = resolve(source, path)
  await readFile(before); await readFile(after)
  const diff = spawnSync('git', ['diff', '--no-index', '--unified=0', '--', before, after], { encoding: 'utf8' })
  if (diff.status !== 0 && diff.status !== 1) throw new Error(`Unable to export ${path}`)
  patch += diff.stdout.replaceAll(before, `/${path}`).replaceAll(after, `/${path}`)
}
await mkdir(output, { recursive: true })
await writeFile(resolve(output, 'changes.patch'), patch)
for (const path of added) {
  const destination = resolve(output, 'new-files', path)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, await readFile(resolve(source, path)))
}
console.log('Exported six changed files for pane keyboard cycling.')
