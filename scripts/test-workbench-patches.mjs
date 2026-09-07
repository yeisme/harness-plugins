#!/usr/bin/env node
/** Prove that the checked-in patch chain reconstructs the cleaned workbench from its release base. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { WORKBENCH_BASE } from './workbench-runtime.mjs'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'temp/dsh-unified-host-source')
const runId = `workbench-patches-${new Date().toISOString().replace(/[:.]/g, '-')}`
const dir = resolve(root, 'temp/integration-test-runs', runId)
await mkdir(resolve(dir, 'artifacts'), { recursive: true })
const checkout = await mkdtemp(resolve(root, 'temp/workbench-patch-check-'))
const commands = []
let stdout = '', stderr = '', failure
function run(command, args, cwd = root) {
  commands.push([command, ...args].join(' '))
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  stdout += result.stdout ?? ''; stderr += result.stderr ?? ''
  assert.equal(result.status, 0, 'Patch chain command failed')
}
try {
  run('git', ['worktree', 'add', '--detach', checkout, WORKBENCH_BASE], source)
  for (const packet of ['unified-multi-pane-workbench', 'composer-multi-reference-v1', 'workbench-runtime-cleanup', 'pane-interaction-completion', 'pane-keyboard-cycle', 'pane-editor-shortcuts']) {
    run('bash', [`upstream-prs/${packet}/apply.sh`, checkout])
  }
  run('bash', ['upstream-prs/workbench-runtime-cleanup/apply.sh', checkout])
  run('bash', ['upstream-prs/pane-editor-shortcuts/apply.sh', checkout])
  const applied = await readFile(resolve(checkout, 'packages/client/ui-conversation/src/client/apply.ts'), 'utf8')
  assert(!applied.includes('createReferenceTargetControl'), 'Fresh reconstruction must omit Target registration')
  const renderer = await readFile(resolve(checkout, 'packages/client/ui-renderer/src/client/scoped-slots.tsx'), 'utf8')
  assert(renderer.includes('props.sessionId'), 'Fresh reconstruction must retain explicit session binding')
  for (const path of [
    'packages/client/ui-layout/src/client/keyboard.ts',
    'packages/client/ui-layout/src/client/Workbench.tsx',
    'packages/client/ui-layout/tests/keyboard.client.spec.ts',
    'packages/client/ui-layout/README.md',
    'packages/client/locale/src/locales/en.ts',
    'packages/client/locale/src/locales/zh.ts',
    '.agents/notes/implemented/architecture/2026-09-05-unified-workspace-panes.md',
    'packages/client/ui-conversation/src/client/apply.ts',
    'packages/client/ui-conversation/src/client/reference-target-chooser.tsx',
    'packages/client/ui-conversation/src/client/reference-target-chooser.module.css',
    'packages/client/ui-conversation/src/client/locales.ts',
    'packages/client/ui-conversation/src/client/skeleton/ConversationRoot.tsx',
    'packages/client/ui-conversation/tests/apply-inject.client.spec.tsx',
    'apps/web/tests/reference-composer-multi.e2e.ts',
  ]) assert.equal(await readFile(resolve(checkout, path), 'utf8'), await readFile(resolve(source, path), 'utf8'), `Reconstructed content differs: ${path}`)
} catch (error) { failure = error.message }
if (!failure) run('git', ['worktree', 'remove', '--force', checkout], source)
const redact = value => value.replaceAll(root, '[PROJECT_ROOT]')
await Promise.all([
  writeFile(resolve(dir, 'summary.json'), JSON.stringify({ status: failure ? 'failed' : 'passed', failure, checkout: relative(root, checkout), redacted: true })),
  writeFile(resolve(dir, 'command.txt'), redact(commands.join('\n'))),
  writeFile(resolve(dir, 'stdout.log'), redact(stdout)),
  writeFile(resolve(dir, 'stderr.log'), redact(stderr)),
  writeFile(resolve(dir, 'env.json'), JSON.stringify({ base: WORKBENCH_BASE, paidCalls: false, redacted: true })),
])
console.log(`${failure ? 'FAIL' : 'PASS'} Evidence: ${relative(root, dir)}`)
process.exitCode = failure ? 1 : 0
