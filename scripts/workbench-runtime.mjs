/** The development CLI and browser components must come from one reviewed checkout. */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

export const WORKBENCH_BASE = 'a66e4702047846cdaa10c66c9d3df3951f5ea70d'

export function workbenchCommand(root, args) {
  return { command: process.execPath, args: [resolve(root, 'temp/dsh-unified-host-source/apps/cli/lib/bin.js'), ...args] }
}

export function checkWorkbenchRuntime(root) {
  const source = resolve(root, 'temp/dsh-unified-host-source')
  const prepare = 'Run pnpm dsh:workbench -- --rebuild --prepare-only.'
  let base
  try { base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() }
  catch { throw new Error(`Compatible workbench checkout is missing. ${prepare}`) }
  if (base !== WORKBENCH_BASE) throw new Error(`Workbench release base does not match. Preserve the checkout and prepare the supported release. ${prepare}`)
  const checks = [
    ['apps/cli/lib/bin.js', text => text.length > 0],
    ['apps/web/dist/index.html', text => text.length > 0],
    ['packages/client/ui-layout/lib/client.js', text => text.includes('workspace.unified.v1') && text.includes('workbenchShortcut')],
    ['packages/client/ui-renderer/lib/client.js', text => text.includes('props.sessionId') && text.includes('ExplicitScopeProvider')],
    ['packages/client/ui-workspace/lib/client.js', text => text.includes('data-workspace-session-id')],
    ['packages/client/ui-conversation/lib/client.js', text => !text.includes('data-composer-reference-target"') && !text.includes('data-composer-reference-target]') && text.includes('data-composer-reference-target-option')],
  ]
  for (const [path, valid] of checks) {
    let content
    try { content = readFileSync(resolve(source, path), 'utf8') }
    catch { throw new Error(`Workbench artifact is missing: ${path}. ${prepare}`) }
    if (!valid(content)) throw new Error(`Workbench artifact is incompatible: ${path}. ${prepare}`)
  }
  return source
}
