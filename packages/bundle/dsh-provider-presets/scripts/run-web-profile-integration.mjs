#!/usr/bin/env node
// dsh-provider-presets-v1 task 4.1 integration runner: disposable DSH web
// profile flow for the @yeisme/dsh-provider-presets bundle.
//
// One phase against the installed `dsh` (0.1.2-rc.1+: ships the
// settings.models.footer slot and the remote.settings/credentials/llm
// namespaces), all with an ephemeral DSH_HOME that is removed afterwards:
//
//   install (packed tarballs) -> dump-config composition -> boot -> onboarding
//   -> open Settings > Models -> the preset market renders in the footer
//   -> guided add against a local OpenAI-compatible echo provider
//      (custom card: baseURL -> fake key -> fetch models -> save)
//   -> on-disk assertions: settings.yaml route + .credentials.yaml ref
//   -> "Set as default" writes agent-default-model
//   -> uninstall (user-layer settings retained).
//
// Evidence: temp/integration-test-runs/<run-id>/{summary.json,command.txt,
// stdout.log,stderr.log,env.json,artifacts/} (redacted; the only key material
// is the local echo key 'local-evidence-echo', which guards nothing).
import { execFileSync, spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { copyFile as fsCopy, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(packageRoot, '../../..')
const startedAt = new Date()
const runId = `${startedAt.toISOString().replaceAll(':', '-').replaceAll('.', '-')}-${process.pid}-provider-presets-web-profile`
const evidenceRoot = resolve(projectRoot, 'temp/integration-test-runs', runId)
const artifactsRoot = resolve(evidenceRoot, 'artifacts')
const publicCommand = 'pnpm --filter @yeisme/dsh-provider-presets run test:integration'
const workspaceDir = join(homedir(), `dsh-presets-ws-${process.pid}`)
const echoKeyValue = 'local-evidence-echo'

const checks = []
const failures = []
const stdoutLines = []
const stderrLines = []
let redactions = []

function log(line) {
  stdoutLines.push(line)
  process.stdout.write(`${line}\n`)
}
function warn(line) {
  stderrLines.push(line)
  process.stderr.write(`${line}\n`)
}
function fail(stage, error) {
  failures.push(stage)
  warn(`${stage}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`)
}
function record(stage, passed, observed) {
  checks.push({ stage, passed, observed })
  log(`[${passed ? 'PASS' : 'FAIL'}] ${stage}: ${JSON.stringify(observed)}`)
}
function gate(command, exitCode, detail) {
  log(`[gate ${exitCode === 0 ? 'ok' : 'fail'}] ${command} -> ${detail}`)
  return { command, exitCode, detail }
}
function sh(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', cwd: options.cwd ?? projectRoot, env: options.env })
}
function ab(args, sessionName) {
  return execFileSync('agent-browser', args, {
    encoding: 'utf8',
    env: { ...process.env, AGENT_BROWSER_SESSION_NAME: sessionName },
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
async function evalPage(expression, sessionName, attempts = 20, delayMs = 250) {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return decodeEvalOutput(ab(['eval', expression], sessionName))
    } catch (error) {
      lastError = error
      await sleep(delayMs)
    }
  }
  throw lastError ?? new Error(`agent-browser eval failed: ${expression.slice(0, 80)}`)
}
async function clickButtonByText(text, sessionName) {
  return evalPage(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === ${JSON.stringify(text)}); if (!b) return 'not-found'; b.click(); return 'clicked' })()`, sessionName)
}
function redact(value) {
  let out = String(value)
  for (const [needle, token] of redactions) out = out.replaceAll(needle, token)
  return out
}

async function buildOwnedPackages() {
  const gates = []
  for (const pkg of ['@yeisme/dsh-client-ui-provider-presets', '@yeisme/dsh-provider-presets']) {
    try {
      execFileSync('pnpm', ['--filter', pkg, 'run', 'build'], { encoding: 'utf8', cwd: projectRoot, stdio: 'pipe' })
      gates.push(gate(`pnpm --filter ${pkg} run build`, 0, 'clean build'))
    } catch (error) {
      gates.push(gate(`pnpm --filter ${pkg} run build`, error.status ?? 1, String(error.stderr ?? error.message).slice(0, 300)))
    }
  }
  return gates
}

async function packOwnedPackages(packRoot) {
  const sourceRoot = join(packRoot, 'source')
  const runtimeRoot = join(packRoot, 'runtime')
  const stagingRoot = join(packRoot, 'bundle-staging')
  for (const dir of [sourceRoot, runtimeRoot, stagingRoot]) await mkdir(dir, { recursive: true })
  const packageDirs = [
    resolve(projectRoot, 'packages/client/ui-visual-kit'),
    resolve(projectRoot, 'packages/client/ui-surface'),
    resolve(projectRoot, 'packages/client/ui-provider-presets'),
    resolve(projectRoot, 'packages/bundle/dsh-provider-presets'),
  ]
  for (const cwd of packageDirs) {
    execFileSync('pnpm', ['pack', '--pack-destination', sourceRoot], { encoding: 'utf8', cwd, stdio: 'pipe' })
  }
  const tarballs = (await readdir(sourceRoot)).filter(name => name.endsWith('.tgz'))
  const pick = marker => {
    const name = tarballs.find(candidate => candidate.includes(marker))
    if (name === undefined) throw new Error(`packed artifact missing: ${marker}`)
    return join(sourceRoot, name)
  }
  // pnpm 不会用同批 add 的 sibling tarball 解析未发布包的 registry dependency：
  // @yeisme/dsh-client-ui-visual-kit / -surface / -provider-presets 均未发布，
  // 需自底向上把 workspace 依赖逐层改写为 file: tarball 后重新 pack
  //（一次性 runtime manifest 由本运行器生成，产品 package.json 保持发布形态）。
  const useOutDir = async (sourceTarball, outName, rewrite) => {
    // 每层产物写独立目录，避免 pick 错层。
    const outDir = join(packRoot, 'runtime', outName)
    await mkdir(outDir, { recursive: true })
    const stage = join(stagingRoot, outName)
    await mkdir(stage, { recursive: true })
    execFileSync('tar', ['-xzf', sourceTarball, '-C', stage, '--strip-components', '1'], { encoding: 'utf8', stdio: 'pipe' })
    const manifestPath = join(stage, 'package.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    rewrite(manifest)
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    execFileSync('pnpm', ['pack', '--pack-destination', outDir], { encoding: 'utf8', cwd: stage, stdio: 'pipe' })
    const produced = (await readdir(outDir)).filter(name => name.endsWith('.tgz'))
    if (produced.length !== 1 || produced[0] === undefined) {
      throw new Error(`expected one staged tarball for ${outName}, found ${produced.length}`)
    }
    return join(outDir, produced[0])
  }
  const visualKitTarball = pick('dsh-client-ui-visual-kit-')
  const surfaceTarball = await useOutDir(pick('dsh-client-ui-surface-'), 'surface', manifest => {
    manifest.dependencies = {
      ...manifest.dependencies,
      '@yeisme/dsh-client-ui-visual-kit': `file:${visualKitTarball}`,
    }
  })
  const clientTarball = await useOutDir(pick('dsh-client-ui-provider-presets-'), 'client', manifest => {
    manifest.dependencies = {
      ...manifest.dependencies,
      '@yeisme/dsh-client-ui-surface': `file:${surfaceTarball}`,
      '@yeisme/dsh-client-ui-visual-kit': `file:${visualKitTarball}`,
    }
  })
  return useOutDir(pick('yeisme-dsh-provider-presets-'), 'bundle', manifest => {
    manifest.dependencies = {
      ...manifest.dependencies,
      '@yeisme/dsh-client-ui-provider-presets': `file:${clientTarball}`,
    }
  })
}

function pluginAdd(dshHome, packageSpec) {
  return execFileSync('dsh', ['plugin', '--profile', 'web', 'add', packageSpec], {
    encoding: 'utf8',
    cwd: projectRoot,
    env: { ...process.env, DSH_HOME: dshHome },
  })
}
function pluginRemove(dshHome) {
  return execFileSync('dsh', ['plugin', '--profile', 'web', 'remove', '@yeisme/dsh-provider-presets'], {
    encoding: 'utf8',
    cwd: projectRoot,
    env: { ...process.env, DSH_HOME: dshHome },
  })
}
function dumpConfig(dshHome) {
  return execFileSync('dsh', ['--profile', 'web', '--dump-config'], {
    encoding: 'utf8',
    cwd: projectRoot,
    env: { ...process.env, DSH_HOME: dshHome },
  })
}
async function bootWeb(dshHome, logFile) {
  const webProcess = spawn('dsh', ['--profile', 'web', '--port', '0'], {
    cwd: projectRoot,
    env: { ...process.env, DSH_HOME: dshHome, NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let bootBuffer = ''
  webProcess.stdout.on('data', chunk => { bootBuffer += String(chunk) })
  webProcess.stderr.on('data', chunk => { bootBuffer += String(chunk) })
  let webUrl = ''
  for (let attempt = 0; attempt < 90 && webUrl === ''; attempt += 1) {
    await sleep(500)
    const match = /https?:\/\/127\.0\.0\.1:\d+\/?\S*/.exec(bootBuffer)
    if (match !== null) webUrl = match[0]
  }
  await writeFile(logFile, redact(bootBuffer), 'utf8')
  return { webProcess, webUrl, webPort: webUrl === '' ? 0 : Number(/:(\d+)/.exec(webUrl)?.[1] ?? 0), bootBuffer }
}

/** 本地 OpenAI 兼容 echo provider（GET /models + chat completions；无第三方凭据）。 */
function startEchoProvider() {
  const server = createServer((req, res) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      if (req.method === 'GET' && String(req.url).endsWith('/models')) {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({
          object: 'list',
          data: [
            { id: 'preset-echo-small' },
            { id: 'preset-echo-large', context_window: 131072, max_output_tokens: 16384 },
          ],
        }))
        return
      }
      let stream = false
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        stream = body.stream === true
      } catch { stream = false }
      const reply = 'echo: provider-presets integration'
      if (stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        res.write(`data: ${JSON.stringify({ id: 'echo', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: reply }, finish_reason: null }] })}\n\n`)
        res.write(`data: ${JSON.stringify({ id: 'echo', object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`)
        res.end('data: [DONE]\n\n')
      } else {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ id: 'echo', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }] }))
      }
    })
  })
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ port: server.address().port, close: () => server.close() })
    })
  })
}

async function stopWeb(webProcess) {
  if (webProcess === null || webProcess === undefined || webProcess.exitCode !== null) return
  webProcess.kill('SIGTERM')
  await sleep(1_000)
  if (webProcess.exitCode === null) webProcess.kill('SIGKILL')
}

/**
 * 打开页面，dismiss 内部测试提示后直达 Settings > Models（渠道市场不依赖
 * workspace/composer——无工作区即渲染）。
 */
async function browserOpenToModels(sessionName, webUrl, label) {
  ab(['open', webUrl], sessionName)
  log(`$ ${label}: agent-browser open ${webUrl.replace(/token=\S+/, 'token=<redacted>')}`)
  await sleep(4_000)
  for (const dialogLabel of ['Continue', 'Configure later', 'Skip']) {
    if (await clickButtonByText(dialogLabel, sessionName) === 'clicked') { log(`$ ${label}: dismiss dialog "${dialogLabel}"`); await sleep(900) }
  }
  return openSettingsModels(sessionName)
}

/** 打开 Settings 对话框并进入 Models 分节（zh/en 双语选择器）。 */
async function openSettingsModels(sessionName) {
  const settingsOpened = await evalPage(`(() => {
    const b = [...document.querySelectorAll('button')].find(b => /settings|设置/i.test([b.getAttribute('aria-label'), b.innerText].filter(Boolean).join(' ')) && b.offsetWidth > 0)
    if (!b) return 'no-settings-button'
    b.click()
    return 'clicked'
  })()`, sessionName)
  if (settingsOpened !== 'clicked') return { settingsOpened }
  await sleep(1_200)
  const modelsClicked = await evalPage(`(() => {
    const item = [...document.querySelectorAll('button,[role=tab],[role=menuitem],[role=option]')].find(el => /^(Models|模型)$/.test((el.textContent ?? '').trim()))
    if (!item) return 'models-nav-not-found'
    item.click()
    return 'clicked'
  })()`, sessionName)
  await sleep(1_500)
  return { settingsOpened, modelsClicked }
}

async function setInputValue(selector, value, sessionName) {
  return evalPage(`(() => {
    const input = ${selector}
    if (!input) return 'no-input'
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, ${JSON.stringify(value)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return 'typed'
  })()`, sessionName)
}

// ---------------------------------------------------------------------------
async function main() {
  const gates = []
  await mkdir(artifactsRoot, { recursive: true })
  await mkdir(workspaceDir, { recursive: true })
  await writeFile(join(workspaceDir, 'README.md'), 'provider-presets integration workspace marker\n', 'utf8')

  const dshHome = await mkdtemp(join(tmpdir(), 'dsh-presets-home-'))
  const packRoot = await mkdtemp(join(tmpdir(), 'dsh-presets-pack-'))
  redactions = [
    [projectRoot, '<project>'],
    [packageRoot, '<bundle>'],
    [dshHome, '<dsh-home>'],
    [packRoot, '<pack-root>'],
    [workspaceDir, '<workspace>'],
    ['/home/linuxbrew/.linuxbrew', '<brew-prefix>'],
    [homedir(), '<home>'],
    [tmpdir(), '<tmp>'],
  ]

  gates.push(...await buildOwnedPackages())
  let packageSpec = ''
  try {
    packageSpec = await packOwnedPackages(packRoot)
    gates.push(gate('pnpm pack (client + bundle)', 0, 'registry-shaped tarballs + local dependency resolver'))
  } catch (error) {
    fail('pack-owned-packages', error)
    gates.push(gate('pnpm pack (client + bundle)', 1, error instanceof Error ? error.message : String(error)))
  }

  let webProcess = null
  let echoProvider = null
  const browser = `dsh_presets_${process.pid}`
  try {
    const dshVersion = sh('dsh', ['--version']).trim()
    log(`$ dsh ${dshVersion}`)
    const anchorOk = /0\.1\.[2-9]/.test(dshVersion)
    record('runtime_anchor', anchorOk, { dsh: dshVersion, need: '>=0.1.2-rc.1 (footer slot + remote namespaces)' })

    const addOut = pluginAdd(dshHome, packageSpec)
    await writeFile(resolve(evidenceRoot, 'out-plugin-add.log'), redact(addOut), 'utf8')
    const dump = dumpConfig(dshHome)
    await writeFile(resolve(evidenceRoot, 'out-dump-config.log'), redact(dump), 'utf8')
    const rows = dump.split('\n').filter(line => line.includes('id: dsh-provider-presets'))
    record('install_composition', rows.length === 1, { rows: rows.map(line => line.trim()) })

    echoProvider = await startEchoProvider()
    const echo = echoProvider
    const boot = await bootWeb(dshHome, resolve(evidenceRoot, 'out-dsh-web.log'))
    webProcess = boot.webProcess
    record('web_boot', boot.webPort !== 0, { resolved_port: boot.webPort })
    if (boot.webPort === 0) throw new Error('dsh web did not report a port')

    const settings = await browserOpenToModels(browser, boot.webUrl, 'flow')
    record('settings_models_opened', settings.settingsOpened === 'clicked' && settings.modelsClicked === 'clicked', settings)
    if (settings.settingsOpened !== 'clicked' || settings.modelsClicked !== 'clicked') throw new Error('did not reach the Models settings section')
    ab(['screenshot', resolve(artifactsRoot, 'models-page.png')], browser)

    const marketVisible = await evalPage(`(() => {
      const root = document.querySelector('[data-provider-presets="section"]')
      if (!root) return 'absent'
      return root.innerText.slice(0, 200)
    })()`, browser)
    record('preset_market_rendered', String(marketVisible) !== 'absent' && /渠道市场|Provider presets/.test(String(marketVisible)), {
      section_text: String(marketVisible).slice(0, 120),
    })

    const dialogOpened = await evalPage(`(() => {
      const card = [...document.querySelectorAll('[data-provider-presets] .pp-card')].find(c => /自定义 OpenAI 兼容|Custom OpenAI-compatible/.test(c.textContent ?? ''))
      if (!card) return 'card-not-found'
      card.click()
      return 'clicked'
    })()`, browser)
    await sleep(900)
    record('custom_card_dialog_opened', dialogOpened === 'clicked', { clicked: dialogOpened })

    const baseUrlTyped = await setInputValue(`document.querySelector('[data-provider-presets] input#pp-base-url')`, `http://127.0.0.1:${echo.port}/v1`, browser)
    const keyTyped = await setInputValue(`document.querySelector('[data-provider-presets] input#pp-api-key')`, echoKeyValue, browser)
    record('dialog_fields_filled', baseUrlTyped === 'typed' && keyTyped === 'typed', { baseURL: baseUrlTyped, apiKey: keyTyped })

    const fetched = await evalPage(`(() => {
      const b = [...document.querySelectorAll('[data-provider-presets] button')].find(b => /拉取模型|Fetch models/.test(b.textContent ?? ''))
      if (!b) return 'no-fetch-button'
      b.click()
      return 'clicked'
    })()`, browser)
    await sleep(2_500)
    const modelListed = await evalPage(`(() => document.body.innerText.includes('preset-echo-small') ? 'listed' : 'missing')()`, browser)
    record('models_fetched_from_endpoint', fetched === 'clicked' && modelListed === 'listed', { fetch: fetched, models: modelListed })
    ab(['screenshot', resolve(artifactsRoot, 'dialog-fetched.png')], browser)

    const saved = await evalPage(`(() => {
      const b = [...document.querySelectorAll('[data-provider-presets] button')].find(b => /保存渠道|Save provider/.test(b.textContent ?? ''))
      if (!b) return 'no-save-button'
      b.click()
      return 'clicked'
    })()`, browser)
    await sleep(2_500)
    const dialogClosed = await evalPage(`(() => (document.querySelector('[data-provider-presets="dialog"]') ? 'open' : 'closed'))()`, browser)
    record('provider_saved', saved === 'clicked' && dialogClosed === 'closed', { save: saved, dialog: dialogClosed })
    ab(['screenshot', resolve(artifactsRoot, 'after-save.png')], browser)

    // on-disk assertions in the ephemeral home
    const settingsYaml = await readFile(join(dshHome, 'settings.yaml'), 'utf8').catch(() => '')
    const credentialsYaml = await readFile(join(dshHome, '.credentials.yaml'), 'utf8').catch(() => '')
    const routeSaved = /custom-openai:/.test(settingsYaml) && /preset-echo-small/.test(settingsYaml)
    const refSaved = /CUSTOM_API_KEY:/.test(credentialsYaml)
    record('settings_yaml_route_written', routeSaved, {
      route_present: /custom-openai:/.test(settingsYaml),
      model_present: /preset-echo-small/.test(settingsYaml),
    })
    record('credentials_ref_written', refSaved, { ref_present: refSaved })

    const modelsRow = await evalPage(`(() => document.body.innerText.includes('custom-openai') ? 'visible' : 'absent')()`, browser)
    record('models_page_row_visible', modelsRow === 'visible', { row: modelsRow })

    const setDefault = await evalPage(`(() => {
      const b = [...document.querySelectorAll('[data-provider-presets] button')].find(b => /设为默认|Set as default/.test(b.textContent ?? '') && !b.disabled)
      if (!b) return 'no-button'
      b.click()
      return 'clicked'
    })()`, browser)
    await sleep(2_000)
    const settingsYaml2 = await readFile(join(dshHome, 'settings.yaml'), 'utf8').catch(() => '')
    const defaultWritten = /agent-default-model:/.test(settingsYaml2) && /provider: custom-openai/.test(settingsYaml2)
    record('default_model_written', setDefault === 'clicked' && defaultWritten, { clicked: setDefault, written: defaultWritten })
    ab(['screenshot', resolve(artifactsRoot, 'default-set.png')], browser)

    // uninstall: row removed, user-layer settings retained in DSH_HOME
    await stopWeb(webProcess); webProcess = null
    const removeOut = pluginRemove(dshHome)
    await writeFile(resolve(evidenceRoot, 'out-plugin-remove.log'), redact(removeOut), 'utf8')
    const dump2 = dumpConfig(dshHome)
    const rowsAfterRemove = dump2.split('\n').filter(line => line.includes('id: dsh-provider-presets'))
    const settingsRetained = await readFile(join(dshHome, 'settings.yaml'), 'utf8').catch(() => '')
    record('uninstall_retains_user_settings', rowsAfterRemove.length === 0 && /custom-openai:/.test(settingsRetained), {
      rows_after_remove: rowsAfterRemove.length,
      user_settings_retained: /custom-openai:/.test(settingsRetained),
    })
    gates.push(gate('dsh plugin --profile web add/remove', 0, 'composition installed, verified, removed'))
  } catch (error) {
    fail('phase-flow', error)
  } finally {
    try { ab(['close'], browser) } catch { }
    await stopWeb(webProcess)
    if (echoProvider !== null) echoProvider.close()
    // 落盘证据：脱敏后的 settings/credentials 形态（echo key 是本运行器生成的守门占位值）
    for (const name of ['settings.yaml', '.credentials.yaml']) {
      try {
        const text = await readFile(join(dshHome, name), 'utf8')
        await writeFile(resolve(artifactsRoot, name.replaceAll('.', '_') + '.txt'), redact(text), 'utf8')
      } catch { }
    }
    await rm(dshHome, { recursive: true, force: true }).catch(() => { })
  }

  await rm(workspaceDir, { recursive: true, force: true }).catch(() => { })
  await rm(packRoot, { recursive: true, force: true }).catch(() => { })

  const finishedAt = new Date()
  const passedCount = checks.filter(c => c.passed).length
  const status = failures.length === 0
    && checks.length > 0
    && checks.every(c => c.passed)
    && gates.every(g => g.exitCode === 0)
    ? 'passed'
    : 'failed'
  const summary = {
    schema_version: 'yeisme.integration_test_evidence.v1',
    project: 'agent/harness-plugins',
    run_id: runId,
    layer: 'browser-e2e',
    change: 'dsh-provider-presets-v1',
    scope: 'task 4.1 disposable web profile integration (install, market render, guided add via local echo provider, on-disk writes, default switch, uninstall retention)',
    status,
    exit_code: status === 'passed' ? 0 : 1,
    command: publicCommand,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - startedAt.getTime(),
    checks,
    gates,
    failures,
    evidence: {
      summary: relative(projectRoot, resolve(evidenceRoot, 'summary.json')),
      command: relative(projectRoot, resolve(evidenceRoot, 'command.txt')),
      stdout: relative(projectRoot, resolve(evidenceRoot, 'stdout.log')),
      stderr: relative(projectRoot, resolve(evidenceRoot, 'stderr.log')),
      env: relative(projectRoot, resolve(evidenceRoot, 'env.json')),
      artifacts: relative(projectRoot, artifactsRoot),
    },
    redaction: {
      enabled: true,
      policy: 'yeisme.integration-test-redaction.v1',
      notes: 'no real credentials, raw prompts, provider payloads, or absolute workspace/home paths persisted; the only key material is the local echo placeholder',
    },
  }
  const environment = {
    schemaVersion: 'harness-plugins.integration-env.v1',
    generatedAt: finishedAt.toISOString(),
    platform: process.platform,
    architecture: process.arch,
    nodeVersion: process.version,
    packageManager: 'pnpm',
    browserDriver: 'agent-browser',
    dshHome: 'ephemeral',
    externalCredentials: false,
    provider: 'local synthetic echo server',
  }
  await writeFile(resolve(evidenceRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  await writeFile(resolve(evidenceRoot, 'stdout.log'), redact(stdoutLines.join('\n')) + '\n', 'utf8')
  await writeFile(resolve(evidenceRoot, 'stderr.log'), redact(stderrLines.join('\n')) + '\n', 'utf8')
  await writeFile(resolve(evidenceRoot, 'command.txt'), `${publicCommand}\n`, 'utf8')
  await writeFile(resolve(evidenceRoot, 'env.json'), `${JSON.stringify(environment, null, 2)}\n`, 'utf8')
  log(`summary: ${passedCount}/${checks.length} checks passed; status=${status}`)
  return status === 'passed' ? 0 : 1
}

main()
  .then(code => process.exit(code))
  .catch(error => {
    fail('runner', error)
    process.exit(1)
  })
