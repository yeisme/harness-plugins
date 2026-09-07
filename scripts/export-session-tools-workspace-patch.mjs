#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile, mkdtemp, cp, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'

const root = resolve(import.meta.dirname, '..')
const beforeRoot = process.argv[2]
if (!beforeRoot) throw new Error('Usage: node scripts/export-session-tools-workspace-patch.mjs <pre-change-source-directory>')
const source = resolve(root, 'temp/dsh-unified-host-source')
const output = resolve(root, 'upstream-prs/session-tools-workspace')
const changed = ['packages/client/modules/src/index.ts', 'packages/client/modules/tests/node-half.client.spec.ts', 'packages/api/session-controller/src/skill-catalog.ts', 'packages/api/session-controller/src/types.ts', 'packages/api/session-controller/tests/session-skills.host.spec.ts', 'packages/client/locale/src/locales/en.ts', 'packages/client/locale/src/locales/zh.ts', 'packages/client/ui-chat/src/client/chat/ChatView.tsx', 'packages/client/ui-chat/src/client/locale.ts', 'packages/client/ui-conversation/src/client/apply.ts', 'packages/client/ui-conversation/src/client/contract/slots.ts', 'packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css', 'packages/client/ui-conversation/src/client/skeleton/ConversationSession.tsx', 'packages/client/ui-layout/README.md', 'packages/client/ui-layout/src/client/Workbench.tsx', 'packages/client/ui-layout/src/client/index.ts', 'packages/client/ui-layout/tests/adaptive-layout.client.spec.ts', 'packages/client/ui-layout/tests/app-frame.client.spec.tsx', 'packages/client/ui-settings-general/src/client/SettingsRoot.tsx', 'packages/client/ui-settings-general/src/client/index.ts', 'packages/client/ui-settings-general/src/client/shell-contract.ts']
const added = ['packages/client/ui-layout/tests/session-tools-title.client.spec.tsx', 'packages/client/ui-conversation/src/client/conversation/navigation.ts', 'packages/client/ui-conversation/tests/session-navigation.client.spec.ts']
let patch = ''
for (const path of changed) {
  const before = resolve(beforeRoot, path), after = resolve(source, path)
  await readFile(before); await readFile(after)
  const diff = spawnSync('git', ['diff', '--no-index', '--unified=0', '--', before, after], { encoding: 'utf8' })
  if (diff.status !== 0 && diff.status !== 1) throw new Error(`Unable to export ${path}`)
  let delta = diff.stdout.replaceAll(before, `/${path}`).replaceAll(after, `/${path}`)
  // These two files have another active writer. Export only this change's
  // independently reviewed additions, never that writer's unrelated hunks.
  const shared = {
    'packages/api/session-controller/src/types.ts': /includeModelInvocable|catalogComplete/,
    'packages/client/ui-conversation/src/client/apply.ts': /ConversationNavigation|const navigation =|bindViewNavigation/,
  }[path]
  if (shared && delta) {
    const pieces = delta.split(/(?=^@@ )/m)
    delta = pieces[0] + pieces.slice(1).filter(hunk => shared.test(hunk.split('\n').filter(line => line.startsWith('+')).join('\n'))).join('')
  }
  patch += delta
}
await mkdir(output, { recursive: true })
await writeFile(resolve(output, 'changes.patch'), patch)
for (const path of added) {
  const destination = resolve(output, 'new-files', path)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, await readFile(resolve(source, path)))
}
const reviewed = await mkdtemp(resolve(tmpdir(), 'dsh-tools-reviewed-'))
try {
  await cp(resolve(beforeRoot), reviewed, {recursive:true})
  const applied = spawnSync('git', ['apply', '--unidiff-zero', '--unsafe-paths', '-'], {cwd:reviewed,input:patch,encoding:'utf8'})
  if (applied.status !== 0) throw new Error(`Reviewed source reconstruction failed: ${applied.stderr}`)
  const hashes=[]
  for (const path of [...changed, ...added]) {
    const bytes=await readFile(resolve(added.includes(path) ? source : reviewed,path))
    hashes.push(`${createHash('sha256').update(bytes).digest('hex')}  ${path}`)
  }
  await writeFile(resolve(output,'owned-source.sha256'),hashes.join('\n')+'\n')
} finally { await rm(reviewed,{recursive:true,force:true}) }
console.log('Exported reviewed Session Tools host hunks and source checksums.')
