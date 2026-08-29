import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderToolsInspectorTree, type ToolsInspectorTreeProps } from '../src/client/McpInspectorView.tsx'
import type { ToolActivitySnapshot } from '../src/client/activity.ts'
import type { ToolHubCatalogV1 } from '../src/client/wire.ts'

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT_ROOT = resolve(PACKAGE_ROOT, '../../..')
const EVIDENCE_ROOT = join(PROJECT_ROOT, 'temp/integration-test-runs')
const ACCEPTANCE_SOURCE_PATHS = [
  'package.json',
  'pnpm-lock.yaml',
  'packages/client/ui-mcp-inspector',
  'packages/host/dsh-tool-hub',
  'packages/bundle/dsh-mcp-inspector',
  'openspec/changes/dsh-tools-center-observability-v1',
] as const
export const REQUIRED_SCREENSHOTS = [
  '01-populated-desktop.png',
  '02-endpoint-error-activity.png',
  '03-partial-catalog.png',
  '04-running-error-timeline.png',
  '05-narrow-layout.png',
  '06-keyboard-focus.png',
  '07-reduced-motion.png',
] as const

type Decision = 'accept' | 'reject'

interface Summary {
  schema_version: 'yeisme.integration_test_evidence.v1'
  project: 'agent/harness-plugins'
  run_id: string
  layer: 'component'
  command: string
  status: 'passed' | 'failed'
  exit_code: number
  started_at: string
  finished_at: string
  duration_ms: number
  evidence: Record<string, string>
  redaction: { enabled: true; policy: string }
}

interface AcceptanceReceipt {
  schema_version: 'dsh.tools_center.human_acceptance.v1'
  change: string
  run_id: string
  decision: Decision
  reviewer_role: string
  reviewed_at: string
  commit: string
  source_digest: string
  screenshot_digests: Record<string, string>
  redaction: { enabled: true; policy: string }
}

function args(argv: readonly string[]): { command: string; flags: Map<string, string> } {
  const command = argv[0] ?? ''
  const flags = new Map<string, string>()
  for (let index = 1; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith('--') || value === undefined) throw new Error(`invalid argument near ${key ?? '<end>'}`)
    flags.set(key.slice(2), value)
  }
  return { command, flags }
}

function required(flags: Map<string, string>, key: string): string {
  const value = flags.get(key)
  if (value === undefined || value.length === 0) throw new Error(`--${key} is required`)
  return value
}

function safeId(value: string, label: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) throw new Error(`invalid ${label}`)
  return value
}

function gitCommit(projectRoot = PROJECT_ROOT): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim()
}

async function sourceDigest(projectRoot = PROJECT_ROOT): Promise<string> {
  const hash = createHash('sha256')
  hash.update(execFileSync('git', ['diff', '--binary', 'HEAD', '--', ...ACCEPTANCE_SOURCE_PATHS], { cwd: projectRoot }))
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z', '--', ...ACCEPTANCE_SOURCE_PATHS], { cwd: projectRoot })
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .sort()
  for (const path of untracked) {
    hash.update(`\0${path}\0`)
    hash.update(await readFile(join(projectRoot, path)))
  }
  return `sha256:${hash.digest('hex')}`
}

async function sha256(path: string): Promise<string> {
  return `sha256:${createHash('sha256').update(await readFile(path)).digest('hex')}`
}

function catalog(overrides: Partial<ToolHubCatalogV1> = {}): ToolHubCatalogV1 {
  return {
    ok: true,
    specVersion: '1.0',
    complete: true,
    generation: 7,
    skillsAvailable: true,
    toolsAvailable: true,
    mcpInventoryAvailable: true,
    observedAt: 120_000,
    healthAvailable: true,
    items: [
      { id: 'mcp:github', family: 'mcp', origin: 'mcp', name: 'github', label: 'mcp__github', description: 'Issues, pull requests and repository metadata', source: 'mcp-client', availability: 'available', enabled: true, canToggle: true, toolCount: 12, server: 'github', health: { state: 'connected', observedAt: 118_000 } },
      { id: 'mcp:web', family: 'mcp', origin: 'mcp', name: 'web', label: 'mcp__web', description: 'Web discovery tools', source: 'plugin-inventory', availability: 'disabled', enabled: false, canToggle: true, toolCount: 4, server: 'web', reasonCode: 'disabled_by_user', disabledReason: 'disabled by user preference', health: { state: 'syncing', observedAt: 30_000 } },
      { id: 'skill:writer', family: 'skill', origin: 'skill', name: 'writer', label: 'writer', description: 'Write and polish project documentation', source: 'user-dsh', availability: 'available', enabled: true, canToggle: true },
      { id: 'skill:legacy', family: 'skill', origin: 'skill', name: 'legacy', label: 'legacy', description: 'Not model-invocable', source: 'project', availability: 'unavailable', enabled: false, canToggle: false, reasonCode: 'not_model_invocable', disabledReason: 'not model-invocable' },
      { id: 'tool:read_file', family: 'native', origin: 'native', name: 'read_file', label: 'read_file', description: 'Read a workspace file', source: 'tools', availability: 'available', enabled: true, canToggle: true },
      { id: 'tool:shell', family: 'native', origin: 'native', name: 'shell', label: 'shell', description: 'Run an approved shell command', source: 'tools', availability: 'available', enabled: true, canToggle: true },
    ],
    ...overrides,
  }
}

const activity: ToolActivitySnapshot = {
  calls: 18,
  errors: 2,
  running: 1,
  records: [
    { itemId: 'mcp:github', family: 'mcp', server: 'github', tool: 'list_prs', time: 120_000, durationMs: null, isError: false, running: true, sequence: 8 },
    { itemId: 'tool:read_file', family: 'native', tool: 'read_file', time: 115_000, durationMs: 1_240, isError: false, running: false, sequence: 7 },
    { itemId: 'mcp:github', family: 'mcp', server: 'github', tool: 'create_issue', time: 112_000, durationMs: 4_200, isError: true, running: false, sequence: 6 },
    { itemId: 'tool:shell', family: 'native', tool: 'shell', time: 105_000, durationMs: 680, isError: false, running: false, sequence: 5 },
    { itemId: null, family: 'skill', tool: 'skill', time: 101_000, durationMs: 90, isError: false, running: false, sequence: 4 },
  ],
}

const noop = () => {}
function treeProps(overrides: Partial<ToolsInspectorTreeProps> = {}): ToolsInspectorTreeProps {
  return {
    catalogState: { status: 'ready', catalog: catalog() },
    query: '',
    family: 'all',
    enabled: 'all',
    activity,
    activeSection: 'catalog',
    activityMode: 'list',
    activityFilter: 'all',
    now: 125_000,
    canRefresh: true,
    onQueryChange: noop,
    onFamilyChange: noop,
    onEnabledChange: noop,
    onToggle: noop,
    onRefresh: noop,
    onClearFilters: noop,
    onSelectItem: noop,
    onActiveSectionChange: noop,
    onActivityModeChange: noop,
    onActivityFilterChange: noop,
    ...overrides,
  }
}

function html(props: ToolsInspectorTreeProps): string {
  // React escapes quotes inside a server-rendered <style> text node. Browsers
  // treat style as raw text, so decode those two entities for this local fixture.
  const markup = renderToStaticMarkup(renderToolsInspectorTree(props)).replaceAll('&#x27;', "'").replaceAll('&quot;', '"')
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;min-height:100%;background:#111113}body{padding:12px}.fixture{width:100%;min-height:780px}</style></head><body><main class="fixture">${markup}</main></body></html>`
}

async function writeJSON(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function screenshotDigests(runRoot: string): Promise<Record<string, string>> {
  const artifacts = join(runRoot, 'artifacts')
  return Object.fromEntries(await Promise.all(REQUIRED_SCREENSHOTS.map(async name => [name, await sha256(join(artifacts, name))])))
}

export async function recordAcceptanceRun(runRoot: string, input: { change: string; runId: string; decision: Decision; reviewerRole: string; commit: string; sourceDigest: string; reviewedAt?: string }): Promise<AcceptanceReceipt> {
  const summary = JSON.parse(await readFile(join(runRoot, 'summary.json'), 'utf8')) as Summary
  const environment = JSON.parse(await readFile(join(runRoot, 'env.json'), 'utf8')) as { source_digest?: string }
  if (summary.status !== 'passed') throw new Error('prepare summary is not passed')
  if (environment.source_digest !== input.sourceDigest) throw new Error('prepared source state is stale; run prepare again')
  const receipt: AcceptanceReceipt = {
    schema_version: 'dsh.tools_center.human_acceptance.v1',
    change: safeId(input.change, 'change'),
    run_id: safeId(input.runId, 'run id'),
    decision: input.decision,
    reviewer_role: safeId(input.reviewerRole, 'reviewer role'),
    reviewed_at: input.reviewedAt ?? new Date().toISOString(),
    commit: input.commit,
    source_digest: input.sourceDigest,
    screenshot_digests: await screenshotDigests(runRoot),
    redaction: { enabled: true, policy: 'no-secrets-no-prompts-no-private-tool-arguments' },
  }
  await writeJSON(join(runRoot, 'human-acceptance.json'), receipt)
  return receipt
}

export async function verifyAcceptanceRun(runRoot: string, currentCommit: string, currentSourceDigest: string): Promise<void> {
  const summary = JSON.parse(await readFile(join(runRoot, 'summary.json'), 'utf8')) as Summary
  const receipt = JSON.parse(await readFile(join(runRoot, 'human-acceptance.json'), 'utf8')) as AcceptanceReceipt
  if (summary.status !== 'passed' || summary.exit_code !== 0) throw new Error('prepare evidence did not pass')
  if (receipt.decision !== 'accept') throw new Error('human decision is not accept')
  if (receipt.commit !== currentCommit) throw new Error('acceptance receipt commit is stale')
  if (receipt.source_digest !== currentSourceDigest) throw new Error('acceptance receipt source state is stale')
  const current = await screenshotDigests(runRoot)
  for (const name of REQUIRED_SCREENSHOTS) {
    if (receipt.screenshot_digests[name] !== current[name]) throw new Error(`screenshot digest mismatch: ${name}`)
  }
}

async function prepare(change: string): Promise<string> {
  const started = Date.now()
  const preparedSourceDigest = await sourceDigest()
  const runId = `${new Date(started).toISOString().replace(/[-:.]/g, '').replace('Z', 'Z')}-${randomUUID().slice(0, 8)}`
  const runRoot = join(EVIDENCE_ROOT, runId)
  const artifacts = join(runRoot, 'artifacts')
  await mkdir(artifacts, { recursive: true })
  const command = `pnpm run ui:acceptance -- prepare --change ${change}`
  const stdout: string[] = []
  const stderr: string[] = []
  await writeFile(join(runRoot, 'command.txt'), `${command}\n`, 'utf8')
  await writeJSON(join(runRoot, 'env.json'), {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    change,
    commit: gitCommit(),
    source_digest: preparedSourceDigest,
    redaction: 'no-secrets-no-prompts-no-private-tool-arguments',
  })
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  let exitCode = 0
  try {
    browser = await chromium.launch({ headless: true })
    const scenarios: Array<{ name: typeof REQUIRED_SCREENSHOTS[number]; width: number; height: number; props: ToolsInspectorTreeProps; focus?: boolean; reduced?: boolean }> = [
      { name: REQUIRED_SCREENSHOTS[0], width: 1400, height: 900, props: treeProps() },
      { name: REQUIRED_SCREENSHOTS[1], width: 1400, height: 900, props: treeProps({ catalogState: { status: 'error', message: 'endpoint_not_found', code: 'endpoint_not_found' }, activeSection: 'activity' }) },
      { name: REQUIRED_SCREENSHOTS[2], width: 960, height: 900, props: treeProps({ catalogState: { status: 'ready', catalog: catalog({ complete: false, healthAvailable: false, items: catalog().items.map(item => ({ ...item, health: undefined })) as ToolHubCatalogV1['items'] }) } }) },
      { name: REQUIRED_SCREENSHOTS[3], width: 960, height: 900, props: treeProps({ activeSection: 'activity', activityMode: 'timeline' }) },
      { name: REQUIRED_SCREENSHOTS[4], width: 560, height: 900, props: treeProps() },
      { name: REQUIRED_SCREENSHOTS[5], width: 560, height: 900, props: treeProps(), focus: true },
      { name: REQUIRED_SCREENSHOTS[6], width: 960, height: 900, props: treeProps({ activeSection: 'activity', activityMode: 'timeline' }), reduced: true },
    ]
    for (const scenario of scenarios) {
      const page = await browser.newPage({ viewport: { width: scenario.width, height: scenario.height }, colorScheme: 'dark', reducedMotion: scenario.reduced ? 'reduce' : 'no-preference' })
      await page.setContent(html(scenario.props), { waitUntil: 'load' })
      if (scenario.focus) await page.locator('input[type="search"]').focus()
      await page.screenshot({ path: join(artifacts, scenario.name), fullPage: true })
      stdout.push(`screenshot=${scenario.name} width=${scenario.width}`)
      await page.close()
    }
    const boardCards = REQUIRED_SCREENSHOTS.map(name => `<figure><img src="artifacts/${name}" alt="${name}"><figcaption>${name}</figcaption></figure>`).join('')
    await writeFile(join(runRoot, 'board.html'), `<!doctype html><html><head><meta charset="utf-8"><title>DSH Tools acceptance</title><style>body{font:14px system-ui;background:#111;color:#eee;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:20px}figure{margin:0;padding:12px;background:#1d1d20;border:1px solid #333;border-radius:10px}img{display:block;width:100%;height:auto}figcaption{margin-top:8px;color:#aaa}</style></head><body><h1>DSH Tools human acceptance</h1><p>Review every required state, then run the record command. Automated checks do not approve this change.</p><main>${boardCards}</main></body></html>`, 'utf8')
    await writeJSON(join(runRoot, 'checklist.json'), {
      schema_version: 'dsh.tools_center.acceptance_checklist.v1',
      required: REQUIRED_SCREENSHOTS,
      checks: ['no-large-empty-gap', 'catalog-and-activity-hierarchy', 'safe-error-copy', 'enablement-health-distinction', 'narrow-layout', 'keyboard-focus', 'reduced-motion'],
    })
    if (await sourceDigest() !== preparedSourceDigest) throw new Error('source state changed while preparing acceptance evidence')
  } catch (error) {
    exitCode = 1
    stderr.push(error instanceof Error ? error.message : 'unknown prepare failure')
  } finally {
    await browser?.close()
    await writeFile(join(runRoot, 'stdout.log'), `${stdout.join('\n')}\n`, 'utf8')
    await writeFile(join(runRoot, 'stderr.log'), `${stderr.join('\n')}\n`, 'utf8')
    const finished = Date.now()
    const summary: Summary = {
      schema_version: 'yeisme.integration_test_evidence.v1',
      project: 'agent/harness-plugins',
      run_id: runId,
      layer: 'component',
      command,
      status: exitCode === 0 ? 'passed' : 'failed',
      exit_code: exitCode,
      started_at: new Date(started).toISOString(),
      finished_at: new Date(finished).toISOString(),
      duration_ms: finished - started,
      evidence: { command: 'command.txt', stdout: 'stdout.log', stderr: 'stderr.log', env: 'env.json', artifacts: 'artifacts/', board: 'board.html', checklist: 'checklist.json' },
      redaction: { enabled: true, policy: 'no-secrets-no-prompts-no-private-tool-arguments' },
    }
    await writeJSON(join(runRoot, 'summary.json'), summary)
  }
  if (exitCode !== 0) throw new Error(`prepare failed; evidence=${relative(PROJECT_ROOT, runRoot)}`)
  return runId
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  if (argv[0] === '--') argv.shift()
  const parsed = args(argv)
  if (parsed.command === 'prepare') {
    const change = safeId(required(parsed.flags, 'change'), 'change')
    const runId = await prepare(change)
    console.log(`run_id=${runId}`)
    console.log(`board=${relative(PROJECT_ROOT, join(EVIDENCE_ROOT, runId, 'board.html'))}`)
    console.log('status=awaiting_human_acceptance')
    return
  }
  const runId = safeId(required(parsed.flags, 'run-id'), 'run id')
  const runRoot = join(EVIDENCE_ROOT, runId)
  if (parsed.command === 'record') {
    const decision = required(parsed.flags, 'decision')
    if (decision !== 'accept' && decision !== 'reject') throw new Error('--decision must be accept or reject')
    await recordAcceptanceRun(runRoot, {
      change: safeId(parsed.flags.get('change') ?? 'dsh-tools-center-observability-v1', 'change'),
      runId,
      decision,
      reviewerRole: required(parsed.flags, 'reviewer-role'),
      commit: gitCommit(),
      sourceDigest: await sourceDigest(),
    })
    console.log(`decision=${decision}`)
    console.log(`receipt=${relative(PROJECT_ROOT, join(runRoot, 'human-acceptance.json'))}`)
    return
  }
  if (parsed.command === 'verify') {
    await verifyAcceptanceRun(runRoot, gitCommit(), await sourceDigest())
    console.log('status=accepted')
    console.log(`run_id=${runId}`)
    return
  }
  throw new Error('usage: pnpm run ui:acceptance -- prepare|record|verify [options]')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : 'unknown acceptance error')
    process.exitCode = 1
  })
}
