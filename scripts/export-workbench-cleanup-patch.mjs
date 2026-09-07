#!/usr/bin/env node
/** Export only the cleanup delta against a captured pre-change staging tree. */
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const baseline = process.argv[2]
if (!baseline) throw new Error('Usage: node scripts/export-workbench-cleanup-patch.mjs <pre-change-source-directory>')
const source = resolve(root, 'temp/dsh-unified-host-source')
const output = resolve(root, 'upstream-prs/workbench-runtime-cleanup')
const paths = [
  '.agents/notes/implemented/architecture/2026-09-05-unified-workspace-panes.md',
  'packages/client/ui-conversation/src/client/apply.ts',
  'packages/client/ui-conversation/src/client/reference-target-chooser.tsx',
  'packages/client/ui-conversation/src/client/reference-target-chooser.module.css',
  'packages/client/ui-conversation/src/client/locales.ts',
  'packages/client/ui-conversation/src/client/skeleton/ConversationRoot.tsx',
  'packages/client/ui-conversation/tests/apply-inject.client.spec.tsx',
  'apps/web/tests/reference-composer-multi.e2e.ts',
]
let patch = ''
for (const path of paths) {
  const before = resolve(baseline, path), after = resolve(source, path)
  await readFile(before); await readFile(after)
  const diff = spawnSync('git', ['diff', '--no-index', '--unified=0', '--', before, after], { encoding: 'utf8' })
  if (diff.status !== 0 && diff.status !== 1) throw new Error(`Unable to export ${path}`)
  patch += diff.stdout.replaceAll(before, `/${path}`).replaceAll(after, `/${path}`)
}
await mkdir(output, { recursive: true })
await writeFile(resolve(output, 'changes.patch'), patch)
console.log(`Exported cleanup delta for ${paths.length} files.`)
