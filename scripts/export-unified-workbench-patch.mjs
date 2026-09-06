#!/usr/bin/env node
/** Export only this change's owned upstream paths; retain other staged work. */
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'temp/dsh-unified-host-source')
const output = resolve(root, 'upstream-prs/unified-multi-pane-workbench')
const base = 'a66e4702047846cdaa10c66c9d3df3951f5ea70d'
const changed = [
  'packages/api/session-controller/src/client/contract/sessions.ts',
  'packages/api/session-controller/src/client/sessions/service.ts',
  'packages/client/locale/src/locales/en.ts', 'packages/client/locale/src/locales/zh.ts',
  'packages/client/ui-layout/package.json', 'pnpm-lock.yaml',
  'packages/client/ui-layout/src/client/AppFrame.tsx', 'packages/client/ui-layout/src/client/index.ts',
  'packages/client/ui-layout/tests/apply.client.spec.ts',
  'packages/client/ui-renderer/src/client/bindings.tsx', 'packages/client/ui-renderer/src/client/scoped-slots.tsx',
  'packages/client/ui-renderer/tests/session-provider.client.spec.tsx', 'packages/client/ui-slots/src/index.ts',
  'packages/client/ui-sidebar/src/client/SidebarRoot.module.css', 'packages/client/ui-sidebar/src/client/SidebarRoot.tsx',
  'packages/client/ui-sidebar/src/client/contract/slots.ts', 'packages/client/ui-sidebar/src/client/index.ts', 'packages/client/ui-sidebar/src/client/locales.ts',
  'packages/client/ui-workspace/src/client/index.ts', 'packages/client/ui-workspace/src/client/rows/Rows.tsx', 'packages/client/ui-workspace/src/client/rows/WorkspaceBrowser.tsx',
  'packages/client/ui-workspace/src/client/locales.ts', 'packages/client/ui-workspace/src/client/rows/Rows.module.css',
  'packages/client/ui-workspace/tests/rows.client.spec.tsx',
  'packages/client/ui-conversation/src/client/contract/slots.ts', 'packages/client/ui-conversation/src/client/skeleton/ConversationRoot.tsx',
  'packages/client/ui-agent-preset/src/client/index.ts', 'packages/client/ui-agent-preset/src/client/AgentPresetSeat.tsx', 'packages/client/ui-agent-preset/tests/components.client.spec.tsx',
]
const added = [
  '.agents/notes/implemented/architecture/2026-09-05-unified-workspace-panes.md',
  'packages/client/ui-layout/src/client/Workbench.tsx', 'packages/client/ui-layout/src/client/Workbench.module.css',
  'packages/client/ui-layout/src/client/workspace-model.ts', 'packages/client/ui-layout/src/client/workspace-service.ts',
  'packages/client/ui-layout/tests/workspace-model.client.spec.ts',
  'packages/client/ui-layout/tests/adaptive-layout.client.spec.ts',
]
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim()
if (head !== base) throw new Error('Staging checkout is not the reviewed release base')
await mkdir(output, { recursive: true })
await writeFile(resolve(output, 'changes.patch'), execFileSync('git', ['diff', '--binary', base, '--', ...changed], { cwd: source, maxBuffer: 20 * 1024 * 1024 }))
for (const path of added) {
  const destination = resolve(output, 'new-files', path)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, await readFile(resolve(source, path)))
}
await writeFile(resolve(output, 'base.txt'), base + '\n')
console.log(`Exported ${changed.length} tracked paths and ${added.length} new files to upstream-prs/unified-multi-pane-workbench`)
