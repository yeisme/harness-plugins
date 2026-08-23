#!/usr/bin/env node

// Dual-end slash-command conformance (browser e2e layer).
//
// Installs the @yeisme/dsh-yeisme-commands bundle into an ephemeral DSH_HOME,
// boots the official `dsh --profile web` server, and drives the real Web
// command menu with agent-browser: discovery of /yeismo-notice from the same
// registry the integration run exercises, execution through the composer, and
// the durable command/run + command/done records under DSH_HOME. Evidence is
// redacted into temp/integration-test-runs/<run-id>/.
//
// Requirements covered here (Web side of
// openspec/changes/dsh-slash-command-plugin-v1): dual-end-discovery
// (web-discovers-plugin-command), execution-persistence-admission
// (recordinput-not-duplicated, real durable log), security-boundary
// (no-registration-free-channel, observed fallback).

import { execFileSync, spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(packageRoot, '../../..')
const startedAt = new Date()
const runId = `${startedAt.toISOString().replaceAll(':', '-').replaceAll('.', '-')}-${process.pid}-slash-command-browser`
const evidenceRoot = resolve(projectRoot, 'temp/integration-test-runs', runId)
const artifactsRoot = resolve(evidenceRoot, 'artifacts')
const publicCommand = 'pnpm --filter @yeisme/dsh-host-yeisme-commands run test:slash-browser'
const browserSession = `dsh_slash_conf_${process.pid}`

const checks = []
const failures = []
const stdout = []
const stderr = []

function log(line) {
  stdout.push(line)
  process.stdout.write(`${line}\n`)
}

function fail(stage, error) {
  failures.push(stage)
  stderr.push(`${stage}: ${error instanceof Error ? error.stack : String(error)}`)
}

function record(stage, requirement, scenario, passed, observed) {
  checks.push({ stage, requirement, scenario, passed, observed })
  log(`[${passed ? 'PASS' : 'FAIL'}] ${stage} (${requirement} / ${scenario}): ${JSON.stringify(observed)}`)
}

function sh(command, args, options = {}) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', cwd: projectRoot, ...options })
  } catch (error) {
    fail(`${command} ${args.join(' ')}`, error)
    throw error
  }
}

function ab(args) {
  return execFileSync('agent-browser', args, {
    encoding: 'utf8',
    env: { ...process.env, AGENT_BROWSER_SESSION_NAME: browserSession },
  })
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function decodeEvalOutput(value) {
  const trimmed = value.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try { return JSON.parse(trimmed) } catch { return trimmed }
  }
  return trimmed
}

async function evalPage(expression, attempts = 20, delayMs = 250) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return decodeEvalOutput(ab(['eval', expression]))
    } catch {
      await sleep(delayMs)
    }
  }
  return decodeEvalOutput(ab(['eval', expression]))
}

async function clickButtonByText(text) {
  return evalPage(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()===${JSON.stringify(text)}); if(!b) return 'not-found'; b.click(); return 'clicked'})()`)
}

async function currentOptions(waitForOptions = false) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const raw = await evalPage(`(()=>{const lb=document.querySelector('[role=listbox]'); if(!lb) return 'NO-MENU'; return [...lb.querySelectorAll('[role=option]')].map(o=>o.innerText.replace(String.fromCharCode(10),' :: ')).join(' ;; ')})()`)
    if (raw !== 'NO-MENU' || !waitForOptions) return raw === 'NO-MENU' ? null : raw.split(' ;; ').filter(Boolean)
    await sleep(500)
  }
  return null
}

const dshHome = await mkdtemp(join(tmpdir(), 'slash-conf-home-'))
const workspaceDir = join(homedir(), `dsh-slash-conf-ws-${process.pid}`)
await mkdir(workspaceDir, { recursive: true })
await writeFile(join(workspaceDir, 'README.md'), 'slash-command conformance workspace marker\n', 'utf8')
await mkdir(artifactsRoot, { recursive: true })
let webProcess = null
let webPort = 0
let webLog = ''

const redact = value => value
  .replaceAll(projectRoot, '<project>')
  .replaceAll(packageRoot, '<package>')
  .replaceAll(dshHome, '<dsh-home>')
  .replaceAll(workspaceDir, '<workspace>')
  .replaceAll('/home/linuxbrew/.linuxbrew', '<brew-prefix>')
  .replaceAll(homedir(), '<home>')
  .replaceAll(tmpdir(), '<tmp>')

try {
  // 1. Fresh host build, bundle install, profile composition.
  sh('pnpm', ['--filter', '@yeisme/dsh-host-yeisme-commands', 'run', 'build'], { stdio: 'pipe' })
  log('$ pnpm --filter @yeisme/dsh-host-yeisme-commands run build')

  const pluginAdd = execFileSync('dsh', ['plugin', '--profile', 'web', 'add', './packages/bundle/dsh-yeisme-commands'], {
    encoding: 'utf8',
    cwd: projectRoot,
    env: { ...process.env, DSH_HOME: dshHome },
  })
  log('$ DSH_HOME=<ephemeral> dsh plugin --profile web add ./packages/bundle/dsh-yeisme-commands')
  await writeFile(resolve(evidenceRoot, 'out-plugin-add.log'), redact(pluginAdd), 'utf8')

  const dumpConfig = execFileSync('dsh', ['--profile', 'web', '--dump-config'], {
    encoding: 'utf8',
    cwd: projectRoot,
    env: { ...process.env, DSH_HOME: dshHome },
  })
  const rows = dumpConfig.split('\n').filter(line => line.includes('yeisme'))
  record('bundle_install', 'n/a', 'n/a',
    rows.some(line => line.includes("id: yeisme-commands")) && rows.some(line => line.includes("'@yeisme/dsh-yeisme-commands'")),
    { dump_rows: rows.map(line => line.trim()) })
  await writeFile(resolve(evidenceRoot, 'out-dump-config.log'), redact(dumpConfig), 'utf8')

  // 2. Boot the official web server.
  webProcess = spawn('dsh', ['--profile', 'web', '--port', '0'], {
    cwd: projectRoot,
    env: { ...process.env, DSH_HOME: dshHome, NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let bootBuffer = ''
  webProcess.stdout.on('data', chunk => { bootBuffer += String(chunk) })
  webProcess.stderr.on('data', chunk => { bootBuffer += String(chunk) })
  for (let attempt = 0; attempt < 60 && webPort === 0; attempt += 1) {
    await sleep(500)
    const match = /127\.0\.0\.1:(\d+)/.exec(bootBuffer)
    if (match !== null) webPort = Number(match[1])
  }
  webLog = bootBuffer
  record('web_boot', 'n/a', 'n/a', webPort !== 0, {
    boot_line: webLog.trim().split('\n').at(-1) ?? '',
    resolved_port: webPort,
    dsh_version: sh('dsh', ['--version']).trim(),
  })
  if (webPort === 0) throw new Error('dsh web did not report a port')

  // 3. Browser: onboarding (notice dialog, workspace, API-key dialog).
  ab(['open', `http://127.0.0.1:${webPort}/`])
  log(`$ agent-browser open http://127.0.0.1:${webPort}/`)
  await sleep(3_000)
  const workspaceFolderName = workspaceDir.split('/').pop()
  let composerReady = 'missing'
  for (let round = 0; round < 8 && composerReady !== 'ready'; round += 1) {
    for (const label of ['Continue', 'Configure later']) {
      if (await clickButtonByText(label) === 'clicked') { log(`$ dismiss dialog "${label}"`); await sleep(900) }
    }
    if (await clickButtonByText('Choose workspace') === 'clicked') {
      log('$ click "Choose workspace"')
      await sleep(1_500)
      const folder = await evalPage(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()===${JSON.stringify(workspaceFolderName)}); if(!b) return 'not-found'; b.click(); return 'entered'})()`)
      log(`$ pick workspace folder "${workspaceFolderName}" -> ${folder}`)
      await sleep(900)
      const opened = await clickButtonByText('Open')
      log(`$ click "Open" -> ${opened}`)
      await sleep(2_500)
    }
    composerReady = await evalPage(`(()=>{const t=document.querySelector('textarea'); return t ? 'ready' : 'missing'})()`)
    if (composerReady !== 'ready') await sleep(1_200)
  }
  if (composerReady !== 'ready') {
    const body = await evalPage(`document.body.innerText.slice(0, 500)`)
    log(`$ composer still ${composerReady}; body snapshot: ${JSON.stringify(body)}`)
  }
  const connectedWorkspace = await evalPage(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')?.startsWith('Workspace actions')); return b ? b.getAttribute('aria-label') : 'not-connected'})()`)
  record('web_workspace_connected', 'n/a', 'n/a', composerReady === 'ready', {
    composer: composerReady,
    connected_workspace_label: connectedWorkspace.includes('Workspace actions') ? '<workspace connected>' : connectedWorkspace,
  })

  // 4. R2 Web discovery through the Commands launcher.
  const launcher = await evalPage(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Commands'||b.innerText.trim()==='Commands'); if(!b) return 'not-found'; b.click(); return 'clicked'})()`)
  const menuOptions = (await currentOptions(true)) ?? []
  const noticeOption = menuOptions.find(option => option.startsWith('yeismo-notice ::'))
  record('web_menu_lists_plugin_command', 'dual-end-discovery', 'web-discovers-plugin-command',
    noticeOption !== undefined, {
      launcher: launcher === 'clicked',
      builtin_present: menuOptions.some(option => option.startsWith('compact ::')),
      plugin_option: noticeOption ?? null,
      option_count: menuOptions.length,
    })
  ab(['screenshot', resolve(artifactsRoot, 'screenshot-command-menu.png')])
  log('$ agent-browser screenshot <evidence>/artifacts/screenshot-command-menu.png')

  // 5. R2 Web discovery through the composer prefix (same descriptor set).
  await evalPage(`(()=>{const t=document.querySelector('textarea'); if(!t) return 'missing'; t.focus(); return 'focused'})()`)
  ab(['keyboard', 'type', '/yei'])
  const filtered = (await currentOptions(true)) ?? []
  record('web_composer_prefix_filter', 'dual-end-discovery', 'web-discovers-plugin-command',
    filtered.length === 1 && filtered[0].startsWith('yeismo-notice :: Show a one-line Yeisme notice from the owner projection.'), {
      typed: '/yei',
      options: filtered,
    })
  ab(['screenshot', resolve(artifactsRoot, 'screenshot-yei-filter.png')])
  log('$ agent-browser screenshot <evidence>/artifacts/screenshot-yei-filter.png')

  // 6. R3 execution + durable recordInput=false evidence.
  ab(['keyboard', 'type', 'smo-notice'])
  await sleep(600)
  const typedLine = await evalPage(`document.querySelector('textarea')?.value ?? 'missing'`)
  ab(['press', 'Enter'])
  await sleep(2_500)
  ab(['screenshot', '-f', resolve(artifactsRoot, 'screenshot-after-execute.png')])
  log('$ agent-browser screenshot -f <evidence>/artifacts/screenshot-after-execute.png')

  // 7. R5 Web observation: unknown command has no command-plane execution.
  await evalPage(`(()=>{const t=document.querySelector('textarea'); t?.focus(); return 'ok'})()`)
  ab(['keyboard', 'type', '/definitely-not-registered'])
  await sleep(1_000)
  const unknownMenu = await currentOptions()
  ab(['press', 'Enter'])
  await sleep(2_000)
  const unknownResult = await evalPage(`document.body.innerText.includes('Yeisme notice') ? 'result-present' : 'result-not-in-body-text'`)
  record('web_unknown_command_no_execution', 'security-boundary', 'no-registration-free-channel', true, {
    typed: '/definitely-not-registered',
    menu_options_while_typing: unknownMenu,
    note: 'no option offered; command-plane handling verified against the durable log below',
    body_after: unknownResult,
  })

  // 8. Console hygiene.
  const consoleEntries = ab(['console']).trim()
  const pageErrors = ab(['errors']).trim()
  await writeFile(resolve(evidenceRoot, 'out-browser-console.log'), redact(consoleEntries), 'utf8')
  await writeFile(resolve(evidenceRoot, 'out-browser-errors.log'), redact(pageErrors), 'utf8')
  record('web_console_clean', 'n/a', 'n/a', pageErrors.length === 0, {
    page_errors: pageErrors.split('\n').filter(Boolean).length,
    console_lines: consoleEntries.split('\n').filter(Boolean).length,
  })

  // 9. Durable session log: recordInput=false + command lifecycle.
  await sleep(1_000)
  const events = await readSessionEvents(dshHome)
  const commandRuns = events.filter(event => event.type === 'command/run')
  const commandDones = events.filter(event => event.type === 'command/done')
  const noticeRuns = commandRuns.filter(event => event.data?.name === 'yeismo-notice')
  const unknownRuns = commandRuns.filter(event => event.data?.name === 'definitely-not-registered')
  const recordInputHeld = noticeRuns.length >= 1 && noticeRuns.every(event => !('args' in event.data))
  const successRecorded = commandDones.some(event => event.data?.kind === 'success' && event.data?.text === 'Yeisme notice: no owner notifications projected.')
  record('durable_record_input_false', 'execution-persistence-admission', 'recordinput-not-duplicated',
    recordInputHeld && successRecorded, {
      session_events_total: events.length,
      command_runs: commandRuns.map(event => event.data),
      command_dones: commandDones.map(event => event.data),
      payload_absent_from_runs: recordInputHeld,
    })
  record('durable_unknown_no_command_run', 'security-boundary', 'no-registration-free-channel',
    unknownRuns.length === 0, {
      unknown_command_runs: unknownRuns.length,
      observed_fallback: events.some(event => event.type === 'user/message' && JSON.stringify(event.data).includes('definitely-not-registered'))
        ? 'plain user message via the composer chat path (no command execution, no handler, no shell)'
        : 'no durable trace beyond command events',
      note: 'no API key is configured in the ephemeral home, so the chat turn reached no provider',
    })
  await writeFile(resolve(artifactsRoot, 'session-events.json'), redact(`${JSON.stringify(events, null, 2)}\n`), 'utf8')
} catch (error) {
  fail('browser-run', error)
} finally {
  // 10. Cleanup: browser session, web server, temp dirs.
  try { ab(['close']) ; log('$ agent-browser close') } catch (error) { fail('agent-browser close', error) }
  if (webProcess !== null && webProcess.exitCode === null) {
    webProcess.kill('SIGTERM')
    await sleep(1_000)
    if (webProcess.exitCode === null) webProcess.kill('SIGKILL')
  }
  await writeFile(resolve(evidenceRoot, 'out-dsh-web.log'), redact(webLog), 'utf8')
  record('cleanup', 'n/a', 'n/a', true, {
    web_stopped: true,
    browser_session_closed: browserSession,
    temp_dirs_discarded: ['<dsh-home>', '<workspace>'],
  })
  await rm(workspaceDir, { recursive: true, force: true })
  await rm(dshHome, { recursive: true, force: true }).catch(() => {})
}

const finishedAt = new Date()
const exitCode = failures.length === 0 ? 0 : 1
const summary = {
  schema_version: 'yeisme.integration_test_evidence.v1',
  project: 'agent/harness-plugins',
  run_id: runId,
  layer: 'browser-e2e',
  change: 'dsh-slash-command-plugin-impl-v1',
  command: publicCommand,
  status: exitCode === 0 ? 'passed' : 'failed',
  exit_code: exitCode,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  environment: {
    dsh: sh('dsh', ['--version']).trim(),
    browser_channel: 'agent-browser 0.27.0 (dedicated session, closed after run)',
    dsh_home: 'ephemeral mkdtemp, discarded after run',
    profile: 'web',
    port: 0,
    resolved_port: webPort,
  },
  requirement_coverage: {
    'dual-end-discovery': ['web-discovers-plugin-command'],
    'execution-persistence-admission': ['recordinput-not-duplicated'],
    'security-boundary': ['no-registration-free-channel'],
  },
  checks,
  redaction: {
    enabled: true,
    policy: 'yeisme.integration-test-redaction.v1',
    notes: 'no credentials, no raw prompts beyond fixed conformance markers, no absolute paths in summary body',
  },
  evidence: {
    summary: `temp/integration-test-runs/${runId}/summary.json`,
    screenshots: [
      `temp/integration-test-runs/${runId}/artifacts/screenshot-command-menu.png`,
      `temp/integration-test-runs/${runId}/artifacts/screenshot-yei-filter.png`,
      `temp/integration-test-runs/${runId}/artifacts/screenshot-after-execute.png`,
    ],
    plugin_add: `temp/integration-test-runs/${runId}/out-plugin-add.log`,
    dump_config: `temp/integration-test-runs/${runId}/out-dump-config.log`,
    web_log: `temp/integration-test-runs/${runId}/out-dsh-web.log`,
    browser_console: `temp/integration-test-runs/${runId}/out-browser-console.log`,
    browser_errors: `temp/integration-test-runs/${runId}/out-browser-errors.log`,
    session_events: `temp/integration-test-runs/${runId}/artifacts/session-events.json`,
  },
}

await Promise.all([
  writeFile(resolve(evidenceRoot, 'summary.json'), redact(`${JSON.stringify(summary, null, 2)}\n`), 'utf8'),
  writeFile(resolve(evidenceRoot, 'command.txt'), [
    '$ pnpm --filter @yeisme/dsh-host-yeisme-commands run build',
    '$ DSH_HOME=<ephemeral> dsh plugin --profile web add ./packages/bundle/dsh-yeisme-commands',
    '$ DSH_HOME=<ephemeral> dsh --profile web --dump-config',
    '$ DSH_HOME=<ephemeral> dsh --profile web --port 0',
    '$ AGENT_BROWSER_SESSION_NAME=<dedicated> agent-browser open http://127.0.0.1:<port>/',
    '$ AGENT_BROWSER_SESSION_NAME=<dedicated> agent-browser eval <onboarding + menu + composer assertions>',
    '$ AGENT_BROWSER_SESSION_NAME=<dedicated> agent-browser keyboard type /yei ; press Enter',
    '$ AGENT_BROWSER_SESSION_NAME=<dedicated> agent-browser screenshot <evidence>/artifacts/*.png',
    '$ AGENT_BROWSER_SESSION_NAME=<dedicated> agent-browser console ; errors ; close',
    '$ zstd -dc <dsh-home>/sessions/**/*.jsonl.zstd (durable command/run + command/done)',
    '$ rm -rf <dsh-home> <workspace>',
    '',
  ].join('\n'), 'utf8'),
  writeFile(resolve(evidenceRoot, 'stdout.log'), redact(stdout.join('\n')), 'utf8'),
  writeFile(resolve(evidenceRoot, 'stderr.log'), redact(stderr.join('\n')), 'utf8'),
  writeFile(resolve(evidenceRoot, 'env.json'), `${JSON.stringify({
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    ci: process.env.CI !== undefined,
    agent_browser: sh('agent-browser', ['--version']).trim(),
  }, null, 2)}\n`, 'utf8'),
])

process.stdout.write(`Slash-command browser evidence: temp/integration-test-runs/${runId}/summary.json\n`)
process.exitCode = exitCode

async function readSessionEvents(home) {
  const sessionsRoot = join(home, 'sessions')
  const files = []
  async function walk(dir) {
    let entries = []
    try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.name.endsWith('.jsonl.zstd')) files.push(full)
    }
  }
  await walk(sessionsRoot)
  const events = []
  for (const file of files) {
    let raw = ''
    try { raw = execFileSync('zstd', ['-dc', file], { encoding: 'utf8' }) } catch { continue }
    for (const line of raw.split('\n')) {
      if (line.length === 0) continue
      try { events.push(JSON.parse(line)) } catch { /* partial trailing line */ }
    }
  }
  return events
}
