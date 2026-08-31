import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import process from 'node:process'

const root = resolve(import.meta.dirname, '..')
const allowPending = process.argv.includes('--allow-pending')

/** @type {Record<string, 'adopted'|'embed'|'excluded'|'pending'>} */
const clientCatalog = {
  'ui-agent-preset': 'adopted',
  'ui-browser-pane': 'excluded', // pure view-model/state logic; React rendering lands with the live factory slice
  'ui-ai-drama-director': 'adopted',
  'ui-command-experience-tui': 'excluded',
  'ui-command-experience-web': 'adopted',
  'ui-conversation-rewrite': 'adopted',
  'ui-creator-studio': 'adopted',
  'ui-interaction-space': 'pending', // neighbor lane: adopting shared Surface/token contract
  'ui-desktop-workbench': 'adopted',
  'ui-devtools': 'adopted',
  'ui-mcp-inspector': 'adopted',
  'ui-mermaid-render': 'embed',
  'ui-next-step-suggestions': 'adopted',
  'ui-ordo-agent-ops': 'adopted',
  'ui-pane-agent-context': 'adopted',
  'ui-pane-domain': 'adopted',
  'ui-pane-side-chat': 'pending', // neighbor lane: adopting shared Surface/token contract
  'ui-pane-subagent': 'adopted',
  'ui-pane-workbench': 'adopted',
  'ui-personal-radar': 'pending', // neighbor lane: adopting shared Surface/token contract
  'ui-semantic-file-editor': 'adopted',
  'ui-session-cookie-manager': 'adopted',
  'ui-selection-annotation': 'pending', // neighbor lane: adopting shared Surface/token contract
  'ui-session-tags': 'adopted',
  'ui-structured-content': 'embed',
  'ui-surface': 'adopted',
  'ui-token-usage': 'adopted',
  'ui-visual-kit': 'excluded',
}

/** @type {Record<string, 'adopted'|'embed'|'excluded'|'pending'>} */
const bundleCatalog = {
  'dsh-desktop-workbench': 'adopted',
  'dsh-file-document': 'adopted',
  'dsh-rich-media': 'embed',
  'dsh-terminal': 'adopted',
  'dsh-workbench-compose': 'adopted',
  'dsh-workbench-core': 'adopted',
  'ordo-agent-ops': 'adopted',
}

const delegatedSurfaceOwners = new Map([
  ['client/ui-ordo-agent-ops', '@yeisme/dsh-ordo-agent-ops/client-runtime'],
])

// Dynamic geometry only. Add a file here with a short reason when static CSS
// cannot express measured position, virtualization, drag, or progress output.
const dynamicStyleAllowlist = new Map([
  ['packages/client/ui-pane-workbench/src/drag-visuals.tsx', 'pointer and measured drag geometry'],
  ['packages/client/ui-pane-workbench/src/explorer/tree-ui.tsx', 'virtual tree height, offset and depth indentation'],
  ['packages/client/ui-pane-workbench/src/git/source-control.tsx', 'virtual list height and offset'],
  ['packages/client/ui-pane-workbench/src/management-center.tsx', 'virtual pane-management list height and offset'],
  ['packages/client/ui-pane-workbench/src/official-host.ts', 'measured tab insertion marker geometry'],
  ['packages/client/ui-pane-workbench/src/region-chrome.ts', 'split ratio and drag position'],
  ['packages/client/ui-pane-workbench/src/chrome/group-chrome.tsx', 'measured drop-target marker and menu geometry'],
  ['packages/client/ui-pane-workbench/src/chrome/split-tree.tsx', 'split ratio flex and virtual row translate geometry'],
  ['packages/client/ui-ai-drama-director/src/client/show-control-views.tsx', 'measured show-control timeline and pane geometry'],
  ['packages/client/ui-creator-studio/src/projection-components.tsx', 'measured storyboard grid and progress geometry'],
  ['packages/client/ui-desktop-workbench/src/client/docx-preview.tsx', 'measured document preview container geometry'],
  ['packages/client/ui-creator-studio/src/views.tsx', 'progress and waveform values'],
  ['packages/client/ui-pane-subagent/src/view.ts', 'tree depth indentation'],
  ['packages/client/ui-mcp-inspector/src/client/McpInspectorView.tsx', 'coverage proportions and activity timeline geometry'],
  ['packages/bundle/dsh-file-document/src/client/file-document-panel.tsx', 'tree depth indentation and owner-authorized preview media sizing'],
  ['packages/client/ui-desktop-workbench/src/client/git-pane.tsx', 'diff and measured workbench state'],
  ['packages/bundle/dsh-rich-media/src/client/media-library.tsx', 'virtual media row geometry'],
])

function sourceFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

function discoveredClientPackages() {
  const base = resolve(root, 'packages/client')
  return readdirSync(base).filter(name => name.startsWith('ui-') && statSync(resolve(base, name)).isDirectory()).sort()
}

function discoveredBundleSurfaces() {
  const base = resolve(root, 'packages/bundle')
  return readdirSync(base).filter(name => {
    const src = resolve(base, name, 'src')
    return sourceFiles(src).some(file => file.endsWith('.tsx'))
  }).sort()
}

const errors = []
const notes = []

function checkCatalog(label, discovered, catalog) {
  for (const name of discovered) if (catalog[name] === undefined) errors.push(`${label}/${name}: unclassified Web surface package`)
  for (const name of Object.keys(catalog)) if (!discovered.includes(name)) errors.push(`${label}/${name}: catalog entry has no matching package`)
}

checkCatalog('client', discoveredClientPackages(), clientCatalog)
checkCatalog('bundle', discoveredBundleSurfaces(), bundleCatalog)

function checkPackage(base, name, classification) {
  const dir = resolve(root, 'packages', base, name)
  const files = sourceFiles(resolve(dir, 'src'))
  if (classification === 'pending') {
    notes.push(`${base}/${name}: pending migration`)
    if (!allowPending) errors.push(`${base}/${name}: pending surface migration`)
    return
  }
  if (classification === 'excluded') {
    notes.push(`${base}/${name}: excluded from React/Web composition`)
    return
  }
  const combined = files.map(file => readFileSync(file, 'utf8')).join('\n')
  if (classification === 'embed') {
    if (!combined.includes('--vk-') && !combined.includes('@yeisme/dsh-client-ui-visual-kit') && !combined.includes('@yeisme/dsh-client-ui-surface')) errors.push(`${base}/${name}: embedded renderer does not consume shared visual tokens`)
    return
  }
  const delegatedOwner = delegatedSurfaceOwners.get(`${base}/${name}`)
  if (name !== 'ui-surface' && !combined.includes('@yeisme/dsh-client-ui-surface') && !combined.includes('data-yeisme-surface') && (delegatedOwner === undefined || !combined.includes(delegatedOwner))) {
    errors.push(`${base}/${name}: adopted package has no shared Surface root/import`)
  }
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const rel = relative(root, file)
    if (/var\(--dsw-alias-[^,]+,[^)]+\)/u.test(text)) errors.push(`${rel}: contains a package-local --dsw-alias fallback`)
    const hasRawFormControl = /<(?:select|textarea)\b|createElement\(['"](?:select|textarea)['"]/u.test(text)
    if (hasRawFormControl && !text.includes('ys-field')) errors.push(`${rel}: raw select/textarea is not inside the shared ys-field contract`)
    const hasInlineStyle = /\bstyle\s*=\s*\{\{|\bstyle\s*:\s*\{/u.test(text)
    if (hasInlineStyle && !dynamicStyleAllowlist.has(rel)) errors.push(`${rel}: inline layout/style is not in the dynamic geometry allowlist`)
  }
}

for (const [name, classification] of Object.entries(clientCatalog)) checkPackage('client', name, classification)
for (const [name, classification] of Object.entries(bundleCatalog)) checkPackage('bundle', name, classification)

for (const [file, reason] of dynamicStyleAllowlist) {
  if (!existsSync(resolve(root, file))) errors.push(`${file}: dynamic style allowlist target is missing (${reason})`)
}

if (errors.length > 0) {
  process.stderr.write(`Web surface conformance failed (${errors.length}):\n${errors.map(error => `- ${error}`).join('\n')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`Web surface conformance passed (${Object.keys(clientCatalog).length} client, ${Object.keys(bundleCatalog).length} bundle packages).\n`)
}

if (notes.length > 0) process.stdout.write(`${notes.join('\n')}\n`)
