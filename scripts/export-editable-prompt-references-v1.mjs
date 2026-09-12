#!/usr/bin/env node
/** Export only the Host files leased for editable prompt references. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const captured = resolve(root, 'temp/editable-prompt-references-v1-baseline')
const prerequisite = resolve(root, 'temp/editable-prompt-references-v1-upstream-baseline')
const host = resolve(root, 'temp/dsh-unified-host-source')
const delivery = resolve(root, 'upstream-prs/editable-prompt-references-v1')

const files = [
  ['captured', 'host/input-contract.ts', 'packages/client/ui-conversation/src/client/contract/input.ts'],
  ['captured', 'host/facade.ts', 'packages/client/ui-conversation/src/client/input/facade.ts'],
  ['captured', 'host/chip-node.tsx', 'packages/client/ui-conversation/src/client/input/editor/chip-node.tsx'],
  ['captured', 'host/ReferenceChip.tsx', 'packages/client/ui-conversation/src/client/input/editor/ReferenceChip.tsx'],
  ['captured', 'host/ReferenceChip.module.css', 'packages/client/ui-conversation/src/client/input/editor/ReferenceChip.module.css'],
  ['captured', 'host/conversation-apply.ts', 'packages/client/ui-conversation/src/client/apply.ts'],
  ['captured', 'host/InputBar.tsx', 'packages/client/ui-conversation/src/client/skeleton/InputBar.tsx'],
  ['captured', 'host/InputBar.module.css', 'packages/client/ui-conversation/src/client/skeleton/InputBar.module.css'],
  ['captured', 'host/locales.ts', 'packages/client/ui-conversation/src/client/locales.ts'],
  ['captured', 'host/reference-composer-multi.e2e.ts', 'apps/web/tests/reference-composer-multi.e2e.ts'],
  ['captured', 'session-controller/client-session-contract.ts', 'packages/api/session-controller/src/client/contract/session.ts'],
  ['captured', 'session-controller/client-session.ts', 'packages/api/session-controller/src/client/sessions/session.ts'],
  ['captured', 'session-controller/commands.ts', 'packages/api/session-controller/src/commands.ts'],
  ['captured', 'session-controller/remotes.ts', 'packages/api/session-controller/src/index.ts'],
  ['captured', 'session-controller/session-models.host.spec.ts', 'packages/api/session-controller/tests/session-models.host.spec.ts'],
  ['captured', 'session-controller/types.ts', 'packages/api/session-controller/src/types.ts'],
  ['captured', 'tests/input-reference-submit.client.spec.ts', 'packages/client/ui-conversation/tests/input-reference-submit.client.spec.ts'],
  ['captured', 'tests/reference-composer.spec.tsx', 'packages/client/ui-conversation/tests/reference-chip.client.spec.tsx'],
  ['prerequisite', 'packages/client/ui-conversation/src/client/input/editor/DecoratorPortals.tsx', 'packages/client/ui-conversation/src/client/input/editor/DecoratorPortals.tsx'],
  ['prerequisite', 'packages/client/ui-conversation/src/client/input/hub.ts', 'packages/client/ui-conversation/src/client/input/hub.ts'],
  ['prerequisite', 'packages/api/session-controller/tests/test-remote.ts', 'packages/api/session-controller/tests/test-remote.ts'],
  ['prerequisite', 'packages/context/session-reference/src/index.ts', 'packages/context/session-reference/src/index.ts'],
  ['prerequisite', 'packages/context/session-reference/tests/session-reference.spec.ts', 'packages/context/session-reference/tests/session-reference.spec.ts'],
]

const added = [
  'apps/web/tests/reference-composer-targets.e2e.ts',
  'packages/api/session-controller/tests/session-reference-grants.host.spec.ts',
  'packages/client/ui-conversation/src/client/input/editable-prompt-reference.ts',
  'packages/client/ui-conversation/src/client/input/editor/reference-chip-actions.ts',
  'packages/client/ui-conversation/tests/editable-prompt-reference-validation.client.spec.ts',
  'packages/client/ui-conversation/tests/reference-refresh-occurrence.client.spec.ts',
]

const chunks = []
const baselineHashes = []
// A previous reviewed packet is authoritative. Never silently replace its
// prerequisite hashes with a subsequently modified temporary checkout.
const expectedBaselines = new Map((await readFile(resolve(delivery, 'baseline.sha256'), 'utf8'))
  .trim().split('\n').map(line => {
    const separator = line.indexOf('  ')
    if (separator !== 64) throw new Error('Invalid reviewed baseline manifest')
    return [line.slice(separator + 2), line.slice(0, separator)]
  }))
for (const [source, saved, relative] of files) {
  const before = resolve(source === 'captured' ? captured : prerequisite, saved)
  const actual = createHash('sha256').update(await readFile(before)).digest('hex')
  if (expectedBaselines.get(relative) !== actual) {
    throw new Error(`Reviewed baseline mismatch: ${relative}; restore the exact prerequisite before exporting`)
  }
}
for (const [source, saved, relative] of files) {
  const before = resolve(source === 'captured' ? captured : prerequisite, saved)
  const after = resolve(host, relative)
  baselineHashes.push(`${createHash('sha256').update(await readFile(before)).digest('hex')}  ${relative}`)
  try {
    execFileSync('diff', ['-u', '--label', `a/${relative}`, '--label', `b/${relative}`, before, after], { encoding: 'utf8' })
  } catch (error) {
    if (error.status !== 1) throw error
    chunks.push(error.stdout)
  }
}
for (const relative of added) {
  const body = await readFile(resolve(host, relative), 'utf8')
  const lines = body.endsWith('\n') ? body.slice(0, -1).split('\n') : body.split('\n')
  chunks.push(`--- /dev/null\n+++ b/${relative}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(line => `+${line}\n`).join('')}`)
}

const hostFiles = [...files.map(([, , relative]) => relative), ...added]
await mkdir(delivery, { recursive: true })
await writeFile(resolve(delivery, 'changes.patch'), chunks.join(''))
await writeFile(resolve(delivery, 'host-files.txt'), `${hostFiles.join('\n')}\n`)
await writeFile(resolve(delivery, 'baseline.sha256'), `${baselineHashes.join('\n')}\n`)
await writeFile(resolve(delivery, 'apply.sh'), `#!/usr/bin/env bash
set -euo pipefail
packet_dir="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")" && pwd)"
target_dir="\${1:-.}"
(cd "$target_dir" && sha256sum -c "$packet_dir/baseline.sha256")
git -C "$target_dir" apply --check "$packet_dir/changes.patch"
git -C "$target_dir" apply "$packet_dir/changes.patch"
echo 'Editable prompt reference patch applied.'
`)
await writeFile(resolve(delivery, 'README.md'), '# Editable prompt references V1\n\nApply this additive Host patch after `upstream-prs/composer-multi-reference-v1` and the exact reviewed staging baseline recorded in `baseline.sha256`. It adds owner-authorized editable drafts, scoped refresh grants, private editor commands, exact insertion receipts, and the real target chooser acceptance test while retaining structured-reference V1 behavior.\n')
